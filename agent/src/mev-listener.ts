import { ethers } from "ethers";
import { recordSandwichAttack, recordRefund, updateTreasury } from "./agent";

// ═══════════════════════════════════════════════════════════════
// SandwichDetectorV2 Event Listener
// Tracks MEV protection stats in real-time
// ═══════════════════════════════════════════════════════════════

// ABI for the events we care about
const SANDWICH_DETECTOR_ABI = [
  "event SandwichDetected(address indexed attacker, address indexed victim, bytes32 indexed poolId, uint256 loss, uint256 refund)",
  "event RefundClaimed(address indexed victim, uint256 amount)",
  "event TreasuryFunded(address indexed funder, uint256 amount)",
  "function treasury() view returns (uint256)"
];

let detectorContract: ethers.Contract | null = null;
let isListening = false;

/**
 * Initialize MEV event listener
 * Watches SandwichDetectorV2 contract for events
 */
export async function startMevListener(
  provider: ethers.Provider,
  detectorAddress: string
): Promise<void> {
  if (isListening) {
    console.log("🛡️  MEV listener already running");
    return;
  }

  if (!detectorAddress) {
    console.log("⚠️  No SANDWICH_DETECTOR_ADDRESS configured, MEV listener disabled");
    return;
  }

  try {
    detectorContract = new ethers.Contract(
      detectorAddress,
      SANDWICH_DETECTOR_ABI,
      provider
    );

    // Listen for SandwichDetected events
    detectorContract.on("SandwichDetected", (
      attacker: string,
      victim: string,
      _poolId: string,
      loss: bigint,
      refund: bigint,
      event: any
    ) => {
      recordSandwichAttack({
        attacker,
        victim,
        loss: ethers.formatEther(loss) + " ETH",
        refund: ethers.formatEther(refund) + " ETH",
        txHash: event.transactionHash
      });
    });

    // Listen for RefundClaimed events
    detectorContract.on("RefundClaimed", (
      victim: string,
      amount: bigint
    ) => {
      recordRefund(victim, ethers.formatEther(amount) + " ETH");
    });

    // Listen for TreasuryFunded events (updates treasury balance)
    detectorContract.on("TreasuryFunded", async () => {
      await refreshTreasuryBalance();
    });

    // Get initial treasury balance
    await refreshTreasuryBalance();

    isListening = true;
    console.log(`🛡️  MEV listener started: ${detectorAddress}`);
    console.log("   Watching for: SandwichDetected, RefundClaimed, TreasuryFunded");

  } catch (error: any) {
    console.error("Failed to start MEV listener:", error.message);
  }
}

/**
 * Refresh treasury balance from contract
 */
async function refreshTreasuryBalance(): Promise<void> {
  if (!detectorContract) return;

  try {
    const balance = await detectorContract.treasury();
    updateTreasury(ethers.formatEther(balance) + " ETH");
  } catch {
    // Treasury might not exist yet
    updateTreasury("0.0 ETH");
  }
}

/**
 * Stop MEV event listener
 */
export function stopMevListener(): void {
  if (detectorContract) {
    detectorContract.removeAllListeners();
    detectorContract = null;
  }
  isListening = false;
  console.log("🛡️  MEV listener stopped");
}

/**
 * Check if MEV listener is active
 */
export function isMevListenerActive(): boolean {
  return isListening;
}
