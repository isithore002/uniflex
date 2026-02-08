import express from "express";
import cors from "cors";
import * as dotenv from "dotenv";
import path from "path";
import { ethers } from "ethers";
import { getAgentState, runAgentTick, refreshState, AgentState } from "./agent";
import { addLiquidity, removeLiquidity, getStrategyParams, LiquidityResult } from "./liquidity";
import { startMevListener, stopMevListener } from "./mev-listener";
import { getLastBridgeAttempt, getBridgeCooldownRemaining } from "./lifi";
import { injectVolatilitySpikes, resetVolatility, computeVolatility, getPriceHistory } from "./observe";
import { 
  getLiFiBridgeQuote, 
  executeSafeHarborEvacuation, 
  getEvacuationStatus,
  testEvacuationFlow,
  getExplorerUrl,
  getLiFiExplorerUrl,
  CHAIN_CONFIG
} from "./evacuate";

// Load environment variables - use absolute path
const envPath = path.resolve(__dirname, "../../.env");
dotenv.config({ path: envPath });

const app = express();
const PORT = process.env.AGENT_PORT || 3001;

// ═══════════════════════════════════════════════════════════════
// AUTONOMOUS MODE CONFIGURATION
// ═══════════════════════════════════════════════════════════════

const AUTO_MODE = process.env.AUTO_MODE === 'true';
const POLL_INTERVAL_MS = parseInt(process.env.POLL_INTERVAL_MS || '5000', 10);

// Tracking for autonomous loop
let lastCycleTime: string | null = null;
let cycleCount = 0;
let lastCycleSuccess = true;
let autonomousLoopRunning = false;
let autonomousCycleTimer: ReturnType<typeof setTimeout> | null = null;

// Middleware - Enable CORS for frontend
app.use(cors({
  origin: [
    'http://localhost:5173',
    'https://uniflex-buds.vercel.app',
    /\.vercel\.app$/ // Allow any Vercel preview deployments
  ],
  credentials: true
}));
app.use(express.json());

// ═══════════════════════════════════════════════════════════════
// SHARED PROVIDER INSTANCE (with retry support)
// ═══════════════════════════════════════════════════════════════

let sharedProvider: ethers.JsonRpcProvider | null = null;
let providerFailures = 0;
const MAX_PROVIDER_FAILURES = 5;

// Fallback RPCs for Unichain Sepolia
const UNICHAIN_RPCS = [
  process.env.SEPOLIA_RPC_URL || 'https://sepolia.unichain.org',
  'https://sepolia.unichain.org',
  'https://unichain-sepolia.drpc.org',
];

function getProvider(): ethers.JsonRpcProvider {
  // If too many failures, try next RPC
  if (sharedProvider && providerFailures >= MAX_PROVIDER_FAILURES) {
    console.log("⚠️  Too many RPC failures, rotating to next RPC...");
    sharedProvider = null;
    providerFailures = 0;
  }
  
  if (!sharedProvider) {
    const rpcUrl = UNICHAIN_RPCS[0];
    console.log(`🔌 Initializing RPC provider: ${rpcUrl.substring(0, 40)}...`);
    sharedProvider = new ethers.JsonRpcProvider(
      rpcUrl,
      {
        name: "unichain-sepolia",
        chainId: 1301
      },
      {
        staticNetwork: true,
        batchMaxCount: 1,
        polling: true,
        pollingInterval: 4000,
      }
    );

    // Handle provider errors (don't exit process)
    sharedProvider.on("error", (error) => {
      console.error("[Provider] Error event:", error.message);
      providerFailures++;
    });

    console.log("✅ Provider initialized");
  }
  return sharedProvider;
}

// ═══════════════════════════════════════════════════════════════
// HELPER: Get configured signer
// ═══════════════════════════════════════════════════════════════

function getSigner(): ethers.Wallet {
  const provider = getProvider();
  return new ethers.Wallet(process.env.PRIVATE_KEY!, provider);
}

