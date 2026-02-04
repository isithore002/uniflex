import { ethers } from "ethers";
import * as dotenv from "dotenv";
import path from "path";
import { observe, PoolState, computeVolatility, getVolatilityHistory } from "./observe";
import { decide, Decision } from "./decide";
import { act, ActionResult } from "./act";

// Load environment variables from parent directory - use absolute path
const envPath = path.resolve(__dirname, "../../.env");
dotenv.config({ path: envPath });

// ═══════════════════════════════════════════════════════════════
// AGENT STATE (exported for server access)
// ═══════════════════════════════════════════════════════════════

export interface TimelineEntry {
  phase: "OBSERVE" | "DECIDE" | "ACT";
  message: string;
  timestamp: string;
  txHash?: string;
}

export interface SandwichAttack {
  attacker: string;
  victim: string;
  loss: string;
  refund: string;
  timestamp: string;
  txHash?: string;
}

export interface SandwichStats {
  detected: number;
  refunded: number;
  treasury: string;
  avgRefundRate: number;
  recentAttacks: SandwichAttack[];
}

export interface AgentState {
  network: string;
  poolManager: string;
  agentWallet: string;
  balances: {
    mETH: string;
    mUSDC: string;
  };
  deviation: number;
  threshold: number;
  crossChainThreshold: number;
  volatility: number;
  volatilityHistory: number[];
  status: "NOOP" | "LOCAL_SWAP" | "CROSS_CHAIN" | "REMOVE_LIQUIDITY";
  isHealthy: boolean;
  lastTickTimestamp: string | null;
  lastAction?: {
    type: string;
    txHash?: string;
    chain?: string;
    timestamp: string;
  };
  timeline: TimelineEntry[];
  mevProtection: SandwichStats;
}

// Global agent state
let agentState: AgentState = {
  network: "Sepolia",
  poolManager: process.env.POOL_MANAGER_ADDRESS || "",
  agentWallet: "",
  balances: { mETH: "0", mUSDC: "0" },
  deviation: 0,
  threshold: 10,
  crossChainThreshold: 25,
  volatility: 0,
  volatilityHistory: [],
  status: "NOOP",
  isHealthy: true,
  lastTickTimestamp: null,
  timeline: [],
  mevProtection: {
    detected: 0,
    refunded: 0,
    treasury: "0.0 ETH",
    avgRefundRate: 30,
    recentAttacks: []
  }
};

// Maximum timeline entries to keep
const MAX_TIMELINE_ENTRIES = 50;
const MAX_RECENT_ATTACKS = 10;

// ═══════════════════════════════════════════════════════════════
// MEV PROTECTION TRACKING
// ═══════════════════════════════════════════════════════════════

/**
 * Records a detected sandwich attack
 * Called when SandwichDetected event is received
 */
export function recordSandwichAttack(attack: {
  attacker: string;
  victim: string;
  loss: string;
  refund: string;
  txHash?: string;
}): void {
  const entry: SandwichAttack = {
    ...attack,
    timestamp: new Date().toISOString()
  };

  agentState.mevProtection.detected += 1;
  agentState.mevProtection.recentAttacks.unshift(entry);

  // Keep only recent attacks
  if (agentState.mevProtection.recentAttacks.length > MAX_RECENT_ATTACKS) {
    agentState.mevProtection.recentAttacks = 
      agentState.mevProtection.recentAttacks.slice(0, MAX_RECENT_ATTACKS);
  }

  console.log(`🥪 Sandwich detected: attacker=${attack.attacker.slice(0, 10)}... victim=${attack.victim.slice(0, 10)}... loss=${attack.loss}`);
}

/**
 * Records a successful refund claim
 */
export function recordRefund(victim: string, amount: string): void {
  agentState.mevProtection.refunded += 1;
  console.log(`💰 Refund claimed: victim=${victim.slice(0, 10)}... amount=${amount}`);
}

/**
 * Updates treasury balance
 */
export function updateTreasury(balance: string): void {
  agentState.mevProtection.treasury = balance;
}

// ═══════════════════════════════════════════════════════════════
// CONFIG
// ═══════════════════════════════════════════════════════════════

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

// ═══════════════════════════════════════════════════════════════
// AGENT TICK (core logic)
// ═══════════════════════════════════════════════════════════════

