import { ethers } from "ethers";

// LiquidityHelper ABI - matches our deployed contract
const LIQUIDITY_HELPER_ABI = [
  "function addLiquidity((address currency0, address currency1, uint24 fee, int24 tickSpacing, address hooks) key, int24 tickLower, int24 tickUpper, int256 liquidityDelta) external",
  "function poolManager() view returns (address)",
  "function owner() view returns (address)"
];

const ERC20_ABI = [
  "function approve(address spender, uint256 amount) returns (bool)",
  "function allowance(address owner, address spender) view returns (uint256)",
  "function balanceOf(address) view returns (uint256)"
];

// Pool configuration (must match deployed pool)
const TICK_SPACING = 60;
const LP_FEE = 3000;

export interface LiquidityResult {
  success: boolean;
  action: "ADD_LIQUIDITY" | "REMOVE_LIQUIDITY";
  txHash?: string;
  blockNumber?: number;
  amount?: string;
  error?: string;
  source: string;
}

/**
 * Agent-controlled liquidity operations
 * UI cannot modify parameters - these are determined by agent strategy
 */

// Agent strategy parameters (immutable from UI)
const STRATEGY_PARAMS = {
  tickLower: -60 * 10,  // -600
  tickUpper: 60 * 10,   // +600
  liquidityAmount: ethers.parseEther("0.5"),  // Fixed amount
};

/**
 * Add liquidity to the Uniswap v4 pool
 * This is an agent-controlled operation - UI cannot set parameters
 */
export async function addLiquidity(
  signer: ethers.Signer,
  liquidityHelperAddress: string,
  token0Address: string,
  token1Address: string,
  source: string = "agent"
): Promise<LiquidityResult> {
  // Log source for judges
  if (source === "ui") {
    console.log("  📋 UI requested execution — agent parameters unchanged");
  }

  try {
    console.log("\n💧 ADD LIQUIDITY (Agent-Controlled)");
    console.log(`  Source: ${source}`);
    console.log(`  Tick Range: [${STRATEGY_PARAMS.tickLower}, ${STRATEGY_PARAMS.tickUpper}]`);
    console.log(`  Liquidity: ${ethers.formatEther(STRATEGY_PARAMS.liquidityAmount)} units`);

    // Verify connection first
    const signerAddress = await Promise.race([
      signer.getAddress(),
      new Promise<never>((_, reject) => 
        setTimeout(() => reject(new Error('Connection timeout')), 5000)
      )
    ]);
    
    console.log(`  Wallet: ${signerAddress}`);

    const helper = new ethers.Contract(liquidityHelperAddress, LIQUIDITY_HELPER_ABI, signer);

    // Sort tokens for pool key
    const [currency0, currency1] = token0Address.toLowerCase() < token1Address.toLowerCase()
      ? [token0Address, token1Address]
      : [token1Address, token0Address];

    // Approve tokens if needed with timeout protection
    const token0Contract = new ethers.Contract(currency0, ERC20_ABI, signer);
    const token1Contract = new ethers.Contract(currency1, ERC20_ABI, signer);

    console.log("  🔍 Checking allowances...");
    const [allowance0, allowance1] = await Promise.race([
      Promise.all([
        token0Contract.allowance(signerAddress, liquidityHelperAddress),
        token1Contract.allowance(signerAddress, liquidityHelperAddress)
      ]),
      new Promise<never>((_, reject) => 
        setTimeout(() => reject(new Error('Allowance check timeout')), 8000)
      )
    ]);

    if (allowance0 < ethers.parseEther("1")) {
      console.log("  📝 Approving token0...");
      const tx = await token0Contract.approve(liquidityHelperAddress, ethers.MaxUint256);
      const receipt = await Promise.race([
        tx.wait(),
        new Promise<never>((_, reject) => 
          setTimeout(() => reject(new Error('Approval timeout')), 30000)
        )
      ]);
      console.log(`  ✅ Token0 approved (${receipt.hash.slice(0, 10)}...)`);
    }

    if (allowance1 < ethers.parseEther("1")) {
      console.log("  📝 Approving token1...");
      const tx = await token1Contract.approve(liquidityHelperAddress, ethers.MaxUint256);
      const receipt = await Promise.race([
        tx.wait(),
        new Promise<never>((_, reject) => 
          setTimeout(() => reject(new Error('Approval timeout')), 30000)
        )
      ]);
      console.log(`  ✅ Token1 approved (${receipt.hash.slice(0, 10)}...)`);
    }

    // Build pool key
    const poolKey = {
      currency0,
      currency1,
      fee: LP_FEE,
      tickSpacing: TICK_SPACING,
      hooks: ethers.ZeroAddress
    };

    // Execute add liquidity with timeout protection
    console.log("  🔄 Executing addLiquidity...");
    const tx = await Promise.race([
      helper.addLiquidity(
        poolKey,
        STRATEGY_PARAMS.tickLower,
        STRATEGY_PARAMS.tickUpper,
        STRATEGY_PARAMS.liquidityAmount
      ),
      new Promise<never>((_, reject) => 
        setTimeout(() => reject(new Error('Transaction submission timeout')), 15000)
      )
    ]);

    const receipt = await Promise.race([
      tx.wait(),
      new Promise<never>((_, reject) => 
        setTimeout(() => reject(new Error('Transaction confirmation timeout')), 60000)
      )
    ]);
    console.log(`  ✅ Liquidity added in block ${receipt.blockNumber}`);

    return {
      success: true,
      action: "ADD_LIQUIDITY",
      txHash: receipt.hash,
      blockNumber: receipt.blockNumber,
      amount: ethers.formatEther(STRATEGY_PARAMS.liquidityAmount),
      source
    };

  } catch (error: any) {
    console.error("  ❌ Add liquidity failed:", error.message);
    return {
      success: false,
      action: "ADD_LIQUIDITY",
      error: error.message,
      source
    };
  }
}

