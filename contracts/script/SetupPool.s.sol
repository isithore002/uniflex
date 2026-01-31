// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Script, console} from "forge-std/Script.sol";
import {PoolManager} from "v4-core/PoolManager.sol";
import {IPoolManager} from "v4-core/interfaces/IPoolManager.sol";
import {PoolKey} from "v4-core/types/PoolKey.sol";
import {Currency, CurrencyLibrary} from "v4-core/types/Currency.sol";
import {IHooks} from "v4-core/interfaces/IHooks.sol";
import {MockToken} from "../src/MockToken.sol";

contract SetupPool is Script {
    using CurrencyLibrary for Currency;

    int24 constant TICK_SPACING = 60;
    uint24 constant LP_FEE = 3000;

    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        vm.startBroadcast(deployerPrivateKey);

        PoolManager manager = new PoolManager(address(0));
        console.log("PoolManager deployed at:", address(manager));

        MockToken tokenA = new MockToken("Mock ETH", "mETH");
        MockToken tokenB = new MockToken("Mock USDC", "mUSDC");

        (address token0Addr, address token1Addr) = address(tokenA) < address(tokenB)
            ? (address(tokenA), address(tokenB))
            : (address(tokenB), address(tokenA));

        console.log("Token0:", token0Addr);
        console.log("Token1:", token1Addr);

        PoolKey memory poolKey = PoolKey({
            currency0: Currency.wrap(token0Addr),
            currency1: Currency.wrap(token1Addr),
            fee: LP_FEE,
            tickSpacing: TICK_SPACING,
            hooks: IHooks(address(0))
        });

        uint160 startPrice = 79228162514264337593543950336;
        manager.initialize(poolKey, startPrice);
        console.log("Pool Initialized!");

        vm.stopBroadcast();
    }
}
