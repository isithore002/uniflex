interface NavbarProps {
  isLive: boolean
  lastPoll: Date | null
}

export default function Navbar({ isLive, lastPoll }: NavbarProps) {
  return (
    <nav className="border-b border-[#2a2a2a] bg-[#131313]">
      <div className="max-w-4xl mx-auto px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-8">
          <span className="text-xl font-semibold text-white">UniFlux</span>
          <div className="flex gap-6 text-sm">
            <a href="#" className="text-[#fc72ff] font-medium">Agent</a>
            <a href="#transactions" className="text-[#9b9b9b] hover:text-white">Transactions</a>
            <a 
              href="https://github.com" 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-[#9b9b9b] hover:text-white"
            >
              Docs
            </a>
          </div>
        </div>
        <div className="flex items-center gap-3 text-sm">
          {/* Live indicator */}
          <div className="flex items-center gap-2 px-3 py-1.5 bg-[#1b1b1b] border border-[#2a2a2a] rounded-lg">
            <span className={`w-2 h-2 rounded-full ${isLive ? 'bg-[#40b66b] animate-pulse' : 'bg-[#5e5e5e]'}`}></span>
            <span className={`text-xs ${isLive ? 'text-[#40b66b]' : 'text-[#5e5e5e]'}`}>
              {isLive ? 'LIVE' : 'OFFLINE'}
            </span>
            {isLive && lastPoll && (
              <span className="text-xs text-[#5e5e5e]">· polling</span>
            )}
          </div>
          <span className="px-2 py-1 bg-[#1b1b1b] border border-[#2a2a2a] rounded text-xs font-mono text-[#9b9b9b]">Sepolia</span>
        </div>
      </div>
    </nav>
  )
}
