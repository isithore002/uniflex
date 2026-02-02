// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {PoolManager} from "v4-core/PoolManager.sol";
import {IPoolManager} from "v4-core/interfaces/IPoolManager.sol";
import {PoolKey} from "v4-core/types/PoolKey.sol";
import {Currency, CurrencyLibrary} from "v4-core/types/Currency.sol";
import {IHooks} from "v4-core/interfaces/IHooks.sol";
import {IERC20} from "openzeppelin-contracts/contracts/token/ERC20/IERC20.sol";
import {IUnlockCallback} from "v4-core/interfaces/callback/IUnlockCallback.sol";
import {BalanceDelta} from "v4-core/types/BalanceDelta.sol";

/// @title LiquidityHelper
/// @notice Helper contract for adding liquidity to Uniswap v4 pools
/// @dev Implements IUnlockCallback to handle the unlock pattern required by v4
contract LiquidityHelper is IUnlockCallback {
    using CurrencyLibrary for Currency;

    IPoolManager public immutable poolManager;
    address public immutable owner;

    // Temporary storage for callback context
    PoolKey private _poolKey;
    int24 private _tickLower;
    int24 private _tickUpper;
    int256 private _liquidityDelta;

    error NotOwner();
    error NotPoolManager();

    modifier onlyOwner() {
        if (msg.sender != owner) revert NotOwner();
        _;
    }

    modifier onlyPoolManager() {
        if (msg.sender != address(poolManager)) revert NotPoolManager();
        _;
    }

    constructor(address _poolManager) {
        poolManager = IPoolManager(_poolManager);
        owner = msg.sender;
    }

    /// @notice Add liquidity to a pool
    /// @param key The pool key
    /// @param tickLower Lower tick bound
    /// @param tickUpper Upper tick bound  
    /// @param liquidityDelta Amount of liquidity to add (positive) or remove (negative)
    function addLiquidity(
        PoolKey calldata key,
        int24 tickLower,
        int24 tickUpper,
        int256 liquidityDelta
    ) external onlyOwner {
        // Store context for callback
        _poolKey = key;
        _tickLower = tickLower;
        _tickUpper = tickUpper;
        _liquidityDelta = liquidityDelta;

        // Transfer tokens from owner to this contract
        address token0 = Currency.unwrap(key.currency0);
        address token1 = Currency.unwrap(key.currency1);
        
        // Pull tokens (assumes approval was given)
        IERC20(token0).transferFrom(msg.sender, address(this), 1e18);
        IERC20(token1).transferFrom(msg.sender, address(this), 1e18);

        // Trigger the unlock callback
        poolManager.unlock("");
    }

    function unlockCallback(bytes calldata) external onlyPoolManager returns (bytes memory) {
        IPoolManager.ModifyLiquidityParams memory params = IPoolManager.ModifyLiquidityParams({
            tickLower: _tickLower,
            tickUpper: _tickUpper,
            liquidityDelta: _liquidityDelta,
            salt: bytes32(0)
        });

        (BalanceDelta callerDelta,) = poolManager.modifyLiquidity(_poolKey, params, "");

        address token0 = Currency.unwrap(_poolKey.currency0);
        address token1 = Currency.unwrap(_poolKey.currency1);

        // Settle token0 if we owe it
        if (callerDelta.amount0() < 0) {
            poolManager.sync(_poolKey.currency0);
            IERC20(token0).transfer(address(poolManager), uint256(int256(-callerDelta.amount0())));
            poolManager.settle();
        }

        // Settle token1 if we owe it
        if (callerDelta.amount1() < 0) {
            poolManager.sync(_poolKey.currency1);
            IERC20(token1).transfer(address(poolManager), uint256(int256(-callerDelta.amount1())));
            poolManager.settle();
        }

        // Take any tokens owed to us
        if (callerDelta.amount0() > 0) {
            poolManager.take(_poolKey.currency0, owner, uint256(int256(callerDelta.amount0())));
        }
        if (callerDelta.amount1() > 0) {
            poolManager.take(_poolKey.currency1, owner, uint256(int256(callerDelta.amount1())));
        }

        return "";
    }
}
