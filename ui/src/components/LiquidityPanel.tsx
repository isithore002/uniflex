import { useState } from 'react'
import { triggerAddLiquidity, triggerRemoveLiquidity } from '../lib/agent'
import type { LiquidityResponse } from '../lib/agent'

interface LiquidityPanelProps {
  isLive: boolean
}

export default function LiquidityPanel({ isLive }: LiquidityPanelProps) {
  const [loading, setLoading] = useState<'add' | 'remove' | null>(null)
  const [result, setResult] = useState<LiquidityResponse | null>(null)
  const [error, setError] = useState<string | null>(null)

  const handleAddLiquidity = async () => {
    if (!isLive) return
    setLoading('add')
    setError(null)
    setResult(null)

    try {
      const response = await triggerAddLiquidity()
      setResult(response)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(null)
    }
  }

  const handleRemoveLiquidity = async () => {
    if (!isLive) return
    setLoading('remove')
    setError(null)
    setResult(null)

    try {
      const response = await triggerRemoveLiquidity()
      setResult(response)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(null)
    }
  }

  return (
    <div className="bg-[#1b1b1b] border border-[#2a2a2a] rounded-2xl p-6 mt-6">
      {/* Section Header */}
      <div className="flex items-center gap-2 mb-4">
        <span className="text-lg">💧</span>
        <h2 className="text-white font-semibold">Agent-Controlled Liquidity Operations</h2>
      </div>

      {/* Important Notice for Judges */}
      <div className="bg-[#252525] border border-[#333] rounded-xl p-4 mb-4">
        <p className="text-[#9b9b9b] text-sm">
          <span className="text-[#fc72ff] font-medium">⚠️ This action does not set parameters.</span>
          <br />
          Liquidity ranges, amounts, and execution logic are fully determined by the backend agent.
        </p>
      </div>

      {/* Action Buttons */}
      <div className="flex gap-3 mb-4">
        <button
          onClick={handleAddLiquidity}
          disabled={!isLive || loading !== null}
          className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-[#fc72ff]/10 border border-[#fc72ff]/30 rounded-xl text-[#fc72ff] font-medium hover:bg-[#fc72ff]/20 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
        >
          {loading === 'add' ? (
            <>
              <div className="w-4 h-4 border-2 border-[#fc72ff] border-t-transparent rounded-full animate-spin"></div>
              Submitting...
            </>
          ) : (
            <>
              <span>▶</span>
              Trigger Agent Liquidity Add (Onchain)
            </>
          )}
        </button>

        <button
          onClick={handleRemoveLiquidity}
          disabled={!isLive || loading !== null}
          className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-orange-500/10 border border-orange-500/30 rounded-xl text-orange-400 font-medium hover:bg-orange-500/20 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
        >
          {loading === 'remove' ? (
            <>
              <div className="w-4 h-4 border-2 border-orange-400 border-t-transparent rounded-full animate-spin"></div>
              Submitting...
            </>
          ) : (
            <>
              <span>▶</span>
              Trigger Agent Liquidity Removal (Onchain)
            </>
          )}
        </button>
      </div>

      {/* Result Display */}
      {result && (
        <div className={`rounded-xl p-4 ${result.status === 'submitted' ? 'bg-green-500/10 border border-green-500/30' : 'bg-red-500/10 border border-red-500/30'}`}>
          {result.status === 'submitted' ? (
            <div className="text-green-400">
              <p className="font-medium mb-2">✓ Agent submitted {result.action === 'ADD_LIQUIDITY' ? 'liquidity add' : 'liquidity removal'}</p>
              {result.txHash && (
                <p className="text-sm">
                  Tx:{' '}
                  <a
                    href={`https://sepolia.uniscan.xyz/tx/${result.txHash}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[#fc72ff] hover:underline font-mono"
                  >
                    {result.txHash.slice(0, 10)}...{result.txHash.slice(-6)}
                  </a>
                </p>
              )}
              {result.block && (
                <p className="text-sm text-[#9b9b9b]">Block: {result.block}</p>
              )}
            </div>
          ) : (
            <p className="text-red-400">✗ {result.error || 'Transaction failed'}</p>
          )}
        </div>
      )}

      {/* Error Display */}
      {error && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4">
          <p className="text-red-400">⚠️ {error}</p>
        </div>
      )}

      {/* Execution Policy Card */}
      <div className="mt-4 bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl p-4">
        <h3 className="text-white text-sm font-medium mb-2">Execution Policy</h3>
        <ul className="text-[#9b9b9b] text-xs space-y-1">
          <li>• UI cannot modify strategy</li>
          <li>• UI cannot set amounts</li>
          <li>• Agent executes deterministic logic only</li>
          <li>• All actions recorded onchain</li>
        </ul>
      </div>
    </div>
  )
}
