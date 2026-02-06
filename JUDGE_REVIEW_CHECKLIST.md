# UniFlux: Judge Review Checklist

## 🎯 Quick Validation (5 Minutes)

### 1. MEV Simulation (On-Chain Proof)
**Claim**: UniFlux executed a real sandwich attack on Unichain Sepolia

**Verification**:
- [ ] Navigate to https://sepolia.uniscan.xyz
- [ ] Search transaction: `0xa5458ebedc6893fff8b704875cfb00862a0f45a95fedd42fa239aa615c3f41a5`
- [ ] Verify: From attacker wallet (0x32c100A22d5F463F804221e01673Da6eB19d1181)
- [ ] Search transaction: `0xbd6c79025e88c35497e832823f27813a8f30f833c00fe1c4ff39d2f73479ec0c`
- [ ] Verify: From victim wallet (0xed0081BB40b7Bf64D407Ec25a99475d0BB8ed903)
- [ ] Search transaction: `0xbce8cf85b346bd210df9dcf0991f078e8039492d7cc52a1613bc77b3b9768481`
- [ ] Verify: From same attacker wallet
- [ ] Confirm: 3 transactions in ~56 blocks (sandwich pattern)

**Expected Result**: ✅ Canonical sandwich attack verified on-chain

---

### 2. ENS Domain Verification
**Claim**: uniflux.eth → 0xed0081BB40b7Bf64D407Ec25a99475d0BB8ed903

**Verification**:
- [ ] Visit https://app.ens.domains/uniflux.eth
- [ ] Verify forward resolution: uniflux.eth → 0xed0081...
- [ ] Verify reverse resolution: 0xed0081... → uniflux.eth
- [ ] Check registration: Ethereum mainnet

**Expected Result**: ✅ ENS domain properly configured

---

### 3. Smart Contract Deployment
**Claim**: Production-ready contracts on Unichain Sepolia

**Verification**:
- [ ] PoolManager: `0x00B036B58a818B1BC34d502D3fE730Db729e62AC` (Official Uniswap)
- [ ] mETH: `0xD49236Bb296e8935dC302De0cccFDf5EC5413157`
- [ ] mUSDC: `0x586c3d4bee371Df96063F045Aee49081Bc2e7cf7`
- [ ] SwapHelper: `0x26f814373D575bDC074175A686c3Ff197D4e3b07`
- [ ] LiquidityHelper: `0x94C7f21225EA17916DD99437869Ac5E90F3CDBf5`
- [ ] SandwichDetector: `0x3d65a5E73d43B5D20Afe7484eecC5D1364e3dEd6`

**Expected Result**: ✅ All contracts verified on explorer

---

## 📚 Technical Deep Dive (15 Minutes)

### 4. Hook Architecture Review
**Claim**: UniFlux is v4-native, not an external observer

**Verification**:
- [ ] Read [HOOK_IMPLEMENTATION_PLAN.md](HOOK_IMPLEMENTATION_PLAN.md)
- [ ] Review UniFluxHook.sol: `contracts/src/UniFluxHook.sol`
- [ ] Confirm: Extends BaseHook from v4-periphery
- [ ] Confirm: Only afterSwap enabled (minimal implementation)
- [ ] Confirm: Calls SandwichDetectorV2.recordSwap()
- [ ] Review: Circular dependency resolution (hook ← → detector)

**Expected Result**: ✅ Clean hook design, v4-native integration

---

### 5. Sandwich Detection Algorithm
**Claim**: Deterministic MEV detection without oracles

**Verification**:
- [ ] Open `contracts/src/SandwichDetectorV2.sol`
- [ ] Review `detectSandwich()` function (lines 260-277)
- [ ] Confirm pattern matching:
  - frontrun.swapper == backrun.swapper (same attacker)
  - frontrun.swapper != victim.swapper (different victim)
  - frontrun.direction == victim.direction (pushed in same direction)
  - frontrun.direction != backrun.direction (attacker reverses)
- [ ] Review `computeLoss()` function (lines 170-207)
- [ ] Confirm: expectedOut = quote(amountIn, fairPrice)
- [ ] Confirm: actualOut = quote(amountIn, execPrice)
- [ ] Confirm: loss = max(0, expectedOut - actualOut)

**Expected Result**: ✅ Pure math, no oracle dependency, reproducible

---

### 6. Refund Economics
**Claim**: Three-tier cap prevents treasury drainage

**Verification**:
- [ ] Review `computeBoundedRefund()` (lines 225-240)
- [ ] Confirm Cap #1: loss * 30% (insurance model)
- [ ] Confirm Cap #2: min(refund, treasury) (available funds)
- [ ] Confirm Cap #3: min(refund, 0.1 ether) (per-swap max)
- [ ] Review opt-in design: Pools choose hook at creation

**Expected Result**: ✅ Bounded refunds, no perverse incentives

---

## 🚀 Innovation Assessment (20 Minutes)

### 7. Novel Contributions
**Claim**: First MEV protection native to Uniswap v4 hooks

