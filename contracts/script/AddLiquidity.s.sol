// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Script, console} from "forge-std/Script.sol";
import {PoolKey} from "v4-core/types/PoolKey.sol";
import {Currency, CurrencyLibrary} from "v4-core/types/Currency.sol";
import {IHooks} from "v4-core/interfaces/IHooks.sol";
import {IERC20} from "openzeppelin-contracts/contracts/token/ERC20/IERC20.sol";
import {LiquidityHelper} from "../src/LiquidityHelper.sol";

contract AddLiquidity is Script {
    using CurrencyLibrary for Currency;

    int24 constant TICK_SPACING = 60;
    uint24 constant LP_FEE = 3000;

    function run() external {
        uint256 key = vm.envUint("PRIVATE_KEY");
        vm.startBroadcast(key);

        address managerAddr = vm.envAddress("POOL_MANAGER_ADDRESS");
        address tokenA = vm.envAddress("TOKEN_A_ADDRESS");
        address tokenB = vm.envAddress("TOKEN_B_ADDRESS");

        // Sort tokens
        (address token0, address token1) = tokenA < tokenB
            ? (tokenA, tokenB)
            : (tokenB, tokenA);

        // Deploy the LiquidityHelper
        LiquidityHelper helper = new LiquidityHelper(managerAddr);
        console.log("LiquidityHelper deployed at:", address(helper));

        PoolKey memory poolKey = PoolKey({
            currency0: Currency.wrap(token0),
            currency1: Currency.wrap(token1),
            fee: LP_FEE,
            tickSpacing: TICK_SPACING,
            hooks: IHooks(address(0))
        });

        // Approve helper to spend our tokens
        IERC20(token0).approve(address(helper), type(uint256).max);
        IERC20(token1).approve(address(helper), type(uint256).max);

        // Add liquidity via the helper
        helper.addLiquidity(
            poolKey,
            -887220,  // tickLower (full range)
            887220,   // tickUpper (full range)
            int256(1e18)  // liquidityDelta
        );

        console.log("Liquidity added successfully!");

        vm.stopBroadcast();
    }
}
