import { ethers } from "ethers";
import { 
  createConfig, 
  getRoutes, 
  getQuote,
  executeRoute,
  EVM,
  ChainId,
  type Route,
  type RouteExtended
} from "@lifi/sdk";
import { createWalletClient, http, type WalletClient, type Chain } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { sepolia, arbitrum, base } from "viem/chains";

// ═══════════════════════════════════════════════════════════════
// SAFETY CONFIGURATION
// ═══════════════════════════════════════════════════════════════

// Environment flags for execution control
const DRY_RUN = process.env.DRY_RUN !== 'false'; // Default: true (safe)
const EXECUTE_REAL_BRIDGE = process.env.EXECUTE_REAL_BRIDGE === 'true'; // Default: false

// Safety limits
const MAX_BRIDGE_AMOUNT_USD = parseFloat(process.env.MAX_BRIDGE_AMOUNT_USD || '10'); // $10 max by default
const BRIDGE_COOLDOWN_MS = parseInt(process.env.BRIDGE_COOLDOWN_MS || '1800000', 10); // 30 min default
const MIN_SIMULATION_AMOUNT = '1000000'; // 1 USDC (6 decimals) - readable simulation

// Cooldown tracking
let lastBridgeTimestamp: number = 0;
let lastBridgeAttempt: BridgeAttempt | null = null;

export interface BridgeAttempt {
  timestamp: string;
  mode: 'simulation' | 'real';
  status: 'success' | 'failed' | 'cooldown' | 'amount-exceeded';
  quote?: BridgeQuote;
  txHash?: string;
  error?: string;
}

// Chain IDs - Use mainnet IDs for LI.FI API (testnets not supported)
// For actual execution, we'd use testnets, but LI.FI quotes work with mainnet
export const CHAINS = {
  SEPOLIA: 11155111,      // Actual testnet (for local ops)
  BASE_SEPOLIA: 84532,    // Actual testnet (for local ops)
  // LI.FI supported chains for quotes
  ARBITRUM: 42161,        // For LI.FI demo
  OPTIMISM: 10,           // For LI.FI demo
  BASE: 8453,             // For LI.FI demo
};

// Base Sepolia chain definition for viem
const baseSepolia: Chain = {
  id: 84532,
  name: "Base Sepolia",
  nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
  rpcUrls: {
    default: { http: ["https://sepolia.base.org"] },
  },
  blockExplorers: {
    default: { name: "BaseScan", url: "https://sepolia.basescan.org" },
  },
  testnet: true,
};

// Known token addresses
export const TOKENS = {
  // Testnet tokens (for local v4 operations)
  SEPOLIA: {
    USDC: "0xB5b2E077521E43647cc75BF10e5285F036C22DBb", // mUSDC on Sepolia
  },
  BASE_SEPOLIA: {
    USDC: "0x036CbD53842c5426634e7929541eC2318f3dCF7e", // USDC on Base Sepolia
  },
  // Mainnet tokens (for LI.FI quotes - widely supported)
  ARBITRUM: {
    USDC: "0xaf88d065e77c8cC2239327C5EDb3A432268e5831", // USDC on Arbitrum
  },
  OPTIMISM: {
    USDC: "0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85", // USDC on Optimism
  },
  BASE: {
    USDC: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913", // USDC on Base
  },
};

export interface BridgeQuote {
  fromChain: number;
  toChain: number;
  fromToken: string;
  toToken: string;
  fromAmount: string;
  estimatedOutput: string;
  bridgeUsed: string;
  gasCostUSD: string;
}

export interface BridgeResult {
  success: boolean;
  txHash?: string;
  error?: string;
  quote?: BridgeQuote;
  mode?: 'simulation' | 'real';
}

let sdkConfigured = false;

// ═══════════════════════════════════════════════════════════════
// SAFETY HELPERS
// ═══════════════════════════════════════════════════════════════

/**
 * Check if bridge is in cooldown period
 */
function isInBridgeCooldown(): boolean {
  return Date.now() - lastBridgeTimestamp < BRIDGE_COOLDOWN_MS;
}

/**
 * Get remaining cooldown time in seconds
 */
export function getBridgeCooldownRemaining(): number {
  if (!isInBridgeCooldown()) return 0;
  return Math.ceil((BRIDGE_COOLDOWN_MS - (Date.now() - lastBridgeTimestamp)) / 1000);
}

/**
 * Record a bridge attempt for tracking
 */
