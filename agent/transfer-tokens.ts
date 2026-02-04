// Transfer mETH and mUSDC tokens to your wallet
import { ethers } from 'ethers';
import dotenv from 'dotenv';

dotenv.config({ path: '../.env' });

const ERC20_ABI = [
  'function transfer(address to, uint256 amount) returns (bool)',
  'function balanceOf(address account) view returns (uint256)',
  'function decimals() view returns (uint8)',
  'function symbol() view returns (string)'
];

async function main() {
  const rpcUrl = process.env.SEPOLIA_RPC_URL || 'https://eth-sepolia.g.alchemy.com/v2/vH_VnmrfwHUdyUNU_XUsX';
  const privateKey = process.env.PRIVATE_KEY;
  
  if (!privateKey) {
    console.error('PRIVATE_KEY not found in .env');
    process.exit(1);
  }

  const provider = new ethers.JsonRpcProvider(rpcUrl);
  const wallet = new ethers.Wallet(privateKey, provider);
  
  console.log('Deployer wallet (has tokens):', wallet.address);
  
  // Token addresses
  const mETH = '0x586c3d4bee371Df96063F045Aee49081Bc2e7cf7';
  const mUSDC = '0xB5b2E077521E43647cc75BF10e5285F036C22DBb';
  
  // Target wallet - the agent wallet itself (to replenish)
  const targetWallet = '0xed0081BB40b7Bf64D407Ec25a99475d0BB8ed903';
  
  const mETHContract = new ethers.Contract(mETH, ERC20_ABI, wallet);
  const mUSDCContract = new ethers.Contract(mUSDC, ERC20_ABI, wallet);
  
  // Check current balances
  const deployerMETH = await mETHContract.balanceOf(wallet.address);
  const deployerMUSDC = await mUSDCContract.balanceOf(wallet.address);
  
  console.log('\n=== Current Balances (Deployer) ===');
  console.log('mETH:', ethers.formatEther(deployerMETH));
  console.log('mUSDC:', ethers.formatEther(deployerMUSDC));
  
  // Transfer amounts
  const mETHAmount = ethers.parseEther('10000'); // 10,000 mETH
  const mUSDCAmount = ethers.parseEther('100000'); // 100,000 mUSDC
  
  console.log('\n=== Transferring tokens to:', targetWallet, '===');
  
  // Transfer mETH
  console.log('Transferring 10,000 mETH...');
  const tx1 = await mETHContract.transfer(targetWallet, mETHAmount);
  console.log('TX Hash:', tx1.hash);
  await tx1.wait();
  console.log('mETH transfer confirmed!');
  
  // Transfer mUSDC
  console.log('Transferring 100,000 mUSDC...');
  const tx2 = await mUSDCContract.transfer(targetWallet, mUSDCAmount);
  console.log('TX Hash:', tx2.hash);
  await tx2.wait();
  console.log('mUSDC transfer confirmed!');
  
  // Check new balances
  const targetMETH = await mETHContract.balanceOf(targetWallet);
  const targetMUSDC = await mUSDCContract.balanceOf(targetWallet);
  
  console.log('\n=== New Balances (Target Wallet) ===');
  console.log('mETH:', ethers.formatEther(targetMETH));
  console.log('mUSDC:', ethers.formatEther(targetMUSDC));
  
  console.log('\n✅ Transfer complete! Import these tokens in MetaMask:');
  console.log('mETH:', mETH);
  console.log('mUSDC:', mUSDC);
}

main().catch(console.error);
