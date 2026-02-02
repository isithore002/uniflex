import { useState, useEffect, useCallback } from 'react'
import './App.css'
import Navbar from './components/Navbar'
import Hero from './components/Hero'
import AgentStatus from './components/AgentStatus'
import DecisionFlow from './components/DecisionFlow'
import Timeline from './components/Timeline'
import TxTable from './components/TxTable'
import ControlPanel from './components/ControlPanel'
import LiquidityPanel from './components/LiquidityPanel'
import VolatilitySparkline from './components/VolatilitySparkline'
import { fetchAgentState, checkAgentHealth } from './lib/agent'
import type { AgentState } from './lib/agent'

function App() {
  const [state, setState] = useState<AgentState | null>(null)
  const [isLive, setIsLive] = useState(false)
  const [lastPoll, setLastPoll] = useState<Date | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  // Fetch state from agent
  const refreshState = useCallback(async () => {
    try {
      const agentState = await fetchAgentState()
      setState(agentState)
      setLastPoll(new Date())
      setError(null)
      setIsLive(true)
      setLoading(false)
    } catch (err: any) {
      setError(err.message)
      setIsLive(false)
      setLoading(false)
    }
  }, [])

  // Initial load + polling
  useEffect(() => {
    // Check health first
    checkAgentHealth().then(healthy => {
      if (healthy) {
        refreshState()
      } else {
        setError("Agent server not running. Start with: npm run server")
        setLoading(false)
      }
    })

    // Poll every 3 seconds
    const interval = setInterval(refreshState, 3000)
    return () => clearInterval(interval)
  }, [refreshState])

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-[#131313] flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-[#fc72ff] border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-[#9b9b9b]">Fetching live agent state…</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#131313]">
      <Navbar isLive={isLive} lastPoll={lastPoll} />
      <main className="max-w-4xl mx-auto px-6 py-8">
        <Hero />
        
        {error && (
          <div className="mb-6 p-4 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400 text-sm">
            ⚠️ {error}
          </div>
        )}

        <ControlPanel onStateUpdate={setState} isLive={isLive} />

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
          <AgentStatus state={state} />
          <DecisionFlow />
        </div>

        <VolatilitySparkline 
          volatility={state?.volatility || 0} 
          history={state?.volatilityHistory || []} 
        />

        <LiquidityPanel isLive={isLive} />
        
        <Timeline entries={state?.timeline || []} />
        <TxTable />
      </main>
    </div>
  )
}

export default App
