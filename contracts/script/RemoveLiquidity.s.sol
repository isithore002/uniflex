// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Script, console2} from "forge-std/Script.sol";
import {IPoolManager} from "v4-core/interfaces/IPoolManager.sol";
import {PoolKey} from "v4-core/types/PoolKey.sol";
import {Currency, CurrencyLibrary} from "v4-core/types/Currency.sol";
import {BalanceDelta} from "v4-core/types/BalanceDelta.sol";
import {IUnlockCallback} from "v4-core/interfaces/callback/IUnlockCallback.sol";
import {IHooks} from "v4-core/interfaces/IHooks.sol";

/// @title RemoveLiquidity
/// @notice Forge script to remove liquidity from Uniswap v4 pool
/// @dev Demonstrates agent risk management - shrinking exposure during volatility
contract RemoveLiquidity is Script, IUnlockCallback {
    using CurrencyLibrary for Currency;

    IPoolManager public manager;
    PoolKey public poolKey;
    address public owner;

    // Agent-determined parameters (deterministic, not user-controlled)
    int24 constant TICK_LOWER = -600;
    int24 constant TICK_UPPER = 600;
    int256 constant LIQUIDITY_TO_REMOVE = -500000000000000000; // -0.5 ether in liquidity units

    function run() external {
        uint256 pk = vm.envUint("PRIVATE_KEY");
        owner = vm.addr(pk);
        vm.startBroadcast(pk);

        manager = IPoolManager(vm.envAddress("POOL_MANAGER_ADDRESS"));

        address tokenA = vm.envAddress("TOKEN_A_ADDRESS");
        address tokenB = vm.envAddress("TOKEN_B_ADDRESS");

        // Sort tokens for pool key
        (address currency0, address currency1) = tokenA < tokenB 
            ? (tokenA, tokenB) 
            : (tokenB, tokenA);

        poolKey = PoolKey({
            currency0: Currency.wrap(currency0),
            currency1: Currency.wrap(currency1),
            fee: 3000,
            tickSpacing: 60,
            hooks: IHooks(address(0))
        });

        console2.log("=== RemoveLiquidity (Agent Risk Management) ===");
        console2.log("Pool Manager:", address(manager));
        console2.log("Token0:", currency0);
        console2.log("Token1:", currency1);
        console2.log("Tick range:", TICK_LOWER);
        console2.log("         to:", TICK_UPPER);

        // Trigger unlock callback
        manager.unlock("");

        vm.stopBroadcast();
    }

    function unlockCallback(bytes calldata) external override returns (bytes memory) {
        require(msg.sender == address(manager), "unauthorized");

        IPoolManager.ModifyLiquidityParams memory params = IPoolManager.ModifyLiquidityParams({
            tickLower: TICK_LOWER,
            tickUpper: TICK_UPPER,
            liquidityDelta: LIQUIDITY_TO_REMOVE, // Negative = remove
            salt: bytes32(0)
        });

        (BalanceDelta delta,) = manager.modifyLiquidity(poolKey, params, "");

        console2.log("Delta computed - settling...");

        // When removing liquidity, we RECEIVE tokens (positive delta = take)
        // delta.amount0() > 0 means we are owed tokens
        if (delta.amount0() > 0) {
            manager.take(poolKey.currency0, owner, uint256(int256(delta.amount0())));
            console2.log("Took token0:", uint256(int256(delta.amount0())));
        }

        if (delta.amount1() > 0) {
            manager.take(poolKey.currency1, owner, uint256(int256(delta.amount1())));
            console2.log("Took token1:", uint256(int256(delta.amount1())));
        }

        // If we somehow owe tokens (shouldn't happen on remove), settle them
        if (delta.amount0() < 0) {
            manager.sync(poolKey.currency0);
            manager.settle();
        }

        if (delta.amount1() < 0) {
            manager.sync(poolKey.currency1);
            manager.settle();
        }

        console2.log("=== Liquidity removed via agent (risk mitigation) ===");

        return "";
    }
}
