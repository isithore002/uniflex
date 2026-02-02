import { ethers } from "ethers";
import { PoolState } from "./observe";

export interface Decision {
  action: "SWAP_0_TO_1" | "SWAP_1_TO_0" | "CROSS_CHAIN" | "NOOP";
  reason: string;
  amountIn?: bigint;
  crossChainToken?: string;
}

// Configuration thresholds
const IMBALANCE_THRESHOLD = 0.1; // 10% deviation from 50/50
const CROSS_CHAIN_THRESHOLD = 0.25; // 25% deviation triggers cross-chain evacuation
const MIN_SWAP_AMOUNT = ethers.parseEther("0.01");
const REBALANCE_TARGET = 0.5; // 50/50 target

// Environment flag to force cross-chain for testing
const FORCE_CROSS_CHAIN = process.env.FORCE_CROSS_CHAIN === "true";

/**
 * Pure deterministic decision logic
 * No chain calls - just computation based on observed state
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

  // CROSS-CHAIN DECISION: Severe imbalance or forced
  if (FORCE_CROSS_CHAIN || deviation > CROSS_CHAIN_THRESHOLD) {
    const evacuationToken = imbalanceRatio > REBALANCE_TARGET ? token0Symbol : token1Symbol;
    const evacuationBalance = imbalanceRatio > REBALANCE_TARGET ? token0Balance : token1Balance;
    const evacuationAmount = evacuationBalance / 4n; // Evacuate 25% of overweight token

    if (evacuationAmount >= MIN_SWAP_AMOUNT) {
      const reason = FORCE_CROSS_CHAIN 
        ? `FORCED: Cross-chain evacuation triggered`
        : `SEVERE imbalance (${(deviation * 100).toFixed(1)}% > ${CROSS_CHAIN_THRESHOLD * 100}%) — evacuating liquidity cross-chain`;
      
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

  // LOCAL SWAP DECISION: Moderate imbalance
  if (deviation > IMBALANCE_THRESHOLD) {
    if (imbalanceRatio > REBALANCE_TARGET) {
      // Too much token0 → swap token0 for token1
      const excessRatio = imbalanceRatio - REBALANCE_TARGET;
      const swapAmount = (token0Balance * BigInt(Math.floor(excessRatio * 1000))) / 1000n;
      
      if (swapAmount < MIN_SWAP_AMOUNT) {
        return {
          action: "NOOP",
          reason: `Swap amount too small (${ethers.formatEther(swapAmount)} ${token0Symbol})`
        };
      }

      return {
        action: "SWAP_0_TO_1",
        reason: `${token0Symbol} overweight (${(imbalanceRatio * 100).toFixed(1)}%), rebalancing locally`,
        amountIn: swapAmount
      };
    } else {
      // Too much token1 → swap token1 for token0
      const excessRatio = REBALANCE_TARGET - imbalanceRatio;
      const swapAmount = (token1Balance * BigInt(Math.floor(excessRatio * 1000))) / 1000n;
      
      if (swapAmount < MIN_SWAP_AMOUNT) {
        return {
          action: "NOOP",
          reason: `Swap amount too small (${ethers.formatEther(swapAmount)} ${token1Symbol})`
        };
      }

      return {
        action: "SWAP_1_TO_0",
        reason: `${token1Symbol} overweight (${((1 - imbalanceRatio) * 100).toFixed(1)}%), rebalancing locally`,
        amountIn: swapAmount
      };
    }
  }

  return {
    action: "NOOP",
    reason: `Pool healthy (deviation ${(deviation * 100).toFixed(2)}% < threshold ${IMBALANCE_THRESHOLD * 100}%)`
  };
}