function recordBridgeAttempt(attempt: Omit<BridgeAttempt, 'timestamp'>): void {
  lastBridgeAttempt = {
    ...attempt,
    timestamp: new Date().toISOString()
  };
  if (attempt.status === 'success' && attempt.mode === 'real') {
    lastBridgeTimestamp = Date.now();
  }
}

/**
 * Get last bridge attempt info (for /health endpoint)
 */
export function getLastBridgeAttempt(): BridgeAttempt | null {
  return lastBridgeAttempt;
}

/**
 * Check if amount exceeds safety limit
 */
function exceedsSafetyLimit(amountUSD: number): boolean {
  return amountUSD > MAX_BRIDGE_AMOUNT_USD;
}

/**
 * Configure LI.FI SDK with EVM provider
 */
function configureSdk(privateKey: string): void {
  if (sdkConfigured) return;

  const account = privateKeyToAccount(privateKey as `0x${string}`);
  const chains = [sepolia, baseSepolia];

  createConfig({
    integrator: "UniFlux",
    providers: [
      EVM({
        getWalletClient: async () => 
          createWalletClient({
            account,
            chain: sepolia,
            transport: http(),
          }),
        switchChain: async (chainId) =>
          createWalletClient({
            account,
            chain: chains.find((c) => c.id === chainId) || sepolia,
            transport: http(),
          }),
      }),
    ],
  });

  sdkConfigured = true;
}

/**
 * Get a bridge quote from LI.FI (no execution)
 */
export async function getBridgeQuote(
  fromChainId: number,
  toChainId: number,
  fromTokenAddress: string,
  toTokenAddress: string,
  fromAmount: string,
  fromAddress: string
): Promise<BridgeQuote | null> {
  try {
    console.log("  🔍 Fetching LI.FI routes...");
    console.log(`     From: Chain ${fromChainId}, Token ${fromTokenAddress.slice(0, 10)}...`);
    console.log(`     To: Chain ${toChainId}, Token ${toTokenAddress.slice(0, 10)}...`);
    console.log(`     Amount: ${ethers.formatUnits(fromAmount, 18)}`);

    const result = await getRoutes({
      fromChainId,
      toChainId,
      fromTokenAddress,
      toTokenAddress,
      fromAmount,
      fromAddress,
      options: {
        slippage: 0.03, // 3% slippage
      },
    });

    if (!result.routes || result.routes.length === 0) {
      console.log("  ⚠️  No routes available from LI.FI");
      return null;
    }

    const route = result.routes[0];
    const bridgeTool = route.steps[0]?.tool || "unknown";

    const quote: BridgeQuote = {
      fromChain: fromChainId,
      toChain: toChainId,
      fromToken: fromTokenAddress,
      toToken: toTokenAddress,
      fromAmount,
      estimatedOutput: route.toAmount,
      bridgeUsed: bridgeTool,
      gasCostUSD: route.gasCostUSD || "0",
    };

    console.log(`  ✅ Route found via ${quote.bridgeUsed}`);
    console.log(`     Estimated output: ${ethers.formatUnits(quote.estimatedOutput, 18)}`);
    console.log(`     Gas cost: $${quote.gasCostUSD}`);

    return quote;

  } catch (error: any) {
    console.error("  ❌ Failed to get LI.FI quote:", error.message);
    return null;
  }
}

/**
 * Simulate a bridge (get quote without execution)
 * Uses mainnet chains for LI.FI quote since testnets not supported
 * Returns quote info for demonstration purposes
 */
