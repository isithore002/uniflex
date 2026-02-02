// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Script, console} from "forge-std/Script.sol";
import {PoolKey} from "v4-core/types/PoolKey.sol";
import {Currency, CurrencyLibrary} from "v4-core/types/Currency.sol";
import {IHooks} from "v4-core/interfaces/IHooks.sol";
import {IERC20} from "openzeppelin-contracts/contracts/token/ERC20/IERC20.sol";
import {SwapHelper} from "../src/SwapHelper.sol";

contract SwapTokens is Script {
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

        // Deploy the SwapHelper
        SwapHelper helper = new SwapHelper(managerAddr);
        console.log("SwapHelper deployed at:", address(helper));

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

        // Swap 0.1 token0 for token1 (exactIn)
        // For zeroForOne, use MIN_SQRT_PRICE + 1 as lower bound
        // MIN_SQRT_PRICE = 4295128739, so we use 4295128740
        helper.swap(
            poolKey,
            true,       // zeroForOne (token0 -> token1)
            -int256(1e17),  // amountSpecified (negative = exactIn, 0.1 tokens)
            4295128740      // sqrtPriceLimitX96 (MIN_SQRT_PRICE + 1)
        );

        console.log("Swap executed successfully!");

        vm.stopBroadcast();
    }
}
