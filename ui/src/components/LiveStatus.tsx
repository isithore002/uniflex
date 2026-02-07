import { useAgentStatus } from '../hooks/useAgentStatus';

export function LiveStatusBar() {
  const { status, loading, error, isConnected } = useAgentStatus();

  if (loading && !status) {
    return (
      <div className="bg-[#1a1a1a] border-b border-[#2D2D2D] px-4 py-2 flex items-center justify-between text-xs font-mono">
        <span className="text-gray-500">Connecting to agent...</span>
      </div>
    );
  }

  if (error || !isConnected) {
    return (
      <div className="bg-[#1a1a1a] border-b border-[#2D2D2D] px-4 py-2 flex items-center justify-between text-xs font-mono">
        <span className="text-red-500">⚠ Agent disconnected</span>
        <span className="text-gray-500">{error}</span>
      </div>
    );
  }

  const isAutonomous = status?.autonomous?.running;
  const cycleCount = status?.autonomous?.cycleCount || 0;
  const decision = status?.lastAction?.decision || 'NOOP';
  const mUSDC = parseFloat(status?.poolState?.mUSDC || '0').toFixed(4);
  const mETH = parseFloat(status?.poolState?.mETH || '0').toFixed(4);
  const deviation = status?.poolState?.deviation?.toFixed(1) || '0';
  const dryRun = status?.safetyConfig?.dryRunEnabled;

  // Decision color
  const decisionColor = {
    'NOOP': 'text-green-400',
    'LOCAL_SWAP': 'text-yellow-400',
    'CROSS_CHAIN': 'text-orange-400',
    'REMOVE_LIQUIDITY': 'text-red-400'
  }[decision] || 'text-gray-400';

  return (
    <div className="bg-[#1a1a1a] border-b border-[#2D2D2D] px-4 py-2 flex items-center justify-between text-xs font-mono">
      {/* Left: Mode & Cycle */}
      <div className="flex items-center gap-4">
        <span className={`flex items-center gap-1 ${isAutonomous ? 'text-green-400' : 'text-gray-500'}`}>
          <span className={`w-2 h-2 rounded-full ${isAutonomous ? 'bg-green-400 animate-pulse' : 'bg-gray-500'}`}></span>
          {isAutonomous ? 'AUTO' : 'MANUAL'}
        </span>
        <span className="text-gray-400">
          Cycle #{cycleCount}
        </span>
        <span className={decisionColor}>
          {decision}
        </span>
      </div>

      {/* Center: Pool State */}
      <div className="flex items-center gap-4 text-gray-400">
        <span>mUSDC: <span className="text-white">{mUSDC}</span></span>
        <span>mETH: <span className="text-white">{mETH}</span></span>
        <span>Dev: <span className={parseFloat(deviation) > 10 ? 'text-yellow-400' : 'text-white'}>{deviation}%</span></span>
      </div>

      {/* Right: Safety Mode */}
      <div className="flex items-center gap-2">
        {dryRun ? (
          <span className="text-blue-400 bg-blue-400/20 px-2 py-0.5 rounded">🧪 SIMULATION</span>
        ) : (
          <span className="text-red-400 bg-red-400/20 px-2 py-0.5 rounded">⚡ LIVE</span>
        )}
      </div>
    </div>
  );
}

