import type { AgentState } from '../lib/agent'

interface AgentStatusProps {
  state: AgentState | null
}

export default function AgentStatus({ state }: AgentStatusProps) {
  // Use live data or fallback
  const mETH = state?.balances.mETH || '—'
  const mUSDC = state?.balances.mUSDC || '—'
  const deviation = state?.deviation?.toFixed(2) || '—'
  const threshold = state?.threshold || 10
  const isHealthy = state?.isHealthy ?? true
  const status = state?.status || 'NOOP'

  return (
    <div className="bg-[#1b1b1b] border border-[#2a2a2a] rounded-2xl">
      <div className="px-5 py-4 border-b border-[#2a2a2a] flex items-center justify-between">
        <h2 className="text-base font-medium text-white">Live Agent State</h2>
        <span className="text-xs text-[#5e5e5e]">Onchain data</span>
      </div>
      <div className="px-5 py-4 space-y-3">
        <div className="flex justify-between items-center">
          <span className="text-[#9b9b9b] text-sm">mETH balance</span>
          <span className="font-mono text-sm text-white">{mETH}</span>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-[#9b9b9b] text-sm">mUSDC balance</span>
          <span className="font-mono text-sm text-white">{mUSDC}</span>
        </div>
        <div className="h-px bg-[#2a2a2a] my-2"></div>
        <div className="flex justify-between items-center">
          <span className="text-[#9b9b9b] text-sm">Target ratio</span>
          <span className="font-mono text-sm text-white">50 / 50</span>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-[#9b9b9b] text-sm">Deviation</span>
          <span className="font-mono text-sm text-white">{deviation}%</span>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-[#9b9b9b] text-sm">Threshold</span>
          <span className="font-mono text-sm text-white">{threshold}%</span>
        </div>
        <div className="h-px bg-[#2a2a2a] my-2"></div>
        <div className="flex justify-between items-center">
          <span className="text-[#9b9b9b] text-sm">Current Decision</span>
          <span className={`text-sm font-medium ${isHealthy ? 'text-[#40b66b]' : 'text-[#ff8f00]'}`}>
            {isHealthy ? '✓' : '⚠'} {isHealthy ? 'Healthy' : 'Action Required'} ({status})
          </span>
        </div>
      </div>
    </div>
  )
}
