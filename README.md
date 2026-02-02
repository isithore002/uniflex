# UniFlux Monorepo

This repository hosts the UniFlux hackathon scaffold with two workspaces:

- `contracts/` — Foundry project for Uniswap v4 pool setup and mock tokens.
- `agent/` — TypeScript agent loop integrating ethers and LI.FI.

## Environment Setup

1. Copy `.env.example` to `.env` and fill in RPC endpoints and private key:
   ```bash
   cp .env.example .env
   ```
2. Install dependencies and build each workspace as needed.

## 📦 Deployed Contracts (Sepolia)

| Contract     | Address                                      |
|--------------|----------------------------------------------|
| PoolManager  | 0xD49236Bb296e8935dC302De0cccFDf5EC5413157   |
| Mock Token A | 0x586c3d4bee371Df96063F045Aee49081Bc2e7cf7   |
| Mock Token B | 0xB5b2E077521E43647cc75BF10e5285F036C22DBb   |
| LiquidityHelper | 0x94C7f21225EA17916DD99437869Ac5E90F3CDBf5 |
| SwapHelper   | 0xB1e1c081D5FB009D8f908b220D902E9F98dfbFE7   |

Network: Ethereum Sepolia (Chain ID 11155111)

## 🔗 Onchain Proof (Sepolia)

### Pool Initialization
- **Tx Hash:** `0xc5ad4ee5af3eef9f573f2fccd98787d29529070b05a98878d159080c1ae902b7`
- **Block:** 10161484

### Liquidity Added
- **LiquidityHelper Deployment:** `0x0a9eece9d3f1ae7131528e5a53df4d1ac617226f3757929c70ed54969e7c7859`
- **Token Approvals:** `0x710d26e26d5b1faa338c658d9477a2129c050a7e2d0cec186084f599a9b5d6f5`
- **AddLiquidity Tx:** `0xbdd4a60a2fc31630ab6a23b8c017aec962a3a1cb546af16f2cc2a603a4dbe8d0`
- **Block:** 10161484

### Swap Executed
- **SwapHelper Deployment:** `0xa1f0661e5e4f3f0cacf7894eaf54b136db661f4e61e0db272db34bf834cb3626`
- **Swap Tx:** `0xf4a10e8b86f737dff12c354ab1d4dc02f5b16a1fc41c15267dd9ece0cb80158f`
- **Block:** 10161488

**Explorer Links:**
- [AddLiquidity Tx](https://sepolia.etherscan.io/tx/0xbdd4a60a2fc31630ab6a23b8c017aec962a3a1cb546af16f2cc2a603a4dbe8d0)
- [Swap Tx](https://sepolia.etherscan.io/tx/0xf4a10e8b86f737dff12c354ab1d4dc02f5b16a1fc41c15267dd9ece0cb80158f)
