// ═══════════════════════════════════════════════════════════════
// UniFlux Agent API Client
// Read-only interface to the agent control plane
// ═══════════════════════════════════════════════════════════════

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3001";

export interface TimelineEntry {
  phase: "OBSERVE" | "DECIDE" | "ACT";
  message: string;
  timestamp: string;
  txHash?: string;
}

export interface SandwichStats {
  detected: number;
  refunded: number;
  treasury: string;
  avgRefundRate: number;
  recentAttacks: {
    attacker: string;
    victim: string;
    loss: string;
    refund: string;
    timestamp: string;
    txHash?: string;
  }[];
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
  // MEV Protection - Sandwich Detector V2
  mevProtection?: SandwichStats;
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  timestamp: string;
}

/**
 * Fetch current agent state (read-only)
 * Polls the agent for live balances and status
 */
export async function fetchAgentState(): Promise<AgentState> {
  const res = await fetch(`${API_URL}/state`);
  if (!res.ok) {
    throw new Error(`Failed to fetch agent state: ${res.statusText}`);
  }
  const json: ApiResponse<AgentState> = await res.json();
  if (!json.success || !json.data) {
    throw new Error(json.error || "Unknown error");
  }
  return json.data;
}

/**
 * Trigger a single agent tick
 * This executes: observe → decide → act
 * Returns the updated state after execution
 */
export async function runAgentTick(): Promise<AgentState> {
  const res = await fetch(`${API_URL}/tick`, {
    method: "POST",
    headers: { "Content-Type": "application/json" }
  });
  if (!res.ok) {
    throw new Error(`Agent tick failed: ${res.statusText}`);
  }
  const json: ApiResponse<AgentState> = await res.json();
  if (!json.success || !json.data) {
    throw new Error(json.error || "Unknown error");
  }
  return json.data;
}

/**
 * Check if agent server is running
 */
export async function checkAgentHealth(): Promise<boolean> {
  try {
    const res = await fetch(`${API_URL}/health`);
    return res.ok;
  } catch {
    return false;
  }
}

// ═══════════════════════════════════════════════════════════════
// AGENT-CONTROLLED LIQUIDITY OPERATIONS
// UI cannot modify parameters - these trigger agent execution only
// ═══════════════════════════════════════════════════════════════

export interface LiquidityResponse {
  status: "submitted" | "failed";
  action: "ADD_LIQUIDITY" | "REMOVE_LIQUIDITY";
  txHash?: string;
  block?: number;
  removedLiquidity?: string;
  pool?: {
    token0: string;
    token1: string;
    fee: number;
  };
  strategy?: {
    tickLower: number;
    tickUpper: number;
    liquidityAmount: string;
    note: string;
  };
  error?: string;
  timestamp: string;
}

/**
 * Trigger agent-controlled liquidity addition
 * UI cannot modify parameters - agent strategy is fixed
 */
export async function triggerAddLiquidity(): Promise<LiquidityResponse> {
  const res = await fetch(`${API_URL}/agent/liquidity/add`, {
    method: "POST",
    headers: { "Content-Type": "application/json" }
  });
  if (!res.ok) {
    throw new Error(`Add liquidity failed: ${res.statusText}`);
  }
  return await res.json();
}

/**
 * Trigger agent-controlled liquidity removal
 * UI cannot modify parameters - agent strategy is fixed
 */
export async function triggerRemoveLiquidity(): Promise<LiquidityResponse> {
  const res = await fetch(`${API_URL}/agent/liquidity/remove`, {
    method: "POST",
    headers: { "Content-Type": "application/json" }
  });
  if (!res.ok) {
    throw new Error(`Remove liquidity failed: ${res.statusText}`);
  }
  return await res.json();
}

/**
 * Format timestamp for display
 */
export function formatTimestamp(iso: string): string {
  const date = new Date(iso);
  return date.toLocaleTimeString("en-US", {
    hour12: false,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit"
  });
}

/**
 * Format "time ago" for last tick
 */
export function timeAgo(iso: string): string {
  const seconds = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (seconds < 5) return "just now";
  if (seconds < 60) return `${seconds}s ago`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  return `${Math.floor(seconds / 3600)}h ago`;
}

/**
 * Add liquidity with specified amount
 */
export async function addLiquidity(amount: number): Promise<LiquidityResponse> {
  const res = await fetch(`${API_URL}/agent/liquidity/add`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ amount })
  });
  if (!res.ok) {
    throw new Error(`Add liquidity failed: ${res.statusText}`);
  }
  return await res.json();
}

