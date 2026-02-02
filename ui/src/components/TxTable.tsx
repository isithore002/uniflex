interface Transaction {
  label: string
  hash: string
  link: string
}

export default function TxTable() {
  const transactions: Transaction[] = [
    {
      label: 'Liquidity Added',
      hash: '0xbdd4a60a...e8d0',
      link: 'https://sepolia.etherscan.io/tx/0xbdd4a60a2fc31630ab6a23b8c017aec962a3a1cb546af16f2cc2a603a4dbe8d0'
    },
    {
      label: 'Swap Executed',
      hash: '0xf4a10e8b...0158',
      link: 'https://sepolia.etherscan.io/tx/0xf4a10e8b86f737dff12c354ab1d4dc02f5b16a1fc41c15267dd9ece0cb80158f'
    }
  ]

  return (
    <div id="transactions" className="mt-8 bg-[#1b1b1b] border border-[#2a2a2a] rounded-2xl">
      <div className="px-5 py-4 border-b border-[#2a2a2a]">
        <h2 className="text-base font-medium text-white">Verified Onchain Transactions</h2>
      </div>
      <div className="divide-y divide-[#2a2a2a]">
        {transactions.map((tx, i) => (
          <div key={i} className="px-5 py-3 flex items-center justify-between hover:bg-[#222222] transition-colors">
            <span className="text-sm text-[#9b9b9b]">{tx.label}</span>
            <a 
              href={tx.link}
              target="_blank"
              rel="noopener noreferrer"
              className="font-mono text-sm text-[#fc72ff] hover:opacity-80"
            >
              {tx.hash}
            </a>
          </div>
        ))}
      </div>
      <div className="px-5 py-3 bg-[#161616] border-t border-[#2a2a2a] rounded-b-2xl">
        <p className="text-xs text-[#5e5e5e]">
          ✓ Verified on Sepolia Etherscan
        </p>
      </div>
    </div>
  )
}
