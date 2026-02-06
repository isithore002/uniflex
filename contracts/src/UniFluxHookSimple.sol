// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {IHooks} from "@uniswap/v4-core/src/interfaces/IHooks.sol";
import {IPoolManager} from "@uniswap/v4-core/src/interfaces/IPoolManager.sol";
import {Hooks} from "@uniswap/v4-core/src/libraries/Hooks.sol";
import {PoolKey} from "@uniswap/v4-core/src/types/PoolKey.sol";
import {BalanceDelta} from "@uniswap/v4-core/src/types/BalanceDelta.sol";
import {PoolId, PoolIdLibrary} from "@uniswap/v4-core/src/types/PoolId.sol";
import {BeforeSwapDelta} from "@uniswap/v4-core/src/types/BeforeSwapDelta.sol";

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

contract UniFluxHook is IHooks {
    using PoolIdLibrary for PoolKey;

    IPoolManager public immutable poolManager;
    ISandwichDetector public detector;

    error NotPoolManager();
    error HookNotImplemented();
    error InvalidDetectorAddress();

    event UniFluxHookTriggered(
        PoolId indexed poolId,
        address indexed swapper,
        int128 delta0,
        int128 delta1,
        uint160 sqrtPriceX96After
    );

    modifier onlyPoolManager() {
        if (msg.sender != address(poolManager)) revert NotPoolManager();
        _;
    }

    constructor(IPoolManager _poolManager, address _detector) {
        poolManager = _poolManager;
        if (_detector != address(0)) {
            detector = ISandwichDetector(_detector);
        }
        Hooks.validateHookPermissions(this, getHookPermissions());
    }

    function setDetector(address _detector) external {
        if (_detector == address(0)) revert InvalidDetectorAddress();
        detector = ISandwichDetector(_detector);
    }

    function getHookPermissions() public pure returns (Hooks.Permissions memory) {
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

    // ============ IHooks Implementation ============

    function beforeInitialize(address, PoolKey calldata, uint160) external pure returns (bytes4) {
        revert HookNotImplemented();
    }

    function afterInitialize(address, PoolKey calldata, uint160, int24) external pure returns (bytes4) {
        revert HookNotImplemented();
    }

    function beforeAddLiquidity(
        address,
        PoolKey calldata,
        IPoolManager.ModifyLiquidityParams calldata,
        bytes calldata
    ) external pure returns (bytes4) {
        revert HookNotImplemented();
    }

    function afterAddLiquidity(
        address,
        PoolKey calldata,
        IPoolManager.ModifyLiquidityParams calldata,
        BalanceDelta,
        BalanceDelta,
        bytes calldata
    ) external pure returns (bytes4, BalanceDelta) {
        revert HookNotImplemented();
    }

    function beforeRemoveLiquidity(
        address,
        PoolKey calldata,
        IPoolManager.ModifyLiquidityParams calldata,
        bytes calldata
    ) external pure returns (bytes4) {
        revert HookNotImplemented();
    }

    function afterRemoveLiquidity(
        address,
        PoolKey calldata,
        IPoolManager.ModifyLiquidityParams calldata,
        BalanceDelta,
        BalanceDelta,
        bytes calldata
    ) external pure returns (bytes4, BalanceDelta) {
        revert HookNotImplemented();
    }

    function beforeSwap(
        address,
        PoolKey calldata,
        IPoolManager.SwapParams calldata,
        bytes calldata
    ) external pure returns (bytes4, BeforeSwapDelta, uint24) {
        revert HookNotImplemented();
    }

    function afterSwap(
        address sender,
        PoolKey calldata key,
        IPoolManager.SwapParams calldata,
        BalanceDelta delta,
        bytes calldata
    ) external onlyPoolManager returns (bytes4, int128) {
        if (address(detector) == address(0)) {
            return (IHooks.afterSwap.selector, 0);
        }

        PoolId poolId = key.toId();

        // Record swap in detector (price = 0 for simplified demo)
        detector.recordSwap(
            PoolId.unwrap(poolId),
            sender,
            delta.amount0(),
            delta.amount1(),
            0
        );

        emit UniFluxHookTriggered(
            poolId,
            sender,
            delta.amount0(),
            delta.amount1(),
            0
        );

        return (IHooks.afterSwap.selector, 0);
    }

    function beforeDonate(
        address,
        PoolKey calldata,
        uint256,
        uint256,
        bytes calldata
    ) external pure returns (bytes4) {
        revert HookNotImplemented();
    }

    function afterDonate(
        address,
        PoolKey calldata,
        uint256,
        uint256,
        bytes calldata
    ) external pure returns (bytes4) {
        revert HookNotImplemented();
    }
}
