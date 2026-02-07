import express from "express";
import cors from "cors";
import * as dotenv from "dotenv";
import path from "path";
import { ethers } from "ethers";
import { getAgentState, runAgentTick, refreshState, AgentState } from "./agent";
import { addLiquidity, removeLiquidity, getStrategyParams, LiquidityResult } from "./liquidity";
import { startMevListener, stopMevListener } from "./mev-listener";
import { 
  getLiFiBridgeQuote, 
  executeSafeHarborEvacuation, 
  getEvacuationStatus,
  testEvacuationFlow 
} from "./evacuate";

// Load environment variables - use absolute path
const envPath = path.resolve(__dirname, "../../.env");
dotenv.config({ path: envPath });

const app = express();
const PORT = process.env.AGENT_PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());

// ═══════════════════════════════════════════════════════════════
// SHARED PROVIDER INSTANCE
// ═══════════════════════════════════════════════════════════════

let sharedProvider: ethers.JsonRpcProvider | null = null;

function getProvider(): ethers.JsonRpcProvider {
  if (!sharedProvider) {
    console.log("🔌 Initializing RPC provider...");
    sharedProvider = new ethers.JsonRpcProvider(
      process.env.SEPOLIA_RPC_URL,
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
      // Don't throw - just log
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
 * Simple health check for the agent server
 */
app.get("/health", (_, res) => {
  res.json({
    status: "ok",
    agent: "UniFlux",
    network: "Sepolia",
    timestamp: new Date().toISOString()
  });
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
        estimatedTimeSeconds: quote.estimatedTime,
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
    const result = await executeSafeHarborEvacuation(removeLiquidityFn, {
      slippage,
      skipAaveDeposit: skipAave
    });
    
    res.json({
      success: result.success,
      status: result.status,
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
});

// Keep process alive
server.on('error', (err) => {
  console.error('Server error:', err);
});

process.on('SIGINT', () => {
  console.log('\n👋 Shutting down...');
  stopMevListener();
  server.close();
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n👋 Shutting down...');
  stopMevListener();
  server.close();
  process.exit(0);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  // Don't exit - just log it
});

process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  // Don't exit - just log it
});
