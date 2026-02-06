# ENS Domain Verification

## UniFlux ENS Domain

**Domain**: `uniflux.eth`  
**Owner**: `0xed0081BB40b7Bf64D407Ec25a99475d0BB8ed903`  
**Network**: Ethereum Mainnet  
**Status**: ✅ Verified

---

## Verification

### Option 1: ENS App
Visit [app.ens.domains/uniflux.eth](https://app.ens.domains/uniflux.eth) to see:
- Owner address
- Resolver configuration
- ETH address record

### Option 2: Etherscan
Visit [etherscan.io/enslookup-search?search=uniflux.eth](https://etherscan.io/enslookup-search?search=uniflux.eth)

### Option 3: Command Line
```bash
# Using cast (Foundry)
cast lookup-address 0xed0081BB40b7Bf64D407Ec25a99475d0BB8ed903 --rpc-url https://eth.llamarpc.com

# Using ethers (Node.js)
node -e "const ethers = require('ethers'); const provider = new ethers.providers.JsonRpcProvider('https://eth.llamarpc.com'); provider.lookupAddress('0xed0081BB40b7Bf64D407Ec25a99475d0BB8ed903').then(console.log)"
```

### Option 4: Resolve in Code
```typescript
import { createPublicClient, http } from 'viem';
import { mainnet } from 'viem/chains';

const client = createPublicClient({
  chain: mainnet,
  transport: http('https://eth.llamarpc.com')
});

// Forward resolution (name → address)
const address = await client.getEnsAddress({ name: 'uniflux.eth' });
console.log(address); // 0xed0081BB40b7Bf64D407Ec25a99475d0BB8ed903

// Reverse resolution (address → name)
const name = await client.getEnsName({ 
  address: '0xed0081BB40b7Bf64D407Ec25a99475d0BB8ed903' 
});
console.log(name); // uniflux.eth
```

---

## Why ENS Matters for Hackathon

### Professional Identity
✅ **Brand Recognition**: `uniflux.eth` is easier to remember than `0xed0081...`  
✅ **Legitimacy**: ENS ownership shows commitment to Web3 ecosystem  
✅ **Trust Signal**: Verified on-chain identity

### Technical Integration
✅ **Decentralized DNS**: No centralized authority required  
✅ **Human-Readable**: Users can send to `uniflux.eth` instead of hex address  
✅ **Cross-Platform**: Works across all Web3 applications

### Judge Perception
✅ **Attention to Detail**: Shows thoroughness beyond code  
✅ **Long-Term Vision**: ENS domains indicate production intent  
✅ **Web3 Native**: Demonstrates ecosystem understanding

---

## Usage in UniFlux

### Main Wallet
The `uniflux.eth` domain points to our **primary deployment wallet**:
- Deployed all smart contracts
- Funded liquidity pools
- Acted as "victim" in MEV sandwich simulation
- All on-chain activity verifiable at: https://sepolia.uniscan.xyz/address/0xed0081BB40b7Bf64D407Ec25a99475d0BB8ed903

### Documentation References
All project documentation now references:
- `uniflux.eth` → `0xed0081BB40b7Bf64D407Ec25a99475d0BB8ed903`
- Easy to verify ownership on Ethereum mainnet
- Clear identity for hackathon judges

---

## ENS Records (Recommended Setup)

### Current
- ✅ ETH Address: `0xed0081BB40b7Bf64D407Ec25a99475d0BB8ed903`

### Future Enhancements
```
Text Records (Optional):
  - url: https://uniflux.app
  - email: team@uniflux.eth
  - description: MEV-Protected Liquidity Management for Uniswap v4
  - com.github: yourusername/uniflux
  - com.twitter: @uniflux
```

### Multi-Chain Addresses (Optional)
```
Address Records:
  - ETH: 0xed0081BB40b7Bf64D407Ec25a99475d0BB8ed903
  - BASE: [same address if needed]
  - OP: [same address if needed]
```

---

## Verification for Judges

To verify UniFlux owns `uniflux.eth`:

1. **Visit ENS App**: https://app.ens.domains/uniflux.eth
2. **Check Owner**: Confirm owner is `0xed0081BB40b7Bf64D407Ec25a99475d0BB8ed903`
3. **Check Resolver**: Confirm ETH address resolves correctly
4. **Cross-Reference**: Compare with our on-chain transactions on Unichain Sepolia

**All transactions** from `0xed0081BB40b7Bf64D407Ec25a99475d0BB8ed903` on Unichain Sepolia:
- Pool initialization
- Liquidity additions
- Test swaps
- Victim swap in MEV sandwich

This establishes a **verifiable chain of custody** from:
- Ethereum mainnet ENS domain
- To Unichain Sepolia deployments
- To MEV sandwich simulation

---

## Brand Identity

### Logo/Avatar
Consider setting an ENS avatar:
```
Text Record: avatar
Value: https://yourcdn.com/uniflux-logo.png
```

Or use NFT avatar:
```
Text Record: avatar
Value: eip155:1/erc721:0x[contract]/[tokenId]
```

### Social Links
```
com.twitter: @uniflux
com.github: yourusername/uniflux
com.discord: uniflux
```

---

## Marketing Value

### For Hackathon Presentation
"UniFlux (`uniflux.eth`) is an autonomous MEV-protecting agent for Uniswap v4..."

### For Demo
"Send funds to `uniflux.eth` instead of copying long addresses..."

### For Branding
"Visit uniflux.eth in any Web3 wallet to interact with our protocol..."

---

**ENS Domain**: `uniflux.eth` ✅ Verified  
**Owner**: `0xed0081BB40b7Bf64D407Ec25a99475d0BB8ed903` ✅ Confirmed  
**Status**: Active on Ethereum Mainnet ✅
