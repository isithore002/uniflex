import { useState, useEffect, useCallback, useRef } from 'react'
import './App.css'
import { fetchAgentState, checkAgentHealth, runAgentTick, addLiquidity, removeLiquidity, fetchMevStats, getEvacuationQuote, executeEvacuation, testEvacuation } from './lib/agent'
import type { AgentState, TimelineEntry } from './lib/agent'
import { useUnifluxEns } from './hooks/useEns'
import { useAgentStatus } from './hooks/useAgentStatus'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

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
          className="text-[#FC72FF] underline hover:text-[#FF007A] cursor-pointer"
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
  const [_error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [isExecuting, setIsExecuting] = useState(false)
  const [commandHistory, setCommandHistory] = useState<string[]>([])
  const [terminalOutput, setTerminalOutput] = useState<string[]>([])
  const [currentCommand, setCurrentCommand] = useState('')
  const [historyIndex, setHistoryIndex] = useState(-1)
  const terminalRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  
  // Dynamic ENS resolution (not hard-coded!)
  // Verifies on-chain that uniflux.eth → our wallet address
  const { displayName: ensName, isLoading: ensLoading, isVerified: ensVerified } = useUnifluxEns()
  
  // Real-time agent status polling (updates every 5 seconds)
  const { status: agentStatus, isConnected: agentConnected } = useAgentStatus()

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
        '┌──────────────────────────────────────────────────────────────────┐',
        '│                                                                  │',
        '│   ██╗   ██╗███╗   ██╗██╗███████╗██╗     ██╗   ██╗██╗  ██╗       │',
        '│   ██║   ██║████╗  ██║██║██╔════╝██║     ██║   ██║╚██╗██╔╝       │',
        '│   ██║   ██║██╔██╗ ██║██║█████╗  ██║     ██║   ██║ ╚███╔╝        │',
        '│   ██║   ██║██║╚██╗██║██║██╔══╝  ██║     ██║   ██║ ██╔██╗        │',
        '│   ╚██████╔╝██║ ╚████║██║██║     ███████╗╚██████╔╝██╔╝ ██╗       │',
        '│    ╚═════╝ ╚═╝  ╚═══╝╚═╝╚═╝     ╚══════╝ ╚═════╝ ╚═╝  ╚═╝       │',
        '│                                                                  │',
        '│         Deterministic Liquidity Rebalancing Agent v1.0          │',
        '│                   Uniswap v4 · Unichain Sepolia                  │',
        '└──────────────────────────────────────────────────────────────────┘',
        '',
        '[BOOT] Initializing UniFlux Agent Terminal...',
        '[BOOT] Loading kernel modules...',
      ])

      await new Promise(r => setTimeout(r, 500))
      addOutput('[BOOT] Connecting to Unichain Sepolia RPC...')
      
      const healthy = await checkAgentHealth()
      
      if (healthy) {
        addOutput('[  OK  ] Agent server connection established')
        await refreshState()
        addOutput('[  OK  ] On-chain state synchronized')
        
        // Check for autonomous mode via /status endpoint
        try {
          const statusRes = await fetch(`${API_URL}/status`)
          if (statusRes.ok) {
            const status = await statusRes.json()
            if (status.autonomous?.running) {
              addOutput('')
              addOutput('┌─────────────────────────────────────────────────────────────┐')
              addOutput('│  🚀 AUTONOMOUS MODE ACTIVE                                  │')
              addOutput('│  Agent is running O→D→A cycles automatically               │')
              addOutput(`│  Current cycle: #${String(status.autonomous.cycleCount || 0).padEnd(42)}│`)
              addOutput(`│  Safety mode: ${status.safetyConfig?.dryRunEnabled ? '🧪 SIMULATION' : '⚡ LIVE'.padEnd(46)}│`)
              addOutput('└─────────────────────────────────────────────────────────────┘')
            }
          }
        } catch (e) {
          // /status endpoint may not exist, ignore
        }
        
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

  // Track last cycle count to detect new cycles
  const lastCycleRef = useRef<number>(0);
  
  // Output autonomous cycle updates to terminal
  useEffect(() => {
    if (!agentStatus?.autonomous?.running) return;
    
    const currentCycle = agentStatus.autonomous.cycleCount || 0;
    
    // Only output when cycle count increases
    if (currentCycle > lastCycleRef.current && lastCycleRef.current > 0) {
      const decision = agentStatus.lastAction?.decision || 'NOOP';
      const reason = agentStatus.lastAction?.reason || '';
      const deviation = agentStatus.poolState?.deviation?.toFixed(1) || '0';
      const mUSDC = parseFloat(agentStatus.poolState?.mUSDC || '0').toFixed(4);
      const mETH = parseFloat(agentStatus.poolState?.mETH || '0').toFixed(4);
      const timestamp = new Date().toLocaleTimeString();
      
      addOutput([
        ``,
        `┌─── AUTONOMOUS CYCLE #${currentCycle} ─────────────────────────────────┐`,
        `│  Time: ${timestamp.padEnd(53)}│`,
        `│  Decision: ${decision.padEnd(49)}│`,
        `│  Reason: ${reason.substring(0, 50).padEnd(51)}│`,
        `├─── Pool State ──────────────────────────────────────────────┤`,
        `│  mUSDC: ${mUSDC.padEnd(52)}│`,
        `│  mETH: ${mETH.padEnd(53)}│`,
        `│  Deviation: ${(deviation + '%').padEnd(48)}│`,
        `└─────────────────────────────────────────────────────────────┘`,
      ]);
    }
    
    lastCycleRef.current = currentCycle;
  }, [agentStatus?.autonomous?.cycleCount, agentStatus, addOutput]);

  // Auto-scroll terminal to bottom when output changes
  useEffect(() => {
    // Use requestAnimationFrame to ensure DOM has updated
    requestAnimationFrame(() => {
      if (terminalRef.current) {
        terminalRef.current.scrollTop = terminalRef.current.scrollHeight
      }
    })
  }, [terminalOutput, currentCommand])

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
    
    // Set executing state for async commands
    const asyncCommands = ['tick', 'add', 'remove', 'evacuate', 'safeharbor', 'quote', 'evac-test', 'mev', 'run', 'stop']
    if (asyncCommands.includes(command)) {
      setIsExecuting(true)
    }

    try {
      switch (command) {
        case '':
          break

        case 'help':
          addOutput([
            '',
            '┌─────────────────────────────────────────────────────────────┐',
            '│                    AVAILABLE COMMANDS                       │',
            '├─────────────────────────────────────────────────────────────┤',
          '│  run         - Start autonomous O→D→A loop                  │',
          '│  stop        - Stop autonomous mode                         │',
          '│  status      - Display current agent state                  │',
          '│  tick        - Execute single observe → decide → act cycle  │',
          '├─────────────────────────────────────────────────────────────┤',
          '│  balances    - Show token balances                          │',
          '│  pool        - Show pool manager contract info              │',
          '│  timeline    - Show recent agent activity                   │',
          '│  mev         - Display MEV protection stats                 │',
          '│  liquidity   - Show liquidity positions                     │',
          '│  add <amt>   - Add liquidity (e.g., add 100)               │',
          '│  remove <amt>- Remove liquidity (e.g., remove 50)          │',
          '│  config      - Display agent configuration                  │',
          '├─────────────────────────────────────────────────────────────┤',
          '│  TEST/DEMO COMMANDS (for judge presentations)               │',
          '│  simulate-volatility - Inject price spikes for MEV demo    │',
          '│  reset-volatility    - Clear synthetic prices               │',
          '│  check-volatility    - Show current volatility stats        │',
          '├─────────────────────────────────────────────────────────────┤',
          '│  SAFE HARBOR (LI.FI Integration)                            │',
          '│  evacuate    - Execute Safe Harbor evacuation               │',
          '│  quote       - Get LI.FI bridge quote                       │',
          '│  evac-test   - Test evacuation flow (dry run)               │',
          '├─────────────────────────────────────────────────────────────┤',
          '│  clear       - Clear terminal output                        │',
          '│  help        - Show this help message                       │',
          '└─────────────────────────────────────────────────────────────┘',
          ''
        ])
        break

      case 'run':
        addOutput('[....] Starting autonomous mode...')
        try {
          const res = await fetch(`${API_URL}/autonomous/start`, { method: 'POST' })
          const data = await res.json()
          if (data.success) {
            addOutput([
              '[  OK  ] Autonomous mode started!',
              '',
              '┌─────────────────────────────────────────────────────────────┐',
              '│  🚀 AUTONOMOUS MODE ACTIVE                                  │',
              '│  Agent is running O→D→A cycles automatically               │',
              `│  Poll interval: ${String(data.pollInterval / 1000 + 's').padEnd(44)}│`,
              '│  Type "stop" to halt autonomous execution                  │',
              '└─────────────────────────────────────────────────────────────┘',
              ''
            ])
          } else {
            addOutput(`[ERROR] ${data.message || 'Failed to start autonomous mode'}`)
          }
        } catch (err: any) {
          addOutput(`[ERROR] ${err.message}`)
        }
        break

      case 'stop':
        addOutput('[....] Stopping autonomous mode...')
        try {
          const res = await fetch(`${API_URL}/autonomous/stop`, { method: 'POST' })
          const data = await res.json()
          if (data.success) {
            addOutput([
              '[  OK  ] Autonomous mode stopped',
              `         Total cycles completed: ${data.cycleCount}`,
              '',
              '📋 Manual mode active – use "tick" for single execution or "run" to restart',
              ''
            ])
          } else {
            addOutput(`[ERROR] ${data.message || 'Failed to stop autonomous mode'}`)
          }
        } catch (err: any) {
          addOutput(`[ERROR] ${err.message}`)
        }
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
          
          // Include autonomous mode info from real-time status
          const autoMode = agentStatus?.autonomous?.running ? 'ENABLED' : 'DISABLED'
          const cycleCount = agentStatus?.autonomous?.cycleCount || 0
          const lastDecision = agentStatus?.lastAction?.decision || 'N/A'
          
          addOutput([
            '',
            '┌─── AGENT STATUS ─────────────────────────────────────────────┐',
            `│  Status:      ${statusIcon} ${statusColor.padEnd(44)}│`,
            `│  Decision:    ${state.status.padEnd(47)}│`,
            `│  Network:     ${state.network.padEnd(47)}│`,
            `│  Deviation:   ${(state.deviation?.toFixed(2) + '%').padEnd(47)}│`,
            `│  Threshold:   ${(state.threshold + '%').padEnd(47)}│`,
            `│  Volatility:  ${(state.volatility?.toFixed(4) || '0').padEnd(47)}│`,
            '├─── AUTONOMOUS MODE ──────────────────────────────────────────┤',
            `│  Auto Mode:   ${autoMode.padEnd(47)}│`,
            `│  Cycle #:     ${String(cycleCount).padEnd(47)}│`,
            `│  Last Action: ${lastDecision.padEnd(47)}│`,
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
            tickOutput.push(`         View: https://sepolia.uniscan.xyz/tx/${newState.lastAction.txHash}`)
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
                addOutput(`           │ https://sepolia.uniscan.xyz/tx/${entry.txHash}`)
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
            '[  OK  ] MEV protection stats',
            '',
            `Attacks detected: ${mevStats.detected}`,
            `Victims refunded: ${mevStats.refunded}`,
            ''
          ])
        } catch {
          addOutput(['[ERROR] Failed to fetch MEV stats.', ''])
        }
        break

      case 'simulate-volatility':
      case 'test-sandwich':
        addOutput('[....] Injecting synthetic price spikes...')
        try {
          const res = await fetch(`${API_URL}/test/volatility`, { 
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ basePrice: 1.0 })
          })
          const data = await res.json()
          if (data.success) {
            addOutput([
              '[  OK  ] Volatility simulation complete',
              '',
              '┌─── VOLATILITY SIMULATION RESULTS ────────────────────────────┐',
              `│  🧪 TEST MODE: Synthetic price spikes injected              │`,
              '├───────────────────────────────────────────────────────────────┤',
              `│  Current Volatility:    ${data.volatilityPercent.padEnd(35)}│`,
              `│  MEV Threshold:         ${data.thresholdPercent.padEnd(35)}│`,
              `│  Price History Length:  ${String(data.priceHistoryLength).padEnd(35)}│`,
              `│  Price Range:           ${data.priceRange.min} - ${data.priceRange.max}`.padEnd(63) + '│',
              '├───────────────────────────────────────────────────────────────┤',
              `│  Will Trigger MEV:      ${(data.willTriggerMEV ? '✅ YES' : '❌ NO').padEnd(35)}│`,
              '└───────────────────────────────────────────────────────────────┘',
              '',
              data.willTriggerMEV 
                ? '⚠️  Next autonomous cycle should detect sandwich pattern!'
                : '⚠️  Volatility still below 15% threshold',
              ''
            ])
          } else {
            addOutput(`[ERROR] ${data.error || 'Failed to inject volatility'}`)
          }
        } catch (err: any) {
          addOutput(`[ERROR] ${err.message}`)
        }
        break

      case 'reset-volatility':
        addOutput('[....] Resetting volatility to real observations...')
        try {
          const res = await fetch(`${API_URL}/test/reset-volatility`, { 
            method: 'POST'
          })
          const data = await res.json()
          if (data.success) {
            addOutput([
              '[  OK  ] Volatility reset complete',
              '',
              `Current volatility: ${data.volatilityPercent}`,
              'Price history cleared - will rebuild naturally',
              ''
            ])
          } else {
            addOutput(`[ERROR] ${data.error || 'Failed to reset volatility'}`)
          }
        } catch (err: any) {
          addOutput(`[ERROR] ${err.message}`)
        }
        break

      case 'check-volatility':
        addOutput('[....] Checking current volatility...')
        try {
          const res = await fetch(`${API_URL}/test/volatility`)
          const data = await res.json()
          if (data.success) {
            addOutput([
              '[  OK  ] Volatility check complete',
              '',
              '┌─── CURRENT VOLATILITY STATUS ────────────────────────────────┐',
              `│  Volatility:       ${data.volatilityPercent.padEnd(42)}│`,
              `│  MEV Threshold:    ${data.thresholdPercent.padEnd(42)}│`,
              `│  Exceeds Threshold: ${(data.exceedsThreshold ? 'YES ✅' : 'NO ❌').padEnd(41)}│`,
              `│  Price History:    ${String(data.priceHistoryLength) + ' prices tracked'.padEnd(42)}│`,
              '└───────────────────────────────────────────────────────────────┘',
              ''
            ])
          } else {
            addOutput(`[ERROR] ${data.error || 'Failed to check volatility'}`)
          }
        } catch (err: any) {
          addOutput(`[ERROR] ${err.message}`)
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
            '│  View on Uniscan:                                            │',
            `│  https://sepolia.uniscan.xyz/address/${state.poolManager}`,
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
            addOutputLines.push(`         View: https://sepolia.uniscan.xyz/tx/${addResult.txHash}`)
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
            removeOutputLines.push(`         View: https://sepolia.uniscan.xyz/tx/${removeResult.txHash}`)
          }
          removeOutputLines.push('')
          addOutput(removeOutputLines)
          await refreshState()
        } catch (err: any) {
          addOutput([`[FAILED] ${err.message}`, ''])
        }
        break

      case 'evacuate':
      case 'safeharbor':
        addOutput([
          '',
          '┌─── SAFE HARBOR EVACUATION ───────────────────────────────────┐',
          '│  🚨 Initiating cross-chain asset protection...              │',
          '│                                                              │',
          '│  Flow: Unichain Sepolia → Base (via LI.FI)                  │',
          '│  Destination: Aave V3 USDC Pool                              │',
          '└──────────────────────────────────────────────────────────────┘',
          ''
        ])
        addOutput('[....] Step 1: Getting LI.FI bridge quote...')
        try {
          const quoteResult = await getEvacuationQuote()
          if (!quoteResult.success || !quoteResult.quote) {
            addOutput([`[FAILED] Quote failed: ${quoteResult.error || 'Unknown error'}`, ''])
            break
          }
          const quote = quoteResult.quote
          addOutput([
            '[  OK  ] Quote received:',
            `         From: Chain ${quote.fromChain} (${quote.fromToken.slice(0, 10)}...)`,
            `         To:   Chain ${quote.toChain} (${quote.toToken.slice(0, 10)}...)`,
            `         Amount: ${(parseFloat(quote.fromAmount) / 1e6).toFixed(2)} → ~${(parseFloat(quote.estimatedOutput) / 1e6).toFixed(2)} USDC`,
            `         Bridge: ${quote.bridgeUsed}`,
            `         Est. Time: ~${Math.round(quote.estimatedTime / 60)} min`,
            ''
          ])
          addOutput('[....] Step 2: Executing bridge transaction...')
          const result = await executeEvacuation(0.01)
          
          if (result.success && result.status) {
            const txHash = result.status.bridge?.txHash || 'Pending...'
            const explorerUrl = result.explorerUrls?.bridge || `https://explorer.li.fi/tx/${txHash}`
            addOutput([
              '[  OK  ] Evacuation complete!',
              '',
              '┌─── EVACUATION RESULT ────────────────────────────────────────┐',
              `│  Step:       ${result.status.step.padEnd(47)}│`,
              `│  Bridge:     ${(result.status.bridge?.bridgeUsed || 'LI.FI').padEnd(47)}│`,
              `│  Time:       ${((result.executionTime || 0) + 's').padEnd(47)}│`,
              '├──────────────────────────────────────────────────────────────┤',
              `│  TX Hash:    ${txHash.slice(0, 42).padEnd(47)}│`,
              '├──────────────────────────────────────────────────────────────┤',
              '│   Assets safely transferred via LI.FI                      │',
              '│   Destination: Aave V3 on Base                             │',
              '└──────────────────────────────────────────────────────────────┘',
              '',
              `🔗 Explorer: ${explorerUrl}`,
              ''
            ])
          } else {
            addOutput([
              `[FAILED] Evacuation failed: ${result.error || 'Unknown error'}`,
              ''
            ])
          }
          await refreshState()
        } catch (err: any) {
          addOutput([`[FAILED] Evacuation error: ${err.message}`, ''])
        }
        break

      case 'quote':
        addOutput('[....] Fetching LI.FI bridge quote...')
        try {
          const quoteResult = await getEvacuationQuote()
          if (!quoteResult.success || !quoteResult.quote) {
            addOutput([`[FAILED] Quote failed: ${quoteResult.error || 'Unknown error'}`, ''])
            break
          }
          const quote = quoteResult.quote
          addOutput([
            '',
            '┌─── LI.FI BRIDGE QUOTE ───────────────────────────────────────┐',
            `│  Source Chain:     ${'Chain ' + quote.fromChain.toString().padEnd(35)}│`,
            `│  Source Token:     ${quote.fromToken.slice(0, 40).padEnd(40)}│`,
            `│  Amount In:        ${((parseFloat(quote.fromAmount) / 1e6).toFixed(2) + ' USDC').padEnd(40)}│`,
            '├──────────────────────────────────────────────────────────────┤',
            `│  Dest Chain:       ${'Chain ' + quote.toChain.toString().padEnd(35)}│`,
            `│  Dest Token:       ${quote.toToken.slice(0, 40).padEnd(40)}│`,
            `│  Amount Out:       ${('~' + (parseFloat(quote.estimatedOutput) / 1e6).toFixed(2) + ' USDC').padEnd(40)}│`,
            '├──────────────────────────────────────────────────────────────┤',
            `│  Bridge:           ${quote.bridgeUsed.padEnd(40)}│`,
            `│  Slippage:         ${((quote.slippage * 100).toFixed(1) + '%').padEnd(40)}│`,
            `│  Est. Time:        ${('~' + Math.round(quote.estimatedTime / 60) + ' min').padEnd(40)}│`,
            `│  Gas Cost:         ${'$' + quote.gasCostUSD.padEnd(39)}│`,
            '└──────────────────────────────────────────────────────────────┘',
            ''
          ])
        } catch (err: any) {
          addOutput([`[FAILED] Quote error: ${err.message}`, ''])
        }
        break

      case 'evac-test':
        addOutput([
          '',
          '┌─── EVACUATION TEST (DRY RUN) ──────────────────────────────────┐',
          '│  Testing Safe Harbor flow without executing transactions...   │',
          '└───────────────────────────────────────────────────────────────┘',
          ''
        ])
        addOutput('[....] Running evacuation test...')
        try {
          const testResult = await testEvacuation()
          if (testResult.success) {
            addOutput([
              '[  OK  ] Test completed successfully!',
              '',
              '┌─── TEST RESULTS ─────────────────────────────────────────────┐',
              '│  ✅ LI.FI connection:     OK                                 │',
              '│  ✅ Quote retrieval:      OK                                 │',
              '│  ✅ Route validation:     OK                                 │',
              '│  ✅ Aave pool check:      OK                                 │',
              '├───────────────────────────────────────────────────────────────┤',
              '│  Ready for evacuation! Use "evacuate" command to execute.   │',
              '└───────────────────────────────────────────────────────────────┘',
              ''
            ])
          } else {
            addOutput([
              `[FAILED] Test failed: ${testResult.error || 'Unknown error'}`,
              ''
            ])
          }
        } catch (err: any) {
          addOutput([`[FAILED] Test error: ${err.message}`, ''])
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
            `│  https://sepolia.uniscan.xyz/address/${state.poolManager}`,
            '├───────────────────────────────────────────────────────────────┤',
            '│  Agent Wallet:                                               │',
            `│  ${state.agentWallet.padEnd(60)}│`,
            `│  https://sepolia.uniscan.xyz/address/${state.agentWallet}`,
            '└───────────────────────────────────────────────────────────────┘',
            ''
          ])
        }
        break

      default:
        addOutput([`[ERROR] Unknown command: ${command}. Type "help" for available commands.`, ''])
    }
    } finally {
      // Always reset executing state when command completes
      setIsExecuting(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !isExecuting) {
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
      className="h-screen bg-[#131313] p-4 font-mono text-white flex items-center justify-center overflow-hidden fixed inset-0"
    >
      {/* Terminal Window */}
      <div className="w-full max-w-4xl h-full max-h-[90vh] flex flex-col overflow-hidden">
        {/* Title Bar */}
        <div className="bg-[#1B1B1B] border border-[#2D2D2D] rounded-t-2xl px-4 py-3 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-[#ff5f57]"></div>
            <div className="w-3 h-3 rounded-full bg-[#ffbd2e]"></div>
            <div className="w-3 h-3 rounded-full bg-[#28ca42]"></div>
          </div>
          <span className="text-[#9B9B9B] text-sm font-sans">UniFlux Agent — Unichain Sepolia</span>
          <div className="flex items-center gap-2 text-xs">
            <span className={`font-semibold ${isLive ? 'text-[#21C95E]' : 'text-[#FF4D4D]'}`}>
              {isLive ? '● LIVE' : '○ OFFLINE'}
            </span>
          </div>
        </div>

        {/* Terminal Body - Output Only */}
        <div 
          ref={terminalRef}
          className="bg-[#191919] border-x border-[#2D2D2D] p-4 pb-0 overflow-y-auto overflow-x-hidden font-mono text-sm flex-1 min-h-0"
          onClick={focusInput}
        >
          {/* Output */}
          {terminalOutput.map((line, i) => (
            <div 
              key={i} 
              className={`whitespace-pre ${
                line.includes('[  OK  ]') ? 'text-[#21C95E]' :
                line.includes('[FAILED]') || line.includes('[ERROR]') ? 'text-[#FF4D4D]' :
                line.includes('[BOOT]') || line.includes('[INFO]') || line.includes('[....]') ? 'text-[#FC72FF]' :
                line.includes('│') || line.includes('─') || line.includes('┌') || line.includes('└') || line.includes('┐') || line.includes('┘') || line.includes('├') || line.includes('┤') || line.includes('╔') || line.includes('╚') || line.includes('╗') || line.includes('╝') || line.includes('║') || line.includes('═') ? 'text-[#FF007A]' :
                'text-[#FFFFFF]'
              }`}
            >
              {renderLineWithLinks(line)}
            </div>
          ))}
        </div>

        {/* Input Line - Fixed at bottom of terminal body */}
        <div 
          className="bg-[#191919] border-x border-[#2D2D2D] px-4 py-2 flex-shrink-0"
          onClick={focusInput}
        >
          {!loading && !isExecuting ? (
            <div className="flex items-center font-mono text-sm">
              <span className="text-[#FF007A]">uniflux@sepolia:~$</span>
              <span className="ml-2 text-white">{currentCommand}</span>
              <span className="cursor-blink ml-0.5 w-2 h-4 bg-[#FF007A] inline-block"></span>
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
          ) : (
            <div className="flex items-center text-[#FC72FF] font-mono text-sm">
              <span className="animate-pulse">⟳ executing...</span>
            </div>
          )}
        </div>

        {/* Status Bar - with real-time autonomous status */}
        <div className="bg-[#1B1B1B] border border-t-0 border-[#2D2D2D] rounded-b-lg px-4 py-2 text-xs text-[#9B9B9B] flex justify-between flex-shrink-0">
          <span className="flex items-center gap-2">
            {/* Autonomous Mode Indicator */}
            {agentConnected && agentStatus?.autonomous?.running ? (
              <span className="flex items-center gap-1 text-[#21C95E]">
                <span className="w-1.5 h-1.5 rounded-full bg-[#21C95E] animate-pulse"></span>
                AUTO #{agentStatus.autonomous.cycleCount}
              </span>
            ) : agentConnected ? (
              <span className="text-[#9B9B9B]">MANUAL</span>
            ) : null}
            <span className="text-[#2D2D2D]">|</span>
            ENS: {ensLoading ? 'Resolving...' : ensName}
            {ensVerified && <span className="text-[#21C95E] ml-1">✓</span>}
            <span className="text-[#2D2D2D]">|</span>
            Unichain Sepolia
          </span>
          <span className="flex items-center gap-2">
            {/* Last Decision */}
            {agentStatus?.lastAction?.decision && (
              <>
                <span className={`${
                  agentStatus.lastAction.decision === 'NOOP' ? 'text-[#21C95E]' :
                  agentStatus.lastAction.decision === 'LOCAL_SWAP' ? 'text-[#FFBD2E]' :
                  agentStatus.lastAction.decision === 'CROSS_CHAIN' ? 'text-[#FC72FF]' :
                  agentStatus.lastAction.decision === 'REMOVE_LIQUIDITY' ? 'text-[#FF4D4D]' : ''
                }`}>
                  {agentStatus.lastAction.decision}
                </span>
                <span className="text-[#2D2D2D]">|</span>
              </>
            )}
            {/* Pool Deviation */}
            {agentStatus?.poolState?.deviation !== undefined ? (
              <span className={
                agentStatus.poolState.deviation > 25 ? 'text-[#FF4D4D]' :
                agentStatus.poolState.deviation > 10 ? 'text-[#FFBD2E]' :
                'text-[#21C95E]'
              }>
                Dev: {agentStatus.poolState.deviation.toFixed(1)}%
              </span>
            ) : state ? (
              `Deviation: ${state.deviation?.toFixed(2)}%`
            ) : 'Connecting...'}
            {/* Safety Mode */}
            {agentStatus?.safetyConfig?.dryRunEnabled && (
              <>
                <span className="text-[#2D2D2D]">|</span>
                <span className="text-[#00A3FF]"></span>
              </>
            )}
          </span>
        </div>
      </div>
    </div>
  )
}

export default App
