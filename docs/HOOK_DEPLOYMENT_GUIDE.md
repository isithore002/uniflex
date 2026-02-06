# UniFlux Hook: Quick Deployment Guide

## ⚡ Fast Track (TL;DR)

**Status**: Design complete, import dependencies need resolution before deployment.

**Time Estimate**: 1-1.5 hours to full deployment once dependencies resolved.

---

## 🎯 What We Built (Past 3 Hours)

| Component | Status | Purpose |
|-----------|--------|---------|
| UniFluxHook.sol | ✅ Created | Minimal afterSwap hook |
| SandwichDetectorV2.recordSwap() | ✅ Added | Receive swap data from hook |
| DeployUniFluxHook.s.sol | ✅ Created | Deploy hook + detector |
| InitPoolWithHook.s.sol | ✅ Created | Create pool with hook attached |
| README.md hook section | ✅ Updated | Architecture + benefits |
| HOOK_IMPLEMENTATION_PLAN.md | ✅ Created | Full technical guide |
| HOOK_SUMMARY.md | ✅ Created | Judge-facing summary |

---

## 🚧 Current Blocker

**Issue**: Import path conflicts between v4-periphery and our contracts

**v4-periphery uses**:
```solidity
import {IPoolManager} from "@uniswap/v4-core/src/interfaces/IPoolManager.sol";
```

**Our contracts use**:
```solidity
import {IPoolManager} from "v4-core/interfaces/IPoolManager.sol";
```

**Solutions** (pick one):

### Option A: Update Remappings (Recommended - 15 min)
Edit `contracts/remappings.txt`:
```diff
- v4-core/=lib/v4-core/src/
+ @uniswap/v4-core/=lib/v4-core/src/
```

Then update all imports in our contracts to use `@uniswap/v4-core/...`

### Option B: Fork v4-periphery (30 min)
1. Fork v4-periphery repo
2. Update all imports to match our remapping
3. Update git submodule to point to fork

### Option C: Direct IHooks Implementation (45 min)
Skip BaseHook, implement IHooks directly:
```solidity
contract UniFluxHook is IHooks {
    // Implement all IHooks functions
    // Most return HookNotImplemented error
    // Only afterSwap has logic
}
```

---

## 📋 Deployment Checklist

### Pre-Deployment
- [ ] Resolve import path conflicts (choose Option A/B/C above)
- [ ] Compile contracts successfully (`forge build`)
- [ ] Run tests (`forge test`)
- [ ] Ensure wallet has Unichain Sepolia ETH

### Deployment Commands

```powershell
# Set Foundry in PATH
$env:Path = "$env:USERPROFILE\.foundry\bin;$env:Path"
cd H:\uniflex\uniflux\contracts

# 1. Deploy Hook + Detector
forge script script/DeployUniFluxHook.s.sol \
  --rpc-url https://sepolia.unichain.org \
  --broadcast \
  --verify

# Save addresses from output:
# Hook: 0x...
# Detector: 0x...

# 2. Create Pool with Hook
forge script script/InitPoolWithHook.s.sol \
  --rpc-url https://sepolia.unichain.org \
  --broadcast

# Save pool ID from output

# 3. Add Liquidity
forge script script/AddLiquidity.s.sol \
  --rpc-url https://sepolia.unichain.org \
  --broadcast

# 4. Execute Test Swap
forge script script/SwapTokens.s.sol \
  --rpc-url https://sepolia.unichain.org \
  --broadcast

# Get transaction hash from output
```

### Verification

1. **Unichain Sepolia Explorer**: https://sepolia.uniscan.xyz
2. Navigate to swap transaction
3. Check "Logs" tab for:
   - ✅ `UniFluxHookTriggered` event
   - ✅ `SwapRecorded` event
4. Verify event data matches swap parameters

### Update Documentation

