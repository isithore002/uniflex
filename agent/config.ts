export type AgentConfig = {
  readonly poolAddress: `0x${string}`;
  readonly baseRpcUrl: string;
  readonly decisionThresholdBps: number;
  readonly ensName: string;
  readonly ensRpcUrl: string;
};

export const config: AgentConfig = {
  poolAddress: process.env.UNISWAP_V4_POOL_ADDRESS as `0x${string}`,
  baseRpcUrl: process.env.BASE_RPC_URL ?? "",
  decisionThresholdBps: Number(process.env.DECISION_THRESHOLD_BPS ?? 50),
  ensName: process.env.ENS_NAME ?? "uniflux.eth",
  ensRpcUrl: process.env.ENS_RPC_URL ?? "https://ethereum.publicnode.com"
};

export function validateConfig(): void {
  if (!config.poolAddress) {
    throw new Error("UNISWAP_V4_POOL_ADDRESS is required in environment variables.");
  }
  if (!config.baseRpcUrl) {
    throw new Error("BASE_RPC_URL is required in environment variables.");
  }
  if (!config.ensName) {
    throw new Error("ENS_NAME is required in environment variables.");
  }
  if (!config.ensRpcUrl) {
    throw new Error("ENS_RPC_URL must resolve to an Ethereum endpoint supporting ENS.");
  }
}
