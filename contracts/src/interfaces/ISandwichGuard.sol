// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

/// @title ISandwichGuard
/// @notice Interface for sandwich attack detection and victim refund system
/// @dev Designed for Uniswap v4 hooks
///
/// ════════════════════════════════════════════════════════════════════════════════
/// WHAT IS A SANDWICH ATTACK?
/// ════════════════════════════════════════════════════════════════════════════════
///
///   1. Attacker sees victim's pending swap in mempool
///   2. Attacker FRONTRUNS: buys before victim, moves price up
///   3. Victim's swap executes at worse price (pays more, gets less)
///   4. Attacker BACKRUNS: sells immediately after, pockets profit
///
///   Example:
///   ┌──────────────────────────────────────────────────────────────┐
///   │ Pool: ETH/USDC                                               │
///   │ Initial Price: 1 ETH = 2000 USDC                             │
///   ├──────────────────────────────────────────────────────────────┤
///   │ TX 1 (Frontrun): Attacker buys 10 ETH                        │
///   │         → Price moves to 1 ETH = 2050 USDC                   │
///   ├──────────────────────────────────────────────────────────────┤
///   │ TX 2 (Victim): User buys 1 ETH                               │
///   │         → Pays 2050 USDC instead of 2000 USDC                │
///   │         → Lost: 50 USDC (2.5% worse execution)               │
///   ├──────────────────────────────────────────────────────────────┤
///   │ TX 3 (Backrun): Attacker sells 10 ETH                        │
///   │         → Receives ~20,500 USDC                              │
///   │         → Profit: ~500 USDC (from all victims)               │
///   └──────────────────────────────────────────────────────────────┘
///
/// ════════════════════════════════════════════════════════════════════════════════
/// DETECTION ALGORITHM
/// ════════════════════════════════════════════════════════════════════════════════
///
///   Pattern Match (same block, same pool):
///
///   IF:
///     swap[n-2].swapper == swap[n].swapper          // Same address
///     AND swap[n-2].direction != swap[n].direction  // Opposite directions
///     AND swap[n-1].swapper != swap[n].swapper      // Different address (victim)
///     AND swap[n-1].direction == swap[n-2].direction // Victim same dir as frontrun
///     AND price_impact > threshold                   // Significant extraction
///
///   THEN:
///     sandwich_detected = true
///     attacker = swap[n].swapper
///     victim = swap[n-1].swapper
///     mev_extracted = victim.amount × price_impact
///
/// ════════════════════════════════════════════════════════════════════════════════

interface ISandwichGuard {
    
    // ═══════════════════════════════════════════════════════════════════════════
    // STRUCTS
    // ═══════════════════════════════════════════════════════════════════════════

    /// @notice Record of a single swap
    struct SwapRecord {
        address swapper;           // Who made the swap
        bool zeroForOne;           // Direction: true = token0→token1
        int256 amountSpecified;    // Amount swapped
        uint160 sqrtPriceBefore;   // Price before swap
        uint160 sqrtPriceAfter;    // Price after swap
        uint256 blockNumber;       // Block number
        uint256 txIndex;           // Transaction index in block
    }

    /// @notice Detected sandwich attack
    struct SandwichAttack {
        address attacker;          // Address that profited
        address victim;            // Address that lost
        uint256 mevExtracted;      // Amount extracted from victim
        uint256 blockNumber;       // When it happened
        bytes32 frontrunTxHash;    // Frontrun transaction
        bytes32 backrunTxHash;     // Backrun transaction
    }

    /// @notice Pending refund for a victim
    struct Refund {
        address victim;
        address token;
        uint256 amount;
        uint256 blockNumber;
        bool claimed;
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // EVENTS
    // ═══════════════════════════════════════════════════════════════════════════

    event SandwichDetected(
        address indexed attacker,
        address indexed victim,
        uint256 mevExtracted,
        uint256 blockNumber
    );

    event RefundQueued(
        address indexed victim,
        address token,
        uint256 amount
    );

    event RefundClaimed(
        address indexed victim,
        address token,
        uint256 amount
    );

    event AttackerBlacklisted(
        address indexed attacker,
        uint256 attackCount
    );

    // ═══════════════════════════════════════════════════════════════════════════
    // CORE FUNCTIONS
    // ═══════════════════════════════════════════════════════════════════════════

    /// @notice Record a swap for analysis
    /// @dev Called by hook in beforeSwap/afterSwap
    function recordSwap(SwapRecord memory swap) external;

    /// @notice Analyze block for sandwich attacks
    /// @dev Called at end of block or by keeper
    function analyzeBlock(uint256 blockNumber) external returns (SandwichAttack[] memory);

    /// @notice Check if current transaction is being sandwiched
    /// @dev Called in beforeSwap to warn user
    function isPotentialVictim(address swapper, bool zeroForOne) external view returns (bool);

    /// @notice Queue a refund for a victim
    function queueRefund(address victim, address token, uint256 amount) external;

    /// @notice Victim claims their refund
    function claimRefund() external returns (uint256);

    // ═══════════════════════════════════════════════════════════════════════════
    // VIEW FUNCTIONS
    // ═══════════════════════════════════════════════════════════════════════════

    /// @notice Get attack count for an address
    function getAttackCount(address attacker) external view returns (uint256);

    /// @notice Check if address is blacklisted
    function isBlacklisted(address addr) external view returns (bool);

    /// @notice Get pending refund for victim
    function getPendingRefund(address victim) external view returns (Refund memory);

    /// @notice Get all swaps in a block
    function getBlockSwaps(uint256 blockNumber) external view returns (SwapRecord[] memory);
}
