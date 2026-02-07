// ═══════════════════════════════════════════════════════════════
// EVACUATION PANEL - Safe Harbor Evacuation UI
// LI.FI-powered cross-chain escape for MEV protection
// ═══════════════════════════════════════════════════════════════

import { useState, useEffect, useCallback } from 'react';
import { getEvacuationQuote, executeEvacuation, testEvacuation } from '../lib/agent';
import type { EvacuationQuote, EvacuationStatus, ExplorerUrls } from '../lib/agent';

interface EvacuationPanelProps {
  lpAmount: string;
  isUnderAttack: boolean;
  onEvacuationComplete?: (status: EvacuationStatus) => void;
  addOutput?: (lines: string | string[]) => void;
}

// Metrics display component
function ExecutionMetrics({ 
  executionTime, 
  retryCount, 
  bridge 
}: { 
  executionTime?: number; 
  retryCount?: number; 
  bridge?: string;
}) {
  if (!executionTime) return null;
  
  return (
    <div className="flex gap-4 text-xs bg-gray-800/50 rounded-lg p-2 mt-2">
      <div className="flex items-center gap-1">
        <span className="text-gray-500">⏱️ Time:</span>
        <span className="text-white font-mono">{executionTime}s</span>
      </div>
      {bridge && (
        <div className="flex items-center gap-1">
          <span className="text-gray-500">🌉 Bridge:</span>
          <span className="text-[#FC72FF] font-mono">{bridge}</span>
        </div>
      )}
      {retryCount !== undefined && retryCount > 0 && (
        <div className="flex items-center gap-1">
          <span className="text-gray-500">🔄 Retries:</span>
          <span className="text-yellow-400 font-mono">{retryCount}</span>
        </div>
      )}
    </div>
  );
}

// Step tracker component
function StepTracker({ steps }: { steps: { name: string; status: 'pending' | 'active' | 'complete' | 'error' }[] }) {
  return (
    <div className="flex items-center justify-between mb-4">
      {steps.map((step, i) => (
        <div key={step.name} className="flex items-center">
          <div className={`
            w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold
            ${step.status === 'complete' ? 'bg-[#21C95E] text-black' : ''}
            ${step.status === 'active' ? 'bg-[#FC72FF] text-black animate-pulse' : ''}
            ${step.status === 'error' ? 'bg-red-500 text-white' : ''}
            ${step.status === 'pending' ? 'bg-gray-700 text-gray-400' : ''}
          `}>
            {step.status === 'complete' ? '✓' : i + 1}
          </div>
          <span className={`ml-2 text-xs ${step.status === 'active' ? 'text-[#FC72FF]' : 'text-gray-400'}`}>
            {step.name}
          </span>
          {i < steps.length - 1 && (
            <div className={`w-8 h-0.5 mx-2 ${step.status === 'complete' ? 'bg-[#21C95E]' : 'bg-gray-700'}`} />
          )}
        </div>
      ))}
    </div>
  );
}

// Quote display component
function QuoteDisplay({ quote, slippage }: { quote: EvacuationQuote | null; slippage: number }) {
  if (!quote) {
    return (
      <div className="border border-gray-700 rounded-lg p-4 bg-gray-900/50">
        <div className="text-gray-500 text-center">
          Loading bridge quote...
        </div>
      </div>
    );
  }

  const inputAmount = parseFloat(quote.fromAmount) / 1e6;
  const outputAmount = parseFloat(quote.estimatedOutput) / 1e6;
  const slippagePercent = ((inputAmount - outputAmount) / inputAmount * 100).toFixed(2);
  const estimatedMinutes = Math.round(quote.estimatedTime / 60);

  return (
    <div className="border border-gray-700 rounded-lg p-4 bg-gray-900/50">
      <div className="flex justify-between items-center mb-3">
        <span className="text-gray-400 text-sm">Bridge Quote</span>
        <span className="text-xs px-2 py-1 bg-[#FC72FF]/20 text-[#FC72FF] rounded">
          via {quote.bridgeUsed}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-4 mb-4">
        <div>
          <div className="text-xs text-gray-500">You Send</div>
          <div className="text-lg font-mono text-white">{inputAmount.toFixed(2)} USDC</div>
          <div className="text-xs text-gray-500">Unichain Sepolia</div>
        </div>
        <div className="text-right">
          <div className="text-xs text-gray-500">You Receive (est.)</div>
          <div className="text-lg font-mono text-[#21C95E]">~{outputAmount.toFixed(2)} USDC</div>
          <div className="text-xs text-gray-500">Base → Aave V3</div>
        </div>
      </div>

      <div className="border-t border-gray-700 pt-3 grid grid-cols-3 gap-2 text-xs">
        <div>
          <span className="text-gray-500">Est. Time</span>
          <div className="text-white">~{estimatedMinutes} min</div>
        </div>
        <div>
          <span className="text-gray-500">Gas Cost</span>
          <div className="text-white">${quote.gasCostUSD}</div>
        </div>
        <div>
          <span className="text-gray-500">Slippage</span>
          <div className={parseFloat(slippagePercent) > slippage * 100 ? 'text-yellow-400' : 'text-white'}>
            {slippagePercent}%
          </div>
        </div>
      </div>
    </div>
  );
}

