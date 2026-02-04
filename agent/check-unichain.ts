import { ethers } from 'ethers';

async function main() {
  const provider = new ethers.JsonRpcProvider('https://sepolia.unichain.org');
  const wallet = '0xed0081BB40b7Bf64D407Ec25a99475d0BB8ed903';
  
  console.log('Checking Unichain Sepolia (Chain ID: 1301)...\n');
  
  const network = await provider.getNetwork();
  console.log('Connected to chain:', network.chainId.toString());
  
  const balance = await provider.getBalance(wallet);
  console.log('Wallet:', wallet);
  console.log('Unichain Sepolia ETH:', ethers.formatEther(balance));
  
  if (balance === 0n) {
    console.log('\n⚠️  You need Unichain Sepolia ETH for gas!');
    console.log('\nOptions:');
    console.log('1. Faucet: https://faucet.unichain.org');
    console.log('2. Bridge: https://superbridge.app/unichain-sepolia');
    console.log('3. Uniswap Bridge: Connect wallet at https://app.uniswap.org and bridge Sepolia ETH');
  } else {
    console.log('\n✅ Ready to deploy contracts on Unichain Sepolia!');
  }
}

main().catch(console.error);