export async function simulateBridge(
  fromChainId: number,
  toChainId: number,
  tokenAddress: string,
  amount: bigint,
  fromAddress: string,
  privateKey?: string
): Promise<BridgeQuote | null> {
  console.log("\n  🧪 SIMULATED LI.FI BRIDGE (Dry Run)");
  console.log("  ─".repeat(30));

  // LI.FI doesn't support testnets, so we demo with mainnet chains
  // Map testnet to mainnet for quote demonstration
  const lifiFromChain = fromChainId === CHAINS.SEPOLIA ? CHAINS.ARBITRUM : fromChainId;
  const lifiToChain = toChainId === CHAINS.BASE_SEPOLIA ? CHAINS.BASE : toChainId;
  
  console.log(`  ℹ️  Using mainnet chains for LI.FI quote (testnets unsupported)`);
  console.log(`     Simulating: Arbitrum (${CHAINS.ARBITRUM}) → Base (${CHAINS.BASE})`);

  if (privateKey) {
    configureSdk(privateKey);
  }

  // Use minimum readable amount for simulation (1 USDC = 1000000 in 6 decimals)
  // This gives realistic quote results instead of tiny dust amounts
  const rawAmount = amount / BigInt(1e12); // 18 decimals → 6 decimals
  const simulationAmount = rawAmount < BigInt(MIN_SIMULATION_AMOUNT) 
    ? MIN_SIMULATION_AMOUNT 
    : rawAmount.toString();

  console.log(`  💰 Simulation amount: ${ethers.formatUnits(simulationAmount, 6)} USDC`);

  const quote = await getBridgeQuote(
    lifiFromChain,
    lifiToChain,
    TOKENS.ARBITRUM.USDC,
    TOKENS.BASE.USDC,
    simulationAmount,
    fromAddress
  );

  if (quote) {
    console.log("\n  📋 SIMULATION RESULT");
    console.log(`     Would bridge: ${ethers.formatUnits(simulationAmount, 6)} USDC`);
    console.log(`     Route: Arbitrum → Base`);
    console.log(`     Bridge: ${quote.bridgeUsed}`);
    console.log(`     Est. output: ${ethers.formatUnits(quote.estimatedOutput, 6)} USDC`);
    console.log(`     Est. gas: $${quote.gasCostUSD}`);
    console.log("\n  ✅ LI.FI integration verified!");
    
    // Record the simulation attempt
    recordBridgeAttempt({
      mode: 'simulation',
      status: 'success',
      quote
    });

    if (!EXECUTE_REAL_BRIDGE) {
      console.log("  ℹ️  Set EXECUTE_REAL_BRIDGE=true to enable real execution");
    }
  }

  return quote;
}

/**
 * Execute a real cross-chain bridge via LI.FI
 * Includes multiple safety layers:
 * - DRY_RUN mode (default: enabled)
 * - EXECUTE_REAL_BRIDGE flag (default: disabled)
 * - Amount cap (MAX_BRIDGE_AMOUNT_USD)
 * - Cooldown period (BRIDGE_COOLDOWN_MS)
 */
