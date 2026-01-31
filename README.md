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

Network: Ethereum Sepolia (Chain ID 11155111)