// Slippage selector component
function SlippageSelector({ 
  value, 
  onChange 
}: { 
  value: number; 
  onChange: (v: number) => void 
}) {
  const presets = [0.005, 0.01, 0.03];
  
  return (
    <div className="mb-4">
      <div className="flex justify-between items-center mb-2">
        <span className="text-gray-400 text-sm">Slippage Tolerance</span>
        <span className="text-white font-mono text-sm">{(value * 100).toFixed(1)}%</span>
      </div>
      <div className="flex gap-2">
        {presets.map(preset => (
          <button
            key={preset}
            onClick={() => onChange(preset)}
            className={`
              px-3 py-1 rounded text-xs font-mono transition-colors
              ${value === preset 
                ? 'bg-[#FC72FF] text-black' 
                : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
              }
            `}
          >
            {(preset * 100).toFixed(1)}%
          </button>
        ))}
        <input
          type="number"
          min="0.1"
          max="5"
          step="0.1"
          value={(value * 100).toFixed(1)}
          onChange={(e) => onChange(parseFloat(e.target.value) / 100)}
          className="w-16 px-2 py-1 bg-gray-800 border border-gray-600 rounded text-xs text-white font-mono text-right"
        />
      </div>
    </div>
  );
}

export function EvacuationPanel({ 
  lpAmount, 
  isUnderAttack,
  onEvacuationComplete,
  addOutput
}: EvacuationPanelProps) {
  const [quote, setQuote] = useState<EvacuationQuote | null>(null);
  const [loading, setLoading] = useState(false);
  const [executing, setExecuting] = useState(false);
  const [slippage, setSlippage] = useState(0.01);
  const [status, setStatus] = useState<EvacuationStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showPanel, setShowPanel] = useState(false);
  const [explorerUrls, setExplorerUrls] = useState<ExplorerUrls | null>(null);
  const [executionTime, setExecutionTime] = useState<number | undefined>();

  // Fetch quote when panel opens or amount changes
  const fetchQuote = useCallback(async () => {
    if (!lpAmount || parseFloat(lpAmount) <= 0) return;
    
    setLoading(true);
    setError(null);
    
    try {
      const result = await getEvacuationQuote(lpAmount);
      if (result.success && result.quote) {
        setQuote(result.quote);
      } else {
        setError(result.error || 'Failed to get quote');
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [lpAmount]);

  useEffect(() => {
    if (showPanel) {
      fetchQuote();
    }
  }, [showPanel, fetchQuote]);

  // Get step status based on evacuation progress
  type StepStatus = 'pending' | 'active' | 'complete' | 'error';
  const getSteps = (): { name: string; status: StepStatus }[] => {
    const steps: { name: string; status: StepStatus }[] = [
      { name: 'Remove LP', status: 'pending' },
      { name: 'Bridge', status: 'pending' },
      { name: 'Aave Deposit', status: 'pending' },
    ];

    if (!status) return steps;

    switch (status.step) {
      case 'REMOVING_LIQUIDITY':
        steps[0].status = 'active';
        break;
      case 'BRIDGING':
      case 'WAITING_BRIDGE':
        steps[0].status = 'complete';
        steps[1].status = 'active';
        break;
      case 'DEPOSITING_AAVE':
        steps[0].status = 'complete';
        steps[1].status = 'complete';
        steps[2].status = 'active';
        break;
      case 'COMPLETE':
        steps[0].status = 'complete';
        steps[1].status = 'complete';
        steps[2].status = 'complete';
        break;
      case 'FAILED':
        // Mark current step as error
        if (!status.removedLiquidity) steps[0].status = 'error';
        else if (!status.bridge?.txHash) steps[1].status = 'error';
        else steps[2].status = 'error';
        break;
    }

    return steps;
  };

  // Execute evacuation
  const handleEvacuate = async () => {
    if (!quote) return;

    setExecuting(true);
    setError(null);
    setExplorerUrls(null);
    setExecutionTime(undefined);
    addOutput?.(['', '🚨 INITIATING SAFE HARBOR EVACUATION...']);

    try {
      const result = await executeEvacuation(slippage);
      
      if (result.success && result.status) {
        setStatus(result.status);
        setExplorerUrls(result.explorerUrls || null);
        setExecutionTime(result.executionTime);
        
        addOutput?.([
          '✅ Evacuation complete!',
          `   Bridge: ${result.status.bridge?.bridgeUsed || 'LI.FI'}`,
          `   Time: ${result.executionTime || 0}s`,
          `   TX: ${result.status.bridge?.txHash?.slice(0, 20)}...`,
          result.explorerUrls?.bridge ? `   Explorer: ${result.explorerUrls.bridge}` : '',
        ].filter(Boolean));
        onEvacuationComplete?.(result.status);
      } else {
        setError(result.error || 'Evacuation failed');
        addOutput?.([`❌ Evacuation failed: ${result.error}`]);
      }
    } catch (err: any) {
      setError(err.message);
      addOutput?.([`❌ Error: ${err.message}`]);
    } finally {
      setExecuting(false);
    }
  };

  // Test evacuation (dry run)
  const handleTestEvacuation = async () => {
    setLoading(true);
    addOutput?.(['', '🧪 Running evacuation dry run...']);

    try {
      const result = await testEvacuation();
      if (result.success) {
        addOutput?.([
          '✅ Dry run complete!',
          `   Would bridge: ${quote?.fromAmount || 'N/A'} USDC`,
          `   Via: ${quote?.bridgeUsed || 'LI.FI'}`,
          `   To: Aave V3 on Base`,
        ]);
      } else {
        addOutput?.([`⚠️ Dry run issue: ${result.error}`]);
      }
    } catch (err: any) {
      addOutput?.([`❌ Dry run failed: ${err.message}`]);
    } finally {
      setLoading(false);
    }
  };

  // Compact mode when closed
  if (!showPanel) {
    return (
      <div className="border border-gray-700 rounded-lg p-3 bg-gray-900/50 mb-4">
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-2">
            <span className="text-lg">🏦</span>
            <div>
              <div className="text-sm font-medium text-white">Safe Harbor Evacuation</div>
              <div className="text-xs text-gray-400">LI.FI cross-chain protection</div>
            </div>
          </div>
          <button
            onClick={() => setShowPanel(true)}
            className={`
              px-4 py-2 rounded text-sm font-medium transition-all
              ${isUnderAttack 
                ? 'bg-red-500 hover:bg-red-600 text-white animate-pulse' 
                : 'bg-[#FC72FF]/20 hover:bg-[#FC72FF]/30 text-[#FC72FF]'
              }
            `}
          >
            {isUnderAttack ? '⚠️ EVACUATE NOW' : 'Open Panel'}
          </button>
        </div>
      </div>
    );
  }

  // Full panel view
  return (
    <div className="border border-[#FC72FF]/50 rounded-lg p-4 bg-gray-900/80 mb-4">
      {/* Header */}
      <div className="flex justify-between items-center mb-4">
        <div className="flex items-center gap-2">
          <span className="text-2xl">🏦</span>
          <div>
            <div className="text-lg font-medium text-white">Safe Harbor Evacuation</div>
            <div className="text-xs text-gray-400">
              Powered by LI.FI • Bridge to Aave V3 on Base
            </div>
          </div>
        </div>
        <button
          onClick={() => setShowPanel(false)}
          className="text-gray-400 hover:text-white text-xl"
        >
          ✕
        </button>
      </div>

      {/* Alert if under attack */}
      {isUnderAttack && (
        <div className="bg-red-500/20 border border-red-500 rounded-lg p-3 mb-4 flex items-center gap-2">
          <span className="text-xl">🚨</span>
          <div>
            <div className="text-red-400 font-medium">MEV Attack Detected!</div>
            <div className="text-xs text-red-300">
              Sandwich attack in progress. Evacuate LP to protect funds.
            </div>
          </div>
        </div>
      )}

      {/* Step tracker */}
      {executing && <StepTracker steps={getSteps()} />}

      {/* Quote display */}
      {loading ? (
        <div className="border border-gray-700 rounded-lg p-8 bg-gray-900/50 text-center">
          <div className="animate-spin text-2xl mb-2">⚡</div>
          <div className="text-gray-400">Fetching bridge quote...</div>
        </div>
      ) : (
        <QuoteDisplay quote={quote} slippage={slippage} />
      )}

      {/* Slippage control */}
      <div className="mt-4">
        <SlippageSelector value={slippage} onChange={setSlippage} />
      </div>

      {/* Error display */}
      {error && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 mb-4 text-red-400 text-sm">
          ❌ {error}
        </div>
      )}

      {/* Action buttons */}
      <div className="flex gap-2 mt-4">
        <button
          onClick={handleTestEvacuation}
          disabled={loading || executing}
          className="flex-1 py-2 px-4 bg-gray-700 hover:bg-gray-600 disabled:bg-gray-800 disabled:text-gray-500 rounded text-sm font-medium transition-colors"
        >
          🧪 Dry Run
        </button>
        <button
          onClick={handleEvacuate}
          disabled={!quote || loading || executing}
          className={`
            flex-2 py-2 px-6 rounded text-sm font-bold transition-all
            ${isUnderAttack 
              ? 'bg-red-500 hover:bg-red-600 animate-pulse' 
              : 'bg-[#FC72FF] hover:bg-[#FF007A]'
            }
            disabled:bg-gray-700 disabled:text-gray-500
            text-black
          `}
        >
          {executing ? (
            <span className="flex items-center gap-2">
              <span className="animate-spin">⚡</span> Evacuating...
            </span>
          ) : (
            '🏦 Execute Evacuation'
          )}
        </button>
      </div>

      {/* Info footer */}
      <div className="mt-4 pt-4 border-t border-gray-700 text-xs text-gray-500">
        <div className="flex justify-between">
          <span>Bridge Provider</span>
          <span className="text-[#FC72FF]">LI.FI Aggregator</span>
        </div>
        <div className="flex justify-between mt-1">
          <span>Destination</span>
          <span className="text-white">Aave V3 (Base)</span>
        </div>
        <div className="flex justify-between mt-1">
          <span>Protection</span>
          <span className="text-[#21C95E]">MEV-resistant</span>
        </div>
      </div>

      {/* Transaction links if complete */}
      {status?.step === 'COMPLETE' && (
        <div className="mt-4 pt-4 border-t border-[#21C95E]/30 bg-[#21C95E]/10 rounded-lg p-3">
          <div className="text-[#21C95E] font-medium mb-2">✅ Evacuation Complete!</div>
          
          {/* Execution Metrics */}
          <ExecutionMetrics 
            executionTime={executionTime}
            bridge={status.bridge?.bridgeUsed}
          />
          
          <div className="text-xs space-y-1 mt-3">
            {status.removedLiquidity?.txHash && (
              <div className="flex justify-between items-center">
                <span className="text-gray-400">LP Removed:</span>
                <a 
                  href={explorerUrls?.removeLiquidity || `https://sepolia.uniscan.xyz/tx/${status.removedLiquidity.txHash}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[#FC72FF] hover:underline font-mono"
                >
                  {status.removedLiquidity.txHash.slice(0, 16)}...
                </a>
              </div>
            )}
            {status.bridge?.txHash && (
              <div className="flex justify-between items-center">
                <span className="text-gray-400">Bridge TX:</span>
                <a 
                  href={explorerUrls?.bridge || `https://explorer.li.fi/tx/${status.bridge.txHash}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[#FC72FF] hover:underline font-mono"
                >
                  {status.bridge.txHash.slice(0, 16)}... 🔗
                </a>
              </div>
            )}
            {status.aaveDeposit?.txHash && (
              <div className="flex justify-between items-center">
                <span className="text-gray-400">Aave Deposit:</span>
                <a 
                  href={explorerUrls?.aaveDeposit || `https://basescan.org/tx/${status.aaveDeposit.txHash}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[#FC72FF] hover:underline font-mono"
                >
                  {status.aaveDeposit.txHash.slice(0, 16)}... 🔗
                </a>
              </div>
            )}
          </div>
          
          {/* Copy all links button */}
          <button
            onClick={() => {
              const links = [
                explorerUrls?.removeLiquidity,
                explorerUrls?.bridge,
                explorerUrls?.aaveDeposit,
              ].filter(Boolean).join('\n');
              navigator.clipboard.writeText(links);
            }}
            className="mt-3 w-full py-1 bg-[#21C95E]/20 hover:bg-[#21C95E]/30 text-[#21C95E] text-xs rounded transition-colors"
          >
            📋 Copy Transaction Links
          </button>
        </div>
      )}
    </div>
  );
}

export default EvacuationPanel;