export async function bridgeToBaseSepolia(
  privateKey: string,
  tokenAddress: string,
  amount: bigint,
  fromAddress: string
): Promise<BridgeResult> {
  console.log("\n  🌐 LI.FI CROSS-CHAIN BRIDGE");
  console.log("  ─".repeat(30));

  // ═══════════════════════════════════════════════════════════════
  // SAFETY CHECK 1: Cooldown
  // ═══════════════════════════════════════════════════════════════
  if (isInBridgeCooldown()) {
    const remaining = getBridgeCooldownRemaining();
    console.log(`  ⏱️  Bridge cooldown active (${remaining}s remaining)`);
    recordBridgeAttempt({
      mode: EXECUTE_REAL_BRIDGE ? 'real' : 'simulation',
      status: 'cooldown',
      error: `Cooldown active: ${remaining}s remaining`
    });
    return {
      success: false,
      error: `Bridge cooldown: ${remaining}s remaining`,
      mode: 'simulation'
    };
  }

  configureSdk(privateKey);

  // Use mainnet chains for quote (testnets not supported by LI.FI)
  const lifiFromChain = CHAINS.ARBITRUM;
  const lifiToChain = CHAINS.BASE;

  // Convert to USDC decimals and ensure minimum amount for readability
  const rawAmount = amount / BigInt(1e12);
  const bridgeAmount = rawAmount < BigInt(MIN_SIMULATION_AMOUNT) 
    ? MIN_SIMULATION_AMOUNT 
    : rawAmount.toString();

  // Estimate USD value (1 USDC = $1)
  const estimatedUSD = parseFloat(ethers.formatUnits(bridgeAmount, 6));

  // ═══════════════════════════════════════════════════════════════
  // SAFETY CHECK 2: Amount cap
  // ═══════════════════════════════════════════════════════════════
  if (exceedsSafetyLimit(estimatedUSD)) {
    console.log(`  🚫 Amount exceeds safety limit ($${estimatedUSD} > $${MAX_BRIDGE_AMOUNT_USD})`);
    recordBridgeAttempt({
      mode: 'simulation',
      status: 'amount-exceeded',
      error: `Amount $${estimatedUSD} exceeds limit $${MAX_BRIDGE_AMOUNT_USD}`
    });
    return {
      success: false,
      error: `Amount $${estimatedUSD} exceeds safety limit $${MAX_BRIDGE_AMOUNT_USD}`,
      mode: 'simulation'
    };
  }

  // Get quote first
  console.log(`  💰 Bridge amount: ${ethers.formatUnits(bridgeAmount, 6)} USDC (~$${estimatedUSD.toFixed(2)})`);
  
  const quote = await getBridgeQuote(
    lifiFromChain,
    lifiToChain,
    TOKENS.ARBITRUM.USDC,
    TOKENS.BASE.USDC,
    bridgeAmount,
    fromAddress
  );

  if (!quote) {
    recordBridgeAttempt({
      mode: 'simulation',
      status: 'failed',
      error: 'No bridge route available'
    });
    return {
      success: false,
      error: "No bridge route available",
      mode: 'simulation'
    };
  }

  // ═══════════════════════════════════════════════════════════════
  // SAFETY CHECK 3: DRY_RUN mode (default behavior)
  // ═══════════════════════════════════════════════════════════════
  if (DRY_RUN || !EXECUTE_REAL_BRIDGE) {
    console.log("\n  🧪 DRY RUN MODE - No real transaction sent");
    console.log("  ─".repeat(30));
    console.log(`     Mode: ${DRY_RUN ? 'DRY_RUN=true' : 'EXECUTE_REAL_BRIDGE=false'}`);
    console.log(`     Would bridge: ${ethers.formatUnits(bridgeAmount, 6)} USDC`);
    console.log(`     Via: ${quote.bridgeUsed}`);
    console.log(`     Est. output: ${ethers.formatUnits(quote.estimatedOutput, 6)} USDC`);
    console.log(`     Est. gas: $${quote.gasCostUSD}`);
    console.log("\n  ✅ Quote verified - ready for real execution");
    console.log("  ℹ️  To enable: DRY_RUN=false EXECUTE_REAL_BRIDGE=true");

    recordBridgeAttempt({
      mode: 'simulation',
      status: 'success',
      quote
    });

    return {
      success: true,
      quote,
      txHash: `SIMULATION_${Date.now()}`,
      mode: 'simulation'
    };
  }

  // ═══════════════════════════════════════════════════════════════
  // REAL EXECUTION (only if all safety checks passed)
  // ═══════════════════════════════════════════════════════════════
  console.log("\n  ⚡ REAL EXECUTION MODE");
  console.log("  ─".repeat(30));
  console.log(`     Amount: ${ethers.formatUnits(bridgeAmount, 6)} USDC`);
  console.log(`     Bridge: ${quote.bridgeUsed}`);
  console.log(`     Route: Arbitrum → Base`);

  try {
    // Get the full route for execution
    const routeResult = await getRoutes({
      fromChainId: lifiFromChain,
      toChainId: lifiToChain,
      fromTokenAddress: TOKENS.ARBITRUM.USDC,
      toTokenAddress: TOKENS.BASE.USDC,
      fromAmount: bridgeAmount,
      fromAddress,
      options: {
        slippage: 0.005, // 0.5% slippage for real execution
      },
    });

    if (!routeResult.routes || routeResult.routes.length === 0) {
      throw new Error('No routes available for execution');
    }

    const route = routeResult.routes[0];
    console.log(`  🚀 Executing route via ${route.steps[0]?.tool}...`);

    // Execute the route
    const executionResult = await executeRoute(route as RouteExtended, {
      // The SDK handles wallet interaction via the configured provider
      updateRouteHook: (updatedRoute) => {
        console.log(`  📊 Route update: ${updatedRoute.steps[0]?.execution?.status || 'pending'}`);
      },
    });

    // Get transaction hash from execution
    const txHash = executionResult.steps[0]?.execution?.process?.[0]?.txHash || `LIFI_${Date.now()}`;
    
    console.log(`  ✅ Bridge executed successfully!`);
    console.log(`     TX: ${txHash}`);

    recordBridgeAttempt({
      mode: 'real',
      status: 'success',
      quote,
      txHash
    });

    return {
      success: true,
      quote,
      txHash,
      mode: 'real'
    };

  } catch (error: any) {
    console.error(`  ❌ Bridge execution failed:`, error.message);

    recordBridgeAttempt({
      mode: 'real',
      status: 'failed',
      quote,
      error: error.message
    });

    return {
      success: false,
      quote,
      error: error.message,
      mode: 'real'
    };
  }
}

/**
 * Check if LI.FI supports a route (useful for testnets)
 */
export async function checkRouteAvailability(
  fromChainId: number,
  toChainId: number,
  fromAddress: string
): Promise<boolean> {
  try {
    // Try to get a quote for native ETH (always available)
    const result = await getRoutes({
      fromChainId,
      toChainId,
      fromTokenAddress: "0x0000000000000000000000000000000000000000",
      toTokenAddress: "0x0000000000000000000000000000000000000000",
      fromAmount: "1000000000000000", // 0.001 ETH
      fromAddress,
    });

    return result.routes && result.routes.length > 0;
  } catch {
    return false;
  }
}
