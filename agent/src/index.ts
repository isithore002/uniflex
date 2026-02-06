import { ethers } from "ethers";
import * as dotenv from "dotenv";
import { observe, PoolState } from "./observe";
import { decide, Decision } from "./decide";
import { act, ActionResult } from "./act";

// Load environment variables from parent directory
dotenv.config({ path: "../.env" });

// Validate required env vars
function validateEnv(): void {
  const required = [
    "SEPOLIA_RPC_URL",
    "PRIVATE_KEY",
    "POOL_MANAGER_ADDRESS",
    "TOKEN_A_ADDRESS",
    "TOKEN_B_ADDRESS",
    "SWAP_HELPER_ADDRESS"
  ];

  const missing = required.filter(key => !process.env[key]);
  if (missing.length > 0) {
    throw new Error(`Missing environment variables: ${missing.join(", ")}`);
  }
}

interface AgentConfig {
  provider: ethers.Provider;
  signer: ethers.Wallet;
  poolManagerAddress: string;
  token0Address: string;
  token1Address: string;
  swapHelperAddress: string;
}

function getConfig(): AgentConfig {
  validateEnv();

  const provider = new ethers.JsonRpcProvider(process.env.SEPOLIA_RPC_URL);
  const signer = new ethers.Wallet(process.env.PRIVATE_KEY!, provider);

  // Sort tokens to match pool key ordering
  const tokenA = process.env.TOKEN_A_ADDRESS!;
  const tokenB = process.env.TOKEN_B_ADDRESS!;
  const [token0, token1] = tokenA.toLowerCase() < tokenB.toLowerCase()
    ? [tokenA, tokenB]
    : [tokenB, tokenA];

  return {
    provider,
    signer,
    poolManagerAddress: process.env.POOL_MANAGER_ADDRESS!,
    token0Address: token0,
    token1Address: token1,
    swapHelperAddress: process.env.SWAP_HELPER_ADDRESS!
  };
}

/**
 * Single agent tick - observe, decide, act
 */
async function runAgentTick(config: AgentConfig): Promise<void> {
  console.log("\n" + "═".repeat(60));
  console.log("🤖 UniFlux Agent Tick");
  console.log("═".repeat(60));
  console.log(`⏰ Timestamp: ${new Date().toISOString()}`);

  // Phase 1: Observe
  console.log("\n📡 OBSERVE PHASE");
  const state: PoolState = await observe(
    config.provider,
    config.poolManagerAddress,
    config.token0Address,
    config.token1Address
  );
  
  console.log(`  ${state.token0Symbol}: ${ethers.formatEther(state.token0Balance)}`);
  console.log(`  ${state.token1Symbol}: ${ethers.formatEther(state.token1Balance)}`);

  // Phase 2: Decide
  console.log("\n🧠 DECIDE PHASE");
  const decision: Decision = decide(state);
  console.log(`  Action: ${decision.action}`);
  console.log(`  Reason: ${decision.reason}`);
  if (decision.action === "CROSS_CHAIN") {
    console.log(`  🌐 Cross-chain evacuation triggered!`);
  }

  // Phase 3: Act
  console.log("\n⚡ ACT PHASE");
  const result: ActionResult = await act(
    decision,
    config.signer,
    config.swapHelperAddress,
    config.token0Address,
    config.token1Address
  );

  // Log result
  console.log("\n📋 RESULT");
  if (result.actionType === "cross-chain") {
    if (result.bridgeTxHash) {
      console.log(`  ✅ Bridge Transaction: ${result.bridgeTxHash}`);
      console.log(`  🔗 https://sepolia.uniscan.xyz/tx/${result.bridgeTxHash}`);
    } else if (result.txHash?.startsWith("SIMULATED")) {
      console.log(`  🧪 Simulation complete (set EXECUTE_CROSS_CHAIN=true for real tx)`);
    } else if (!result.success) {
      console.log(`  ❌ Bridge failed: ${result.error}`);
    }
  } else if (result.txHash) {
    console.log(`  ✅ Transaction: ${result.txHash}`);
    console.log(`  🔗 https://sepolia.uniscan.xyz/tx/${result.txHash}`);
  } else if (result.success) {
    console.log("  ✅ No action needed");
  } else {
    console.log(`  ❌ Failed: ${result.error}`);
  }
}

/**
 * Run agent once (for testing/demo)
 */
async function runOnce(): Promise<void> {
  console.log("🚀 UniFlux Agent - Liquidity Maintenance + Cross-Chain");
  console.log("   Strategy: Rebalance locally (>10%) or evacuate cross-chain (>25%)");
  console.log("   Networks: Sepolia ↔ Base Sepolia via LI.FI");
  
  const config = getConfig();
  console.log(`\n📍 Pool Manager: ${config.poolManagerAddress}`);
  console.log(`📍 Swap Helper: ${config.swapHelperAddress}`);
  console.log(`📍 Agent Wallet: ${await config.signer.getAddress()}`);
  
  // Show cross-chain mode
  if (process.env.FORCE_CROSS_CHAIN === "true") {
    console.log(`\n⚠️  FORCE_CROSS_CHAIN=true (testing mode)`);
  }
  if (process.env.EXECUTE_CROSS_CHAIN === "true") {
    console.log(`⚠️  EXECUTE_CROSS_CHAIN=true (will execute real bridge)`);
  }

  await runAgentTick(config);
  
  console.log("\n" + "═".repeat(60));
  console.log("✅ Agent tick complete");
  console.log("═".repeat(60));
}

/**
 * Run agent in continuous loop (for production)
 */
async function runLoop(intervalMs: number = 60000): Promise<void> {
  console.log("🚀 UniFlux Agent - Continuous Mode");
  console.log(`   Interval: ${intervalMs / 1000}s`);
  
  const config = getConfig();

  while (true) {
    try {
      await runAgentTick(config);
    } catch (error: any) {
      console.error("❌ Agent tick failed:", error.message);
    }

    console.log(`\n⏳ Next tick in ${intervalMs / 1000}s...`);
    await new Promise(resolve => setTimeout(resolve, intervalMs));
  }
}

// Entry point
const args = process.argv.slice(2);
if (args.includes("--loop")) {
  const intervalArg = args.find(a => a.startsWith("--interval="));
  const interval = intervalArg ? parseInt(intervalArg.split("=")[1]) * 1000 : 60000;
  runLoop(interval).catch(console.error);
} else {
  runOnce().catch(console.error);
}
