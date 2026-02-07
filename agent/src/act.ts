import { ethers } from "ethers";
import { Decision, recordRemoval } from "./decide";
import { bridgeToBaseSepolia, simulateBridge, CHAINS } from "./lifi";
import { removeLiquidity } from "./liquidity";

// SwapHelper ABI - matches our deployed contract
const SWAP_HELPER_ABI = [
  "function swap((address currency0, address currency1, uint24 fee, int24 tickSpacing, address hooks) key, bool zeroForOne, int256 amountSpecified, uint160 sqrtPriceLimitX96) external",
  "function poolManager() view returns (address)",
  "function owner() view returns (address)"
];

const ERC20_ABI = [
  "function approve(address spender, uint256 amount) returns (bool)",
  "function allowance(address owner, address spender) view returns (uint256)"
];

// Pool configuration (must match deployed pool)
const TICK_SPACING = 60;
const LP_FEE = 3000;
const MIN_SQRT_PRICE = 4295128740n; // MIN_SQRT_PRICE + 1
const MAX_SQRT_PRICE = 1461446703485210103287273052203988822378723970341n; // MAX_SQRT_PRICE - 1

// Environment flag to execute real cross-chain tx
const EXECUTE_CROSS_CHAIN = process.env.EXECUTE_CROSS_CHAIN === "true";

// Environment flag for dry-run mode (log instead of executing)
const DRY_RUN = process.env.DRY_RUN === "true";

export interface ActionResult {
  success: boolean;
  txHash?: string;
  bridgeTxHash?: string;
  error?: string;
  actionType?: "local" | "cross-chain" | "remove-liquidity" | "none";
}

/**
 * Executes the decided action by calling onchain contracts
 * Supports local swaps (v4), cross-chain bridges (LI.FI), and MEV protection (remove liquidity)
 */
export async function act(
  decision: Decision,
  signer: ethers.Signer,
  swapHelperAddress: string,
  token0Address: string,
  token1Address: string,
  liquidityHelperAddress?: string
): Promise<ActionResult> {
  // NOOP - No action needed
  if (decision.action === "NOOP") {
    console.log("  ⏸️  No action taken");
    return { success: true, actionType: "none" };
  }

  // REMOVE_LIQUIDITY - MEV Protection
  if (decision.action === "REMOVE_LIQUIDITY") {
    return await actRemoveLiquidity(decision, signer, token0Address, token1Address, liquidityHelperAddress);
  }

  // CROSS-CHAIN - Bridge via LI.FI
  if (decision.action === "CROSS_CHAIN") {
    return await actCrossChain(decision, signer, token0Address, token1Address);
  }

  // LOCAL SWAP - Execute via SwapHelper
  return await actLocalSwap(decision, signer, swapHelperAddress, token0Address, token1Address);
}

/**
 * Execute MEV protection by removing liquidity
 */
async function actRemoveLiquidity(
  decision: Decision,
  signer: ethers.Signer,
  token0Address: string,
  token1Address: string,
  liquidityHelperAddress?: string
): Promise<ActionResult> {
  console.log(`  🛡️  MEV PROTECTION: Removing liquidity to reduce deviation`);
  console.log(`     Urgency: ${decision.urgency || 'HIGH'}`);
  console.log(`     Reason: ${decision.reason}`);
  if (decision.targetDeviation !== undefined) {
    console.log(`     Target deviation: ${(decision.targetDeviation * 100).toFixed(1)}%`);
  }
  if (decision.removalAmount) {
    console.log(`     Removal amount: ${ethers.formatEther(decision.removalAmount)}`);
  }

  // Get helper address from env if not passed
  const helperAddress = liquidityHelperAddress || process.env.LIQUIDITY_HELPER_ADDRESS;
  
  if (!helperAddress) {
    return {
      success: false,
      actionType: "remove-liquidity",
      error: "LIQUIDITY_HELPER_ADDRESS not configured"
    };
  }

  // DRY RUN mode - log but don't execute
  if (DRY_RUN) {
    console.log(`  🧪 DRY RUN: Would remove ${decision.removalAmount ? ethers.formatEther(decision.removalAmount) : 'default amount'} liquidity`);
    return {
      success: true,
      actionType: "remove-liquidity",
      txHash: `DRY_RUN_${Date.now()}`
    };
  }

  try {
    const result = await removeLiquidity(
      signer,
      helperAddress,
      token0Address,
      token1Address,
      "mev-protection",
      decision.removalAmount  // Pass calculated amount
    );

    if (result.success) {
      // Record removal for cooldown tracking
      recordRemoval();
      
      console.log(`  ✅ Liquidity removed successfully!`);
      console.log(`     TX: ${result.txHash}`);
      console.log(`     Block: ${result.blockNumber}`);
      
      return {
        success: true,
        actionType: "remove-liquidity",
        txHash: result.txHash
      };
    } else {
      return {
        success: false,
        actionType: "remove-liquidity",
        error: result.error
      };
    }
  } catch (error: any) {
    console.error(`  ❌ Remove liquidity failed:`, error.message);
    return {
      success: false,
      actionType: "remove-liquidity",
      error: error.message
    };
  }
}

