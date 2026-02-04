import { useState, useEffect, useCallback, useRef } from 'react'
import './App.css'
import { fetchAgentState, checkAgentHealth, runAgentTick, addLiquidity, removeLiquidity, fetchMevStats } from './lib/agent'
import type { AgentState, TimelineEntry } from './lib/agent'

// Helper to render line with clickable links
function renderLineWithLinks(line: string): React.ReactNode {
  // Match URLs (https://...)
  const urlRegex = /(https?:\/\/[^\s]+)/g
  const parts = line.split(urlRegex)
  
  if (parts.length === 1) {
    return line
  }
  
  return parts.map((part, i) => {
    if (part.match(urlRegex)) {
      return (
        <a
          key={i}
          href={part}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
          className="text-[#00ffff] underline hover:text-[#00ff00] cursor-pointer"
        >
          {part}
        </a>
      )
    }
    return part
  })
}

function App() {
  const [state, setState] = useState<AgentState | null>(null)
  const [isLive, setIsLive] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [commandHistory, setCommandHistory] = useState<string[]>([])
  const [terminalOutput, setTerminalOutput] = useState<string[]>([])
  const [currentCommand, setCurrentCommand] = useState('')
  const [historyIndex, setHistoryIndex] = useState(-1)
  const terminalRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const addOutput = useCallback((lines: string | string[]) => {
    const newLines = Array.isArray(lines) ? lines : [lines]
    setTerminalOutput(prev => [...prev, ...newLines])
  }, [])

  // Fetch state from agent
  const refreshState = useCallback(async () => {
    try {
      const agentState = await fetchAgentState()
      setState(agentState)
      setError(null)
      setIsLive(true)
      setLoading(false)
    } catch (err: any) {
      setError(err.message)
      setIsLive(false)
      setLoading(false)
    }
  }, [])

  // Boot sequence
  useEffect(() => {
    const bootSequence = async () => {
      setTerminalOutput([
        '',
        '╔══════════════════════════════════════════════════════════════════╗',
        '║                                                                  ║',
        '║   ██╗   ██╗███╗   ██╗██╗███████╗██╗     ██╗   ██╗██╗  ██╗       ║',
        '║   ██║   ██║████╗  ██║██║██╔════╝██║     ██║   ██║╚██╗██╔╝       ║',
        '║   ██║   ██║██╔██╗ ██║██║█████╗  ██║     ██║   ██║ ╚███╔╝        ║',
        '║   ██║   ██║██║╚██╗██║██║██╔══╝  ██║     ██║   ██║ ██╔██╗        ║',
        '║   ╚██████╔╝██║ ╚████║██║██║     ███████╗╚██████╔╝██╔╝ ██╗       ║',
        '║    ╚═════╝ ╚═╝  ╚═══╝╚═╝╚═╝     ╚══════╝ ╚═════╝ ╚═╝  ╚═╝       ║',
        '║                                                                  ║',
        '║         Deterministic Liquidity Rebalancing Agent v1.0          ║',
        '║                      Uniswap v4 · Sepolia                        ║',
        '╚══════════════════════════════════════════════════════════════════╝',
        '',
        '[BOOT] Initializing UniFlux Agent Terminal...',
        '[BOOT] Loading kernel modules...',
      ])

      await new Promise(r => setTimeout(r, 500))
      addOutput('[BOOT] Connecting to Sepolia RPC...')
      
      const healthy = await checkAgentHealth()
      
      if (healthy) {
        addOutput('[  OK  ] Agent server connection established')
        await refreshState()
        addOutput('[  OK  ] On-chain state synchronized')
        addOutput('')
        addOutput('Type "help" for available commands.')
        addOutput('')
      } else {
        addOutput('[FAILED] Agent server not running')
        addOutput('[ERROR] Start with: npm run server')
        addOutput('')
        setLoading(false)
      }
    }

    bootSequence()

    // Poll every 5 seconds
    const interval = setInterval(refreshState, 5000)
    return () => clearInterval(interval)
  }, [refreshState, addOutput])

  // Auto-scroll terminal
  useEffect(() => {
    if (terminalRef.current) {
      terminalRef.current.scrollTop = terminalRef.current.scrollHeight
    }
  }, [terminalOutput])

  // Focus input on click
  const focusInput = () => {
    inputRef.current?.focus()
  }

  const executeCommand = async (cmd: string) => {
    const trimmed = cmd.trim().toLowerCase()
    const args = trimmed.split(' ')
    const command = args[0]

    addOutput(`uniflux@sepolia:~$ ${cmd}`)
    setCommandHistory(prev => [...prev, cmd])
    setHistoryIndex(-1)

    switch (command) {
      case '':
        break

      case 'help':
        addOutput([
          '',
          '┌─────────────────────────────────────────────────────────────┐',
          '│                    AVAILABLE COMMANDS                       │',
          '├─────────────────────────────────────────────────────────────┤',
          '│  status      - Display current agent state                  │',
          '│  tick        - Execute observe → decide → act cycle         │',
          '│  balances    - Show token balances                          │',
          '│  pool        - Show pool manager contract info              │',
          '│  timeline    - Show recent agent activity                   │',
          '│  mev         - Display MEV protection stats                 │',
          '│  liquidity   - Show liquidity positions                     │',
          '│  add <amt>   - Add liquidity (e.g., add 100)               │',
          '│  remove <amt>- Remove liquidity (e.g., remove 50)          │',
          '│  config      - Display agent configuration                  │',
          '│  clear       - Clear terminal output                        │',
          '│  help        - Show this help message                       │',
          '└─────────────────────────────────────────────────────────────┘',
          ''
        ])
        break

      case 'clear':
        setTerminalOutput([])
        break

      case 'status':
        if (!state) {
          addOutput(['[ERROR] No agent state available. Server may be offline.', ''])
        } else {
          const statusIcon = state.isHealthy ? '●' : '○'
          const statusColor = state.isHealthy ? 'HEALTHY' : 'ACTION REQUIRED'
          addOutput([
            '',
            '┌─── AGENT STATUS ─────────────────────────────────────────────┐',
            `│  Status:      ${statusIcon} ${statusColor.padEnd(44)}│`,
            `│  Decision:    ${state.status.padEnd(47)}│`,
            `│  Network:     ${state.network.padEnd(47)}│`,
            `│  Deviation:   ${(state.deviation?.toFixed(2) + '%').padEnd(47)}│`,
            `│  Threshold:   ${(state.threshold + '%').padEnd(47)}│`,
            `│  Volatility:  ${(state.volatility?.toFixed(4) || '0').padEnd(47)}│`,
            '└───────────────────────────────────────────────────────────────┘',
            ''
          ])
        }
        break

      case 'balances':
        if (!state) {
          addOutput(['[ERROR] No agent state available.', ''])
        } else {
          addOutput([
            '',
            '┌─── TOKEN BALANCES ───────────────────────────────────────────┐',
            `│  mETH:   ${state.balances.mETH.padEnd(52)}│`,
            `│  mUSDC:  ${state.balances.mUSDC.padEnd(52)}│`,
            '├───────────────────────────────────────────────────────────────┤',
            `│  Wallet: ${state.agentWallet.slice(0, 42).padEnd(52)}│`,
            '└───────────────────────────────────────────────────────────────┘',
            ''
          ])
        }
        break

      case 'tick':
        if (!isLive) {
          addOutput(['[ERROR] Agent server is offline.', ''])
          break
        }
        addOutput('[....] Executing agent tick...')
        try {
          const newState = await runAgentTick()
          setState(newState)
          
          // Build output with tick result
          const tickOutput: string[] = [
            '[  OK  ] Agent tick completed',
            `         Decision: ${newState.status}`,
            `         Deviation: ${newState.deviation?.toFixed(2)}%`,
          ]
          
          // Add transaction hash if an action was taken
          if (newState.lastAction?.txHash) {
            tickOutput.push(`         TX Hash: ${newState.lastAction.txHash}`)
            tickOutput.push(`         View: https://sepolia.etherscan.io/tx/${newState.lastAction.txHash}`)
          }
          
          // Add timeline if there are entries
          if (newState.timeline && newState.timeline.length > 0) {
            tickOutput.push('')
            tickOutput.push('─── AGENT TIMELINE ─────────────────────────────────────────────')
            newState.timeline.slice(0, 5).forEach((entry: TimelineEntry) => {
              const ts = new Date(entry.timestamp).toLocaleTimeString()
              const phase = entry.phase.padEnd(7)
              tickOutput.push(`[${ts}] ${phase} │ ${entry.message}`)
              if (entry.txHash) {
                tickOutput.push(`           │ TX: ${entry.txHash}`)
              }
            })
            tickOutput.push('────────────────────────────────────────────────────────────────')
          }
          
          tickOutput.push('')
          addOutput(tickOutput)
        } catch (err: any) {
          addOutput([`[FAILED] ${err.message}`, ''])
        }
        break

      case 'timeline':
        if (!state || state.timeline.length === 0) {
          addOutput(['[INFO] No timeline entries yet. Run "tick" to generate activity.', ''])
        } else {
          addOutput(['', '─── AGENT TIMELINE ─────────────────────────────────────────────'])
          state.timeline.slice(0, 10).forEach((entry: TimelineEntry) => {
            const ts = new Date(entry.timestamp).toLocaleTimeString()
            const phase = entry.phase.padEnd(7)
            addOutput(`[${ts}] ${phase} │ ${entry.message}`)
            if (entry.txHash) {
              addOutput(`           │ TX: ${entry.txHash}`)
              addOutput(`           │ https://sepolia.etherscan.io/tx/${entry.txHash}`)
            }
          })
          addOutput(['────────────────────────────────────────────────────────────────', ''])
        }
        break

      case 'mev':
        try {
          addOutput('[....] Fetching MEV protection stats...')
          const mevStats = await fetchMevStats()
          addOutput([
            '[  OK  ] MEV stats retrieved',
            '',
            '┌─── MEV PROTECTION (SANDWICH DETECTOR V2) ────────────────────┐',
            `│  Attacks Detected:  ${String(mevStats.detected).padEnd(41)}│`,
            `│  Victims Refunded:  ${String(mevStats.refunded).padEnd(41)}│`,
            `│  Treasury Balance:  ${mevStats.treasury.padEnd(41)}│`,
            `│  Avg Refund Rate:   ${(mevStats.avgRefundRate * 100).toFixed(1)}%`.padEnd(63) + '│',
            '└───────────────────────────────────────────────────────────────┘',
            ''
          ])
        } catch {
          addOutput(['[ERROR] Failed to fetch MEV stats.', ''])
        }
        break

      case 'liquidity':
        addOutput([
          '',
          '┌─── LIQUIDITY POSITIONS ──────────────────────────────────────┐',
          '│  Pool:          mETH / mUSDC                                 │',
          '│  Fee Tier:      0.3%                                         │',
          '│  Target Ratio:  50 / 50                                      │',
          '└───────────────────────────────────────────────────────────────┘',
          ''
        ])
        break

      case 'pool':
        if (!state) {
          addOutput(['[ERROR] No agent state available.', ''])
        } else {
          addOutput([
            '',
            '┌─── POOL MANAGER CONTRACT ────────────────────────────────────┐',
            '│  Uniswap v4 Pool Manager (Sepolia)                          │',
            '├───────────────────────────────────────────────────────────────┤',
            '│  Address:                                                    │',
            `│  ${state.poolManager}`,
            '│                                                              │',
            '│  View on Etherscan:                                          │',
            `│  https://sepolia.etherscan.io/address/${state.poolManager}`,
            '├───────────────────────────────────────────────────────────────┤',
            '│  Pool Tokens:  mETH / mUSDC                                  │',
            '│  Fee Tier:     3000 (0.3%)                                   │',
            '│  Tick Spacing: 60                                            │',
            '└───────────────────────────────────────────────────────────────┘',
            ''
          ])
        }
        break

      case 'add':
        const addAmt = args[1]
        if (!addAmt || isNaN(Number(addAmt))) {
          addOutput(['[ERROR] Usage: add <amount>', ''])
          break
        }
        addOutput(`[....] Adding ${addAmt} liquidity...`)
        try {
          const addResult = await addLiquidity(Number(addAmt))
          const addOutputLines = ['[  OK  ] Liquidity added successfully']
          if (addResult.txHash) {
            addOutputLines.push(`         TX Hash: ${addResult.txHash}`)
            addOutputLines.push(`         View: https://sepolia.etherscan.io/tx/${addResult.txHash}`)
          }
          addOutputLines.push('')
          addOutput(addOutputLines)
          await refreshState()
        } catch (err: any) {
          addOutput([`[FAILED] ${err.message}`, ''])
        }
        break

      case 'remove':
        const removeAmt = args[1]
        if (!removeAmt || isNaN(Number(removeAmt))) {
          addOutput(['[ERROR] Usage: remove <amount>', ''])
          break
        }
        addOutput(`[....] Removing ${removeAmt} liquidity...`)
        try {
          const removeResult = await removeLiquidity(Number(removeAmt))
          const removeOutputLines = ['[  OK  ] Liquidity removed successfully']
          if (removeResult.txHash) {
            removeOutputLines.push(`         TX Hash: ${removeResult.txHash}`)
            removeOutputLines.push(`         View: https://sepolia.etherscan.io/tx/${removeResult.txHash}`)
          }
          removeOutputLines.push('')
          addOutput(removeOutputLines)
          await refreshState()
        } catch (err: any) {
          addOutput([`[FAILED] ${err.message}`, ''])
        }
        break

      case 'config':
        if (!state) {
          addOutput(['[ERROR] No agent state available.', ''])
        } else {
          addOutput([
            '',
            '┌─── AGENT CONFIGURATION ──────────────────────────────────────┐',
            `│  Network:              ${state.network.padEnd(38)}│`,
            `│  Threshold:            ${(state.threshold + '%').padEnd(38)}│`,
            `│  Cross-Chain Thresh:   ${(state.crossChainThreshold + '%').padEnd(38)}│`,
            '├───────────────────────────────────────────────────────────────┤',
            '│  Pool Manager:                                               │',
            `│  ${state.poolManager.padEnd(60)}│`,
            `│  https://sepolia.etherscan.io/address/${state.poolManager}`,
            '├───────────────────────────────────────────────────────────────┤',
            '│  Agent Wallet:                                               │',
            `│  ${state.agentWallet.padEnd(60)}│`,
            `│  https://sepolia.etherscan.io/address/${state.agentWallet}`,
            '└───────────────────────────────────────────────────────────────┘',
            ''
          ])
        }
        break

      default:
        addOutput([`[ERROR] Unknown command: ${command}. Type "help" for available commands.`, ''])
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      executeCommand(currentCommand)
      setCurrentCommand('')
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      if (commandHistory.length > 0) {
        const newIndex = historyIndex < commandHistory.length - 1 ? historyIndex + 1 : historyIndex
        setHistoryIndex(newIndex)
        setCurrentCommand(commandHistory[commandHistory.length - 1 - newIndex] || '')
      }
    } else if (e.key === 'ArrowDown') {
      e.preventDefault()
      if (historyIndex > 0) {
        const newIndex = historyIndex - 1
        setHistoryIndex(newIndex)
        setCurrentCommand(commandHistory[commandHistory.length - 1 - newIndex] || '')
      } else {
        setHistoryIndex(-1)
        setCurrentCommand('')
      }
    }
  }

  return (
    <div 
      className="min-h-screen bg-[#0a0a0a] p-4 font-mono text-[#00ff00]"
      onClick={focusInput}
    >
      {/* Terminal Window */}
      <div className="max-w-4xl mx-auto">
        {/* Title Bar */}
        <div className="bg-[#1a1a1a] border border-[#003300] rounded-t-lg px-4 py-2 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-[#ff5f57]"></div>
            <div className="w-3 h-3 rounded-full bg-[#ffbd2e]"></div>
            <div className="w-3 h-3 rounded-full bg-[#28ca42]"></div>
          </div>
          <span className="text-[#00aa00] text-sm">uniflux@sepolia — agent-terminal</span>
          <div className="flex items-center gap-2 text-xs">
            <span className={`${isLive ? 'text-[#00ff00]' : 'text-[#ff3333]'}`}>
              {isLive ? '● LIVE' : '○ OFFLINE'}
            </span>
          </div>
        </div>

        {/* Terminal Body */}
        <div 
          ref={terminalRef}
          className="bg-[#0a0a0a] border-x border-b border-[#003300] rounded-b-lg p-4 h-[80vh] overflow-y-auto font-mono text-sm"
        >
          {/* Output */}
          {terminalOutput.map((line, i) => (
            <div 
              key={i} 
              className={`whitespace-pre ${
                line.includes('[  OK  ]') ? 'text-[#00ff00]' :
                line.includes('[FAILED]') || line.includes('[ERROR]') ? 'text-[#ff3333]' :
                line.includes('[BOOT]') || line.includes('[INFO]') || line.includes('[....]') ? 'text-[#00aaaa]' :
                line.includes('│') || line.includes('─') || line.includes('┌') || line.includes('└') || line.includes('┐') || line.includes('┘') || line.includes('├') || line.includes('┤') || line.includes('╔') || line.includes('╚') || line.includes('╗') || line.includes('╝') || line.includes('║') || line.includes('═') ? 'text-[#00aa00]' :
                'text-[#00ff00]'
              }`}
            >
              {renderLineWithLinks(line)}
            </div>
          ))}

          {/* Input Line */}
          {!loading && (
            <div className="flex items-center mt-1">
              <span className="text-[#00aaaa]">uniflux@sepolia:~$</span>
              <span className="ml-2">{currentCommand}</span>
              <span className="cursor-blink ml-0.5 w-2 h-4 bg-[#00ff00] inline-block"></span>
              <input
                ref={inputRef}
                type="text"
                value={currentCommand}
                onChange={(e) => setCurrentCommand(e.target.value)}
                onKeyDown={handleKeyDown}
                className="absolute opacity-0 pointer-events-none"
                autoFocus
              />
            </div>
          )}

          {/* Loading indicator */}
          {loading && (
            <div className="flex items-center text-[#00aaaa]">
              <span className="cursor-blink">_</span>
            </div>
          )}
        </div>

        {/* Status Bar */}
        <div className="bg-[#0f0f0f] border border-t-0 border-[#003300] px-4 py-1 text-xs text-[#006600] flex justify-between">
          <span>ENS: uniflux.eth | Network: Sepolia</span>
          <span>
            {state ? `Deviation: ${state.deviation?.toFixed(2)}% | Status: ${state.status}` : 'Connecting...'}
          </span>
        </div>
      </div>
    </div>
  )
}

export default App
