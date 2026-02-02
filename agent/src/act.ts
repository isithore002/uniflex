import { ethers } from "ethers";
import { Decision } from "./decide";
import { bridgeToBaseSepolia, simulateBridge, CHAINS } from "./lifi";

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

export interface ActionResult {
  success: boolean;
  txHash?: string;
  bridgeTxHash?: string;
  error?: string;
  actionType?: "local" | "cross-chain" | "none";
}

/**
 * Executes the decided action by calling onchain contracts
 * Supports both local swaps (v4) and cross-chain bridges (LI.FI)
 */
export async function act(
  decision: Decision,
  signer: ethers.Signer,
  swapHelperAddress: string,
  token0Address: string,
  token1Address: string
): Promise<ActionResult> {
  // NOOP - No action needed
  if (decision.action === "NOOP") {
    console.log("  ⏸️  No action taken");
    return { success: true, actionType: "none" };
  }

  // CROSS-CHAIN - Bridge via LI.FI
  if (decision.action === "CROSS_CHAIN") {
    return await actCrossChain(decision, signer, token0Address, token1Address);
  }

  // LOCAL SWAP - Execute via SwapHelper
  return await actLocalSwap(decision, signer, swapHelperAddress, token0Address, token1Address);
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

    // Determine swap direction and parameters
    const zeroForOne = decision.action === "SWAP_0_TO_1";
    const inputToken = zeroForOne ? token0Address : token1Address;
    const amountIn = decision.amountIn!;
    
    // For exactIn swaps, amountSpecified is negative
    const amountSpecified = -BigInt(amountIn);
    
    // Set price limit based on direction
    const sqrtPriceLimitX96 = zeroForOne ? MIN_SQRT_PRICE : MAX_SQRT_PRICE;

    console.log(`  💱 Executing local swap: ${ethers.formatEther(amountIn)} ${zeroForOne ? 'token0→token1' : 'token1→token0'}`);

    // Sort tokens for pool key
    const [currency0, currency1] = token0Address.toLowerCase() < token1Address.toLowerCase()
      ? [token0Address, token1Address]
      : [token1Address, token0Address];

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
