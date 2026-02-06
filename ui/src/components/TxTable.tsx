interface Transaction {
  label: string
  hash: string
  link: string
}

export default function TxTable() {
  const transactions: Transaction[] = [
    {
      label: 'Liquidity Added',
      hash: '0xb4f93ca0...e5ea',
      link: 'https://sepolia.uniscan.xyz/tx/0xb4f93ca003f358c391bc1e303c362dd075027b6d903d2f9cebb4165dddabe5ea'
    },
    {
      label: 'Swap Executed',
      hash: '0x8efb8b22...8296',
      link: 'https://sepolia.uniscan.xyz/tx/0x8efb8b22ecc09943a976f8101ceb1e6c8ea70b873877dc73ac0c45bd0a6b8296'
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
          ✓ Verified on Unichain Sepolia
        </p>
      </div>
    </div>
  )
}