```markdown
## Deployed Contracts (Updated)

| Contract | Address | Explorer |
|----------|---------|----------|
| **UniFluxHook** | `0x...` | [View](https://sepolia.uniscan.xyz/address/0x...) |
| **SandwichDetectorV2** | `0x...` | [View](https://sepolia.uniscan.xyz/address/0x...) |
| **Hook-Enabled Pool** | `0x...` | [View](https://sepolia.uniscan.xyz/address/0x...) |
```

---

## 🎯 Success Criteria

| Criterion | Verification Method |
|-----------|---------------------|
| Hook deployed | Address on Unichain Sepolia |
| Detector deployed | Address on Unichain Sepolia |
| Pool created with hook | Pool key contains hook address |
| Swap triggers hook | `UniFluxHookTriggered` event in tx |
| Detector receives data | `SwapRecorded` event in same tx |
| Events parseable | Agent can decode event data |

---

## 📊 Judge Demonstration

### Slide 1: The Problem
"Traditional MEV protection operates **outside** the DEX. Flashbots, Eden, Cow Protocol - all external systems."

### Slide 2: UniFlux Solution
"UniFlux operates **inside** Uniswap v4 via hooks. Atomic execution, no trust assumptions."

### Slide 3: Architecture
[Show diagram from README.md]

### Slide 4: Live Proof
"Here's a swap transaction. See the `UniFluxHookTriggered` event? That's our hook executing **inside** the swap."

### Slide 5: Code Walkthrough
```solidity
function _afterSwap(...) internal override returns (bytes4, int128) {
    detector.recordSwap(...);  // Feed to detector
    emit UniFluxHookTriggered(...);  // Alert agent
    return (IHooks.afterSwap.selector, 0);
}
```
"60 lines. Minimal. Auditable. Judge-safe."

### Slide 6: Impact
"Other protocols can attach our hook. LPs opt-in per-pool. Victims get trustless refunds. This is composable MEV protection."

---

## 🔧 Troubleshooting

### "Compiler run failed: Identifier not found"
**Cause**: Import path mismatch  
**Fix**: Update remappings.txt or use consistent import paths

### "Hook address doesn't match required flags"
**Cause**: v4 requires hook addresses to have specific bits set  
**Fix**: Use HookMiner to find valid address or deploy with CREATE2 + salt

### "Transaction reverted: UnauthorizedCaller"
**Cause**: recordSwap() called by non-hook address  
**Fix**: Ensure hook.setDetector() was called after deployment

### "No UniFluxHookTriggered event"
**Cause**: Swap not using hooked pool  
**Fix**: Verify pool key contains hook address

---

## 📚 Reference Documents

| Document | Purpose | Audience |
|----------|---------|----------|
| [README.md](README.md) | Project overview + hook section | General |
| [HOOK_IMPLEMENTATION_PLAN.md](HOOK_IMPLEMENTATION_PLAN.md) | Technical implementation guide | Developers |
| [HOOK_SUMMARY.md](HOOK_SUMMARY.md) | High-level achievements | Judges |
| [This file](HOOK_DEPLOYMENT_GUIDE.md) | Quick deployment steps | You (right now) |

---

## 🚀 Immediate Next Steps

1. **Choose import resolution strategy** (Option A recommended)
2. **Compile contracts** (`forge build`)
3. **Deploy hook + detector** (15 min)
4. **Execute test swap** (5 min)
5. **Verify events** (5 min)
6. **Update submission** (10 min)

**Total Time**: ~45-60 minutes

---

## 💡 Pro Tips

- **Test locally first**: Use `forge test` to validate hook logic
- **Use --verify flag**: Auto-verify contracts on deployment
- **Save all addresses**: You'll need them for agent integration
- **Screenshot events**: Visual proof for judges
- **Update .env**: Add HOOK_ADDRESS and DETECTOR_ADDRESS

---

**Last Updated**: 2026-02-06  
**Status**: Ready for deployment pending import resolution  
**Confidence**: High (design validated, contracts written, scripts ready)