function addTimelineEntry(entry: TimelineEntry): void {
  agentState.timeline.unshift(entry);
  if (agentState.timeline.length > MAX_TIMELINE_ENTRIES) {
    agentState.timeline = agentState.timeline.slice(0, MAX_TIMELINE_ENTRIES);
  }
}

export async function runAgentTick(options?: { manual?: boolean }): Promise<AgentState> {
  const config = getConfig();
  const timestamp = new Date().toISOString();
  
  console.log("\n" + "═".repeat(60));
  console.log(`🤖 UniFlux Agent Tick ${options?.manual ? "(Manual)" : "(Auto)"}`);
  console.log("═".repeat(60));
  console.log(`⏰ Timestamp: ${timestamp}`);

  agentState.lastTickTimestamp = timestamp;
  agentState.agentWallet = await config.signer.getAddress();
  agentState.poolManager = config.poolManagerAddress;

  // Phase 1: OBSERVE
  console.log("\n📡 OBSERVE PHASE");
  const state: PoolState = await observe(
    config.provider,
    config.poolManagerAddress,
    config.token0Address,
    config.token1Address
  );
  
  const mETH = ethers.formatEther(state.token0Balance);
  const mUSDC = ethers.formatEther(state.token1Balance);
  console.log(`  ${state.token0Symbol}: ${mETH}`);
  console.log(`  ${state.token1Symbol}: ${mUSDC}`);

  agentState.balances = { mETH, mUSDC };
  
  // Update volatility from observe module
  agentState.volatility = Math.round(computeVolatility() * 10000) / 10000;
  agentState.volatilityHistory = getVolatilityHistory();
  console.log(`  Volatility: ${(agentState.volatility * 100).toFixed(2)}%`);
  
  addTimelineEntry({
    phase: "OBSERVE",
    message: `Read balances: ${state.token0Symbol}=${mETH}, ${state.token1Symbol}=${mUSDC}, vol=${(agentState.volatility * 100).toFixed(2)}%`,
    timestamp
  });

  // Phase 2: DECIDE
  console.log("\n🧠 DECIDE PHASE");
  const decision: Decision = decide(state);
  
  const deviation = Math.abs(state.imbalanceRatio - 0.5) * 100;
  agentState.deviation = Math.round(deviation * 100) / 100;
  
  console.log(`  Action: ${decision.action}`);
  console.log(`  Reason: ${decision.reason}`);
  
  // Map decision to status
  if (decision.action === "CROSS_CHAIN") {
    agentState.status = "CROSS_CHAIN";
    agentState.isHealthy = false;
    console.log(`  🌐 Cross-chain evacuation triggered!`);
  } else if (decision.action === "SWAP_0_TO_1" || decision.action === "SWAP_1_TO_0") {
    agentState.status = "LOCAL_SWAP";
    agentState.isHealthy = false;
  } else {
    agentState.status = "NOOP";
    agentState.isHealthy = true;
  }

  addTimelineEntry({
    phase: "DECIDE",
    message: `Deviation: ${agentState.deviation}%, Action: ${decision.action}`,
    timestamp
  });

  // Phase 3: ACT
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
  let actMessage = "";
  let actTxHash: string | undefined;

  if (result.actionType === "cross-chain") {
    if (result.bridgeTxHash) {
      actMessage = `Bridge executed: ${result.bridgeTxHash.slice(0, 10)}...`;
      actTxHash = result.bridgeTxHash;
      console.log(`  ✅ Bridge Transaction: ${result.bridgeTxHash}`);
    } else if (result.txHash?.startsWith("SIMULATED")) {
      actMessage = "Cross-chain bridge simulated (dry run)";
      console.log(`  🧪 Simulation complete`);
    } else if (!result.success) {
      actMessage = `Bridge failed: ${result.error}`;
      console.log(`  ❌ Bridge failed: ${result.error}`);
    }
  } else if (result.txHash) {
    actMessage = `Swap executed: ${result.txHash.slice(0, 10)}...`;
    actTxHash = result.txHash;
    console.log(`  ✅ Transaction: ${result.txHash}`);
  } else if (result.success) {
    actMessage = "No action needed";
    console.log("  ✅ No action needed");
  } else {
    actMessage = `Failed: ${result.error}`;
    console.log(`  ❌ Failed: ${result.error}`);
  }

  addTimelineEntry({
    phase: "ACT",
    message: actMessage,
    timestamp,
    txHash: actTxHash
  });

  if (actTxHash) {
    agentState.lastAction = {
      type: result.actionType || "swap",
      txHash: actTxHash,
      timestamp
    };
  }

  console.log("\n" + "═".repeat(60));
  console.log("✅ Agent tick complete");
  console.log("═".repeat(60));

  return agentState;
}

