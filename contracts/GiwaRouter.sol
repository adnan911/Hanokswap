// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./interfaces/IGiwaPool.sol";
import "./interfaces/IGiwaFactory.sol";

interface IWETH {
    function deposit() external payable;
    function transfer(address to, uint256 value) external returns (bool);
    function withdraw(uint256) external;
}

/// @title GiwaRouter
/// @notice Universal Router for executing multi-hop swaps and liquidity provisioning on Giwa Chain.
contract GiwaRouter {
    address public immutable factory;
    address public immutable WETH;

    modifier ensure(uint256 deadline) {
        require(deadline >= block.timestamp, "GiwaRouter: EXPIRED");
        _;
    }

    constructor(address _factory, address _WETH) {
        factory = _factory;
        WETH = _WETH;
    }

    receive() external payable {
        assert(msg.sender == WETH); // Only accept ETH via fallback from the WETH contract
    }

    function _safeTransferFrom(address token, address from, address to, uint256 value) internal {
        (bool success, bytes memory data) = token.call(
            abi.encodeWithSelector(0x23b872dd, from, to, value)
        );
        require(success && (data.length == 0 || abi.decode(data, (bool))), "GiwaRouter: TRANSFER_FROM_FAILED");
    }

    function _safeTransfer(address token, address to, uint256 value) internal {
        (bool success, bytes memory data) = token.call(
            abi.encodeWithSelector(0xa9059cbb, to, value)
        );
        require(success && (data.length == 0 || abi.decode(data, (bool))), "GiwaRouter: TRANSFER_FAILED");
    }

    function _safeTransferETH(address to, uint256 value) internal {
        (bool success, ) = to.call{value: value}(new bytes(0));
        require(success, "GiwaRouter: ETH_TRANSFER_FAILED");
    }

    // ==========================================
    // LIQUIDITY PROVISIONING
    // ==========================================

    function addLiquidity(
        address tokenA,
        address tokenB,
        bool isStable,
        uint256 feeBps,
        uint256 amountADesired,
        uint256 amountBDesired,
        uint256 amountAMin,
        uint256 amountBMin,
        address to,
        uint256 deadline
    ) external ensure(deadline) returns (uint256 amountA, uint256 amountB, uint256 liquidity) {
        address pool = IGiwaFactory(factory).getPool(tokenA, tokenB, isStable);
        if (pool == address(0)) {
            pool = IGiwaFactory(factory).createPool(tokenA, tokenB, isStable, feeBps);
        }

        (uint256 reserveA, uint256 reserveB, ) = IGiwaPool(pool).getReserves();
        if (reserveA == 0 && reserveB == 0) {
            (amountA, amountB) = (amountADesired, amountBDesired);
        } else {
            uint256 amountBOptimal = (amountADesired * reserveB) / reserveA;
            if (amountBOptimal <= amountBDesired) {
                require(amountBOptimal >= amountBMin, "GiwaRouter: INSUFFICIENT_B_AMOUNT");
                (amountA, amountB) = (amountADesired, amountBOptimal);
            } else {
                uint256 amountAOptimal = (amountBDesired * reserveA) / reserveB;
                assert(amountAOptimal <= amountADesired);
                require(amountAOptimal >= amountAMin, "GiwaRouter: INSUFFICIENT_A_AMOUNT");
                (amountA, amountB) = (amountAOptimal, amountBDesired);
            }
        }

        _safeTransferFrom(tokenA, msg.sender, pool, amountA);
        _safeTransferFrom(tokenB, msg.sender, pool, amountB);
        liquidity = IGiwaPool(pool).mint(to);
    }

    function addLiquidityETH(
        address token,
        bool isStable,
        uint256 feeBps,
        uint256 amountTokenDesired,
        uint256 amountTokenMin,
        uint256 amountETHMin,
        address to,
        uint256 deadline
    ) external payable ensure(deadline) returns (uint256 amountToken, uint256 amountETH, uint256 liquidity) {
        address pool = IGiwaFactory(factory).getPool(token, WETH, isStable);
        if (pool == address(0)) {
            pool = IGiwaFactory(factory).createPool(token, WETH, isStable, feeBps);
        }

        (uint256 reserveToken, uint256 reserveETH, ) = IGiwaPool(pool).getReserves();
        if (reserveToken == 0 && reserveETH == 0) {
            (amountToken, amountETH) = (amountTokenDesired, msg.value);
        } else {
            uint256 amountETHOptimal = (amountTokenDesired * reserveETH) / reserveToken;
            if (amountETHOptimal <= msg.value) {
                require(amountETHOptimal >= amountETHMin, "GiwaRouter: INSUFFICIENT_ETH_AMOUNT");
                (amountToken, amountETH) = (amountTokenDesired, amountETHOptimal);
            } else {
                uint256 amountTokenOptimal = (msg.value * reserveToken) / reserveETH;
                assert(amountTokenOptimal <= amountTokenDesired);
                require(amountTokenOptimal >= amountTokenMin, "GiwaRouter: INSUFFICIENT_TOKEN_AMOUNT");
                (amountToken, amountETH) = (amountTokenOptimal, msg.value);
            }
        }

        _safeTransferFrom(token, msg.sender, pool, amountToken);
        IWETH(WETH).deposit{value: amountETH}();
        assert(IWETH(WETH).transfer(pool, amountETH));
        liquidity = IGiwaPool(pool).mint(to);

        if (msg.value > amountETH) {
            _safeTransferETH(msg.sender, msg.value - amountETH);
        }
    }

    function removeLiquidity(
        address tokenA,
        address tokenB,
        bool isStable,
        uint256 liquidity,
        uint256 amountAMin,
        uint256 amountBMin,
        address to,
        uint256 deadline
    ) public ensure(deadline) returns (uint256 amountA, uint256 amountB) {
        address pool = IGiwaFactory(factory).getPool(tokenA, tokenB, isStable);
        require(pool != address(0), "GiwaRouter: POOL_NOT_FOUND");
        _safeTransferFrom(pool, msg.sender, pool, liquidity);
        (uint256 amount0, uint256 amount1) = IGiwaPool(pool).burn(to);
        (address token0, ) = tokenA < tokenB ? (tokenA, tokenB) : (tokenB, tokenA);
        (amountA, amountB) = tokenA == token0 ? (amount0, amount1) : (amount1, amount0);
        require(amountA >= amountAMin, "GiwaRouter: INSUFFICIENT_A_AMOUNT");
        require(amountB >= amountBMin, "GiwaRouter: INSUFFICIENT_B_AMOUNT");
    }

    function removeLiquidityETH(
        address token,
        bool isStable,
        uint256 liquidity,
        uint256 amountTokenMin,
        uint256 amountETHMin,
        address to,
        uint256 deadline
    ) public ensure(deadline) returns (uint256 amountToken, uint256 amountETH) {
        (amountToken, amountETH) = removeLiquidity(
            token,
            WETH,
            isStable,
            liquidity,
            amountTokenMin,
            amountETHMin,
            address(this),
            deadline
        );
        _safeTransfer(token, to, amountToken);
        IWETH(WETH).withdraw(amountETH);
        _safeTransferETH(to, amountETH);
    }

    // ==========================================
    // SWAP ROUTING
    // ==========================================

    function swapExactTokensForTokens(
        uint256 amountIn,
        uint256 amountOutMin,
        address[] calldata path,
        bool[] calldata isStablePath,
        address to,
        uint256 deadline
    ) external ensure(deadline) returns (uint256[] memory amounts) {
        amounts = getAmountsOut(amountIn, path, isStablePath);
        require(amounts[amounts.length - 1] >= amountOutMin, "GiwaRouter: INSUFFICIENT_OUTPUT_AMOUNT");

        address firstPool = IGiwaFactory(factory).getPool(path[0], path[1], isStablePath[0]);
        require(firstPool != address(0), "GiwaRouter: POOL_NOT_FOUND");
        _safeTransferFrom(path[0], msg.sender, firstPool, amounts[0]);

        _swap(amounts, path, isStablePath, to);
    }

    function swapExactETHForTokens(
        uint256 amountOutMin,
        address[] calldata path,
        bool[] calldata isStablePath,
        address to,
        uint256 deadline
    ) external payable ensure(deadline) returns (uint256[] memory amounts) {
        require(path[0] == WETH, "GiwaRouter: INVALID_PATH");
        amounts = getAmountsOut(msg.value, path, isStablePath);
        require(amounts[amounts.length - 1] >= amountOutMin, "GiwaRouter: INSUFFICIENT_OUTPUT_AMOUNT");

        IWETH(WETH).deposit{value: amounts[0]}();
        address firstPool = IGiwaFactory(factory).getPool(path[0], path[1], isStablePath[0]);
        require(firstPool != address(0), "GiwaRouter: POOL_NOT_FOUND");
        assert(IWETH(WETH).transfer(firstPool, amounts[0]));

        _swap(amounts, path, isStablePath, to);
    }

    function swapExactTokensForETH(
        uint256 amountIn,
        uint256 amountOutMin,
        address[] calldata path,
        bool[] calldata isStablePath,
        address to,
        uint256 deadline
    ) external ensure(deadline) returns (uint256[] memory amounts) {
        require(path[path.length - 1] == WETH, "GiwaRouter: INVALID_PATH");
        amounts = getAmountsOut(amountIn, path, isStablePath);
        require(amounts[amounts.length - 1] >= amountOutMin, "GiwaRouter: INSUFFICIENT_OUTPUT_AMOUNT");

        address firstPool = IGiwaFactory(factory).getPool(path[0], path[1], isStablePath[0]);
        require(firstPool != address(0), "GiwaRouter: POOL_NOT_FOUND");
        _safeTransferFrom(path[0], msg.sender, firstPool, amounts[0]);

        _swap(amounts, path, isStablePath, address(this));
        IWETH(WETH).withdraw(amounts[amounts.length - 1]);
        _safeTransferETH(to, amounts[amounts.length - 1]);
    }

    function _swap(
        uint256[] memory amounts,
        address[] memory path,
        bool[] memory isStablePath,
        address _to
    ) internal {
        for (uint256 i = 0; i < path.length - 1; i++) {
            (address input, address output) = (path[i], path[i + 1]);
            address pool = IGiwaFactory(factory).getPool(input, output, isStablePath[i]);
            address token0 = IGiwaPool(pool).token0();
            uint256 amountOut = amounts[i + 1];
            (uint256 amount0Out, uint256 amount1Out) = input == token0 ? (uint256(0), amountOut) : (amountOut, uint256(0));
            address recipient = i < path.length - 2
                ? IGiwaFactory(factory).getPool(output, path[i + 2], isStablePath[i + 1])
                : _to;
            IGiwaPool(pool).swap(amount0Out, amount1Out, recipient, new bytes(0));
        }
    }

    function getAmountsOut(
        uint256 amountIn,
        address[] memory path,
        bool[] memory isStablePath
    ) public view returns (uint256[] memory amounts) {
        require(path.length >= 2, "GiwaRouter: INVALID_PATH");
        amounts = new uint256[](path.length);
        amounts[0] = amountIn;
        for (uint256 i = 0; i < path.length - 1; i++) {
            address pool = IGiwaFactory(factory).getPool(path[i], path[i + 1], isStablePath[i]);
            require(pool != address(0), "GiwaRouter: POOL_NOT_FOUND");
            amounts[i + 1] = IGiwaPool(pool).getAmountOut(amounts[i], path[i]);
        }
    }
}