export function LiveStatusPanel() {
  const { status, loading, error, lastUpdate, refresh } = useAgentStatus();

  if (loading && !status) {
    return (
      <div className="bg-[#191919] rounded-lg p-4 border border-[#2D2D2D]">
        <div className="animate-pulse text-gray-500">Connecting to agent...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-[#191919] rounded-lg p-4 border border-red-500/50">
        <div className="text-red-400">⚠ Error: {error}</div>
        <button 
          onClick={refresh}
          className="mt-2 px-3 py-1 bg-red-500/20 text-red-400 rounded hover:bg-red-500/30"
        >
          Retry
        </button>
      </div>
    );
  }

  const isAutonomous = status?.autonomous?.running;
  const cycleCount = status?.autonomous?.cycleCount || 0;
  const decision = status?.lastAction?.decision || 'NOOP';
  const reason = status?.lastAction?.reason || 'Waiting...';
  const mUSDC = parseFloat(status?.poolState?.mUSDC || '0').toFixed(4);
  const mETH = parseFloat(status?.poolState?.mETH || '0').toFixed(4);
  const deviation = status?.poolState?.deviation?.toFixed(2) || '0';
  const volatility = ((status?.poolState?.volatility || 0) * 100).toFixed(2);
  const lastBridge = status?.lastBridgeAttempt;

  return (
    <div className="bg-[#191919] rounded-lg border border-[#2D2D2D] overflow-hidden">
      {/* Header */}
      <div className="bg-[#1a1a1a] px-4 py-2 border-b border-[#2D2D2D] flex items-center justify-between">
        <h3 className="text-[#FF007A] font-bold">🤖 Agent Status</h3>
        <div className="flex items-center gap-2 text-xs">
          <span className={`flex items-center gap-1 ${isAutonomous ? 'text-green-400' : 'text-gray-500'}`}>
            <span className={`w-2 h-2 rounded-full ${isAutonomous ? 'bg-green-400 animate-pulse' : 'bg-gray-500'}`}></span>
            {isAutonomous ? 'Autonomous' : 'Manual'}
          </span>
          {lastUpdate && (
            <span className="text-gray-500">
              Updated: {lastUpdate.toLocaleTimeString()}
            </span>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="p-4 grid grid-cols-2 gap-4 text-sm">
        {/* Cycle Info */}
        <div className="space-y-2">
          <div className="text-gray-400">Cycle Count</div>
          <div className="text-2xl font-bold text-white">#{cycleCount}</div>
        </div>

        {/* Last Decision */}
        <div className="space-y-2">
          <div className="text-gray-400">Last Decision</div>
          <div className={`text-lg font-bold ${
            decision === 'NOOP' ? 'text-green-400' :
            decision === 'LOCAL_SWAP' ? 'text-yellow-400' :
            decision === 'CROSS_CHAIN' ? 'text-orange-400' :
            decision === 'REMOVE_LIQUIDITY' ? 'text-red-400' : 'text-white'
          }`}>
            {decision}
          </div>
          <div className="text-xs text-gray-500 truncate">{reason}</div>
        </div>

        {/* Pool State */}
        <div className="col-span-2 grid grid-cols-4 gap-2 bg-[#1a1a1a] rounded p-3">
          <div>
            <div className="text-gray-500 text-xs">mUSDC</div>
            <div className="text-white font-mono">{mUSDC}</div>
          </div>
          <div>
            <div className="text-gray-500 text-xs">mETH</div>
            <div className="text-white font-mono">{mETH}</div>
          </div>
          <div>
            <div className="text-gray-500 text-xs">Deviation</div>
            <div className={`font-mono ${parseFloat(deviation) > 25 ? 'text-red-400' : parseFloat(deviation) > 10 ? 'text-yellow-400' : 'text-green-400'}`}>
              {deviation}%
            </div>
          </div>
          <div>
            <div className="text-gray-500 text-xs">Volatility</div>
            <div className={`font-mono ${parseFloat(volatility) > 15 ? 'text-red-400' : 'text-white'}`}>
              {volatility}%
            </div>
          </div>
        </div>

        {/* Last Bridge */}
        {lastBridge && (
          <div className="col-span-2 bg-[#1a1a1a] rounded p-3">
            <div className="text-gray-500 text-xs mb-1">Last Bridge Attempt</div>
            <div className="flex items-center justify-between">
              <span className={`px-2 py-0.5 rounded text-xs ${
                lastBridge.mode === 'simulation' ? 'bg-blue-500/20 text-blue-400' : 'bg-green-500/20 text-green-400'
              }`}>
                {lastBridge.mode === 'simulation' ? '🧪 Simulation' : '⚡ Real'}
              </span>
              <span className={`text-xs ${
                lastBridge.status === 'success' ? 'text-green-400' : 'text-red-400'
              }`}>
                {lastBridge.status}
              </span>
              <span className="text-gray-500 text-xs">
                {lastBridge.quote?.bridgeUsed || 'N/A'}
              </span>
            </div>
          </div>
        )}

        {/* Safety Config */}
        <div className="col-span-2 flex items-center justify-center gap-4 pt-2 border-t border-[#2D2D2D]">
          {status?.safetyConfig?.dryRunEnabled ? (
            <span className="text-blue-400 text-xs">🧪 DRY_RUN: ON</span>
          ) : (
            <span className="text-red-400 text-xs">⚠ DRY_RUN: OFF</span>
          )}
          {status?.safetyConfig?.realExecutionEnabled ? (
            <span className="text-red-400 text-xs">⚡ REAL_BRIDGE: ON</span>
          ) : (
            <span className="text-green-400 text-xs">✅ REAL_BRIDGE: OFF</span>
          )}
        </div>
      </div>
    </div>
  );
}
