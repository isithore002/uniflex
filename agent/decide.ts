import { config } from "./config.js";
import type { ObservedState } from "./observe.js";

export type Decision = "NONE" | "REBALANCE" | "CROSS_CHAIN";

export type DecisionContext = {
  readonly reason: string;
  readonly decision: Decision;
};

const BASIS_POINTS_DENOMINATOR = 10_000;

export function decide(state: ObservedState): DecisionContext {
  console.log("[decide] Evaluating observed state delta against thresholds");

  const threshold = config.decisionThresholdBps / BASIS_POINTS_DENOMINATOR;

  if (state.mockMetric > threshold * 1.5) {
    return {
      decision: "CROSS_CHAIN",
      reason: `mockMetric ${state.mockMetric.toFixed(4)} exceeds cross-chain multiplier threshold ${(
        threshold * 1.5
      ).toFixed(4)}`
    };
  }

  if (state.mockMetric > threshold) {
    return {
      decision: "REBALANCE",
      reason: `mockMetric ${state.mockMetric.toFixed(4)} exceeds threshold ${threshold.toFixed(4)}`
    };
  }

  return {
    decision: "NONE",
    reason: `mockMetric ${state.mockMetric.toFixed(4)} is below threshold ${threshold.toFixed(4)}`
  };
}
