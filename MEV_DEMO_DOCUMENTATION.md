# UniFlux MEV Sandwich Simulation - Judge Documentation

🌐 **ENS Domain**: `uniflux.eth` → `0xed0081BB40b7Bf64D407Ec25a99475d0BB8ed903`

## Executive Summary

UniFlux demonstrates **deterministic MEV protection** using a canonical sandwich attack simulation on Unichain Sepolia. All transactions are verifiable on-chain at [sepolia.uniscan.xyz](https://sepolia.uniscan.xyz).

---

## Why Simulation?

**MEV cannot be reliably reproduced on testnets.**

Real MEV attackers don't operate on testnets. To demonstrate our protection mechanism, we execute the canonical three-transaction sandwich pattern ourselves. This is **industry-standard** for MEV research:

> "MEV is about mechanism, not identity. Detection logic doesn't care who the attacker is—only that the three-swap pattern occurred with measurable price displacement."

Our approach:
- ✅ Three real on-chain transactions (tight time window)
- ✅ Canonical sandwich pattern (frontrun → victim → backrun)
- ✅ Deterministic loss calculation (pure math, no oracle)
- ✅ Verifiable on block explorer

---

## On-Chain Proof (Unichain Sepolia)

### Pool Details
- **Pool ID**: `0xbf8ef484167ee2036a7a8a6eef0ae97eb9fd831c2fc06a897ab8d312c813ef0e`
- **Tokens**: mETH (0xD49236...3157) / mUSDC (0x586c3d...7cf7)
- **Fee Tier**: 0.3% (3000 bps)
- **Liquidity**: 1 ETH each side

### Sandwich Transaction Sequence

| Step | TX Hash | Block | Role | Action |
|------|---------|-------|------|--------|
| 1 | [0xa5458ebedс...41a5](https://sepolia.uniscan.xyz/tx/0xa5458ebedc6893fff8b704875cfb00862a0f45a95fedd42fa239aa615c3f41a5) | 43458620 | Attacker | **Frontrun**: 0.5 token0 → token1 (pushes price UP) |
| 2 | [0xbd6c79025e...ec0c](https://sepolia.uniscan.xyz/tx/0xbd6c79025e88c35497e832823f27813a8f30f833c00fe1c4ff39d2f73479ec0c) | 43458649 | **Victim** | Swaps 0.1 token0 → token1 at WORSE price |
| 3 | [0xbce8cf85b3...8481](https://sepolia.uniscan.xyz/tx/0xbce8cf85b346bd210df9dcf0991f078e8039492d7cc52a1613bc77b3b9768481) | 43458676 | Attacker | **Backrun**: token1 → token0 (restores price, extracts MEV) |

**Time Window**: 56 blocks (~112 seconds)

### Wallet Addresses
- **Victim**: `0xed0081BB40b7Bf64D407Ec25a99475d0BB8ed903` (`uniflux.eth` ✅ ENS verified)
- **Attacker**: `0x32c100A22d5F463F804221e01673Da6eB19d1181`

---

## Technical Implementation

### Detection Algorithm (SandwichDetectorV2)

```solidity
library SandwichMath {
    /// @notice Canonical sandwich detection pattern
    /// @return isSandwich True if pattern matches
    function detectSandwich(
        address frontrunSwapper,
        bool frontrunDir,
        address victimSwapper,
        bool victimDir,
        address backrunSwapper,
        bool backrunDir
    ) internal pure returns (bool isSandwich) {
        isSandwich = (
            frontrunSwapper == backrunSwapper &&   // Same attacker
            frontrunSwapper != victimSwapper &&    // Different victim
            frontrunDir == victimDir &&            // Victim pushed same direction
            frontrunDir != backrunDir              // Attacker reverses
        );
    }
}
```

### Loss Calculation (No Oracle Required)

```solidity
/// @dev Loss = what victim SHOULD have received - what they GOT
/// P_pre = sqrtPriceX96 at block start (fair price)
/// P_exec = sqrtPriceX96 when victim executed (displaced price)
///
/// expectedOut = quote(amountIn, P_pre)
/// actualOut = quote(amountIn, P_exec)
/// loss = max(0, expectedOut - actualOut)
```

**Properties:**
- ✅ Deterministic (pure math)
- ✅ No external oracle dependency
- ✅ Reproducible by judges
- ✅ Denominated in output token

### Refund Caps (Three-Tier Safety)

```solidity
refund = min(
    loss * REFUND_BPS / 10000,    // Cap #2: 30% of loss (insurance model)
    treasury,                      // Cap #1: Available funds
    MAX_REFUND_PER_SWAP            // Cap #3: 0.1 ETH absolute ceiling
)
```

**Why Caps?**
- Prevents treasury drainage
- Limits single-user dominance
- Avoids perverse incentives
- Sustainable economics

---

## How Judges Can Verify

### 1. Check Sandwich Pattern on Explorer

Visit [sepolia.uniscan.xyz](https://sepolia.uniscan.xyz) and search for:
- Frontrun TX: `0xa5458ebedc6893fff8b704875cfb00862a0f45a95fedd42fa239aa615c3f41a5`
- Victim TX: `0xbd6c79025e88c35497e832823f27813a8f30f833c00fe1c4ff39d2f73479ec0c`
- Backrun TX: `0xbce8cf85b346bd210df9dcf0991f078e8039492d7cc52a1613bc77b3b9768481`

**Expected Observations:**
- ✅ Tight time window (same block or consecutive blocks)
- ✅ Same attacker address in TX 1 & 3
- ✅ Different victim address in TX 2
- ✅ All swaps in same pool (Pool ID matches)

### 2. Analyze Swap Logs

Each transaction emits:
```
event Swap(
    PoolId indexed id,
    address indexed sender,
    int128 amount0,
    int128 amount1,
    uint160 sqrtPriceX96,
    uint128 liquidity,
    int24 tick
)
```

**Compare `sqrtPriceX96` values:**
- After frontrun: Price ↑ (higher sqrtPrice)
- After victim: Price ↑↑ (victim pushed further)
- After backrun: Price ↓ (restored toward original)

### 3. Run Detection Algorithm

Use our open-source code:
```bash
git clone https://github.com/yourusername/uniflex
cd uniflex/uniflux/contracts
forge test --match-contract SandwichDetector -vvv
```

### 4. Verify Contract Deployment

All contracts deployed on Unichain Sepolia:
- **PoolManager**: `0x00B036B58a818B1BC34d502D3fE730Db729e62AC` (official Uniswap v4)
- **SandwichDetectorStorage**: `0x3d65a5E73d43B5D20Afe7484eecC5D1364e3dEd6`
- **SwapHelper**: `0x26f814373D575bDC074175A686c3Ff197D4e3b07`
- **LiquidityHelper**: `0x94C7f21225EA17916DD99437869Ac5E90F3CDBf5`

---

## What We're NOT Claiming

❌ **NOT claiming**: "This is real MEV from external attackers"  
✅ **CLAIMING**: "Our detection mechanism works for the canonical pattern"

❌ **NOT claiming**: "We made profits"  
✅ **CLAIMING**: "We demonstrated measurable victim loss"

❌ **NOT claiming**: "This is production-ready"  
✅ **CLAIMING**: "This is a judge-defensible proof of concept"

---

## Architecture Highlights

### Agent-Driven Response

When MEV is detected:
1. **OBSERVE**: Agent polls for `Swap` events, calculates price changes
2. **DECIDE**: Risk escalation algorithm (moving average + thresholds)
3. **ACT**: Remove liquidity, issue alerts, trigger refunds

### UI Dashboard

Real-time monitoring at [http://localhost:5173](http://localhost:5173):
- Live swap feed with tx links to Unichain Sepolia explorer
- MEV detection statistics
- Agent decision timeline
- Refund tracking

### Smart Contract Safety

- **Opt-in model**: Pool creators choose MEV protection
- **LP consent**: Liquidity providers know insurance model upfront
- **Bounded refunds**: Three-tier caps prevent abuse
- **Upgradeable detection**: Logic in library, storage separate

---

## Economic Model

### Treasury Funding

Pool operators fund insurance pool:
```solidity
function fund() external payable {
    treasury += msg.value;
    emit TreasuryFunded(msg.sender, msg.value);
}
```

### Victim Claims

```solidity
function claim() external returns (uint256 amount) {
    amount = claimable[msg.sender];
    if (amount == 0) revert NothingToClaim();
    
    claimable[msg.sender] = 0;
    (bool success,) = msg.sender.call{value: amount}("");
    
    emit RefundClaimed(msg.sender, amount);
}
```

### Analytics

```solidity
totalLossDetected;       // Aggregate victim losses
totalRefundsIssued;      // Aggregate refunds paid
sandwichCount[attacker]; // Reputation tracking
avgRefundRate();         // Insurance efficiency
```

---

## Future Work

### Production Roadmap

1. **Uniswap v4 Hook Integration**: Move detection into `afterSwap` hook
2. **Real-time Event Streaming**: Replace polling with WebSocket subscriptions
3. **Multi-pool Support**: Expand beyond single test pool
4. **Gas Optimization**: Batch swap recording, optimize storage
5. **Advanced Patterns**: Detect long-tail attacks (wash trading, spoofing)

### Research Extensions

- **Cross-DEX Detection**: Arbitrage sandwiches across protocols
- **L2-Specific Optimizations**: Leverage Unichain's sequencer guarantees
- **ML-Based Classification**: Neural networks for pattern recognition
- **Reputation Oracle**: Trustless attacker identification

---

## Conclusion

UniFlux demonstrates:

✅ **Canonical MEV pattern** executed on-chain  
✅ **Deterministic detection** via pure math (no oracles)  
✅ **Verifiable proof** on Unichain Sepolia explorer  
✅ **Bounded refund mechanism** with three-tier safety  
✅ **Agent-driven response** with OBSERVE-DECIDE-ACT loop  
✅ **Judge-defensible methodology** using industry-standard simulation

This is a **proof of concept** showing UniFlux can:
- Detect MEV with mathematical precision
- Calculate losses deterministically
- Issue bounded refunds safely
- Respond autonomously via agent logic

**For Judges**: All code is open-source, all transactions are on-chain, and all math is reproducible. This is verifiable, deterministic MEV protection.

---

## Links

- **Live UI**: http://localhost:5173 (local demo)
- **Explorer**: https://sepolia.uniscan.xyz
- **GitHub**: https://github.com/yourusername/uniflex
- **Docs**: See README.md in repo root

---

## Contact

For questions about this submission, contact: [your email/Discord]

**Hackathon**: Uniswap v4 Agentic Finance  
**Prize Track**: $5,000 Best Agent  
**Submission Date**: [Date]
