// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Script, console} from "forge-std/Script.sol";
import {SwapHelper} from "../src/SwapHelper.sol";
import {LiquidityHelper} from "../src/LiquidityHelper.sol";
import {SandwichDetectorStorage} from "../src/SandwichDetectorV2.sol";

contract DeployHelpers is Script {
    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address poolManagerAddress = vm.envAddress("POOL_MANAGER_ADDRESS");
        
        console.log("Deploying helper contracts to Unichain Sepolia...");
        console.log("Using PoolManager:", poolManagerAddress);
        
        vm.startBroadcast(deployerPrivateKey);

        // Deploy SwapHelper
        SwapHelper swapHelper = new SwapHelper(poolManagerAddress);
        console.log("SwapHelper deployed at:", address(swapHelper));

        // Deploy LiquidityHelper
        LiquidityHelper liquidityHelper = new LiquidityHelper(poolManagerAddress);
        console.log("LiquidityHelper deployed at:", address(liquidityHelper));

        // Deploy SandwichDetectorStorage (standalone storage for MEV protection)
        SandwichDetectorStorage sandwichDetector = new SandwichDetectorStorage();
        console.log("SandwichDetectorStorage deployed at:", address(sandwichDetector));

        vm.stopBroadcast();
        
        console.log("");
        console.log("=== DEPLOYED CONTRACTS ===");
        console.log("SwapHelper:", address(swapHelper));
        console.log("LiquidityHelper:", address(liquidityHelper));
        console.log("SandwichDetectorStorage:", address(sandwichDetector));
        console.log("");
        console.log("Update your .env with these addresses!");
    }
}
