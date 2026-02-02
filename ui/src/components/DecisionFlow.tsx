export default function DecisionFlow() {
  const rules = [
    { range: '< 10%', action: 'No action', color: 'text-[#9b9b9b]' },
    { range: '10–25%', action: 'Local Uniswap v4 swap', color: 'text-[#fc72ff]' },
    { range: '> 25%', action: 'Cross-chain evacuation (LI.FI)', color: 'text-[#ff8f00]' },
  ]

  return (
    <div className="bg-[#1b1b1b] border border-[#2a2a2a] rounded-2xl">
      <div className="px-5 py-4 border-b border-[#2a2a2a]">
        <h2 className="text-base font-medium text-white">Deterministic Decision Policy</h2>
        <p className="text-xs text-[#5e5e5e] mt-1">No ML, no heuristics</p>
      </div>
      <div className="px-5 py-4">
        <div className="space-y-3">
          {rules.map((rule, i) => (
            <div key={i} className="flex items-center gap-4">
              <span className="font-mono text-sm text-white w-16">{rule.range}</span>
              <span className="text-[#5e5e5e]">→</span>
              <span className={`text-sm ${rule.color}`}>{rule.action}</span>
            </div>
          ))}
        </div>
        <div className="mt-5 pt-4 border-t border-[#2a2a2a]">
          <p className="text-xs text-[#5e5e5e]">
            All decisions computed in backend agent. UI does not influence execution.
          </p>
        </div>
      </div>
    </div>
  )
}
