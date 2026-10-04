// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Test.sol";
import "../contracts/core/GiwaPoolFactory.sol";
import "../contracts/core/GiwaCLDeployer.sol";
import "../contracts/core/GiwaStableDeployer.sol";
import "../contracts/core/GiwaCLPool.sol";
import "../contracts/core/GiwaStablePool.sol";
import "../contracts/periphery/GiwaUniversalRouter.sol";
import "../contracts/governance/ProtocolFeeVault.sol";
import "./mocks/MockERC20.sol";
import "./mocks/MockWETH.sol";

contract GiwaDualEngineTest is Test {
    GiwaPoolFactory public factory;
    GiwaCLDeployer public clDeployer;
    GiwaStableDeployer public stableDeployer;
    ProtocolFeeVault public feeVault;
    GiwaUniversalRouter public router;
    MockWETH public weth;
    MockERC20 public usdc;
    MockERC20 public usdt;

    address public owner = address(0xA1);
    address public treasury = address(0x77);
    address public alice = address(0xB1);
    address public bob = address(0xB2);

    function setUp() public {
        vm.startPrank(owner);
        weth = new MockWETH();
        usdc = new MockERC20("USD Coin", "USDC");
        usdt = new MockERC20("Tether USD", "USDT");

        feeVault = new ProtocolFeeVault(treasury);
        clDeployer = new GiwaCLDeployer();
        stableDeployer = new GiwaStableDeployer();
        factory = new GiwaPoolFactory(address(feeVault), address(clDeployer), address(stableDeployer));
        clDeployer.setFactory(address(factory));
        stableDeployer.setFactory(address(factory));
        router = new GiwaUniversalRouter(address(factory), address(weth), address(0));
        vm.stopPrank();

        // Deal ETH & Mint Mock Tokens
        vm.deal(alice, 100 ether);
        vm.deal(bob, 100 ether);

        usdc.mint(alice, 1_000_000 ether);
        usdt.mint(alice, 1_000_000 ether);
        usdc.mint(bob, 1_000_000 ether);
        usdt.mint(bob, 1_000_000 ether);

        vm.prank(alice);
        usdc.approve(address(router), type(uint256).max);
        vm.prank(alice);
        usdt.approve(address(router), type(uint256).max);

        vm.prank(bob);
        usdc.approve(address(router), type(uint256).max);
        vm.prank(bob);
        usdt.approve(address(router), type(uint256).max);
    }

    function test_Factory_DeployCLAMMPool() public {
        address pool = factory.createPool(address(weth), address(usdc), 3000, false);
        assertTrue(pool != address(0), "CLAMM Pool address should not be zero");

        GiwaCLPool clPool = GiwaCLPool(pool);
        assertEq(clPool.fee(), 3000, "Fee should be 3000 (0.30%)");
        assertEq(clPool.tickSpacing(), 60, "Tick spacing should be 60");
    }

    function test_Factory_DeployStablePool() public {
        address pool = factory.createPool(address(usdc), address(usdt), 100, true);
        assertTrue(pool != address(0), "Stable Pool address should not be zero");

        GiwaStablePool stablePool = GiwaStablePool(pool);
        assertEq(stablePool.fee(), 100 * 10**6, "Fee should be normalized");
        assertEq(stablePool.A(), 10000, "Default A should be 100 * 100");
    }

    function test_ProtocolFeeVault_Distribution() public {
        // Mint fees directly to vault
        usdc.mint(address(feeVault), 10_000 ether);

        uint256 treasuryBefore = usdc.balanceOf(treasury);
        uint256 deadBefore = usdc.balanceOf(feeVault.DEAD_ADDRESS());

        (uint256 lpShare, uint256 treasuryShare, uint256 burnShare) = feeVault.distributeFees(address(usdc));

        assertEq(lpShare, 7_000 ether, "LP Share should be 70%");
        assertEq(treasuryShare, 2_000 ether, "Treasury Share should be 20%");
        assertEq(burnShare, 1_000 ether, "Burn Share should be 10%");

        assertEq(usdc.balanceOf(treasury), treasuryBefore + 2_000 ether);
        assertEq(usdc.balanceOf(feeVault.DEAD_ADDRESS()), deadBefore + 1_000 ether);
    }

    function test_StablePool_AddLiquidityAndExchange() public {
        address pool = factory.createPool(address(usdc), address(usdt), 100, true);
        GiwaStablePool stablePool = GiwaStablePool(pool);

        vm.startPrank(alice);
        usdc.approve(pool, type(uint256).max);
        usdt.approve(pool, type(uint256).max);

        uint256[] memory amounts = new uint256[](2);
        amounts[0] = 50_000 ether;
        amounts[1] = 50_000 ether;

        uint256 lpMinted = stablePool.add_liquidity(amounts, 0);
        assertGt(lpMinted, 0, "LP tokens should be minted");
        vm.stopPrank();

        // Bob exchanges 1,000 USDC for USDT
        vm.startPrank(bob);
        usdc.approve(pool, type(uint256).max);
        uint256 usdtBefore = usdt.balanceOf(bob);

        uint256 dy = stablePool.exchange(0, 1, 1_000 ether, 990 ether);
        assertGt(dy, 995 ether, "Pegged swap should have <0.5% slippage");
        assertEq(usdt.balanceOf(bob), usdtBefore + dy);
        vm.stopPrank();
    }
}