/**
 * Remove liquidity with specified amount
 */
export async function removeLiquidity(amount: number): Promise<LiquidityResponse> {
  const res = await fetch(`${API_URL}/agent/liquidity/remove`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ amount })
  });
  if (!res.ok) {
    throw new Error(`Remove liquidity failed: ${res.statusText}`);
  }
  return await res.json();
}

/**
 * Fetch MEV protection statistics
 */
export async function fetchMevStats(): Promise<SandwichStats> {
  const res = await fetch(`${API_URL}/mev/stats`);
  if (!res.ok) {
    throw new Error(`Failed to fetch MEV stats: ${res.statusText}`);
  }
  const json: ApiResponse<SandwichStats> = await res.json();
  if (!json.success || !json.data) {
    throw new Error(json.error || "Unknown error");
  }
  return json.data;
}

// ═══════════════════════════════════════════════════════════════
// SAFE HARBOR EVACUATION (LI.FI Integration)
// ═══════════════════════════════════════════════════════════════

export interface EvacuationQuote {
  fromChain: number;
  toChain: number;
  fromToken: string;
  toToken: string;
  fromAmount: string;
  estimatedOutput: string;
  bridgeUsed: string;
  estimatedTime: number;
  gasCostUSD: string;
  slippage: number;
}

export interface EvacuationStatus {
  step: "IDLE" | "DETECTING_MEV" | "REMOVING_LIQUIDITY" | "BRIDGING" | "WAITING_BRIDGE" | "DEPOSITING_AAVE" | "COMPLETE" | "FAILED";
  startTime: number;
  removedLiquidity?: {
    token0Amount: string;
    token1Amount: string;
    txHash: string;
  };
  bridge?: {
    fromChain: string;
    toChain: string;
    fromAmount: string;
    estimatedOutput: string;
    bridgeUsed: string;
    txHash?: string;
    status?: string;
  };
  aaveDeposit?: {
    amount: string;
    txHash: string;
  };
  error?: string;
  completedAt?: number;
}

/**
 * Get LI.FI bridge quote for evacuation
 */
export async function getEvacuationQuote(amount?: string, slippage?: number): Promise<{
  success: boolean;
  quote?: EvacuationQuote;
  error?: string;
}> {
  const params = new URLSearchParams();
  if (amount) params.append("amount", amount);
  if (slippage) params.append("slippage", slippage.toString());
  
  const res = await fetch(`${API_URL}/evacuation/quote?${params.toString()}`);
  if (!res.ok) {
    return { success: false, error: `Failed to get evacuation quote: ${res.statusText}` };
  }
  const json = await res.json();
  if (!json.success) {
    return { success: false, error: json.error || "Failed to get quote" };
  }
  return { success: true, quote: json.quote };
}

export interface ExplorerUrls {
  removeLiquidity?: string;
  bridge?: string;
  bridgeSource?: string;
  aaveDeposit?: string;
}

/**
 * Execute Safe Harbor evacuation
 */
export async function executeEvacuation(slippage?: number, skipAave?: boolean): Promise<{
  success: boolean;
  status?: EvacuationStatus;
  explorerUrls?: ExplorerUrls;
  executionTime?: number;
  message?: string;
  error?: string;
}> {
  const res = await fetch(`${API_URL}/evacuation/execute`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ slippage, skipAave })
  });
  if (!res.ok) {
    return { success: false, error: `Evacuation failed: ${res.statusText}` };
  }
  return await res.json();
}

/**
 * Get current evacuation status
 */
export async function getEvacuationStatus(): Promise<{
  active: boolean;
  status: EvacuationStatus | null;
}> {
  const res = await fetch(`${API_URL}/evacuation/status`);
  if (!res.ok) {
    throw new Error(`Failed to get evacuation status: ${res.statusText}`);
  }
  return await res.json();
}

/**
 * Test evacuation flow (dry run)
 */
export async function testEvacuation(): Promise<{
  success: boolean;
  status: EvacuationStatus;
  error?: string;
}> {
  const res = await fetch(`${API_URL}/evacuation/test`, {
    method: "POST",
    headers: { "Content-Type": "application/json" }
  });
  if (!res.ok) {
    throw new Error(`Evacuation test failed: ${res.statusText}`);
  }
  return await res.json();
}
