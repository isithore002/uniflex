// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import "forge-std/Script.sol";

interface IMockToken {
    function transfer(address to, uint256 amount) external returns (bool);
    function balanceOf(address account) external view returns (uint256);
}

contract MintTokens is Script {
    function run() external {
        // Token addresses from .env
        address mETH = 0x586c3d4bee371Df96063F045Aee49081Bc2e7cf7;
        address mUSDC = 0xB5b2E077521E43647cc75BF10e5285F036C22DBb;
        
        // Your MetaMask wallet address
        address targetWallet = 0x19d47570BA52E058bD6432009b2705F799b851Dc;
        
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerPrivateKey);
        
        console.log("Deployer (has tokens):", deployer);
        console.log("Target wallet:", targetWallet);
        console.log("Current mETH balance of deployer:", IMockToken(mETH).balanceOf(deployer));
        console.log("Current mUSDC balance of deployer:", IMockToken(mUSDC).balanceOf(deployer));
        
        vm.startBroadcast(deployerPrivateKey);
        
        // Transfer 10,000 mETH (18 decimals)
        IMockToken(mETH).transfer(targetWallet, 10_000 * 10**18);
        
        // Transfer 100,000 mUSDC (18 decimals - MockToken uses 18)
        IMockToken(mUSDC).transfer(targetWallet, 100_000 * 10**18);
        
        vm.stopBroadcast();
        
        console.log("=== After Transfer ===");
        console.log("mETH balance of target:", IMockToken(mETH).balanceOf(targetWallet));
        console.log("mUSDC balance of target:", IMockToken(mUSDC).balanceOf(targetWallet));
    }
}
