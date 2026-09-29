// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../contracts/GiwaFactory.sol";
import "../contracts/GiwaRouter.sol";
import "../contracts/GiwaPool.sol";
import "./mocks/MockERC20.sol";
import "./mocks/MockWETH.sol";

contract GiwaDexTest is Test {
    GiwaFactory public factory;
    GiwaRouter public router;
    MockWETH public weth;
    MockERC20 public usdc;
    MockERC20 public usdt;

    address public owner = address(0xA1);
    address public feeVault = address(0xFE);
    address public user1 = address(0xB1);
    address public user2 = address(0xB2);

    function setUp() public {
        vm.startPrank(owner);
        weth = new MockWETH();
        usdc = new MockERC20("USD Coin", "USDC");
        usdt = new MockERC20("Tether USD", "USDT");

        factory = new GiwaFactory(feeVault);
        router = new GiwaRouter(address(factory), address(weth));
        vm.stopPrank();

        // Seed users with ETH and tokens
        vm.deal(user1, 100 ether);
        vm.deal(user2, 100 ether);

        usdc.mint(user1, 1_000_000 ether);
        usdt.mint(user1, 1_000_000 ether);
        usdc.mint(user2, 1_000_000 ether);
        usdt.mint(user2, 1_000_000 ether);

        vm.prank(user1);
        usdc.approve(address(router), type(uint256).max);
        vm.prank(user1);
        usdt.approve(address(router), type(uint256).max);

        vm.prank(user2);
        usdc.approve(address(router), type(uint256).max);
        vm.prank(user2);
        usdt.approve(address(router), type(uint256).max);
    }

    function test_CreatePoolAndAddLiquidity() public {
        vm.startPrank(user1);
        (uint256 amountA, uint256 amountB, uint256 liquidity) = router.addLiquidity(
            address(usdc),
            address(usdt),
            true, // isStable
            1,    // 0.01% fee
            10_000 ether,
            10_000 ether,
            9_000 ether,
            9_000 ether,
            user1,
            block.timestamp + 100
        );
        vm.stopPrank();

        address pool = factory.getPool(address(usdc), address(usdt), true);
        assertTrue(pool != address(0), "Pool address should not be zero");
        assertGt(liquidity, 0, "Liquidity should be minted");
        assertEq(amountA, 10_000 ether);
        assertEq(amountB, 10_000 ether);
    }

    function test_AddLiquidityETHAndSwap() public {
        vm.startPrank(user1);
        router.addLiquidityETH{value: 10 ether}(
            address(usdc),
            false, // Volatile
            30,    // 0.30% fee
            25_000 ether,
            20_000 ether,
            8 ether,
            user1,
            block.timestamp + 100
        );
        vm.stopPrank();

        address pool = factory.getPool(address(usdc), address(weth), false);
        assertTrue(pool != address(0));

        // User2 swaps 1 ETH for USDC
        address[] memory path = new address[](2);
        path[0] = address(weth);
        path[1] = address(usdc);

        bool[] memory isStablePath = new bool[](1);
        isStablePath[0] = false;

        uint256 usdcBefore = usdc.balanceOf(user2);
        vm.prank(user2);
        uint256[] memory amounts = router.swapExactETHForTokens{value: 1 ether}(
            1000 ether,
            path,
            isStablePath,
            user2,
            block.timestamp + 100
        );

        uint256 usdcAfter = usdc.balanceOf(user2);
        assertGt(usdcAfter, usdcBefore, "User2 should receive USDC");
        assertEq(amounts[0], 1 ether, "Input should match 1 ETH");
        assertGt(amounts[1], 2000 ether, "Should receive approximately ~2266 USDC");
    }

    function test_MultiHopSwap() public {
        // Pool 1: WETH / USDC (Volatile 0.30%)
        vm.prank(user1);
        router.addLiquidityETH{value: 10 ether}(
            address(usdc),
            false,
            30,
            25_000 ether,
            20_000 ether,
            8 ether,
            user1,
            block.timestamp + 100
        );

        // Pool 2: USDC / USDT (Stable 0.01%)
        vm.prank(user1);
        router.addLiquidity(
            address(usdc),
            address(usdt),
            true,
            1,
            50_000 ether,
            50_000 ether,
            40_000 ether,
            40_000 ether,
            user1,
            block.timestamp + 100
        );

        // User2 swaps ETH -> USDC -> USDT
        address[] memory path = new address[](3);
        path[0] = address(weth);
        path[1] = address(usdc);
        path[2] = address(usdt);

        bool[] memory isStablePath = new bool[](2);
        isStablePath[0] = false;
        isStablePath[1] = true;

        uint256 usdtBefore = usdt.balanceOf(user2);
        vm.prank(user2);
        uint256[] memory amounts = router.swapExactETHForTokens{value: 1 ether}(
            1000 ether,
            path,
            isStablePath,
            user2,
            block.timestamp + 100
        );

        uint256 usdtAfter = usdt.balanceOf(user2);
        assertGt(usdtAfter, usdtBefore, "User2 should receive USDT");
        assertEq(amounts[0], 1 ether);
        assertGt(amounts[2], 2000 ether);
    }

    function test_RemoveLiquidity() public {
        vm.startPrank(user1);
        (, , uint256 liquidity) = router.addLiquidity(
            address(usdc),
            address(usdt),
            true,
            1,
            10_000 ether,
            10_000 ether,
            9_000 ether,
            9_000 ether,
            user1,
            block.timestamp + 100
        );

        address pool = factory.getPool(address(usdc), address(usdt), true);
        GiwaPool(pool).approve(address(router), liquidity);

        uint256 usdcBefore = usdc.balanceOf(user1);
        uint256 usdtBefore = usdt.balanceOf(user1);

        (uint256 amountA, uint256 amountB) = router.removeLiquidity(
            address(usdc),
            address(usdt),
            true,
            liquidity,
            9_000 ether,
            9_000 ether,
            user1,
            block.timestamp + 100
        );
        vm.stopPrank();

        assertGt(amountA, 0);
        assertGt(amountB, 0);
        assertEq(usdc.balanceOf(user1), usdcBefore + amountA);
        assertEq(usdt.balanceOf(user1), usdtBefore + amountB);
    }
}
