import express from "express";
import cors from "cors";
import * as dotenv from "dotenv";
import path from "path";
import { ethers } from "ethers";
import { getAgentState, runAgentTick, refreshState, AgentState } from "./agent";
import { addLiquidity, removeLiquidity, getStrategyParams, LiquidityResult } from "./liquidity";

// Load environment variables - use absolute path
const envPath = path.resolve(__dirname, "../../.env");
dotenv.config({ path: envPath });

const app = express();
const PORT = process.env.AGENT_PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());

// ═══════════════════════════════════════════════════════════════
// HELPER: Get configured signer
// ═══════════════════════════════════════════════════════════════

function getSigner(): ethers.Wallet {
  const provider = new ethers.JsonRpcProvider(process.env.SEPOLIA_RPC_URL);
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
    const state = await refreshState();
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
    const state = await runAgentTick({ manual: true });
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
  console.log(`     GET  /health             → Health check`);
  console.log(`     GET  /config             → Agent configuration`);
  console.log("═".repeat(60));
  console.log("\n⏳ Waiting for requests...\n");
});

// Keep process alive
server.on('error', (err) => {
  console.error('Server error:', err);
});

process.on('SIGINT', () => {
  console.log('\n👋 Shutting down...');
  server.close();
  process.exit(0);
});
