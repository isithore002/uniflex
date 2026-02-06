// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Script} from "forge-std/Script.sol";
import {console2} from "forge-std/console2.sol";
import {UniFluxHook} from "../src/UniFluxHook.sol";
import {SandwichDetectorV2} from "../src/SandwichDetectorV2.sol";
import {IPoolManager} from "v4-core/interfaces/IPoolManager.sol";
import {Hooks} from "v4-core/libraries/Hooks.sol";

/// @title DeployUniFluxHook
/// @notice Deploy UniFlux v4 hook + SandwichDetector integration on Unichain Sepolia
contract DeployUniFluxHook is Script {
    // Unichain Sepolia addresses
    address constant POOL_MANAGER = 0x00B036B58a818B1BC34d502D3fE730Db729e62AC;
    
    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerPrivateKey);

        console2.log("Deployer:", deployer);
        console2.log("PoolManager:", POOL_MANAGER);

        vm.startBroadcast(deployerPrivateKey);

        // Step 1: Deploy UniFluxHook with placeholder detector
        console2.log("\n=== Deploying UniFluxHook ===");
        UniFluxHook hook = new UniFluxHook{salt: bytes32(uint256(0x1))}(
            IPoolManager(POOL_MANAGER),
            address(0) // Placeholder, will deploy detector next
        );
        console2.log("UniFluxHook deployed at:", address(hook));

        // Step 2: Deploy SandwichDetectorV2 with hook address
        console2.log("\n=== Deploying SandwichDetectorV2 ===");
        SandwichDetectorV2 detector = new SandwichDetectorV2(address(hook));
        console2.log("SandwichDetectorV2 deployed at:", address(detector));

        // Step 3: Verify hook permissions
        Hooks.Permissions memory permissions = hook.getHookPermissions();
        console2.log("\n=== Hook Permissions ===");
        console2.log("beforeSwap:", permissions.beforeSwap);
        console2.log("afterSwap:", permissions.afterSwap);

        // Step 4: Display hook address for pool creation
        console2.log("\n=== Next Steps ===");
        console2.log("1. Create new pool with hook address:", address(hook));
        console2.log("2. Hook will call detector at:", address(detector));
        console2.log("3. Detector will emit SwapRecorded events for agent");
        
        console2.log("\n=== Hook Address Validation ===");
        console2.log("Hook address must have correct flags in binary representation");
        console2.log("Binary (last 14 bits):", _toBinaryString(uint160(address(hook)), 14));
        console2.log("afterSwap flag (bit 7) should be 1");

        vm.stopBroadcast();

        // Save addresses to file for agent
        _writeDeploymentInfo(address(hook), address(detector));
    }

    function _toBinaryString(uint160 value, uint256 bits) internal pure returns (string memory) {
        bytes memory buffer = new bytes(bits);
        for (uint256 i = 0; i < bits; i++) {
            buffer[bits - 1 - i] = ((value >> i) & 1) == 1 ? bytes1("1") : bytes1("0");
        }
        return string(buffer);
    }

    function _writeDeploymentInfo(address hookAddr, address detectorAddr) internal {
        string memory json = string(abi.encodePacked(
            '{\n',
            '  "hook": "', vm.toString(hookAddr), '",\n',
            '  "detector": "', vm.toString(detectorAddr), '",\n',
            '  "poolManager": "', vm.toString(POOL_MANAGER), '",\n',
            '  "network": "unichain-sepolia",\n',
            '  "chainId": 1301,\n',
            '  "timestamp": ', vm.toString(block.timestamp), '\n',
            '}'
        ));

        vm.writeFile("./broadcast/hook-deployment.json", json);
        console2.log("\n=== Deployment info saved to ./broadcast/hook-deployment.json ===");
    }
}