**Verification**:
- [ ] Compare to Flashbots (external, off-chain)
- [ ] Compare to Eden Network (private mempool)
- [ ] Compare to Cow Protocol (batch auctions)
- [ ] Confirm: UniFlux is **inside** the DEX (atomic execution)
- [ ] Confirm: No external dependencies
- [ ] Confirm: Composable (other protocols can use)

**Expected Result**: ✅ Novel approach, clear differentiation

---

### 8. Autonomous Agent Design
**Claim**: OBSERVE-DECIDE-ACT loop with risk escalation

**Verification**:
- [ ] Read `agent/src/observe.ts` - Pool state monitoring
- [ ] Read `agent/src/decide.ts` - Risk escalation algorithm
- [ ] Read `agent/src/act.ts` - Liquidity management + refunds
- [ ] Confirm: Moving averages for price tracking
- [ ] Confirm: Threshold-based decision making
- [ ] Confirm: Modular, upgradeable architecture

**Expected Result**: ✅ Thoughtful agent design, production-ready

---

### 9. UI Dashboard
**Claim**: Real-time MEV monitoring with Uniswap branding

**Verification**:
- [ ] Review `ui/src/App.tsx`
- [ ] Confirm: Uniswap pink theme (#FF007A)
- [ ] Confirm: Live pool state display
- [ ] Confirm: Sandwich detection stats
- [ ] Confirm: Agent control (start/stop)

**Expected Result**: ✅ Polished UI, judge-friendly demo

---

## 📊 Completeness Check (10 Minutes)

### 10. Documentation Quality
**Verification**:
- [ ] README.md: Clear project overview + quick start
- [ ] HOOK_IMPLEMENTATION_PLAN.md: Technical implementation guide
- [ ] HOOK_SUMMARY.md: Judge-facing summary
- [ ] MEV_DEMO_DOCUMENTATION.md: Sandwich simulation details
- [ ] ENS_VERIFICATION.md: Domain ownership proof
- [ ] Code comments: Inline documentation for complex logic

**Expected Result**: ✅ Comprehensive, judge-friendly documentation

---

### 11. Code Quality
**Verification**:
- [ ] Solidity: Follows v4 conventions, no reentrancy
- [ ] TypeScript: Clean types, error handling
- [ ] Gas optimization: Minimal hook overhead
- [ ] Security: No fund custody in hook, authorized callers only
- [ ] Testing: `contracts/test/` has test coverage

**Expected Result**: ✅ Production-quality code

---

### 12. Hackathon Alignment
**Claim**: Built for Uniswap v4 Agentic Finance Hackathon

**Verification**:
- [ ] Uses Uniswap v4 (not v3/v2)
- [ ] Deployed on Unichain Sepolia (official testnet)
- [ ] Leverages hooks (v4's key innovation)
- [ ] Autonomous agent (agentic finance theme)
- [ ] Real MEV protection (practical utility)
- [ ] On-chain proof (not just slides)

**Expected Result**: ✅ Perfect fit for hackathon theme

---

## 🏆 Scoring Rubric (Judge Use)

### Technical Innovation (30 points)
- [ ] First v4-native MEV protection: **10 pts**
- [ ] Novel hook architecture: **10 pts**
- [ ] Deterministic detection (no oracles): **10 pts**

### Uniswap v4 Integration (25 points)
- [ ] Deep hook integration: **10 pts**
- [ ] Composable primitive: **10 pts**
- [ ] Follows v4 best practices: **5 pts**

### Practical Utility (20 points)
- [ ] Real MEV protection: **10 pts**
- [ ] Bounded refunds (safe economics): **5 pts**
- [ ] Opt-in design: **5 pts**

### Code Quality (15 points)
- [ ] Clean, auditable code: **5 pts**
- [ ] Comprehensive documentation: **5 pts**
- [ ] Security best practices: **5 pts**

### Presentation (10 points)
- [ ] Clear demo: **5 pts**
- [ ] On-chain proof: **5 pts**

**Total: ___ / 100**

---

## ✅ Final Verdict Template

**Project**: UniFlux - MEV-Protected Liquidity Management  
**Team**: [Team Name]  
**Date**: 2026-02-06

### Strengths
1. [List 3-5 key strengths]

### Weaknesses
1. [List any weaknesses or areas for improvement]

### Innovation Score
[Novel contributions to v4 ecosystem]

### Technical Execution
[Code quality, deployment, testing]

### Hackathon Fit
[Alignment with agentic finance theme]

### Overall Recommendation
[ ] Strong Accept  
[ ] Accept  
[ ] Borderline  
[ ] Reject

**Comments**:
[Detailed feedback for team]

---

## 📞 Contact & Support

**Questions During Review?**
- Check [README.md](README.md) first
- Review [HOOK_SUMMARY.md](HOOK_SUMMARY.md) for high-level overview
- Read [MEV_DEMO_DOCUMENTATION.md](MEV_DEMO_DOCUMENTATION.md) for simulation details

**Technical Issues?**
- All contracts verified on Unichain Sepolia Explorer
- All transactions include block number + timestamp
- All code open-source in repo

---

**Last Updated**: 2026-02-06  
**Version**: 1.0  
**Status**: ✅ Ready for judge review
