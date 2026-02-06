// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Script, console} from "forge-std/Script.sol";
import {PoolKey} from "v4-core/types/PoolKey.sol";
import {Currency, CurrencyLibrary} from "v4-core/types/Currency.sol";
import {IHooks} from "v4-core/interfaces/IHooks.sol";
import {IERC20} from "openzeppelin-contracts/contracts/token/ERC20/IERC20.sol";
import {SwapHelper} from "../src/SwapHelper.sol";

/// @title SandwichSimulation
/// @notice Simulates the canonical MEV sandwich attack pattern for demonstration
/// @dev This executes the three-transaction sandwich: frontrun → victim → backrun
contract SandwichSimulation is Script {
    using CurrencyLibrary for Currency;

    int24 constant TICK_SPACING = 60;
    uint24 constant LP_FEE = 3000;

    /// @notice Step 1: Attacker frontrun swap (pushes price up)
    function frontrun() external {
        uint256 attackerKey = vm.envUint("ATTACKER_PRIVATE_KEY");
        vm.startBroadcast(attackerKey);

        address managerAddr = vm.envAddress("POOL_MANAGER_ADDRESS");
        address tokenA = vm.envAddress("TOKEN_A_ADDRESS");
        address tokenB = vm.envAddress("TOKEN_B_ADDRESS");

        (address token0, address token1) = tokenA < tokenB ? (tokenA, tokenB) : (tokenB, tokenA);

        SwapHelper helper = new SwapHelper(managerAddr);
        console.log("[FRONTRUN] SwapHelper deployed at:", address(helper));

        PoolKey memory poolKey = PoolKey({
            currency0: Currency.wrap(token0),
            currency1: Currency.wrap(token1),
            fee: LP_FEE,
            tickSpacing: TICK_SPACING,
            hooks: IHooks(address(0))
        });

        IERC20(token0).approve(address(helper), type(uint256).max);

        // Large swap: 0.5 token0 → token1 (pushes price)
        helper.swap(poolKey, true, -int256(5e17), 4295128740);

        console.log("[FRONTRUN] Attacker swap executed: 0.5 token0 -> token1");
        console.log("[FRONTRUN] Price moved UP - victim will suffer slippage");

        vm.stopBroadcast();
    }

    /// @notice Step 2: Victim swap (suffers from displaced price)
    function victim() external {
        uint256 victimKey = vm.envUint("PRIVATE_KEY");
        vm.startBroadcast(victimKey);

        address managerAddr = vm.envAddress("POOL_MANAGER_ADDRESS");
        address tokenA = vm.envAddress("TOKEN_A_ADDRESS");
        address tokenB = vm.envAddress("TOKEN_B_ADDRESS");

        (address token0, address token1) = tokenA < tokenB ? (tokenA, tokenB) : (tokenB, tokenA);

        SwapHelper helper = new SwapHelper(managerAddr);
        console.log("[VICTIM] SwapHelper deployed at:", address(helper));

        PoolKey memory poolKey = PoolKey({
            currency0: Currency.wrap(token0),
            currency1: Currency.wrap(token1),
            fee: LP_FEE,
            tickSpacing: TICK_SPACING,
            hooks: IHooks(address(0))
        });

        IERC20(token0).approve(address(helper), type(uint256).max);

        // Normal swap: 0.1 token0 → token1 (executes at WORSE price)
        helper.swap(poolKey, true, -int256(1e17), 4295128740);

        console.log("[VICTIM] User swap executed: 0.1 token0 -> token1");
        console.log("[VICTIM] Suffered price impact from frontrun");
        console.log("[VICTIM] SandwichDetectorV2 should detect this loss");

        vm.stopBroadcast();
    }

    /// @notice Step 3: Attacker backrun swap (restores price, extracts profit)
    function backrun() external {
        uint256 attackerKey = vm.envUint("ATTACKER_PRIVATE_KEY");
        vm.startBroadcast(attackerKey);

        address managerAddr = vm.envAddress("POOL_MANAGER_ADDRESS");
        address tokenA = vm.envAddress("TOKEN_A_ADDRESS");
        address tokenB = vm.envAddress("TOKEN_B_ADDRESS");

        (address token0, address token1) = tokenA < tokenB ? (tokenA, tokenB) : (tokenB, tokenA);

        SwapHelper helper = new SwapHelper(managerAddr);
        console.log("[BACKRUN] SwapHelper deployed at:", address(helper));

        PoolKey memory poolKey = PoolKey({
            currency0: Currency.wrap(token0),
            currency1: Currency.wrap(token1),
            fee: LP_FEE,
            tickSpacing: TICK_SPACING,
            hooks: IHooks(address(0))
        });

        IERC20(token1).approve(address(helper), type(uint256).max);

        // Reverse swap: token1 → token0 (restores price)
        helper.swap(poolKey, false, -int256(5e17), 1461446703485210103287273052203988822378723970341);

        console.log("[BACKRUN] Attacker reverses position: token1 -> token0");
        console.log("[BACKRUN] Price restored, attacker extracted MEV");
        console.log("[BACKRUN] Sandwich attack complete");

        vm.stopBroadcast();
    }

    /// @notice Execute full sandwich sequence (for testing)
    function fullSandwich() external {
        console.log("=== EXECUTING CANONICAL MEV SANDWICH SIMULATION ===");
        console.log("");
        
        // Step 1: Frontrun
        console.log("Step 1/3: Attacker frontrun swap...");
        this.frontrun();
        console.log("");

        // Step 2: Victim
        console.log("Step 2/3: Victim swap...");
        this.victim();
        console.log("");

        // Step 3: Backrun
        console.log("Step 3/3: Attacker backrun swap...");
        this.backrun();
        console.log("");

        console.log("=== SANDWICH COMPLETE ===");
        console.log("Check SandwichDetectorV2 events for:");
        console.log("  - SandwichDetected(attacker, victim, loss, refund)");
        console.log("  - RefundClaimed(victim, amount)");
    }
}
