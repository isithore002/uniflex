import { useState, useEffect, useCallback } from 'react';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';
const POLL_INTERVAL = 5000; // 5 seconds - matches backend cycle

export interface AutonomousStatus {
  enabled: boolean;
  running: boolean;
  cycleCount: number;
  lastCycleTime: string | null;
  lastCycleSuccess: boolean;
  pollIntervalMs: number;
}

export interface LastAction {
  timestamp: string | null;
  decision: string;
  reason: string;
  actionTaken: string;
  txHash?: string;
}

export interface PoolState {
  mUSDC: string;
  mETH: string;
  imbalanceRatio: number;
  deviation: number;
  volatility: number;
}

export interface BridgeAttempt {
  timestamp: string;
  mode: 'simulation' | 'real';
  status: 'success' | 'failed' | 'cooldown' | 'amount-exceeded';
  quote?: {
    fromChain: number;
    toChain: number;
    bridgeUsed: string;
    estimatedOutput: string;
    gasCostUSD: string;
  };
  txHash?: string;
  error?: string;
}

export interface SafetyConfig {
  dryRunEnabled: boolean;
  realExecutionEnabled: boolean;
  maxAmountUSD: number;
}

export interface TimelineEntry {
  phase: 'OBSERVE' | 'DECIDE' | 'ACT';
  message: string;
  timestamp: string;
  txHash?: string;
}

export interface AgentStatus {
  success: boolean;
  autonomous: AutonomousStatus;
  currentPhase: string;
  lastAction: LastAction;
  poolState: PoolState;
  lastBridgeAttempt: BridgeAttempt | null;
  bridgeCooldownRemaining: number;
  safetyConfig: SafetyConfig;
  recentActivity: TimelineEntry[];
  timestamp: string;
}

export function useAgentStatus() {
  const [status, setStatus] = useState<AgentStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);

  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/status`);
      if (!res.ok) throw new Error(`Failed to fetch status: ${res.statusText}`);
      const data: AgentStatus = await res.json();
      setStatus(data);
      setError(null);
      setLastUpdate(new Date());
    } catch (err: any) {
      setError(err.message);
      console.error('Status polling error:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // Initial fetch
    fetchStatus();

    // Set up polling interval
    const interval = setInterval(fetchStatus, POLL_INTERVAL);

    // Cleanup on unmount
    return () => clearInterval(interval);
  }, [fetchStatus]);

  // Manual refresh function
  const refresh = useCallback(() => {
    setLoading(true);
    fetchStatus();
  }, [fetchStatus]);

  return { 
    status, 
    loading, 
    error, 
    lastUpdate,
    refresh,
    isConnected: !error && status !== null
  };
}
