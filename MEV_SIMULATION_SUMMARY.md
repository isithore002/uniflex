# MEV Sandwich Simulation - Quick Start

🌐 **ENS Domain**: `uniflux.eth` → `0xed0081BB40b7Bf64D407Ec25a99475d0BB8ed903`

## Summary

Successfully executed **canonical MEV sandwich attack pattern** on Unichain Sepolia to demonstrate UniFlux's MEV detection capabilities.

## On-Chain Proof

All three transactions are **live on Unichain Sepolia** and verifiable:

| Transaction | TX Hash | Block | Explorer Link |
|-------------|---------|-------|---------------|
| **Frontrun** (Attacker) | `0xa5458ebe...41a5` | 43458620 | [View](https://sepolia.uniscan.xyz/tx/0xa5458ebedc6893fff8b704875cfb00862a0f45a95fedd42fa239aa615c3f41a5) |
| **Victim** | `0xbd6c7902...ec0c` | 43458649 | [View](https://sepolia.uniscan.xyz/tx/0xbd6c79025e88c35497e832823f27813a8f30f833c00fe1c4ff39d2f73479ec0c) |
| **Backrun** (Attacker) | `0xbce8cf85...8481` | 43458676 | [View](https://sepolia.uniscan.xyz/tx/0xbce8cf85b346bd210df9dcf0991f078e8039492d7cc52a1613bc77b3b9768481) |

**Time Window**: 56 blocks (~112 seconds)

## Pattern Validation

```
✅ Same attacker: 0x32c100A22d5F463F804221e01673Da6eB19d1181 (frontrun & backrun)
✅ Different victim: 0xed0081BB40b7Bf64D407Ec25a99475d0BB8ed903
✅ Canonical pattern: frontrun → victim → backrun
✅ Price displacement: Victim suffered slippage from frontrun
```

## How to Verify

### Method 1: Run Verification Script
```powershell
cd H:\uniflex\uniflux\contracts
.\script\verify-sandwich.ps1
```

### Method 2: Check Explorer Manually
1. Visit [sepolia.uniscan.xyz](https://sepolia.uniscan.xyz)
2. Search for transaction hashes above
3. Verify:
   - Block numbers are sequential
   - Attacker address same in TX 1 & 3
   - Victim address different in TX 2
   - All transactions in same pool

### Method 3: Run Simulation Yourself
```powershell
# Setup attacker wallet
.\script\setup-attacker.ps1

# Fund wallet with ETH + tokens
# (See output for instructions)

# Run sandwich simulation
.\script\run-sandwich-simulation.ps1
```

## Technical Documentation

See [MEV_DEMO_DOCUMENTATION.md](./MEV_DEMO_DOCUMENTATION.md) for:
- Detection algorithm details
- Loss calculation methodology
- Refund mechanism design
- Judge verification guide

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    SANDWICH PATTERN                      │
├─────────────────────────────────────────────────────────┤
│                                                          │
│  1. Attacker FRONTRUN:  0.5 token0 → token1 (push ↑)   │
│  2. Victim SWAP:        0.1 token0 → token1 (@ worse)   │
│  3. Attacker BACKRUN:   token1 → token0 (restore ↓)     │
│                                                          │
│  Result: Victim lost value, attacker extracted MEV      │
│                                                          │
└─────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│                 DETECTION MECHANISM                      │
├─────────────────────────────────────────────────────────┤
│                                                          │
│  • Pattern matching: frontrun.swapper == backrun.swapper │
│  • Loss calculation: expectedOut - actualOut             │
│  • Refund caps: min(loss*30%, treasury, 0.1 ETH)        │
│  • Agent response: Remove liquidity, alert, refund       │
│                                                          │
└─────────────────────────────────────────────────────────┘
```

## Deployed Contracts (Unichain Sepolia)

- **PoolManager** (Official): `0x00B036B58a818B1BC34d502D3fE730Db729e62AC`
- **mETH Token**: `0xD49236Bb296e8935dC302De0cccFDf5EC5413157`
- **mUSDC Token**: `0x586c3d4bee371Df96063F045Aee49081Bc2e7cf7`
- **SwapHelper**: `0x26f814373D575bDC074175A686c3Ff197D4e3b07`
- **LiquidityHelper**: `0x94C7f21225EA17916DD99437869Ac5E90F3CDBf5`
- **SandwichDetector**: `0x3d65a5E73d43B5D20Afe7484eecC5D1364e3dEd6`

## Key Features

✅ **Deterministic Detection**: Pure math, no oracles  
✅ **Bounded Refunds**: Three-tier safety caps  
✅ **Agent-Driven**: OBSERVE-DECIDE-ACT loop  
✅ **Verifiable**: All on-chain, reproducible  
✅ **Judge-Defensible**: Industry-standard simulation

## Why Simulation?

> **MEV cannot be reliably reproduced on testnets.** Real attackers don't operate on testnets. We execute the canonical sandwich pattern ourselves to demonstrate the detection mechanism.

This is **standard practice** in MEV research. The detection logic doesn't care about attacker identity—only that the pattern occurred with measurable price displacement.

## What This Proves

1. ✅ We can **detect** the canonical sandwich pattern
2. ✅ We can **calculate loss** deterministically  
3. ✅ We can **issue refunds** with safety bounds
4. ✅ We can **respond** autonomously via agent

This is a **proof of concept** for judge evaluation, not production MEV.

## Next Steps

1. **Integrate Uniswap v4 Hook**: Move detection into `afterSwap` callback
2. **Real-time Events**: Replace polling with WebSocket subscriptions  
3. **Multi-pool Support**: Expand beyond test pool
4. **Gas Optimization**: Batch recording, optimize storage
5. **Advanced Patterns**: Detect long-tail attacks

## Links

- **Full Documentation**: [MEV_DEMO_DOCUMENTATION.md](./MEV_DEMO_DOCUMENTATION.md)
- **Verification Script**: [verify-sandwich.ps1](./script/verify-sandwich.ps1)
- **Simulation Script**: [run-sandwich-simulation.ps1](./script/run-sandwich-simulation.ps1)
- **Explorer**: https://sepolia.uniscan.xyz

---

**Hackathon Submission**: Uniswap v4 Agentic Finance  
**Prize Track**: Best Agent ($5,000)  
**Status**: ✅ MEV simulation complete, all transactions on-chain
