import { ethers } from "ethers";
import { PoolState, computeVolatility } from "./observe";

export interface Decision {
  action: "SWAP_0_TO_1" | "SWAP_1_TO_0" | "CROSS_CHAIN" | "REMOVE_LIQUIDITY" | "NOOP";
  reason: string;
  amountIn?: bigint;
  crossChainToken?: string;
  urgency?: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  removalAmount?: bigint;        // Amount to remove for REMOVE_LIQUIDITY
  targetDeviation?: number;      // Target deviation after removal
  overweightToken?: "token0" | "token1"; // Which token is overweight
}

// Configuration thresholds
const IMBALANCE_THRESHOLD = 0.1; // 10% deviation from 50/50
const CROSS_CHAIN_THRESHOLD = 0.25; // 25% deviation triggers cross-chain evacuation
const MEV_RISK_THRESHOLD = 0.15; // 15% volatility triggers MEV protection
const MIN_SWAP_AMOUNT = ethers.parseEther("0.01");
const REBALANCE_TARGET = 0.5; // 50/50 target
const TARGET_DEVIATION_AFTER_REBALANCE = 0.09; // Rebalance to 9% deviation when >= 25%
const REMOVAL_DEVIATION_REDUCTION = 0.05; // Remove liquidity to reduce deviation by 5%

// Environment flag to force cross-chain for testing
const FORCE_CROSS_CHAIN = process.env.FORCE_CROSS_CHAIN === "true";

// ═══════════════════════════════════════════════════════════════
// MEV PROTECTION: Cooldown tracking
// ═══════════════════════════════════════════════════════════════

let lastRemovalTimestamp: number = 0;
const REMOVAL_COOLDOWN_MS = 5 * 60 * 1000; // 5 minute cooldown between removals

/**
 * Check if sandwich pattern is detected based on volatility spike
 * High volatility + sudden imbalance = potential sandwich attack
 */
function checkSandwichPattern(state: PoolState): boolean {
  const volatility = computeVolatility();
  const deviation = Math.abs(state.imbalanceRatio - REBALANCE_TARGET);
  
  // Sandwich pattern: high volatility + significant imbalance
  const isHighVolatility = volatility > MEV_RISK_THRESHOLD;
  const isSignificantImbalance = deviation > IMBALANCE_THRESHOLD;
  
  if (isHighVolatility && isSignificantImbalance) {
    console.log(`  🥪 SANDWICH PATTERN DETECTED!`);
    console.log(`     Volatility: ${(volatility * 100).toFixed(2)}% (> ${MEV_RISK_THRESHOLD * 100}%)`);
    console.log(`     Imbalance: ${(deviation * 100).toFixed(2)}% (> ${IMBALANCE_THRESHOLD * 100}%)`);
    return true;
  }
  
  return false;
}

/**
 * Check if we're in cooldown period after a removal
 */
function isInCooldown(): boolean {
  const now = Date.now();
  const timeSinceRemoval = now - lastRemovalTimestamp;
  return timeSinceRemoval < REMOVAL_COOLDOWN_MS;
}

/**
 * Record a liquidity removal (called by act.ts on success)
 */
export function recordRemoval(): void {
  lastRemovalTimestamp = Date.now();
  console.log(`  ⏱️  Cooldown started: ${REMOVAL_COOLDOWN_MS / 1000}s`);
}

/**
 * Get remaining cooldown time in seconds
 */
export function getCooldownRemaining(): number {
  if (!isInCooldown()) return 0;
  return Math.ceil((REMOVAL_COOLDOWN_MS - (Date.now() - lastRemovalTimestamp)) / 1000);
}

/**
 * Pure deterministic decision logic
 * No chain calls - just computation based on observed state
 * Priority: MEV Protection > Cross-Chain > Local Swap > NOOP
 */
