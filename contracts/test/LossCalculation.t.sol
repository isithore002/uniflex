// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Test, console2} from "forge-std/Test.sol";

/// @title LossCalculationTest
/// @notice Validates the hardened loss calculation math
/// @dev Run with: forge test -vvv --match-contract LossCalculationTest
///
/// This is a standalone test that mirrors the hook's loss calculation logic
/// without depending on the v4-core/v4-periphery imports

contract LossCalculationTest is Test {

    uint256 constant Q96 = 2 ** 96;

    // Mirror the hook's constants
    uint256 constant MIN_SQRT_PRICE_MOVE = 2e14;
    uint256 constant REFUND_BPS = 3000; // 30%
    uint256 constant MAX_REFUND_PER_SWAP = 0.1 ether;

    // ═══════════════════════════════════════════════════════════════════════════
    // QUOTE FUNCTIONS (copied from hook for isolated testing)
    // ═══════════════════════════════════════════════════════════════════════════

    /// @notice Safe mulDiv - a * b / denominator without overflow
    function mulDiv(uint256 a, uint256 b, uint256 denominator) internal pure returns (uint256 result) {
        // 512-bit multiply [prod1 prod0] = a * b
        uint256 prod0 = a * b;
        uint256 prod1;
        assembly {
            let mm := mulmod(a, b, not(0))
            prod1 := sub(sub(mm, prod0), lt(mm, prod0))
        }
        
        if (prod1 == 0) {
            return prod0 / denominator;
        }
        
        // Make sure the result is less than 2^256
        require(denominator > prod1);
        
        // 512-bit division
        uint256 remainder;
        assembly {
            remainder := mulmod(a, b, denominator)
            prod1 := sub(prod1, gt(remainder, prod0))
            prod0 := sub(prod0, remainder)
        }
        
        // Factor powers of two out of denominator
        uint256 twos = denominator & (~denominator + 1);
        assembly {
            denominator := div(denominator, twos)
            prod0 := div(prod0, twos)
            twos := add(div(sub(0, twos), twos), 1)
        }
        prod0 |= prod1 * twos;
        
        // Compute the modular inverse of denominator
        uint256 inv = (3 * denominator) ^ 2;
        inv *= 2 - denominator * inv;
        inv *= 2 - denominator * inv;
        inv *= 2 - denominator * inv;
        inv *= 2 - denominator * inv;
        inv *= 2 - denominator * inv;
        inv *= 2 - denominator * inv;
        
        result = prod0 * inv;
    }

    function quote0to1(uint256 amountIn, uint160 sqrtPriceX96) internal pure returns (uint256) {
        uint256 sqrtPrice = uint256(sqrtPriceX96);
        uint256 numerator = mulDiv(amountIn, sqrtPrice, Q96);
        return mulDiv(numerator, sqrtPrice, Q96);
    }

    function quote1to0(uint256 amountIn, uint160 sqrtPriceX96) internal pure returns (uint256) {
        uint256 sqrtPrice = uint256(sqrtPriceX96);
        if (sqrtPrice == 0) return 0;
        uint256 numerator = mulDiv(amountIn, Q96, sqrtPrice);
        return mulDiv(numerator, Q96, sqrtPrice);
    }

    function computeLoss(
        uint160 fairPrice,
        uint160 execPrice,
        uint256 amountIn,
        bool zeroForOne
    ) internal pure returns (uint256 loss) {
        if (fairPrice == 0 || execPrice == 0) return 0;

        uint256 priceDiff = fairPrice > execPrice
            ? fairPrice - execPrice
            : execPrice - fairPrice;

        if (priceDiff < MIN_SQRT_PRICE_MOVE) return 0;

        uint256 expectedOut;
        uint256 actualOut;

        if (zeroForOne) {
            expectedOut = quote0to1(amountIn, fairPrice);
            actualOut = quote0to1(amountIn, execPrice);
        } else {
            expectedOut = quote1to0(amountIn, fairPrice);
            actualOut = quote1to0(amountIn, execPrice);
        }

        if (expectedOut > actualOut) {
            loss = expectedOut - actualOut;
        }
    }

    function computeBoundedRefund(uint256 loss, uint256 treasury) internal pure returns (uint256 refund) {
        refund = (loss * REFUND_BPS) / 10_000;
        if (refund > treasury) refund = treasury;
        if (refund > MAX_REFUND_PER_SWAP) refund = MAX_REFUND_PER_SWAP;
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // TEST: Quote functions correctness
    // ═══════════════════════════════════════════════════════════════════════════

    function test_Quote0to1_AtParity() public pure {
        // sqrtPriceX96 = Q96 means price = 1:1
        uint160 sqrtPrice = uint160(Q96);
        uint256 amountIn = 1 ether;

        uint256 output = quote0to1(amountIn, sqrtPrice);

        // At 1:1, output should equal input
        assertEq(output, amountIn, "At parity, output should equal input");
    }

    function test_Quote1to0_AtParity() public pure {
        uint160 sqrtPrice = uint160(Q96);
        uint256 amountIn = 1 ether;

        uint256 output = quote1to0(amountIn, sqrtPrice);

        assertEq(output, amountIn, "At parity, output should equal input");
    }

    function test_Quote0to1_AtDoublePrice() public pure {
        // sqrtPrice = Q96 * sqrt(2) ≈ Q96 * 1.414
        // price = 2, so 1 token0 = 2 token1
        uint160 sqrtPrice = uint160((Q96 * 14142) / 10000); // ~1.4142
        uint256 amountIn = 1 ether;

        uint256 output = quote0to1(amountIn, sqrtPrice);

        // At price=2, 1 token0 → ~2 token1
        assertApproxEqRel(output, 2 ether, 0.01e18, "At price=2, should get ~2 token1");
    }

    function test_Quote1to0_AtDoublePrice() public pure {
        // sqrtPrice = Q96 * sqrt(2)
        // price = 2, so 1 token1 = 0.5 token0
        uint160 sqrtPrice = uint160((Q96 * 14142) / 10000);
        uint256 amountIn = 1 ether;

        uint256 output = quote1to0(amountIn, sqrtPrice);

        // At price=2, 1 token1 → ~0.5 token0
        assertApproxEqRel(output, 0.5 ether, 0.01e18, "At price=2, should get ~0.5 token0");
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // TEST: Loss calculation
    // ═══════════════════════════════════════════════════════════════════════════

    function test_Loss_ZeroForOne_PriceIncrease() public pure {
        // Scenario: Attacker buys token1 (pushes price up)
        //           Victim also buys token1 at higher price
        //           Victim gets less token1 than they should have

        uint160 fairPrice = uint160(Q96);                    // 1:1
        uint160 execPrice = uint160((Q96 * 101) / 100);      // 1.01:1 (1% higher)
        uint256 amountIn = 10 ether;
        bool zeroForOne = true;

        uint256 loss = computeLoss(fairPrice, execPrice, amountIn, zeroForOne);

        // Expected: ~10 token1
        // Actual: ~10.2 token1 (because higher sqrtPrice means more output for 0→1)
        // Wait, this is inverted...

        console2.log("Expected output:", quote0to1(amountIn, fairPrice));
        console2.log("Actual output:", quote0to1(amountIn, execPrice));
        console2.log("Loss:", loss);

        // For zeroForOne, higher sqrtPrice = MORE output
        // So if frontrun pushed price UP, victim gets MORE, not less
        // This means for zeroForOne sandwich, attacker pushes price DOWN
        assertEq(loss, 0, "No loss when price goes up for 0to1");
    }

    function test_Loss_ZeroForOne_PriceDecrease() public pure {
        // Correct scenario: Attacker sells token1 (pushes price down)
        //                   Victim buys token1 at lower price
        //                   Wait, that's BETTER for victim...

        // Actually for 0→1: victim wants high sqrtPrice
        // Frontrunner doing 0→1 first would push price UP
        // Then victim does 0→1, but... higher price = better for victim?

        // Let me reconsider:
        // sqrtPrice = sqrt(token1/token0) * Q96
        // For 0→1: output_token1 = input_token0 * (sqrtPrice/Q96)^2

        // If frontrunner does 0→1, they buy token1, which:
        // - Increases token0 reserve
        // - Decreases token1 reserve
        // - sqrtPrice = sqrt(token1/token0) DECREASES

        // So frontrun 0→1 → sqrtPrice goes DOWN
        // Victim 0→1 at lower sqrtPrice → gets LESS token1

        uint160 fairPrice = uint160(Q96);                    // 1:1 before frontrun
        uint160 execPrice = uint160((Q96 * 99) / 100);       // 0.99:1 after frontrun (lower)
        uint256 amountIn = 10 ether;
        bool zeroForOne = true;

        uint256 loss = computeLoss(fairPrice, execPrice, amountIn, zeroForOne);

        console2.log("Fair output:", quote0to1(amountIn, fairPrice));
        console2.log("Actual output:", quote0to1(amountIn, execPrice));
        console2.log("Loss:", loss);

        // At fair price: 10 token0 → 10 token1
        // At exec price: 10 token0 → ~9.8 token1
        // Loss ≈ 0.2 token1
        assertGt(loss, 0, "Should have positive loss");
        assertApproxEqRel(loss, 0.2 ether, 0.1e18, "Loss should be ~0.2 token1");
    }

    function test_Loss_OneForZero_PriceIncrease() public pure {
        // For 1→0: victim wants LOW sqrtPrice (more token0 per token1)
        // Frontrun 1→0 → increases sqrtPrice → victim gets less token0

        uint160 fairPrice = uint160(Q96);                    // 1:1 before frontrun
        uint160 execPrice = uint160((Q96 * 101) / 100);      // 1.01:1 after frontrun (higher)
        uint256 amountIn = 10 ether;
        bool zeroForOne = false;

        uint256 loss = computeLoss(fairPrice, execPrice, amountIn, zeroForOne);

        console2.log("Fair output:", quote1to0(amountIn, fairPrice));
        console2.log("Actual output:", quote1to0(amountIn, execPrice));
        console2.log("Loss:", loss);

        // At fair price: 10 token1 → 10 token0
        // At exec price: 10 token1 → ~9.8 token0
        assertGt(loss, 0, "Should have positive loss");
        assertApproxEqRel(loss, 0.2 ether, 0.1e18, "Loss should be ~0.2 token0");
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // TEST: Minimum displacement threshold
    // ═══════════════════════════════════════════════════════════════════════════

    function test_Loss_BelowThreshold_ReturnsZero() public pure {
        uint160 fairPrice = uint160(Q96);
        // Very tiny displacement (below MIN_SQRT_PRICE_MOVE)
        uint160 execPrice = uint160(Q96 - 1);
        uint256 amountIn = 10 ether;

        uint256 loss = computeLoss(fairPrice, execPrice, amountIn, true);

        assertEq(loss, 0, "Should return 0 for tiny displacement");
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // TEST: Refund caps
    // ═══════════════════════════════════════════════════════════════════════════

    function test_Refund_Cap1_TreasuryLimit() public pure {
        uint256 loss = 10 ether;
        uint256 treasury = 0.01 ether; // Very low

        uint256 refund = computeBoundedRefund(loss, treasury);

        // 30% of 10 ETH = 3 ETH, but treasury only has 0.01 ETH
        assertEq(refund, 0.01 ether, "Should be capped by treasury");
    }

    function test_Refund_Cap2_PercentageOfLoss() public pure {
        uint256 loss = 0.1 ether; // Small loss so 30% = 0.03 ETH < MAX_REFUND
        uint256 treasury = 100 ether; // Plenty

        uint256 refund = computeBoundedRefund(loss, treasury);

        // 30% of 0.1 ETH = 0.03 ETH
        assertEq(refund, 0.03 ether, "Should be 30% of loss");
    }

    function test_Refund_Cap3_MaxPerSwap() public pure {
        uint256 loss = 100 ether; // Large loss
        uint256 treasury = 100 ether;

        uint256 refund = computeBoundedRefund(loss, treasury);

        // 30% of 100 ETH = 30 ETH, but max is 0.1 ETH
        assertEq(refund, MAX_REFUND_PER_SWAP, "Should be capped at MAX_REFUND_PER_SWAP");
    }

    function test_Refund_AllCapsApplied() public pure {
        // Test that we take minimum of all caps
        uint256 loss = 0.5 ether;
        uint256 treasury = 0.05 ether;

        uint256 refund = computeBoundedRefund(loss, treasury);

        // 30% of 0.5 = 0.15 ETH
        // Treasury = 0.05 ETH (lowest)
        // Max per swap = 0.1 ETH
        assertEq(refund, 0.05 ether, "Should take minimum of all caps");
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // TEST: Edge cases
    // ═══════════════════════════════════════════════════════════════════════════

    function test_Loss_ZeroPrice_ReturnsZero() public pure {
        uint256 loss = computeLoss(0, uint160(Q96), 1 ether, true);
        assertEq(loss, 0, "Zero fair price should return 0");

        loss = computeLoss(uint160(Q96), 0, 1 ether, true);
        assertEq(loss, 0, "Zero exec price should return 0");
    }

    function test_Loss_ZeroAmount_ReturnsZero() public pure {
        uint160 fairPrice = uint160(Q96);
        uint160 execPrice = uint160((Q96 * 99) / 100);

        uint256 loss = computeLoss(fairPrice, execPrice, 0, true);
        assertEq(loss, 0, "Zero amount should return 0 loss");
    }

    function test_Refund_ZeroLoss_ReturnsZero() public pure {
        uint256 refund = computeBoundedRefund(0, 100 ether);
        assertEq(refund, 0, "Zero loss should return zero refund");
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // TEST: Realistic sandwich scenario
    // ═══════════════════════════════════════════════════════════════════════════

    function test_RealisticSandwich() public pure {
        // Scenario:
        // 1. Initial price: 1 ETH = 2000 USDC (sqrtPrice = sqrt(2000) * Q96)
        // 2. Frontrunner buys ETH (0→1), pushes price down by 0.5%
        // 3. Victim buys ETH at worse price
        // 4. Backrunner sells ETH, profit

        // sqrtPrice = sqrt(2000) * Q96 ≈ 44.72 * Q96
        uint160 fairPrice = uint160((Q96 * 4472) / 100);

        // After frontrun, price drops 0.5% (sqrtPrice drops ~0.25%)
        uint160 execPrice = uint160((uint256(fairPrice) * 9975) / 10000);

        // Victim swaps 10 ETH worth
        uint256 amountIn = 10 ether;

        uint256 loss = computeLoss(fairPrice, execPrice, amountIn, true);
        uint256 refund = computeBoundedRefund(loss, 10 ether);

        console2.log("=== Realistic Sandwich ===");
        console2.log("Fair price (sqrtX96):", fairPrice);
        console2.log("Exec price (sqrtX96):", execPrice);
        console2.log("Price displacement:", ((uint256(fairPrice) - execPrice) * 10000) / fairPrice, "bps");
        console2.log("Victim input:", amountIn / 1e18, "tokens");
        console2.log("Expected output:", quote0to1(amountIn, fairPrice) / 1e18);
        console2.log("Actual output:", quote0to1(amountIn, execPrice) / 1e18);
        console2.log("Loss:", loss / 1e18, "tokens");
        console2.log("Refund (30%):", refund / 1e18, "tokens");

        // Verify loss is reasonable (around 0.5% of output)
        uint256 expectedOutput = quote0to1(amountIn, fairPrice);
        uint256 lossPercent = (loss * 10000) / expectedOutput;
        console2.log("Loss as % of expected:", lossPercent, "bps");

        assertTrue(lossPercent > 0 && lossPercent < 100, "Loss should be 0-1% of output");
    }
}
