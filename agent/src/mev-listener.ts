import { ethers } from "ethers";
import { recordSandwichAttack, recordRefund, updateTreasury } from "./agent";

// ═══════════════════════════════════════════════════════════════
// SandwichDetectorV2 Event Listener
// Uses polling instead of eth_newFilter for Unichain compatibility
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
let pollInterval: NodeJS.Timeout | null = null;
let lastBlock = 0;

/**
 * Initialize MEV event listener with polling (Unichain-compatible)
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

    // Get current block as starting point
    lastBlock = await provider.getBlockNumber();

    // Get initial treasury balance
    await refreshTreasuryBalance();

    // Start polling for events (every 5 seconds)
    pollInterval = setInterval(() => pollEvents(provider, detectorAddress), 5000);

    isListening = true;
    console.log(`🛡️  MEV listener started (polling mode): ${detectorAddress}`);

  } catch (error: any) {
    console.error("Failed to start MEV listener:", error.message);
  }
}

/**
 * Poll for new events since last block
 */
async function pollEvents(provider: ethers.Provider, detectorAddress: string): Promise<void> {
  if (!detectorContract) return;

  try {
    const currentBlock = await provider.getBlockNumber();
    if (currentBlock <= lastBlock) return;

    // Query SandwichDetected events
    const sandwichFilter = detectorContract.filters.SandwichDetected();
    const sandwichEvents = await detectorContract.queryFilter(sandwichFilter, lastBlock + 1, currentBlock);

    for (const event of sandwichEvents) {
      const [attacker, victim, _poolId, loss, refund] = (event as ethers.EventLog).args || [];
      recordSandwichAttack({
        attacker,
        victim,
        loss: ethers.formatEther(loss) + " ETH",
        refund: ethers.formatEther(refund) + " ETH",
        txHash: event.transactionHash
      });
    }

    // Query RefundClaimed events
    const refundFilter = detectorContract.filters.RefundClaimed();
    const refundEvents = await detectorContract.queryFilter(refundFilter, lastBlock + 1, currentBlock);

    for (const event of refundEvents) {
      const [victim, amount] = (event as ethers.EventLog).args || [];
      recordRefund(victim, ethers.formatEther(amount) + " ETH");
    }

    // Query TreasuryFunded events
    const treasuryFilter = detectorContract.filters.TreasuryFunded();
    const treasuryEvents = await detectorContract.queryFilter(treasuryFilter, lastBlock + 1, currentBlock);

    if (treasuryEvents.length > 0) {
      await refreshTreasuryBalance();
    }

    lastBlock = currentBlock;
  } catch (error: any) {
    // Silently ignore polling errors (e.g., RPC rate limits)
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
  if (pollInterval) {
    clearInterval(pollInterval);
    pollInterval = null;
  }
  if (detectorContract) {
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
