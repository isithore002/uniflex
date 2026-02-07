# LI.FI Safe Harbor Evacuation Flow

## Overview

UniFlux integrates LI.FI for **MEV-safe cross-chain evacuation** - automatically protecting LP positions when MEV attacks are detected by bridging assets to a safer chain and depositing into Aave V3 for yield.

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    SAFE HARBOR EVACUATION FLOW                          │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│   1. MEV DETECTION          2. REMOVE LP           3. BRIDGE           │
│   ┌─────────────┐          ┌─────────────┐       ┌─────────────┐      │
│   │ Sandwich    │    →     │ Uniswap v4  │   →   │   LI.FI     │      │
│   │ Detector    │          │ LP Removal  │       │   Bridge    │      │
│   └─────────────┘          └─────────────┘       └─────────────┘      │
│                                                         │              │
│                                                         ↓              │
│                                              4. AAVE DEPOSIT           │
│                                              ┌─────────────┐           │
│                                              │  Aave V3    │           │
│                                              │  on Base    │           │
│                                              └─────────────┘           │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

## User Problem Solved

**The Problem**: MEV bots detect pending LP operations and sandwich attack liquidity providers, extracting value.

**Our Solution**: When UniFlux detects high MEV risk:
1. **Immediately removes** liquidity from the Uniswap v4 pool
2. **Bridges** withdrawn USDC to Base via LI.FI (fastest/cheapest route)
3. **Deposits** bridged USDC into Aave V3 for yield + safety

This "MEV Evacuation to Safe Harbor" protects LP value while earning yield during attack windows.

## Implementation

### Core Files

- **`agent/src/evacuate.ts`** - Main evacuation logic
- **`agent/src/lifi.ts`** - LI.FI SDK integration
- **`agent/src/server.ts`** - API endpoints

### API Endpoints

```
GET  /evacuation/quote    → Get LI.FI bridge quote
POST /evacuation/execute  → Execute full evacuation
GET  /evacuation/status   → Check evacuation progress
POST /evacuation/test     → Dry run test
```

### Code Flow

```typescript
// 1. Get bridge quote from LI.FI
const quote = await getLiFiBridgeQuote(amount, walletAddress, {
  slippage: 0.005, // 0.5%
  allowBridges: ["across", "stargate", "hop"]
});

// 2. Execute bridge
const bridgeResult = await executeLiFiBridge(quote, signer);

// 3. Wait for bridge completion
const status = await pollBridgeStatus(txHash, fromChain, toChain);

// 4. Deposit to Aave
const aaveResult = await depositToAave(amount, recipient);
```

## Chain Configuration

| Chain | Purpose | Address |
|-------|---------|---------|
| Unichain Sepolia (1301) | Source - LP removal | - |
| Base (8453) | Destination - Aave deposit | - |
| Aave V3 Pool (Base) | Safe harbor deposit | `0xA238Dd80C259a72e81d7e4664a9801593F98d1c4` |
| USDC (Base) | Deposit token | `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913` |

## Evacuation Status Tracking

```typescript
type EvacuationStep = 
  | "IDLE"
  | "DETECTING_MEV"
  | "REMOVING_LIQUIDITY"
  | "BRIDGING"
  | "WAITING_BRIDGE"
  | "DEPOSITING_AAVE"
  | "COMPLETE"
  | "FAILED";
```

## Example API Response

```json
{
  "success": true,
  "status": {
    "step": "COMPLETE",
    "startTime": 1707307200000,
    "removedLiquidity": {
      "token0Amount": "1.0",
      "token1Amount": "1000.0",
      "txHash": "0x..."
    },
    "bridge": {
      "fromChain": "Unichain Sepolia",
      "toChain": "Base",
      "fromAmount": "1000.0",
      "estimatedOutput": "999.5",
      "bridgeUsed": "across",
      "txHash": "0x...",
      "status": "COMPLETE"
    },
    "aaveDeposit": {
      "amount": "999.5",
      "txHash": "0x..."
    },
    "completedAt": 1707307500000
  },
  "message": "Safe Harbor evacuation complete - assets protected in Aave"
}
```

## Integration with MEV Detection

The evacuation triggers automatically when:
- `SandwichDetectorV2` detects an attack pattern
- Agent deviation exceeds `crossChainThreshold` (25%)
- High volatility + deviation combination detected

```typescript
// In decide.ts
if (deviation > crossChainThreshold || mevRiskScore > 0.8) {
  return {
    action: "SAFE_HARBOR_EVACUATION",
    reason: "MEV risk detected - evacuating to Base + Aave"
  };
}
```

## LI.FI Bridge Selection

LI.FI automatically selects the optimal bridge:

| Bridge | Speed | Cost | Best For |
|--------|-------|------|----------|
| Across | ~2 min | Low | Fast evacuations |
| Stargate | ~5 min | Medium | Large amounts |
| Hop | ~10 min | Low | Stable routes |

## Error Handling

- **Bridge failure**: Retry with alternative route
- **Aave deposit failure**: Hold in wallet, alert user
- **Timeout**: Poll up to 10 minutes, then alert
- **Slippage exceeded**: Abort and return to source chain

## Testing

```bash
# Test evacuation flow (dry run)
curl -X POST http://localhost:3001/evacuation/test

# Get quote
curl "http://localhost:3001/evacuation/quote?amount=1000000000"

# Execute (production)
curl -X POST http://localhost:3001/evacuation/execute \
  -H "Content-Type: application/json" \
  -d '{"slippage": 0.005}'
```

## Security Considerations

1. **Private key handling**: Only agent wallet can execute
2. **Slippage protection**: Default 0.5%, max 3%
3. **Approval management**: Uses existing allowances or requests minimal
4. **Status polling**: Times out after 10 minutes
5. **Error isolation**: Failed bridge doesn't lose funds

---

*LI.FI powers UniFlux's cross-chain MEV protection, enabling automatic asset evacuation to safe yield-generating positions.*