function getTokenAddresses(): { token0: string; token1: string } {
  const tokenA = process.env.TOKEN_A_ADDRESS!;
  const tokenB = process.env.TOKEN_B_ADDRESS!;
  return tokenA.toLowerCase() < tokenB.toLowerCase()
    ? { token0: tokenA, token1: tokenB }
    : { token0: tokenB, token1: tokenA };
}

// ═══════════════════════════════════════════════════════════════
// API ROUTES
// ═══════════════════════════════════════════════════════════════

/**
 * GET /state
 * Returns current agent state (read-only, no execution)
 */
app.get("/state", async (_, res) => {
  try {
    const provider = getProvider();
    const state = await refreshState(provider);
    res.json({
      success: true,
      data: state,
      timestamp: new Date().toISOString()
    });
  } catch (error: any) {
    console.error("Failed to get state:", error.message);
    // Return cached state on error (allows UI to still work)
    const cachedState = getAgentState();
    res.json({
      success: true,
      data: cachedState,
      cached: true,
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * POST /tick
 * Triggers a single agent tick (observe → decide → act)
 * This is the ONLY way the UI can trigger execution
 */
app.post("/tick", async (_, res) => {
  try {
    console.log("\n🔔 Manual tick triggered via API");
    const provider = getProvider();
    const state = await runAgentTick({ manual: true, provider });
    res.json({
      success: true,
      data: state,
      timestamp: new Date().toISOString()
    });
  } catch (error: any) {
    console.error("Agent tick failed:", error.message);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /health
 * Health check with autonomous mode and bridge status
 */
app.get("/health", (_, res) => {
  const lastBridge = getLastBridgeAttempt();
  const bridgeCooldown = getBridgeCooldownRemaining();

  res.json({
    status: lastCycleSuccess ? "ok" : "degraded",
    agent: "UniFlux",
    network: "Sepolia",
    mode: AUTO_MODE ? "autonomous" : "manual",
    autonomous: {
      enabled: AUTO_MODE,
      running: autonomousLoopRunning,
      pollIntervalMs: POLL_INTERVAL_MS,
      cycleCount,
      lastCycle: lastCycleTime,
      lastCycleSuccess
    },
    bridge: {
      lastAttempt: lastBridge,
      cooldownRemaining: bridgeCooldown,
      safetyConfig: {
        dryRunEnabled: process.env.DRY_RUN !== 'false',
        realExecutionEnabled: process.env.EXECUTE_REAL_BRIDGE === 'true',
        maxAmountUSD: parseFloat(process.env.MAX_BRIDGE_AMOUNT_USD || '10')
      }
    },
    timestamp: new Date().toISOString()
  });
});

/**
 * GET /status
 * Real-time status endpoint for UI polling
 * Returns detailed cycle info, last decision, pool state
 */
app.get("/status", async (_, res) => {
  const lastBridge = getLastBridgeAttempt();
  const bridgeCooldown = getBridgeCooldownRemaining();
  
  // Get current agent state
  const agentState = getAgentState();

  res.json({
    success: true,
    autonomous: {
      enabled: AUTO_MODE,
      running: autonomousLoopRunning,
      cycleCount,
      lastCycleTime,
      lastCycleSuccess,
      pollIntervalMs: POLL_INTERVAL_MS
    },
    currentPhase: autonomousLoopRunning ? 'RUNNING' : 'IDLE',
    lastAction: {
      timestamp: agentState.lastTickTimestamp || lastCycleTime,
      decision: agentState.status,
      reason: agentState.timeline[0]?.message || 'Waiting...',
      actionTaken: agentState.lastAction?.type || 'None',
      txHash: agentState.lastAction?.txHash
    },
    poolState: {
      mUSDC: agentState.balances.mUSDC,
      mETH: agentState.balances.mETH,
      imbalanceRatio: parseFloat(agentState.balances.mUSDC) / 
        (parseFloat(agentState.balances.mUSDC) + parseFloat(agentState.balances.mETH) || 1) * 100,
      deviation: agentState.deviation,
      volatility: agentState.volatility
    },
    lastBridgeAttempt: lastBridge,
    bridgeCooldownRemaining: bridgeCooldown,
    safetyConfig: {
      dryRunEnabled: process.env.DRY_RUN !== 'false',
      realExecutionEnabled: process.env.EXECUTE_REAL_BRIDGE === 'true',
      maxAmountUSD: parseFloat(process.env.MAX_BRIDGE_AMOUNT_USD || '10')
    },
    recentActivity: agentState.timeline.slice(0, 5),
    timestamp: new Date().toISOString()
  });
});

// ═══════════════════════════════════════════════════════════════
// AUTONOMOUS MODE CONTROL ENDPOINTS
// ═══════════════════════════════════════════════════════════════

// Forward declaration for the autonomous cycle function
let runAutonomousCycleRef: (() => Promise<void>) | null = null;

/**
 * POST /autonomous/start
 * Start autonomous O→D→A loop from UI
 */
app.post("/autonomous/start", async (_, res) => {
  if (autonomousLoopRunning) {
    return res.json({
      success: true,
      message: "Autonomous mode already running",
      cycleCount,
      running: true
    });
  }

  console.log("\n🚀 AUTONOMOUS MODE STARTED (via API)");
  console.log("═".repeat(60));
  
  autonomousLoopRunning = true;
  
  // Start the loop if we have the function reference
  if (runAutonomousCycleRef) {
    setTimeout(() => runAutonomousCycleRef?.(), 1000);
  }
  
  res.json({
    success: true,
    message: "Autonomous mode started",
    cycleCount,
    running: true,
    pollInterval: POLL_INTERVAL_MS
  });
});

/**
 * POST /autonomous/stop
 * Stop autonomous O→D→A loop from UI
 */
app.post("/autonomous/stop", async (_, res) => {
  if (!autonomousLoopRunning) {
    return res.json({
      success: true,
      message: "Autonomous mode already stopped",
      cycleCount,
      running: false
    });
  }

  console.log("\n🛑 AUTONOMOUS MODE STOPPED (via API)");
  console.log("═".repeat(60));
  
  autonomousLoopRunning = false;
  
  // Clear any pending timer
  if (autonomousCycleTimer) {
    clearTimeout(autonomousCycleTimer);
    autonomousCycleTimer = null;
  }
  
  res.json({
    success: true,
    message: "Autonomous mode stopped",
    cycleCount,
    running: false
  });
});

// ═══════════════════════════════════════════════════════════════
// TEST/DEMO ENDPOINTS (for volatility simulation)
// ═══════════════════════════════════════════════════════════════

/**
 * POST /test/volatility
 * Inject synthetic price spikes to simulate MEV conditions
 * Perfect for demo/judge presentations
 */
app.post("/test/volatility", async (req, res) => {
  try {
    const { basePrice } = req.body;
    const price = basePrice || 1.0;
    
    console.log("\n🧪 [TEST] Volatility simulation requested via API");
    injectVolatilitySpikes(price);
    
    const newVolatility = computeVolatility();
    const priceHistory = getPriceHistory();
    
    res.json({
      success: true,
      message: "Synthetic volatility injected",
      volatility: newVolatility,
      volatilityPercent: `${(newVolatility * 100).toFixed(2)}%`,
      threshold: 0.15,
      thresholdPercent: "15.0%",
      willTriggerMEV: newVolatility > 0.15,
      priceHistoryLength: priceHistory.length,
      priceRange: {
        min: Math.min(...priceHistory).toFixed(4),
        max: Math.max(...priceHistory).toFixed(4)
      }
    });
  } catch (error: any) {
    console.error("[TEST] Failed to inject volatility:", error.message);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /test/reset-volatility
 * Clear synthetic prices and return to real observations
 */
app.post("/test/reset-volatility", async (_, res) => {
  try {
    console.log("\n🔄 [TEST] Volatility reset requested via API");
    resetVolatility();
    
    const currentVolatility = computeVolatility();
    
    res.json({
      success: true,
      message: "Volatility reset to real observations",
      volatility: currentVolatility,
      volatilityPercent: `${(currentVolatility * 100).toFixed(2)}%`
    });
  } catch (error: any) {
    console.error("[TEST] Failed to reset volatility:", error.message);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /test/volatility
 * Get current volatility stats without modification
 */
app.get("/test/volatility", async (_, res) => {
  try {
    const volatility = computeVolatility();
    const priceHistory = getPriceHistory();
    
    res.json({
      success: true,
      volatility,
      volatilityPercent: `${(volatility * 100).toFixed(2)}%`,
      threshold: 0.15,
      thresholdPercent: "15.0%",
      exceedsThreshold: volatility > 0.15,
      priceHistoryLength: priceHistory.length,
      priceHistory: priceHistory.map(p => p.toFixed(4))
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// ═══════════════════════════════════════════════════════════════
// AGENT-CONTROLLED LIQUIDITY ENDPOINTS
// ═══════════════════════════════════════════════════════════════

/**
 * POST /agent/liquidity/add
 * Agent-controlled liquidity addition
 * UI cannot modify parameters - triggers agent execution
 */
app.post("/agent/liquidity/add", async (_, res) => {
  console.log("\n💧 POST /agent/liquidity/add");
  console.log("  📋 UI requested execution — agent parameters unchanged");

  try {
    const signer = getSigner();
    const { token0, token1 } = getTokenAddresses();
    const liquidityHelperAddress = process.env.LIQUIDITY_HELPER_ADDRESS;

    if (!liquidityHelperAddress) {
      return res.status(400).json({
        success: false,
        error: "LIQUIDITY_HELPER_ADDRESS not configured"
      });
    }

    const result: LiquidityResult = await addLiquidity(
      signer,
      liquidityHelperAddress,
      token0,
      token1,
      "ui"  // Source: UI trigger
    );

    res.json({
      status: result.success ? "submitted" : "failed",
      action: "ADD_LIQUIDITY",
      txHash: result.txHash,
      block: result.blockNumber,
      pool: {
        token0,
        token1,
        fee: 3000
      },
      strategy: getStrategyParams(),
      error: result.error,
      timestamp: new Date().toISOString()
    });

  } catch (error: any) {
    console.error("  ❌ Add liquidity failed:", error.message);
    res.status(500).json({
      success: false,
      action: "ADD_LIQUIDITY",
      error: error.message
    });
  }
});

/**
 * POST /agent/liquidity/remove
 * Agent-controlled liquidity removal
 * UI cannot modify parameters - triggers agent execution
 */
app.post("/agent/liquidity/remove", async (_, res) => {
  console.log("\n🔥 POST /agent/liquidity/remove");
  console.log("  📋 UI requested execution — agent parameters unchanged");

  try {
    const signer = getSigner();
    const { token0, token1 } = getTokenAddresses();
    const liquidityHelperAddress = process.env.LIQUIDITY_HELPER_ADDRESS;

    if (!liquidityHelperAddress) {
      return res.status(400).json({
        success: false,
        error: "LIQUIDITY_HELPER_ADDRESS not configured"
      });
    }

    const result: LiquidityResult = await removeLiquidity(
      signer,
      liquidityHelperAddress,
      token0,
      token1,
      "ui"  // Source: UI trigger
    );

    res.json({
      status: result.success ? "submitted" : "failed",
      action: "REMOVE_LIQUIDITY",
      txHash: result.txHash,
      block: result.blockNumber,
      removedLiquidity: result.amount,
      pool: {
        token0,
        token1,
        fee: 3000
      },
      strategy: getStrategyParams(),
      error: result.error,
      timestamp: new Date().toISOString()
    });

  } catch (error: any) {
    console.error("  ❌ Remove liquidity failed:", error.message);
    res.status(500).json({
      success: false,
      action: "REMOVE_LIQUIDITY",
      error: error.message
    });
  }
});

/**
 * GET /agent/strategy
 * Returns agent strategy parameters (read-only)
 */
app.get("/agent/strategy", (_, res) => {
  res.json({
    strategy: getStrategyParams(),
    note: "These parameters are set by the agent, not the UI. UI triggers execution only.",
    timestamp: new Date().toISOString()
  });
});

// ═══════════════════════════════════════════════════════════════
// SAFE HARBOR EVACUATION ENDPOINTS (LI.FI Integration)
// ═══════════════════════════════════════════════════════════════

/**
 * GET /evacuation/quote
 * Get a LI.FI bridge quote for evacuation
 */
app.get("/evacuation/quote", async (req, res) => {
  console.log("\n🔍 GET /evacuation/quote");
  
  try {
    const amount = req.query.amount as string || "1000000000"; // Default 1000 USDC (6 decimals)
    const signer = getSigner();
    const walletAddress = await signer.getAddress();
    
    const quote = await getLiFiBridgeQuote(amount, walletAddress, {
      slippage: parseFloat(req.query.slippage as string) || 0.005
    });
    
    if (!quote) {
      return res.status(400).json({
        success: false,
        error: "No bridge routes available"
      });
    }
    
    res.json({
      success: true,
      quote: {
        fromChain: quote.fromChain,
        toChain: quote.toChain,
        fromToken: quote.fromToken,
        toToken: quote.toToken,
        fromAmount: quote.fromAmount,
        estimatedOutput: quote.estimatedOutput,
        bridgeUsed: quote.bridgeUsed,
        estimatedTime: quote.estimatedTime,
        gasCostUSD: quote.gasCostUSD,
        slippage: quote.slippage
      },
      timestamp: new Date().toISOString()
    });
  } catch (error: any) {
    console.error("  ❌ Quote failed:", error.message);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /evacuation/execute
 * Execute full Safe Harbor evacuation flow
 */
app.post("/evacuation/execute", async (req, res) => {
  console.log("\n🚨 POST /evacuation/execute");
  console.log("  📋 UI triggered Safe Harbor evacuation");
  
  try {
    const signer = getSigner();
    const { token0, token1 } = getTokenAddresses();
    const liquidityHelperAddress = process.env.LIQUIDITY_HELPER_ADDRESS;
    
    if (!liquidityHelperAddress) {
      return res.status(400).json({
        success: false,
        error: "LIQUIDITY_HELPER_ADDRESS not configured"
      });
    }
    
    // Slippage from request body (default 0.5%)
    const slippage = req.body.slippage || 0.005;
    const skipAave = req.body.skipAave || false;
    
    // Create remove liquidity function for evacuation
    const removeLiquidityFn = async () => {
      const result = await removeLiquidity(
        signer,
        liquidityHelperAddress,
        token0,
        token1,
        "evacuation"
      );
      
      if (!result.success) {
        throw new Error(result.error || "Failed to remove liquidity");
      }
      
      // Parse the removed amounts (simplified - actual implementation needs proper parsing)
      const amount = ethers.parseEther(result.amount || "0");
      return {
        token0Amount: amount,
        token1Amount: amount, // Would need actual amounts from receipt
        txHash: result.txHash || "0x",
      };
    };
    
    // Execute evacuation
    const startTime = Date.now();
    const result = await executeSafeHarborEvacuation(removeLiquidityFn, {
      slippage,
      skipAaveDeposit: skipAave
    });
    const executionTime = Math.round((Date.now() - startTime) / 1000);
    
    // Build explorer URLs if we have transaction hashes
    const explorerUrls: Record<string, string> = {};
    if (result.status?.removedLiquidity?.txHash) {
      explorerUrls.removeLiquidity = getExplorerUrl(
        result.status.removedLiquidity.txHash, 
        CHAIN_CONFIG.SOURCE.chainId
      );
    }
    if (result.status?.bridge?.txHash) {
      explorerUrls.bridge = getLiFiExplorerUrl(result.status.bridge.txHash);
      explorerUrls.bridgeSource = getExplorerUrl(
        result.status.bridge.txHash,
        CHAIN_CONFIG.SOURCE.chainId
      );
    }
    if (result.status?.aaveDeposit?.txHash) {
      explorerUrls.aaveDeposit = getExplorerUrl(
        result.status.aaveDeposit.txHash,
        CHAIN_CONFIG.DESTINATION.chainId
      );
    }
    
    res.json({
      success: result.success,
      status: result.status,
      explorerUrls,
      executionTime,
      message: result.success 
        ? "Safe Harbor evacuation complete - assets protected in Aave"
        : "Evacuation failed",
      timestamp: new Date().toISOString()
    });
    
  } catch (error: any) {
    console.error("  ❌ Evacuation failed:", error.message);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /evacuation/status
 * Get current evacuation status
 */
app.get("/evacuation/status", (_, res) => {
  const status = getEvacuationStatus();
  
  res.json({
    active: status !== null && status.step !== "COMPLETE" && status.step !== "FAILED",
    status: status,
    timestamp: new Date().toISOString()
  });
});

/**
 * POST /evacuation/test
 * Test evacuation flow (dry run)
 */
app.post("/evacuation/test", async (_, res) => {
  console.log("\n🧪 POST /evacuation/test");
  
  try {
    await testEvacuationFlow();
    const status = getEvacuationStatus();
    
    res.json({
      success: true,
      message: "Evacuation test completed (dry run)",
      status,
      timestamp: new Date().toISOString()
    });
  } catch (error: any) {
    console.error("  ❌ Test failed:", error.message);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /config
 * Returns agent configuration (read-only)
 */
app.get("/config", (_, res) => {
  res.json({
    network: "Sepolia",
    chainId: 11155111,
    thresholds: {
      localSwap: 10,
      crossChain: 25
    },
    targetRatio: "50/50",
    contracts: {
      poolManager: process.env.POOL_MANAGER_ADDRESS,
      swapHelper: process.env.SWAP_HELPER_ADDRESS,
      token0: process.env.TOKEN_A_ADDRESS,
      token1: process.env.TOKEN_B_ADDRESS
    }
  });
});

/**
 * GET /mev/stats
 * Returns MEV protection statistics from SandwichDetectorV2
 */
app.get("/mev/stats", async (_, res) => {
  try {
    const state = getAgentState();
    const mevStats = state.mevProtection || {
      detected: 0,
      refunded: 0,
      treasury: "0.0 ETH",
      avgRefundRate: 0,
      recentAttacks: []
    };
    
    res.json({
      success: true,
      data: mevStats,
      timestamp: new Date().toISOString()
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// ═══════════════════════════════════════════════════════════════
// SERVER STARTUP
// ═══════════════════════════════════════════════════════════════

const server = app.listen(PORT, () => {
  console.log("═".repeat(60));
  console.log("🧠 UniFlux Agent Control Plane");
  console.log("═".repeat(60));
  console.log(`   Server:     http://localhost:${PORT}`);
  console.log(`   Network:    Sepolia (11155111)`);
  console.log(`   Endpoints:`);
  console.log(`     GET  /state              → Live agent state`);
  console.log(`     POST /tick               → Trigger agent tick`);
  console.log(`     POST /agent/liquidity/add    → Add liquidity (agent-controlled)`);
  console.log(`     POST /agent/liquidity/remove → Remove liquidity (agent-controlled)`);
  console.log(`     GET  /agent/strategy     → View strategy params`);
  console.log(`     GET  /mev/stats          → MEV protection statistics`);
  console.log(`     GET  /health             → Health check`);
  console.log(`     GET  /config             → Agent configuration`);
  console.log("═".repeat(60));

  // Start MEV protection listener (non-blocking)
  const detectorAddress = process.env.SANDWICH_DETECTOR_ADDRESS;
  if (detectorAddress) {
    setTimeout(async () => {
      try {
        const provider = getProvider();
        await startMevListener(provider, detectorAddress);
      } catch (err: any) {
        console.error("MEV listener error:", err.message);
      }
    }, 1000);
  } else {
    console.log("\n⚠️  SANDWICH_DETECTOR_ADDRESS not set - MEV tracking simulated");
  }

  console.log("\n⏳ Waiting for requests...\n");

  // ═══════════════════════════════════════════════════════════════
  // AUTONOMOUS MODE - Self-scheduling O→D→A loop
  // ═══════════════════════════════════════════════════════════════

  if (AUTO_MODE) {
    console.log("═".repeat(60));
    console.log("🚀 AUTONOMOUS MODE ENABLED");
    console.log("═".repeat(60));
    console.log(`   Poll Interval: ${POLL_INTERVAL_MS / 1000}s`);
    console.log(`   Agent will run O→D→A loop automatically`);
    console.log("═".repeat(60));
    
    // Display safety configuration
    const dryRun = process.env.DRY_RUN !== 'false';
    const realBridge = process.env.EXECUTE_REAL_BRIDGE === 'true';
    const maxAmount = process.env.MAX_BRIDGE_AMOUNT_USD || '10';
    
    console.log("\n🛡️  SAFETY CONFIGURATION");
    console.log("─".repeat(40));
    console.log(`   DRY_RUN:              ${dryRun ? '✅ ENABLED (safe)' : '⚠️  DISABLED'}`);
    console.log(`   EXECUTE_REAL_BRIDGE:  ${realBridge ? '⚠️  ENABLED' : '✅ DISABLED (safe)'}`);
    console.log(`   MAX_BRIDGE_AMOUNT:    $${maxAmount}`);
    console.log(`   Mode:                 ${dryRun || !realBridge ? '🧪 SIMULATION' : '⚡ REAL EXECUTION'}`);
    console.log("─".repeat(40));
    
    if (!dryRun && realBridge) {
      console.log("\n⚠️  WARNING: Real bridge execution is ENABLED!");
      console.log("    Transactions will be sent to the blockchain.");
      console.log("    Ensure wallet is funded and you understand the risks.\n");
    }

    autonomousLoopRunning = true;
  }
  
  // Define autonomous cycle function (available for API start/stop)
  let consecutiveFailures = 0;
  
  const runAutonomousCycle = async () => {
    if (!autonomousLoopRunning) return;

    const cycleStart = new Date().toISOString();
    console.log(`\n[${cycleStart}] 🔄 Autonomous cycle #${cycleCount + 1} starting...`);

    try {
      const provider = getProvider();
      await runAgentTick({ manual: false, provider });
      
      cycleCount++;
      lastCycleTime = new Date().toISOString();
      lastCycleSuccess = true;
      consecutiveFailures = 0; // Reset on success
      
      console.log(`[${lastCycleTime}] ✅ Cycle #${cycleCount} completed`);
    } catch (err: any) {
      lastCycleTime = new Date().toISOString();
      lastCycleSuccess = false;
      consecutiveFailures++;
      providerFailures++; // Track for RPC rotation
      console.error(`[${lastCycleTime}] ❌ Cycle failed:`, err.message);
      
      // Don't crash - log and continue
    }

    // Calculate next interval with exponential backoff on failures
    let nextInterval = POLL_INTERVAL_MS;
    if (consecutiveFailures > 0) {
      // Backoff: 5s, 10s, 20s, 30s max
      nextInterval = Math.min(POLL_INTERVAL_MS * Math.pow(2, consecutiveFailures - 1), 30000);
      console.log(`⏳ RPC issues detected, next cycle in ${nextInterval/1000}s (backoff)`);
    }

    // Schedule next cycle (only if still running)
    if (autonomousLoopRunning) {
      autonomousCycleTimer = setTimeout(runAutonomousCycle, nextInterval);
    }
  };
  
  // Store reference for API endpoints
  runAutonomousCycleRef = runAutonomousCycle;

  // Start first cycle after a short delay if AUTO_MODE was set
  if (AUTO_MODE) {
    setTimeout(runAutonomousCycle, 2000);
  } else {
    console.log("\n📋 Manual mode – type 'run' in UI terminal or use POST /autonomous/start");
  }
});

// Keep process alive
server.on('error', (err) => {
  console.error('Server error:', err);
});

process.on('SIGINT', () => {
  console.log('\n👋 Shutting down...');
  autonomousLoopRunning = false; // Stop autonomous loop
  stopMevListener();
  server.close();
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n👋 Shutting down gracefully...');
  autonomousLoopRunning = false; // Stop autonomous loop
  stopMevListener();
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  // Don't exit - just log it
});

process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  // Don't exit - just log it
});