// ═══════════════════════════════════════════════════════════════
// EXPORTED FUNCTIONS FOR SERVER
// ═══════════════════════════════════════════════════════════════

export function getAgentState(): AgentState {
  return { ...agentState };
}

export async function refreshState(): Promise<AgentState> {
  // Just read balances without executing actions
  const config = getConfig();
  agentState.agentWallet = await config.signer.getAddress();
  agentState.poolManager = config.poolManagerAddress;

  const state: PoolState = await observe(
    config.provider,
    config.poolManagerAddress,
    config.token0Address,
    config.token1Address
  );

  agentState.balances = {
    mETH: ethers.formatEther(state.token0Balance),
    mUSDC: ethers.formatEther(state.token1Balance)
  };
  
  const deviation = Math.abs(state.imbalanceRatio - 0.5) * 100;
  agentState.deviation = Math.round(deviation * 100) / 100;
  
  // Update volatility
  agentState.volatility = Math.round(computeVolatility() * 10000) / 10000;
  agentState.volatilityHistory = getVolatilityHistory();
  
  // Update health status based on deviation and volatility
  const HIGH_VOLATILITY = 0.15; // 15%
  
  if (agentState.deviation > 25) {
    agentState.status = "CROSS_CHAIN";
    agentState.isHealthy = false;
  } else if (agentState.volatility > HIGH_VOLATILITY && agentState.deviation > 15) {
    agentState.status = "REMOVE_LIQUIDITY";
    agentState.isHealthy = false;
  } else if (agentState.deviation > 10) {
    agentState.status = "LOCAL_SWAP";
    agentState.isHealthy = false;
  } else {
    agentState.status = "NOOP";
    agentState.isHealthy = true;
  }

  return agentState;
}

// ═══════════════════════════════════════════════════════════════
// CLI ENTRY POINT
// ═══════════════════════════════════════════════════════════════

async function runOnce(): Promise<void> {
  console.log("🚀 UniFlux Agent - Liquidity Maintenance + Cross-Chain");
  console.log("   Strategy: Rebalance locally (>10%) or evacuate cross-chain (>25%)");
  console.log("   Networks: Sepolia ↔ Base Sepolia via LI.FI");
  
  const config = getConfig();
  console.log(`\n📍 Pool Manager: ${config.poolManagerAddress}`);
  console.log(`📍 Swap Helper: ${config.swapHelperAddress}`);
  console.log(`📍 Agent Wallet: ${await config.signer.getAddress()}`);
  
  if (process.env.FORCE_CROSS_CHAIN === "true") {
    console.log(`\n⚠️  FORCE_CROSS_CHAIN=true (testing mode)`);
  }

  await runAgentTick();
}

async function runLoop(intervalMs: number = 60000): Promise<void> {
  console.log("🚀 UniFlux Agent - Continuous Mode");
  console.log(`   Interval: ${intervalMs / 1000}s`);
  
  while (true) {
    try {
      await runAgentTick();
    } catch (error: any) {
      console.error("❌ Agent tick failed:", error.message);
    }

    console.log(`\n⏳ Next tick in ${intervalMs / 1000}s...`);
    await new Promise(resolve => setTimeout(resolve, intervalMs));
  }
}

// Only run CLI if this is the main module
const isMainModule = require.main === module;
if (isMainModule) {
  const args = process.argv.slice(2);
  if (args.includes("--loop")) {
    const intervalArg = args.find(a => a.startsWith("--interval="));
    const interval = intervalArg ? parseInt(intervalArg.split("=")[1]) * 1000 : 60000;
    runLoop(interval).catch(console.error);
  } else {
    runOnce().catch(console.error);
  }
}
