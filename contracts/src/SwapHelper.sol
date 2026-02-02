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

/// @title SwapHelper
/// @notice Helper contract for performing swaps on Uniswap v4 pools
/// @dev Implements IUnlockCallback to handle the unlock pattern required by v4
contract SwapHelper is IUnlockCallback {
    using CurrencyLibrary for Currency;

    IPoolManager public immutable poolManager;
    address public immutable owner;

    // Temporary storage for callback context
    PoolKey private _poolKey;
    bool private _zeroForOne;
    int256 private _amountSpecified;
    uint160 private _sqrtPriceLimitX96;

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

    /// @notice Execute a swap
    /// @param key The pool key
    /// @param zeroForOne Direction of the swap (true = token0 -> token1)
    /// @param amountSpecified The amount to swap (negative = exactIn, positive = exactOut)
    /// @param sqrtPriceLimitX96 Price limit for the swap
    function swap(
        PoolKey calldata key,
        bool zeroForOne,
        int256 amountSpecified,
        uint160 sqrtPriceLimitX96
    ) external onlyOwner {
        // Store context for callback
        _poolKey = key;
        _zeroForOne = zeroForOne;
        _amountSpecified = amountSpecified;
        _sqrtPriceLimitX96 = sqrtPriceLimitX96;

        // Transfer input token from owner
        address inputToken = zeroForOne 
            ? Currency.unwrap(key.currency0) 
            : Currency.unwrap(key.currency1);
        
        uint256 amountIn = amountSpecified < 0 
            ? uint256(-amountSpecified) 
            : uint256(amountSpecified);
            
        IERC20(inputToken).transferFrom(msg.sender, address(this), amountIn);

        // Trigger the unlock callback
        poolManager.unlock("");
    }

    function unlockCallback(bytes calldata) external onlyPoolManager returns (bytes memory) {
        IPoolManager.SwapParams memory params = IPoolManager.SwapParams({
            zeroForOne: _zeroForOne,
            amountSpecified: _amountSpecified,
            sqrtPriceLimitX96: _sqrtPriceLimitX96
        });

        BalanceDelta delta = poolManager.swap(_poolKey, params, "");

        address token0 = Currency.unwrap(_poolKey.currency0);
        address token1 = Currency.unwrap(_poolKey.currency1);

        // Settle the input token (negative delta = we owe)
        if (delta.amount0() < 0) {
            poolManager.sync(_poolKey.currency0);
            IERC20(token0).transfer(address(poolManager), uint256(int256(-delta.amount0())));
            poolManager.settle();
        }
        if (delta.amount1() < 0) {
            poolManager.sync(_poolKey.currency1);
            IERC20(token1).transfer(address(poolManager), uint256(int256(-delta.amount1())));
            poolManager.settle();
        }

        // Take the output token (positive delta = we receive)
        if (delta.amount0() > 0) {
            poolManager.take(_poolKey.currency0, owner, uint256(int256(delta.amount0())));
        }
        if (delta.amount1() > 0) {
            poolManager.take(_poolKey.currency1, owner, uint256(int256(delta.amount1())));
        }

        return "";
    }
}
