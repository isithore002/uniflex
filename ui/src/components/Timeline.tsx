import type { TimelineEntry } from '../lib/agent'
import { formatTimestamp } from '../lib/agent'

interface TimelineProps {
  entries: TimelineEntry[]
}

export default function Timeline({ entries }: TimelineProps) {
  // Show placeholder if no entries
  const hasEntries = entries.length > 0

  const getPhaseColor = (phase: TimelineEntry['phase']) => {
    switch (phase) {
      case 'OBSERVE': return 'bg-[#fc72ff]'
      case 'DECIDE': return 'bg-[#7b61ff]'
      case 'ACT': return 'bg-[#40b66b]'
      default: return 'bg-[#9b9b9b]'
    }
  }

  const getPhaseBgColor = (phase: TimelineEntry['phase']) => {
    switch (phase) {
      case 'OBSERVE': return 'bg-[#fc72ff]/10'
      case 'DECIDE': return 'bg-[#7b61ff]/10'
      case 'ACT': return 'bg-[#40b66b]/10'
      default: return 'bg-[#9b9b9b]/10'
    }
  }

  return (
    <div className="mt-8 bg-[#1b1b1b] border border-[#2a2a2a] rounded-2xl">
      <div className="px-5 py-4 border-b border-[#2a2a2a] flex items-center justify-between">
        <h2 className="text-base font-medium text-white">Agent Execution Timeline</h2>
        <span className="text-xs text-[#5e5e5e]">Live</span>
      </div>
      <div className="px-5 py-4">
        <div className="relative">
          {/* Timeline line */}
          <div className="absolute left-[7px] top-3 bottom-3 w-0.5 bg-[#2a2a2a]"></div>
          
          {/* Events */}
          <div className="space-y-4">
            {!hasEntries ? (
              <div className="text-center py-8 text-[#5e5e5e] text-sm">
                No agent ticks yet. Click "Run Agent Tick" to start.
              </div>
            ) : (
              entries.slice(0, 15).map((entry, i) => (
                <div key={i} className="flex gap-4">
                  {/* Dot */}
                  <div className={`w-4 h-4 rounded-full ${getPhaseColor(entry.phase)} flex-shrink-0 mt-1 z-10`}></div>
                  
                  {/* Content */}
                  <div className={`flex-1 ${getPhaseBgColor(entry.phase)} rounded-xl px-4 py-3`}>
                    <div className="flex items-center gap-3 mb-1">
                      <span className="font-mono text-xs text-[#5e5e5e]">[{formatTimestamp(entry.timestamp)}]</span>
                      <span className="text-sm font-medium text-white">{entry.phase}</span>
                    </div>
                    <p className="font-mono text-sm text-[#9b9b9b]">{entry.message}</p>
                    {entry.txHash && (
                      <a 
                        href={`https://sepolia.uniscan.xyz/tx/${entry.txHash}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-mono text-xs text-[#fc72ff] hover:opacity-80 mt-1 inline-block"
                      >
                        Tx: {entry.txHash.slice(0, 10)}...
                      </a>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
