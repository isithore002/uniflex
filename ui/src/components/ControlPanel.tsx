import { useState } from 'react'
import { runAgentTick } from '../lib/agent'
import type { AgentState } from '../lib/agent'

interface ControlPanelProps {
  onStateUpdate: (state: AgentState) => void
  isLive: boolean
}

export default function ControlPanel({ onStateUpdate, isLive }: ControlPanelProps) {
  const [isRunning, setIsRunning] = useState(false)
  const [lastResult, setLastResult] = useState<string | null>(null)

  const handleTick = async () => {
    setIsRunning(true)
    setLastResult(null)
    
    try {
      const state = await runAgentTick()
      onStateUpdate(state)
      
      // Show result message
      if (state.status === "NOOP") {
        setLastResult("✓ Agent decided: No action needed")
      } else if (state.status === "LOCAL_SWAP") {
        setLastResult("✓ Agent executed local swap")
      } else if (state.status === "CROSS_CHAIN") {
        setLastResult("✓ Agent triggered cross-chain evacuation")
      }
    } catch (err: any) {
      setLastResult(`✗ Failed: ${err.message}`)
    } finally {
      setIsRunning(false)
    }
  }

  return (
    <div className="bg-[#1b1b1b] border border-[#2a2a2a] rounded-2xl p-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-medium text-white mb-1">Agent Execution</h2>
          <p className="text-xs text-[#5e5e5e]">
            Trigger observe → decide → act cycle. The UI does not control strategy.
          </p>
        </div>
        
        <button
          onClick={handleTick}
          disabled={isRunning || !isLive}
          className={`
            flex items-center gap-2 px-5 py-2.5 rounded-xl font-medium text-sm transition-all
            ${isRunning 
              ? 'bg-[#fc72ff]/20 text-[#fc72ff] cursor-wait' 
              : isLive
                ? 'bg-[#fc72ff] text-white hover:bg-[#fc72ff]/90 cursor-pointer'
                : 'bg-[#2a2a2a] text-[#5e5e5e] cursor-not-allowed'
            }
          `}
        >
          {isRunning ? (
            <>
              <span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin"></span>
              Running...
            </>
          ) : (
            <>
              <span>▶</span>
              Run Agent Tick (Live)
            </>
          )}
        </button>
      </div>

      {lastResult && (
        <div className={`mt-4 text-sm font-mono ${lastResult.startsWith('✓') ? 'text-[#40b66b]' : 'text-red-400'}`}>
          {lastResult}
        </div>
      )}
    </div>
  )
}
