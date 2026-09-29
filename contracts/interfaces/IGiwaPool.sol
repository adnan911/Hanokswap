// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title IGiwaPool
/// @notice Interface for Giwa DEX liquidity pools supporting dynamic fee tiers and Flashblocks optimization.
interface IGiwaPool {
    event Mint(address indexed sender, address indexed recipient, uint256 amount0, uint256 amount1, uint256 liquidity);
    event Burn(address indexed sender, address indexed recipient, uint256 amount0, uint256 amount1, uint256 liquidity);
    event Swap(
        address indexed sender,
        address indexed recipient,
        uint256 amount0In,
        uint256 amount1In,
        uint256 amount0Out,
        uint256 amount1Out,
        uint256 feeBps
    );
    event Sync(uint112 reserve0, uint112 reserve1);
    event FeesCollected(address indexed recipient, uint256 amount0, uint256 amount1);

    function token0() external view returns (address);
    function token1() external view returns (address);
    function feeBps() external view returns (uint256);
    function isStable() external view returns (bool);
    function factory() external view returns (address);

    function getReserves() external view returns (uint112 reserve0, uint112 reserve1, uint32 blockTimestampLast);
    function getAmountOut(uint256 amountIn, address tokenIn) external view returns (uint256 amountOut);

    function mint(address recipient) external returns (uint256 liquidity);
    function burn(address recipient) external returns (uint256 amount0, uint256 amount1);
    function swap(uint256 amount0Out, uint256 amount1Out, address recipient, bytes calldata data) external;
    function skim(address recipient) external;
    function sync() external;
}
