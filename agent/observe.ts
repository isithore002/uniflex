import { config } from "./config.js";

export type ObservedState = {
  readonly poolAddress: `0x${string}`;
  readonly timestamp: number;
  readonly mockMetric: number;
};

export async function observe(): Promise<ObservedState> {
  console.log("[observe] Reading Uniswap v4 pool state for", config.poolAddress);

  return {
    poolAddress: config.poolAddress,
    timestamp: Date.now(),
    mockMetric: Number((config.decisionThresholdBps / 10_000 + 0.05).toFixed(4))
  };
}
