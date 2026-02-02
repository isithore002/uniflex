import { ethers } from "ethers";

const ERC20_ABI = [
  "function balanceOf(address) view returns (uint256)",
  "function decimals() view returns (uint8)",
  "function symbol() view returns (string)"
];

export interface PoolState {
  timestamp: number;
  token0Balance: bigint;
  token1Balance: bigint;
  token0Symbol: string;
  token1Symbol: string;
  imbalanceRatio: number;
  price: number;
}

// ═══════════════════════════════════════════════════════════════
// VOLATILITY TRACKING (rolling window)
// ═══════════════════════════════════════════════════════════════

const MAX_PRICE_HISTORY = 20;
const priceHistory: number[] = [];

/**
 * Compute standard deviation of an array
 */
function stddev(values: number[]): number {
  if (values.length < 2) return 0;
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const squaredDiffs = values.map(v => Math.pow(v - mean, 2));
  const variance = squaredDiffs.reduce((a, b) => a + b, 0) / values.length;
  return Math.sqrt(variance);
}

/**
 * Compute normalized volatility from price history
 * Formula: stddev(prices) / mean(prices)
 */
export function computeVolatility(): number {
  if (priceHistory.length < 2) return 0;
  const mean = priceHistory.reduce((a, b) => a + b, 0) / priceHistory.length;
  if (mean === 0) return 0;
  return stddev(priceHistory) / mean;
}

/**
 * Get volatility history for sparkline
 * Returns rolling volatility at each point
 */
export function getVolatilityHistory(): number[] {
  const history: number[] = [];
  for (let i = 2; i <= priceHistory.length; i++) {
    const slice = priceHistory.slice(0, i);
    const mean = slice.reduce((a, b) => a + b, 0) / slice.length;
    if (mean > 0) {
      history.push(stddev(slice) / mean);
    }
  }
  return history;
}

/**
 * Get raw price history
 */
export function getPriceHistory(): number[] {
  return [...priceHistory];
}

/**
 * Observes the current state of the Uniswap v4 pool
 * Reads real onchain token balances held by the PoolManager
 */
export async function observe(
  provider: ethers.Provider,
  poolManagerAddress: string,
  token0Address: string,
  token1Address: string
): Promise<PoolState> {
  const token0 = new ethers.Contract(token0Address, ERC20_ABI, provider);
  const token1 = new ethers.Contract(token1Address, ERC20_ABI, provider);

  // Fetch balances and metadata in parallel
  const [balance0, balance1, symbol0, symbol1] = await Promise.all([
    token0.balanceOf(poolManagerAddress),
    token1.balanceOf(poolManagerAddress),
    token0.symbol(),
    token1.symbol()
  ]);

  // Calculate imbalance ratio (1.0 = perfectly balanced)
  const total = balance0 + balance1;
  const imbalanceRatio = total > 0n 
    ? Number(balance0 * 10000n / total) / 10000 
    : 0.5;

  // Calculate price (token1 per token0)
  const price = balance0 > 0n 
    ? Number(balance1 * 10000n / balance0) / 10000
    : 1.0;

  // Track price history for volatility computation
  priceHistory.push(price);
  if (priceHistory.length > MAX_PRICE_HISTORY) {
    priceHistory.shift();
  }

  return {
    timestamp: Date.now(),
    token0Balance: balance0,
    token1Balance: balance1,
    token0Symbol: symbol0,
    token1Symbol: symbol1,
    imbalanceRatio,
    price
  };
}