/**
 * Execute cross-chain bridge via LI.FI
 */
async function actCrossChain(
  decision: Decision,
  signer: ethers.Signer,
  token0Address: string,
  token1Address: string
): Promise<ActionResult> {
  const tokenAddress = decision.crossChainToken === "token0" ? token0Address : token1Address;
  const amount = decision.amountIn!;
  const fromAddress = await signer.getAddress();

  console.log(`  🌉 Cross-chain evacuation: ${ethers.formatEther(amount)} tokens`);
  console.log(`     From: Sepolia (${CHAINS.SEPOLIA})`);
  console.log(`     To: Base Sepolia (${CHAINS.BASE_SEPOLIA})`);

  // Get private key from environment for LI.FI SDK
  const privateKey = process.env.PRIVATE_KEY;

  if (!EXECUTE_CROSS_CHAIN) {
    // Simulation mode - get quote but don't execute
    const quote = await simulateBridge(
      CHAINS.SEPOLIA,
      CHAINS.BASE_SEPOLIA,
      tokenAddress,
      amount,
      fromAddress,
      privateKey
    );

    if (quote) {
      return {
        success: true,
        actionType: "cross-chain",
        txHash: `SIMULATED_${Date.now()}`
      };
    } else {
      return {
        success: false,
        actionType: "cross-chain",
        error: "No bridge route available (simulation)"
      };
    }
  }

  // Real execution
  if (!privateKey) {
    return {
      success: false,
      actionType: "cross-chain",
      error: "PRIVATE_KEY not set for cross-chain execution"
    };
  }

  const result = await bridgeToBaseSepolia(privateKey, tokenAddress, amount, fromAddress);

  return {
    success: result.success,
    bridgeTxHash: result.txHash,
    actionType: "cross-chain",
    error: result.error
  };
}

/**
 * Execute local swap via Uniswap v4 SwapHelper
 */
async function actLocalSwap(
  decision: Decision,
  signer: ethers.Signer,
  swapHelperAddress: string,
  token0Address: string,
  token1Address: string
): Promise<ActionResult> {
  try {
    const swapHelper = new ethers.Contract(swapHelperAddress, SWAP_HELPER_ABI, signer);
    const signerAddress = await signer.getAddress();

    // Sort tokens for pool key (Uniswap v4 requires sorted order)
    const token0Lower = token0Address.toLowerCase();
    const token1Lower = token1Address.toLowerCase();
    const needsSwap = token0Lower > token1Lower;
    
    const [currency0, currency1] = needsSwap
      ? [token1Address, token0Address]
      : [token0Address, token1Address];

    // Determine swap direction based on decision
    // SWAP_0_TO_1 means: swap agent's token0 for token1
    // But we need to map this to the SORTED pool's zeroForOne
    const agentWantsZeroForOne = decision.action === "SWAP_0_TO_1";
    
    // If tokens were swapped for sorting, the direction needs to be inverted
    // because what the agent calls "token0" might be "currency1" in the pool
    const zeroForOne = needsSwap ? !agentWantsZeroForOne : agentWantsZeroForOne;
    
    const inputToken = agentWantsZeroForOne ? token0Address : token1Address;
    const amountIn = decision.amountIn!;
    
    // For exactIn swaps, amountSpecified is negative
    const amountSpecified = -BigInt(amountIn);
    
    // Set price limit based on direction
    const sqrtPriceLimitX96 = zeroForOne ? MIN_SQRT_PRICE : MAX_SQRT_PRICE;

    console.log(`  💱 Executing local swap: ${ethers.formatEther(amountIn)}`);
    console.log(`     Agent direction: ${agentWantsZeroForOne ? 'token0→token1' : 'token1→token0'}`);
    console.log(`     Pool direction: ${zeroForOne ? 'currency0→currency1' : 'currency1→currency0'}`);
    console.log(`     Tokens swapped for sorting: ${needsSwap}`);

    // Approve SwapHelper to spend input token
    const tokenContract = new ethers.Contract(inputToken, ERC20_ABI, signer);
    const currentAllowance = await tokenContract.allowance(signerAddress, swapHelperAddress);
    
    if (currentAllowance < amountIn) {
      console.log("  📝 Approving token spend...");
      const approveTx = await tokenContract.approve(swapHelperAddress, ethers.MaxUint256);
      await approveTx.wait();
      console.log("  ✅ Approval confirmed");
    }

    // Build pool key struct
    const poolKey = {
      currency0,
      currency1,
      fee: LP_FEE,
      tickSpacing: TICK_SPACING,
      hooks: ethers.ZeroAddress
    };

    // Execute the swap via SwapHelper
    console.log("  🔄 Sending swap transaction...");
    const tx = await swapHelper.swap(
      poolKey,
      zeroForOne,
      amountSpecified,
      sqrtPriceLimitX96
    );

    const receipt = await tx.wait();
    console.log(`  ✅ Swap executed in block ${receipt.blockNumber}`);

    return {
      success: true,
      txHash: receipt.hash,
      actionType: "local"
    };

  } catch (error: any) {
    console.error("  ❌ Action failed:", error.message);
    return {
      success: false,
      error: error.message,
      actionType: "local"
    };
  }
}
