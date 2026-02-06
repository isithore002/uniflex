// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Script} from "forge-std/Script.sol";
import {console2} from "forge-std/console2.sol";
import {IPoolManager} from "v4-core/interfaces/IPoolManager.sol";
import {PoolKey} from "v4-core/types/PoolKey.sol";
import {Currency} from "v4-core/types/Currency.sol";
import {IHooks} from "v4-core/interfaces/IHooks.sol";
import {PoolId, PoolIdLibrary} from "v4-core/types/PoolId.sol";
import {TickMath} from "v4-core/libraries/TickMath.sol";
import {IERC20} from "forge-std/interfaces/IERC20.sol";

/// @title InitPoolWithHook
/// @notice Initialize a new Uniswap v4 pool with UniFluxHook attached
contract InitPoolWithHook is Script {
    using PoolIdLibrary for PoolKey;

    // Unichain Sepolia addresses
    address constant POOL_MANAGER = 0x00B036B58a818B1BC34d502D3fE730Db729e62AC;
    address constant METH = 0xD49236Bb296e8935dC302De0cccFDf5EC5413157;
    address constant MUSDC = 0x586c3d4bee371Df96063F045Aee49081Bc2e7cf7;

    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");

        // Read hook address from deployment file
        string memory json = vm.readFile("./broadcast/hook-deployment.json");
        address hookAddress = vm.parseJsonAddress(json, ".hook");

        console2.log("Hook address:", hookAddress);
        console2.log("PoolManager:", POOL_MANAGER);
        console2.log("mETH:", METH);
        console2.log("mUSDC:", MUSDC);

        vm.startBroadcast(deployerPrivateKey);

        // Sort tokens (v4 requires currency0 < currency1)
        (Currency currency0, Currency currency1) = METH < MUSDC
            ? (Currency.wrap(METH), Currency.wrap(MUSDC))
            : (Currency.wrap(MUSDC), Currency.wrap(METH));

        console2.log("\n=== Pool Configuration ===");
        console2.log("Currency0:", Currency.unwrap(currency0));
        console2.log("Currency1:", Currency.unwrap(currency1));

        // Create pool key
        PoolKey memory key = PoolKey({
            currency0: currency0,
            currency1: currency1,
            fee: 3000, // 0.3% fee
            tickSpacing: 60,
            hooks: IHooks(hookAddress)
        });

        // Initial price: 1 mETH = 2000 mUSDC (same as previous pool)
        uint160 sqrtPriceX96 = 112045541949572279837463876454; // sqrt(2000) * 2^96

        console2.log("\n=== Initializing Pool ===");
        console2.log("Fee:", key.fee);
        console2.log("Tick spacing:", key.tickSpacing);
        console2.log("Initial sqrtPriceX96:", sqrtPriceX96);

        // Initialize pool
        IPoolManager(POOL_MANAGER).initialize(key, sqrtPriceX96, "");

        PoolId poolId = key.toId();
        console2.log("\n=== Pool Initialized ===");
        console2.log("Pool ID:", vm.toString(PoolId.unwrap(poolId)));
        console2.log("Hook attached:", hookAddress);

        console2.log("\n=== Next Steps ===");
        console2.log("1. Add liquidity to this pool");
        console2.log("2. Execute swaps to trigger hook");
        console2.log("3. Monitor SwapRecorded events");

        vm.stopBroadcast();

        // Save pool info
        _writePoolInfo(PoolId.unwrap(poolId), hookAddress);
    }

    function _writePoolInfo(bytes32 poolIdBytes, address hookAddr) internal {
        string memory json = string(abi.encodePacked(
            '{\n',
            '  "poolId": "', vm.toString(poolIdBytes), '",\n',
            '  "hook": "', vm.toString(hookAddr), '",\n',
            '  "poolManager": "', vm.toString(POOL_MANAGER), '",\n',
            '  "currency0": "', METH < MUSDC ? vm.toString(METH) : vm.toString(MUSDC), '",\n',
            '  "currency1": "', METH < MUSDC ? vm.toString(MUSDC) : vm.toString(METH), '",\n',
            '  "fee": 3000,\n',
            '  "tickSpacing": 60,\n',
            '  "timestamp": ', vm.toString(block.timestamp), '\n',
            '}'
        ));

        vm.writeFile("./broadcast/pool-with-hook.json", json);
        console2.log("\n=== Pool info saved to ./broadcast/pool-with-hook.json ===");
    }
}
