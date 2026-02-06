# UniFlux Agent

Autonomous Liquidity Maintenance Agent for Uniswap v4 with Cross-Chain capabilities via LI.FI.

## 🎯 Strategy

**Deterministic Multi-Chain Rebalancing Agent**

1. **Observe** → Read token balances in the v4 PoolManager
2. **Decide** → Based on imbalance:
   - `< 10%` → NOOP (pool healthy)
   - `10-25%` → LOCAL SWAP (rebalance via Uniswap v4)
   - `> 25%` → CROSS-CHAIN (evacuate liquidity via LI.FI)
3. **Act** → Execute swap locally or bridge cross-chain

This is a composable, auditable agent with no ML/hype—just reliable finance automation.

## 🏗️ Architecture

```
agent/
├── src/
│   ├── index.ts      # Agent loop entry point
│   ├── observe.ts    # Reads onchain state (real balances)
│   ├── decide.ts     # Pure deterministic logic
│   ├── act.ts        # Calls SwapHelper or LI.FI bridge
│   └── lifi.ts       # LI.FI SDK integration
└── README.md
```

## 🚀 Quick Start

### Prerequisites
- Node.js 18+
- Environment variables in `../.env`

### Install Dependencies
```bash
cd agent
npm install
```

### Run Agent (Single Tick)
```bash
npx ts-node src/index.ts
```

### Run Agent (Continuous Loop)
```bash
# Default 60s interval
npx ts-node src/index.ts --loop

# Custom interval (30 seconds)
npx ts-node src/index.ts --loop --interval=30
```

### Test Cross-Chain Mode
```bash
# Force cross-chain decision (simulation)
FORCE_CROSS_CHAIN=true npx ts-node src/index.ts

# Execute real cross-chain bridge
FORCE_CROSS_CHAIN=true EXECUTE_CROSS_CHAIN=true npx ts-node src/index.ts
```

## 🌐 LI.FI Cross-Chain Integration

