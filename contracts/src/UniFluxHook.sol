// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {BaseHook} from "v4-periphery/src/utils/BaseHook.sol";
import {Hooks} from "@uniswap/v4-core/src/libraries/Hooks.sol";
import {IHooks} from "@uniswap/v4-core/src/interfaces/IHooks.sol";
import {IPoolManager} from "@uniswap/v4-core/src/interfaces/IPoolManager.sol";
import {PoolKey} from "@uniswap/v4-core/src/types/PoolKey.sol";
import {BalanceDelta} from "@uniswap/v4-core/src/types/BalanceDelta.sol";
import {PoolId, PoolIdLibrary} from "@uniswap/v4-core/src/types/PoolId.sol";
import {SwapParams} from "@uniswap/v4-core/src/types/PoolOperation.sol";

/// @title UniFluxHook
/// @notice Minimal Uniswap v4 Hook that feeds swap data to SandwichDetector
/// @dev Proves UniFlux operates as a v4-native execution primitive
interface ISandwichDetector {
    function recordSwap(
        bytes32 poolId,
        address swapper,
        int128 delta0,
        int128 delta1,
        uint160 sqrtPriceX96After
    ) external;
}

contract UniFluxHook is BaseHook {
    using PoolIdLibrary for PoolKey;

    /// @notice SandwichDetector contract for MEV protection
    ISandwichDetector public detector;

    /// @notice Hook triggered after swap execution
    event UniFluxHookTriggered(
        PoolId indexed poolId,
        address indexed swapper,
        int128 delta0,
        int128 delta1,
        uint160 sqrtPriceX96After
    );

    error InvalidDetectorAddress();

    constructor(
        IPoolManager _poolManager,
        address _detector
    ) BaseHook(_poolManager) {
        if (_detector != address(0)) {
            detector = ISandwichDetector(_detector);
        }
    }

    /// @notice Set detector address after deployment
    /// @dev Needed because hook and detector have circular dependency
    function setDetector(address _detector) external {
        if (_detector == address(0)) revert InvalidDetectorAddress();
        detector = ISandwichDetector(_detector);
    }

    /// @notice Returns hook permissions (only afterSwap enabled)
    function getHookPermissions()
        public
        pure
        override
        returns (Hooks.Permissions memory)
    {
        return Hooks.Permissions({
            beforeInitialize: false,
            afterInitialize: false,
            beforeAddLiquidity: false,
            afterAddLiquidity: false,
            beforeRemoveLiquidity: false,
            afterRemoveLiquidity: false,
            beforeSwap: false,
            afterSwap: true,
            beforeDonate: false,
            afterDonate: false,
            beforeSwapReturnDelta: false,
            afterSwapReturnDelta: false,
            afterAddLiquidityReturnDelta: false,
            afterRemoveLiquidityReturnDelta: false
        });
    }

    /// @notice Called after every swap in the pool
    /// @dev Feeds swap data to SandwichDetector for MEV analysis
    function _afterSwap(
        address sender,
        PoolKey calldata key,
        SwapParams calldata,
        BalanceDelta delta,
        bytes calldata
    ) internal override returns (bytes4, int128) {
        // Skip if detector not set
        if (address(detector) == address(0)) {
            return (IHooks.afterSwap.selector, 0);
        }

        PoolId poolId = key.toId();

        // Record swap in detector (price = 0 for now, can be enhanced later)
        detector.recordSwap(
            PoolId.unwrap(poolId),
            sender,
            delta.amount0(),
            delta.amount1(),
            0 // sqrtPriceX96After - simplified for demo
        );

        // Emit event for off-chain agent monitoring
        emit UniFluxHookTriggered(
            poolId,
            sender,
            delta.amount0(),
            delta.amount1(),
            0 // sqrtPriceX96After - simplified for demo
        );

        return (IHooks.afterSwap.selector, 0);
    }
}
