import { ethers } from 'ethers';

const provider = new ethers.JsonRpcProvider('https://eth-sepolia.g.alchemy.com/v2/vH_VnmrfwHUdyUNU_XUsX');
const ERC20_ABI = ['function balanceOf(address) view returns (uint256)'];

async function main() {
  const mETH = new ethers.Contract('0x586c3d4bee371Df96063F045Aee49081Bc2e7cf7', ERC20_ABI, provider);
  const mUSDC = new ethers.Contract('0xB5b2E077521E43647cc75BF10e5285F036C22DBb', ERC20_ABI, provider);
  
  const agentWallet = '0xed0081BB40b7Bf64D407Ec25a99475d0BB8ed903';
  const metaMask = '0x19d47570BA52E058bD6432009b2705F799b851Dc';
  
  console.log('=== Agent Wallet:', agentWallet, '===');
  console.log('mETH:', ethers.formatEther(await mETH.balanceOf(agentWallet)));
  console.log('mUSDC:', ethers.formatEther(await mUSDC.balanceOf(agentWallet)));
  
  console.log('\n=== MetaMask Wallet:', metaMask, '===');
  console.log('mETH:', ethers.formatEther(await mETH.balanceOf(metaMask)));
  console.log('mUSDC:', ethers.formatEther(await mUSDC.balanceOf(metaMask)));
}

main().catch(console.error);
