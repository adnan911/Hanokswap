// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title IGiwaStablePool
/// @notice Interface for Stableswap pools utilizing amplification coefficient (A) for ultra-low slippage pegged swaps.
interface IGiwaStablePool {
    event AddLiquidity(address indexed provider, uint256[] tokenAmounts, uint256 fee, uint256 tokenSupply);
    event RemoveLiquidity(address indexed provider, uint256[] tokenAmounts, uint256 tokenSupply);
    event RemoveLiquidityOne(address indexed provider, uint256 index, uint256 tokenAmount, uint256 coinAmount);
    event TokenExchange(address indexed buyer, uint256 soldId, uint256 tokensSold, uint256 boughtId, uint256 tokensBought);
    event RampA(uint256 oldA, uint256 newA, uint256 initialTime, uint256 futureTime);
    event StopRampA(uint256 currentA, uint256 time);

    function coins(uint256 i) external view returns (address);
    function balances(uint256 i) external view returns (uint256);
    function A() external view returns (uint256);
    function A_precise() external view returns (uint256);
    function fee() external view returns (uint256);
    function admin_fee() external view returns (uint256);

    function get_dy(uint256 i, uint256 j, uint256 dx) external view returns (uint256);
    function get_virtual_price() external view returns (uint256);

    function exchange(uint256 i, uint256 j, uint256 dx, uint256 minDy) external returns (uint256);
    function add_liquidity(uint256[] calldata amounts, uint256 minMintAmount) external returns (uint256);
    function remove_liquidity(uint256 amount, uint256[] calldata minAmounts) external returns (uint256[] memory);
    function remove_liquidity_one_coin(uint256 tokenAmount, uint256 i, uint256 minAmount) external returns (uint256);
}