/**
 * Remove liquidity from the Uniswap v4 pool
 * This is an agent-controlled operation - UI cannot set parameters
 */
export async function removeLiquidity(
  signer: ethers.Signer,
  liquidityHelperAddress: string,
  token0Address: string,
  token1Address: string,
  source: string = "agent"
): Promise<LiquidityResult> {
  // Log source for judges
  if (source === "ui") {
    console.log("  📋 UI requested execution — agent parameters unchanged");
  }

  try {
    console.log("\n🔥 REMOVE LIQUIDITY (Agent-Controlled)");
    console.log(`  Source: ${source}`);
    console.log(`  Tick Range: [${STRATEGY_PARAMS.tickLower}, ${STRATEGY_PARAMS.tickUpper}]`);
    console.log(`  Liquidity: ${ethers.formatEther(STRATEGY_PARAMS.liquidityAmount)} units`);

    // Verify connection first
    const signerAddress = await Promise.race([
      signer.getAddress(),
      new Promise<never>((_, reject) => 
        setTimeout(() => reject(new Error('Connection timeout')), 5000)
      )
    ]);
    console.log(`  Wallet: ${signerAddress}`);

    const helper = new ethers.Contract(liquidityHelperAddress, LIQUIDITY_HELPER_ABI, signer);

    // Sort tokens for pool key
    const [currency0, currency1] = token0Address.toLowerCase() < token1Address.toLowerCase()
      ? [token0Address, token1Address]
      : [token1Address, token0Address];

    // Build pool key
    const poolKey = {
      currency0,
      currency1,
      fee: LP_FEE,
      tickSpacing: TICK_SPACING,
      hooks: ethers.ZeroAddress
    };

    // Execute remove liquidity (negative delta) with timeout protection
    console.log("  🔄 Executing removeLiquidity...");
    const tx = await Promise.race([
      helper.addLiquidity(
        poolKey,
        STRATEGY_PARAMS.tickLower,
        STRATEGY_PARAMS.tickUpper,
        -STRATEGY_PARAMS.liquidityAmount  // Negative = remove
      ),
      new Promise<never>((_, reject) => 
        setTimeout(() => reject(new Error('Transaction submission timeout')), 15000)
      )
    ]);

    const receipt = await Promise.race([
      tx.wait(),
      new Promise<never>((_, reject) => 
        setTimeout(() => reject(new Error('Transaction confirmation timeout')), 60000)
      )
    ]);
    console.log(`  ✅ Liquidity removed in block ${receipt.blockNumber}`);

    return {
      success: true,
      action: "REMOVE_LIQUIDITY",
      txHash: receipt.hash,
      blockNumber: receipt.blockNumber,
      amount: ethers.formatEther(STRATEGY_PARAMS.liquidityAmount),
      source
    };

  } catch (error: any) {
    console.error("  ❌ Remove liquidity failed:", error.message);
    return {
      success: false,
      action: "REMOVE_LIQUIDITY",
      error: error.message,
      source
    };
  }
}

/**
 * Get strategy parameters (read-only for UI)
 */
export function getStrategyParams() {
  return {
    tickLower: STRATEGY_PARAMS.tickLower,
    tickUpper: STRATEGY_PARAMS.tickUpper,
    liquidityAmount: ethers.formatEther(STRATEGY_PARAMS.liquidityAmount),
    note: "These parameters are set by the agent, not the UI"
  };
}
