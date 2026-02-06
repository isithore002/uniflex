// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Script, console} from "forge-std/Script.sol";
import {IPoolManager} from "v4-core/interfaces/IPoolManager.sol";
import {PoolKey} from "v4-core/types/PoolKey.sol";
import {Currency, CurrencyLibrary} from "v4-core/types/Currency.sol";
import {IHooks} from "v4-core/interfaces/IHooks.sol";

contract SetupPool is Script {
    using CurrencyLibrary for Currency;

    int24 constant TICK_SPACING = 60;
    uint24 constant LP_FEE = 3000;

    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        
        // Use existing deployed contracts on Unichain Sepolia
        address poolManagerAddress = vm.envAddress("POOL_MANAGER_ADDRESS");
        address tokenAAddress = vm.envAddress("TOKEN_A_ADDRESS");
        address tokenBAddress = vm.envAddress("TOKEN_B_ADDRESS");
        
        console.log("Using PoolManager:", poolManagerAddress);
        console.log("Using Token A (mETH):", tokenAAddress);
        console.log("Using Token B (mUSDC):", tokenBAddress);
        
        vm.startBroadcast(deployerPrivateKey);

        IPoolManager manager = IPoolManager(poolManagerAddress);

        // Sort tokens (token0 < token1)
        (address token0Addr, address token1Addr) = tokenAAddress < tokenBAddress
            ? (tokenAAddress, tokenBAddress)
            : (tokenBAddress, tokenAAddress);

        console.log("Token0:", token0Addr);
        console.log("Token1:", token1Addr);

        PoolKey memory poolKey = PoolKey({
            currency0: Currency.wrap(token0Addr),
            currency1: Currency.wrap(token1Addr),
            fee: LP_FEE,
            tickSpacing: TICK_SPACING,
            hooks: IHooks(address(0))
        });

        // Price: 1 token0 = 1 token1 (sqrt(1) * 2^96)
        uint160 startPrice = 79228162514264337593543950336;
        
        console.log("Initializing pool with sqrtPriceX96:", startPrice);
        manager.initialize(poolKey, startPrice);
        console.log("Pool Initialized!");
        
        console.log("");
        console.log("=== PoolKey ===");
        console.log("currency0:", token0Addr);
        console.log("currency1:", token1Addr);
        console.log("fee:", LP_FEE);
        console.log("tickSpacing:", TICK_SPACING);
        console.log("hooks: address(0)");

        vm.stopBroadcast();
    }
}
