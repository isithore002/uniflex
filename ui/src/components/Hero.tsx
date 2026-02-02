export default function Hero() {
  return (
    <div className="py-8">
      <h1 className="text-3xl font-semibold text-white mb-2">
        UniFlux Agent
      </h1>
      <p className="text-[#9b9b9b] text-lg mb-4">
        Deterministic liquidity rebalancing for Uniswap v4
      </p>
      <p className="text-[#9b9b9b] text-sm mb-6">
        Observe → Decide → Act across chains
      </p>
      <div className="flex gap-3">
        <span className="inline-flex items-center px-3 py-1.5 bg-[#1b1b1b] border border-[#2a2a2a] rounded-xl text-sm">
          <span className="text-[#9b9b9b] mr-2">ENS:</span>
          <span className="font-mono text-white">uniflux.eth</span>
        </span>
        <span className="inline-flex items-center px-3 py-1.5 bg-[#1b1b1b] border border-[#2a2a2a] rounded-xl text-sm">
          <span className="w-2 h-2 bg-[#40b66b] rounded-full mr-2"></span>
          <span className="text-[#9b9b9b]">Sepolia</span>
        </span>
      </div>
    </div>
  )
}