export function decide(state: PoolState): Decision {
  const { imbalanceRatio, token0Balance, token1Balance, token0Symbol, token1Symbol } = state;

  // Check if pool has any liquidity
  const totalBalance = token0Balance + token1Balance;
  if (totalBalance === 0n) {
    return {
      action: "NOOP",
      reason: "Pool has no liquidity"
    };
  }

  // Calculate deviation from target (0.5 = balanced)
  const deviation = Math.abs(imbalanceRatio - REBALANCE_TARGET);

  console.log(`  📊 Imbalance ratio: ${(imbalanceRatio * 100).toFixed(2)}% ${token0Symbol}`);
  console.log(`  📊 Deviation from target: ${(deviation * 100).toFixed(2)}%`);

  // ═══════════════════════════════════════════════════════════════
  // PRIORITY 1: MEV PROTECTION - Sandwich attack detection
  // ═══════════════════════════════════════════════════════════════
  
  const isSandwich = checkSandwichPattern(state);
  
  if (isSandwich) {
    // Check cooldown to prevent rapid repeated removals
    if (isInCooldown()) {
      const remaining = getCooldownRemaining();
      console.log(`  ⏱️  In cooldown (${remaining}s remaining) - skipping removal`);
    } else {
      // Calculate amount to remove to reduce deviation by 5%
      const targetDeviation = Math.max(deviation - REMOVAL_DEVIATION_REDUCTION, 0);
      const overweightToken = imbalanceRatio > REBALANCE_TARGET ? "token0" : "token1";
      const overweightBalance = imbalanceRatio > REBALANCE_TARGET ? token0Balance : token1Balance;
      
      // Calculate removal: to reduce deviation by X%, remove proportional amount of overweight token
      // removalRatio = (currentDeviation - targetDeviation) / currentDeviation
      const removalRatio = deviation > 0 ? REMOVAL_DEVIATION_REDUCTION / deviation : 0;
      const removalAmount = BigInt(Math.floor(Number(overweightBalance) * removalRatio));
      
      console.log(`  🎯 Removal target: ${(deviation * 100).toFixed(1)}% → ${(targetDeviation * 100).toFixed(1)}%`);
      console.log(`  📤 Removing: ${ethers.formatEther(removalAmount)} of ${overweightToken}`);
      
      return {
        action: "REMOVE_LIQUIDITY",
        reason: `MEV PROTECTION: Sandwich pattern detected → reducing deviation by 5%`,
        urgency: "CRITICAL",
        removalAmount,
        targetDeviation,
        overweightToken
      };
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // PRIORITY 2: CROSS-CHAIN - Severe imbalance evacuation
  // When deviation >= 25%, rebalance to bring it down to 9%
  // ═══════════════════════════════════════════════════════════════
  if (FORCE_CROSS_CHAIN || deviation >= CROSS_CHAIN_THRESHOLD) {
    const evacuationToken = imbalanceRatio > REBALANCE_TARGET ? token0Symbol : token1Symbol;
    const evacuationBalance = imbalanceRatio > REBALANCE_TARGET ? token0Balance : token1Balance;
    
    // Calculate amount needed to reach target deviation of 9%
    // If we're at 75% token0 (25% deviation), we need to get to 59% token0 (9% deviation)
    // Target ratio = 0.5 + TARGET_DEVIATION_AFTER_REBALANCE (if overweight) or 0.5 - TARGET_DEVIATION_AFTER_REBALANCE
    const targetRatio = imbalanceRatio > REBALANCE_TARGET 
      ? REBALANCE_TARGET + TARGET_DEVIATION_AFTER_REBALANCE  // e.g., 0.59 for overweight token0
      : REBALANCE_TARGET - TARGET_DEVIATION_AFTER_REBALANCE; // e.g., 0.41 for underweight token0
    
    // Calculate how much to evacuate to reach target
    // Current: token0 / total = imbalanceRatio
    // Target:  (token0 - x) / (total - x) = targetRatio  [evacuate x of overweight token]
    // Solving: x = (imbalanceRatio - targetRatio) * total / (1 - targetRatio)
    const totalBalanceNum = Number(totalBalance);
    const amountToEvacuate = (Math.abs(imbalanceRatio - targetRatio) * totalBalanceNum) / (1 - targetRatio);
    const evacuationAmount = BigInt(Math.floor(amountToEvacuate));

    console.log(`  🎯 Rebalancing: ${(deviation * 100).toFixed(1)}% → ${(TARGET_DEVIATION_AFTER_REBALANCE * 100).toFixed(1)}%`);
    console.log(`  📤 Evacuating: ${ethers.formatEther(evacuationAmount)} ${evacuationToken}`);

    if (evacuationAmount >= MIN_SWAP_AMOUNT) {
      const reason = FORCE_CROSS_CHAIN 
        ? `FORCED: Cross-chain evacuation triggered`
        : `SEVERE imbalance (${(deviation * 100).toFixed(1)}% >= ${CROSS_CHAIN_THRESHOLD * 100}%) → rebalancing to ${(TARGET_DEVIATION_AFTER_REBALANCE * 100)}%`;
      
      return {
        action: "CROSS_CHAIN",
        reason,
        amountIn: evacuationAmount,
        crossChainToken: imbalanceRatio > REBALANCE_TARGET 
          ? "token0" 
          : "token1"
      };
    }
  }

  // LOCAL SWAP DECISION: Moderate imbalance (10-25%)
  // Rebalance towards 9% deviation target
  if (deviation > IMBALANCE_THRESHOLD) {
    // Calculate target ratio to achieve 9% deviation (or less if current deviation is smaller)
    const targetDeviation = Math.min(deviation, TARGET_DEVIATION_AFTER_REBALANCE);
    
    if (imbalanceRatio > REBALANCE_TARGET) {
      // Too much token0 → swap token0 for token1
      // Calculate swap to reach target deviation
      const currentRatio = imbalanceRatio;
      const targetRatio = REBALANCE_TARGET + targetDeviation;
      const excessRatio = currentRatio - targetRatio;
      const swapAmount = (token0Balance * BigInt(Math.floor(excessRatio * 1000))) / 1000n;
      
      console.log(`  🎯 Local rebalance: ${(deviation * 100).toFixed(1)}% → ${(targetDeviation * 100).toFixed(1)}%`);
      
      if (swapAmount < MIN_SWAP_AMOUNT) {
        return {
          action: "NOOP",
          reason: `Swap amount too small (${ethers.formatEther(swapAmount)} ${token0Symbol})`
        };
      }

      return {
        action: "SWAP_0_TO_1",
        reason: `${token0Symbol} overweight (${(imbalanceRatio * 100).toFixed(1)}%) → rebalancing to ${(targetDeviation * 100).toFixed(1)}%`,
        amountIn: swapAmount
      };
    } else {
      // Too much token1 → swap token1 for token0
      const currentRatio = imbalanceRatio;
      const targetRatio = REBALANCE_TARGET - targetDeviation;
      const excessRatio = targetRatio - currentRatio;
      const swapAmount = (token1Balance * BigInt(Math.floor(Math.abs(excessRatio) * 1000))) / 1000n;
      
      console.log(`  🎯 Local rebalance: ${(deviation * 100).toFixed(1)}% → ${(targetDeviation * 100).toFixed(1)}%`);
      
      if (swapAmount < MIN_SWAP_AMOUNT) {
        return {
          action: "NOOP",
          reason: `Swap amount too small (${ethers.formatEther(swapAmount)} ${token1Symbol})`
        };
      }

      return {
        action: "SWAP_1_TO_0",
        reason: `${token1Symbol} overweight (${((1 - imbalanceRatio) * 100).toFixed(1)}%) → rebalancing to ${(targetDeviation * 100).toFixed(1)}%`,
        amountIn: swapAmount
      };
    }
  }

  return {
    action: "NOOP",
    reason: `Pool healthy (deviation ${(deviation * 100).toFixed(2)}% < threshold ${IMBALANCE_THRESHOLD * 100}%)`
  };
}
