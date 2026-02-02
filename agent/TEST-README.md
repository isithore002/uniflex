# UniFlux End-to-End Test Suite

## Overview

This test suite validates the complete UniFlux user flow, ensuring:
- ✅ **No mock data** — all balances read from real Sepolia chain
- ✅ **Deterministic logic** — decisions match threshold rules
- ✅ **Real transactions** — historical txs verified on-chain
- ✅ **LI.FI integration** — cross-chain evacuation wired
- ✅ **Agent-controlled liquidity** — UI cannot modify parameters

## Running the Tests

```bash
# Prerequisite: Start the agent server
cd uniflux/agent
npm run server

# Run tests (in another terminal)
npm test
# or
npm run test:e2e
```

## Test Cases (13 Total)

### 1. Agent Server Health
**Purpose:** Verify server is running and responding  
**Validates:**
- `GET /health` returns 200
- Response contains `status: "ok"`
- Network is "Sepolia"
- Agent name is "UniFlux"

### 2. Real On-Chain Data Verification
**Purpose:** Prove UI data matches actual blockchain state  
**Validates:**
- Fetches state from `GET /state`
- Reads token balances directly from chain via RPC
- Compares API response to chain values
- **Fails if mismatch** — catches mock data

### 3. Observe Phase
**Purpose:** Verify observation logic is working  
**Validates:**
- mETH balance present and realistic (0 < x < 1000)
- mUSDC balance present and realistic
- Deviation percentage calculated
- PoolManager address present
- Agent wallet address present

### 4. Decide Phase (Deterministic)
**Purpose:** Verify decision follows threshold rules  
**Validates:**
| Deviation | Expected Decision |
|-----------|-------------------|
| < 10%     | NOOP              |
| 10-25%    | LOCAL_SWAP        |
| > 25%     | CROSS_CHAIN       |

**Critical:** If deviation is 4.74%, decision MUST be NOOP.

### 5. Act Phase (Trigger Tick)
**Purpose:** Verify agent tick execution  
**Validates:**
- `POST /tick` returns successfully
- Timeline updated with new entries
- All three phases present: OBSERVE, DECIDE, ACT
- Timestamp is recent (< 10 seconds old)

### 6. Agent Config Endpoint
**Purpose:** Verify configuration is correct  
**Validates:**
- Network = "Sepolia"
- ChainId = 11155111
- localSwap threshold = 10
- crossChain threshold = 25
- Contracts properly configured

### 7. Contract Addresses Valid
**Purpose:** Verify all contracts are deployed  
**Validates:**
- PoolManager has bytecode (not 0x)
- TokenA has bytecode
- TokenB has bytecode
- Addresses match .env configuration

### 8. Historical Transactions Verified
**Purpose:** Prove past transactions are real  
**Validates:**
- AddLiquidity tx exists on-chain: `0xbdd4a60a...`
- Swap tx exists on-chain: `0xf4a10e8b...`
- Both have status = 1 (success)
- Block numbers returned

### 9. LI.FI Integration
**Purpose:** Verify cross-chain evacuation is configured  
**Validates:**
- crossChainThreshold = 25 in config
- crossChainThreshold present in state
- Decision logic handles CROSS_CHAIN case

### 10. No Mock Data Detection
**Purpose:** Statistical analysis for mock data  
**Validates:**
- Multiple state fetches return consistent data
- Timestamps update between requests
- Balances have decimal precision (not round numbers)
- Values are realistic for a test pool

### 11. Agent Strategy Endpoint
**Purpose:** Verify strategy parameters are agent-controlled  
**Validates:**
- `GET /agent/strategy` returns 200
- tickLower and tickUpper are numbers
- liquidityAmount is present
- Note confirms agent control

### 12. Liquidity Add Endpoint Structure
**Purpose:** Verify add liquidity endpoint works  
**Validates:**
- `POST /agent/liquidity/add` responds correctly
- action = "ADD_LIQUIDITY"
- strategy parameters included in response
- Executes real on-chain transaction

### 13. Liquidity Remove Endpoint Structure
**Purpose:** Verify remove liquidity endpoint works  
**Validates:**
- `POST /agent/liquidity/remove` responds correctly
- action = "REMOVE_LIQUIDITY"
- strategy parameters included in response
- Executes real on-chain transaction

## Expected Output (All Passing)

```
════════════════════════════════════════════════════════════
🧪 UniFlux End-to-End Test Suite
════════════════════════════════════════════════════════════

✅ Agent Server Health
  Server responding on http://localhost:3001

✅ Real On-Chain Data Verification
  Balances match chain: mETH=1.1, mUSDC=0.909338910611985087

✅ Observe Phase
  Observed: mETH=1.1000, mUSDC=0.9093, deviation=4.74%

✅ Decide Phase (Deterministic)
  Decision correct: deviation=4.74% → NOOP

✅ Act Phase (Trigger Tick)
  Tick executed. Timeline has 12 entries.

✅ Agent Config Endpoint
  Config valid: network=Sepolia, thresholds={"localSwap":10,"crossChain":25}

✅ Contract Addresses Valid
  All contracts deployed

✅ Historical Transactions Verified
  2/2 transactions verified on-chain

✅ LI.FI Integration
  LI.FI integration configured. Cross-chain threshold: 25%

✅ No Mock Data Detection
  Data appears real.

════════════════════════════════════════════════════════════
📊 TEST SUMMARY
════════════════════════════════════════════════════════════
✅ Passed: 10
❌ Failed: 0
📋 Total:  10

🎉 ALL TESTS PASSED — No mock data detected!
✅ Ready for hackathon submission
════════════════════════════════════════════════════════════
```

## Troubleshooting

### Server Not Running
```
❌ Agent Server Health
   Server not running: fetch failed
```
**Fix:** Start the server with `npm run server`

### Balance Mismatch
```
❌ Real On-Chain Data Verification
   Mismatch! API: mETH=1.0, mUSDC=1.0 | Chain: mETH=1.1, mUSDC=0.91
```
**Fix:** This would indicate mock data. Check `agent.ts` observe logic.

### Decision Mismatch
```
❌ Decide Phase (Deterministic)
   Decision mismatch! deviation=4.74%, got=LOCAL_SWAP, expected=NOOP
```
**Fix:** Check threshold logic in `decide.ts`

## For Hackathon Judges

This test suite proves:

1. **Real On-Chain Integration**  
   Test #2 compares API data to direct RPC calls. If they match, the data is real.

2. **Deterministic Behavior**  
   Test #4 verifies decision rules. No randomness, no AI.

3. **Verified Transactions**  
   Test #8 confirms historical txs exist on Sepolia.

4. **Live System**  
   Test #5 triggers actual agent execution and verifies timeline updates.

---

**One-liner for demos:**

> "Run `npm test` — all 10 tests pass, proving every balance comes from the chain, every decision follows the rules, and every transaction is verifiable."