The agent uses [LI.FI SDK](https://docs.li.fi/) for cross-chain liquidity evacuation.

### Supported Chains
| Chain | ID | Role |
|-------|-----|------|
| Sepolia | 11155111 | Source (Uniswap v4 pool) |
| Base Sepolia | 84532 | Destination (safe harbor) |

### Cross-Chain Decision Logic
```typescript
if (deviation > 25%) {
  // Severe imbalance - evacuate to safer chain
  action = "CROSS_CHAIN"
  bridge = "LI.FI (best route)"
  destination = "Base Sepolia"
}
```

### Environment Flags
| Flag | Effect |
|------|--------|
| `FORCE_CROSS_CHAIN=true` | Force cross-chain decision regardless of imbalance |
| `EXECUTE_CROSS_CHAIN=true` | Execute real bridge (otherwise simulation only) |

## 📊 Example Output

### Normal Operation (Pool Healthy)
```
🚀 UniFlux Agent - Liquidity Maintenance + Cross-Chain
   Strategy: Rebalance locally (>10%) or evacuate cross-chain (>25%)
   Networks: Sepolia ↔ Base Sepolia via LI.FI

════════════════════════════════════════════════════════════
🤖 UniFlux Agent Tick
════════════════════════════════════════════════════════════

📡 OBSERVE PHASE
  mETH: 1.1
  mUSDC: 0.9

🧠 DECIDE PHASE
  📊 Imbalance ratio: 55.00% mETH
  📊 Deviation from target: 5.00%
  Action: NOOP
  Reason: Pool healthy (deviation 5.00% < threshold 10%)

⚡ ACT PHASE
  ⏸️  No action taken

📋 RESULT
  ✅ No action needed
```

### Cross-Chain Evacuation (LI.FI)
```
🧠 DECIDE PHASE
  📊 Imbalance ratio: 54.74% mETH
  📊 Deviation from target: 4.74%
  Action: CROSS_CHAIN
  Reason: FORCED: Cross-chain evacuation triggered
  🌐 Cross-chain evacuation triggered!

⚡ ACT PHASE
  🌉 Cross-chain evacuation: 0.275 tokens
     From: Sepolia (11155111)
     To: Base Sepolia (84532)

  🧪 SIMULATED LI.FI BRIDGE (Dry Run)
  ───────────────────────────────────────
  ℹ️  Using mainnet chains for LI.FI quote (testnets unsupported)
     Simulating: Arbitrum (42161) → Base (8453)
  🔍 Fetching LI.FI routes...
  ✅ Route found via eco
     Estimated output: 0.264308 USDC
     Gas cost: $0.0201

  ✅ LI.FI integration verified!
  ℹ️  In production, this would execute on real chains

📋 RESULT
  🧪 Simulation complete (set EXECUTE_CROSS_CHAIN=true for real tx)
```

> **Note**: LI.FI SDK doesn't support Sepolia testnet, so the agent maps to mainnet chains (Arbitrum → Base) for quote demonstration. In production, this works natively on mainnets.

## 🔧 Configuration

Environment variables (in `../.env`):

| Variable | Description |
|----------|-------------|
| `SEPOLIA_RPC_URL` | Sepolia RPC endpoint |
| `PRIVATE_KEY` | Agent wallet private key |
| `POOL_MANAGER_ADDRESS` | Deployed PoolManager |
| `TOKEN_A_ADDRESS` | First token address |
| `TOKEN_B_ADDRESS` | Second token address |
| `SWAP_HELPER_ADDRESS` | Deployed SwapHelper |
| `FORCE_CROSS_CHAIN` | Force cross-chain mode |
| `EXECUTE_CROSS_CHAIN` | Execute real bridge tx |

## 🧪 Decision Logic

The agent uses pure, deterministic logic:

```typescript
// Thresholds
IMBALANCE_THRESHOLD = 0.10      // 10% → local swap
CROSS_CHAIN_THRESHOLD = 0.25    // 25% → bridge to Base
REBALANCE_TARGET = 0.5          // 50/50 target ratio
MIN_SWAP_AMOUNT = 0.01 ETH      // Minimum action size

// Decision Tree
if (deviation > 25%) → CROSS_CHAIN (LI.FI bridge)
else if (deviation > 10%) → LOCAL SWAP (v4 swap)
else → NOOP (pool healthy)
```

## 🔗 Deployed Contracts (Sepolia)

| Contract | Address |
|----------|---------|
| PoolManager | `0xD49236Bb296e8935dC302De0cccFDf5EC5413157` |
| SwapHelper | `0xB1e1c081D5FB009D8f908b220D902E9F98dfbFE7` |
| LiquidityHelper | `0x94C7f21225EA17916DD99437869Ac5E90F3CDBf5` |

## ✅ Why This Design

- **Real onchain state** - No mocked data
- **Deterministic logic** - Reproducible, auditable
- **Composable** - Uses proven v4 contracts + LI.FI SDK
- **Multi-chain** - Sepolia ↔ Base Sepolia via LI.FI
- **Expandable** - Ready for hooks, more chains, etc.

## 🏆 Hackathon Tracks

This agent qualifies for:

| Track | Status |
|-------|--------|
| 🥇 Uniswap v4 Agentic Finance | ✅ Core agent + v4 interaction |
| 🥈 AI x LI.FI Smart App | ✅ Cross-chain via LI.FI |
| 🥉 Best LI.FI-Powered DeFi | ✅ Liquidity evacuation |

### On-Chain Proof (Unichain Sepolia)

| Action | Transaction |
|--------|-------------|
| Add Liquidity | [`0xb4f93ca0...`](https://sepolia.uniscan.xyz/tx/0xb4f93ca003f358c391bc1e303c362dd075027b6d903d2f9cebb4165dddabe5ea) |
| Swap Tokens | [`0x8efb8b22...`](https://sepolia.uniscan.xyz/tx/0x8efb8b22ecc09943a976f8101ceb1e6c8ea70b873877dc73ac0c45bd0a6b8296) |

## 📜 License

MIT
