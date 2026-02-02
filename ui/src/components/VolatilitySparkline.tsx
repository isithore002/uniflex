import { LineChart, Line, ResponsiveContainer, YAxis } from 'recharts'

interface VolatilitySparklineProps {
  volatility: number
  history: number[]
}

export default function VolatilitySparkline({ volatility, history }: VolatilitySparklineProps) {
  // Convert history to chart data
  const data = history.map((v, i) => ({ i, v: v * 100 })) // Convert to percentage

  // Determine volatility level for color
  const getVolatilityColor = (vol: number) => {
    if (vol > 0.15) return '#ef4444' // High - red
    if (vol > 0.08) return '#f59e0b' // Medium - amber
    return '#22c55e' // Low - green
  }

  const volColor = getVolatilityColor(volatility)
  const volPercent = (volatility * 100).toFixed(2)

  return (
    <div className="bg-[#1b1b1b] border border-[#2a2a2a] rounded-2xl p-6 mt-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className="text-lg">📈</span>
          <h2 className="text-white font-semibold">Pool Volatility</h2>
          <span className="flex items-center gap-1 px-2 py-0.5 bg-[#252525] rounded text-xs text-[#9b9b9b]">
            <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse"></span>
            LIVE
          </span>
        </div>
        <div 
          className="text-2xl font-mono font-bold"
          style={{ color: volColor }}
        >
          {volPercent}%
        </div>
      </div>

      {/* Subtitle */}
      <p className="text-[#9b9b9b] text-xs mb-4">
        Rolling window (agent computed from onchain price samples)
      </p>

      {/* Sparkline Chart */}
      <div className="h-20 w-full">
        {history.length > 1 ? (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data}>
              <YAxis hide domain={['auto', 'auto']} />
              <Line
                type="monotone"
                dataKey="v"
                stroke={volColor}
                strokeWidth={2}
                dot={false}
                isAnimationActive={true}
                animationDuration={500}
              />
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <div className="h-full flex items-center justify-center text-[#9b9b9b] text-sm">
            Collecting data... (run more ticks)
          </div>
        )}
      </div>

      {/* Judge-facing explanation */}
      <div className="mt-4 p-3 bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg">
        <p className="text-[#9b9b9b] text-xs">
          This chart is derived from onchain price samples observed by the UniFlux agent.
          Volatility directly influences whether liquidity is added, preserved, or withdrawn.
        </p>
      </div>

      {/* Volatility Thresholds */}
      <div className="mt-3 flex gap-4 text-xs">
        <div className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-green-500"></span>
          <span className="text-[#9b9b9b]">&lt;8% Low</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-amber-500"></span>
          <span className="text-[#9b9b9b]">8-15% Medium</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-red-500"></span>
          <span className="text-[#9b9b9b]">&gt;15% High (remove LP)</span>
        </div>
      </div>
    </div>
  )
}
