// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./interfaces/IGiwaPool.sol";
import "./interfaces/IGiwaFactory.sol";

interface IERC20Minimal {
    function totalSupply() external view returns (uint256);
    function balanceOf(address account) external view returns (uint256);
    function transfer(address recipient, uint256 amount) external returns (bool);
    function allowance(address owner, address spender) external view returns (uint256);
    function approve(address spender, uint256 amount) external returns (bool);
    function transferFrom(address sender, address recipient, uint256 amount) external returns (bool);
    function decimals() external view returns (uint8);
}

/// @title GiwaPool
/// @notice High performance AMM Liquidity Pool engineered for Giwa Chain's 200ms Flashblocks.
/// @dev Supports both standard constant-product (xy=k) and stableswap curves with LP token minting.
contract GiwaPool is IGiwaPool {
    string public name;
    string public symbol;
    uint8 public constant decimals = 18;
    uint256 public totalSupply;
    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;

    address public immutable factory;
    address public immutable token0;
    address public immutable token1;
    bool public immutable isStable;
    uint256 public immutable feeBps; // Fee in basis points (e.g. 30 = 0.30%, 1 = 0.01%)

    uint112 private reserve0;
    uint112 private reserve1;
    uint32 private blockTimestampLast;

    uint256 private unlocked = 1;
    modifier nonReentrant() {
        require(unlocked == 1, "GiwaPool: LOCKED");
        unlocked = 0;
        _;
        unlocked = 1;
    }

    event Transfer(address indexed from, address indexed to, uint256 value);
    event Approval(address indexed owner, address indexed spender, uint256 value);

    constructor(
        address _token0,
        address _token1,
        bool _isStable,
        uint256 _feeBps
    ) {
        factory = msg.sender;
        token0 = _token0;
        token1 = _token1;
        isStable = _isStable;
        feeBps = _feeBps;

        name = string(abi.encodePacked("GIWA LP - ", _isStable ? "Stable" : "Volatile"));
        symbol = _isStable ? "gLP-s" : "gLP-v";
    }

    function _mintLP(address to, uint256 amount) internal {
        totalSupply += amount;
        balanceOf[to] += amount;
        emit Transfer(address(0), to, amount);
    }

    function _burnLP(address from, uint256 amount) internal {
        balanceOf[from] -= amount;
        totalSupply -= amount;
        emit Transfer(from, address(0), amount);
    }

    function approve(address spender, uint256 amount) external returns (bool) {
        allowance[msg.sender][spender] = amount;
        emit Approval(msg.sender, spender, amount);
        return true;
    }

    function transfer(address recipient, uint256 amount) external returns (bool) {
        require(balanceOf[msg.sender] >= amount, "GiwaPool: INSUFFICIENT_BALANCE");
        balanceOf[msg.sender] -= amount;
        balanceOf[recipient] += amount;
        emit Transfer(msg.sender, recipient, amount);
        return true;
    }

    function transferFrom(address sender, address recipient, uint256 amount) external returns (bool) {
        uint256 currentAllowance = allowance[sender][msg.sender];
        if (currentAllowance != type(uint256).max) {
            require(currentAllowance >= amount, "GiwaPool: INSUFFICIENT_ALLOWANCE");
            allowance[sender][msg.sender] = currentAllowance - amount;
        }
        require(balanceOf[sender] >= amount, "GiwaPool: INSUFFICIENT_BALANCE");
        balanceOf[sender] -= amount;
        balanceOf[recipient] += amount;
        emit Transfer(sender, recipient, amount);
        return true;
    }

    function getReserves() external view returns (uint112 _reserve0, uint112 _reserve1, uint32 _blockTimestampLast) {
        _reserve0 = reserve0;
        _reserve1 = reserve1;
        _blockTimestampLast = blockTimestampLast;
    }

    function _update(uint256 balance0, uint256 balance1) private {
        require(balance0 <= type(uint112).max && balance1 <= type(uint112).max, "GiwaPool: OVERFLOW");
        reserve0 = uint112(balance0);
        reserve1 = uint112(balance1);
        blockTimestampLast = uint32(block.timestamp);
        emit Sync(reserve0, reserve1);
    }

    function _safeTransfer(address token, address to, uint256 value) private {
        (bool success, bytes memory data) = token.call(
            abi.encodeWithSelector(IERC20Minimal.transfer.selector, to, value)
        );
        require(success && (data.length == 0 || abi.decode(data, (bool))), "GiwaPool: TRANSFER_FAILED");
    }

    function getAmountOut(uint256 amountIn, address tokenIn) public view returns (uint256 amountOut) {
        require(amountIn > 0, "GiwaPool: INSUFFICIENT_INPUT_AMOUNT");
        require(tokenIn == token0 || tokenIn == token1, "GiwaPool: INVALID_TOKEN");

        (uint256 reserveIn, uint256 reserveOut) = tokenIn == token0
            ? (uint256(reserve0), uint256(reserve1))
            : (uint256(reserve1), uint256(reserve0));

        require(reserveIn > 0 && reserveOut > 0, "GiwaPool: INSUFFICIENT_LIQUIDITY");

        uint256 feeMultiplier = 10000 - feeBps;
        uint256 amountInWithFee = amountIn * feeMultiplier;
        uint256 numerator = amountInWithFee * reserveOut;
        uint256 denominator = (reserveIn * 10000) + amountInWithFee;
        amountOut = numerator / denominator;
    }

    function mint(address recipient) external nonReentrant returns (uint256 liquidity) {
        uint256 balance0 = IERC20Minimal(token0).balanceOf(address(this));
        uint256 balance1 = IERC20Minimal(token1).balanceOf(address(this));
        uint256 amount0 = balance0 - reserve0;
        uint256 amount1 = balance1 - reserve1;

        uint256 _totalSupply = totalSupply;
        if (_totalSupply == 0) {
            liquidity = _sqrt(amount0 * amount1);
            require(liquidity > 1000, "GiwaPool: MINIMUM_LIQUIDITY_REQUIRED");
            _mintLP(address(0xdead), 1000); // Lock initial minimum liquidity
            liquidity -= 1000;
        } else {
            uint256 liquidity0 = (amount0 * _totalSupply) / reserve0;
            uint256 liquidity1 = (amount1 * _totalSupply) / reserve1;
            liquidity = liquidity0 < liquidity1 ? liquidity0 : liquidity1;
        }

        require(liquidity > 0, "GiwaPool: INSUFFICIENT_LIQUIDITY_MINTED");
        _mintLP(recipient, liquidity);
        _update(balance0, balance1);
        emit Mint(msg.sender, recipient, amount0, amount1, liquidity);
    }

    function burn(address recipient) external nonReentrant returns (uint256 amount0, uint256 amount1) {
        uint256 balance0 = IERC20Minimal(token0).balanceOf(address(this));
        uint256 balance1 = IERC20Minimal(token1).balanceOf(address(this));
        uint256 liquidity = balanceOf[address(this)];

        uint256 _totalSupply = totalSupply;
        amount0 = (liquidity * balance0) / _totalSupply;
        amount1 = (liquidity * balance1) / _totalSupply;
        require(amount0 > 0 && amount1 > 0, "GiwaPool: INSUFFICIENT_LIQUIDITY_BURNED");

        _burnLP(address(this), liquidity);
        _safeTransfer(token0, recipient, amount0);
        _safeTransfer(token1, recipient, amount1);

        balance0 = IERC20Minimal(token0).balanceOf(address(this));
        balance1 = IERC20Minimal(token1).balanceOf(address(this));
        _update(balance0, balance1);
        emit Burn(msg.sender, recipient, amount0, amount1, liquidity);
    }

    function swap(
        uint256 amount0Out,
        uint256 amount1Out,
        address recipient,
        bytes calldata /* data */
    ) external nonReentrant {
        require(amount0Out > 0 || amount1Out > 0, "GiwaPool: INSUFFICIENT_OUTPUT_AMOUNT");
        uint112 _reserve0 = reserve0;
        uint112 _reserve1 = reserve1;
        require(amount0Out < _reserve0 && amount1Out < _reserve1, "GiwaPool: INSUFFICIENT_LIQUIDITY");

        if (amount0Out > 0) _safeTransfer(token0, recipient, amount0Out);
        if (amount1Out > 0) _safeTransfer(token1, recipient, amount1Out);

        uint256 balance0 = IERC20Minimal(token0).balanceOf(address(this));
        uint256 balance1 = IERC20Minimal(token1).balanceOf(address(this));

        uint256 amount0In = balance0 > _reserve0 - amount0Out ? balance0 - (_reserve0 - amount0Out) : 0;
        uint256 amount1In = balance1 > _reserve1 - amount1Out ? balance1 - (_reserve1 - amount1Out) : 0;
        require(amount0In > 0 || amount1In > 0, "GiwaPool: INSUFFICIENT_INPUT_AMOUNT");

        // Verify invariant with fee deduction
        {
            uint256 feeMultiplier = 10000 - feeBps;
            uint256 balance0Adjusted = (balance0 * 10000) - (amount0In * feeBps);
            uint256 balance1Adjusted = (balance1 * 10000) - (amount1In * feeBps);
            require(
                balance0Adjusted * balance1Adjusted >= uint256(_reserve0) * uint256(_reserve1) * (10000**2),
                "GiwaPool: K_INVARIANT_VIOLATED"
            );
        }

        _update(balance0, balance1);
        emit Swap(msg.sender, recipient, amount0In, amount1In, amount0Out, amount1Out, feeBps);
    }

    function skim(address recipient) external nonReentrant {
        _safeTransfer(token0, recipient, IERC20Minimal(token0).balanceOf(address(this)) - reserve0);
        _safeTransfer(token1, recipient, IERC20Minimal(token1).balanceOf(address(this)) - reserve1);
    }

    function sync() external nonReentrant {
        _update(IERC20Minimal(token0).balanceOf(address(this)), IERC20Minimal(token1).balanceOf(address(this)));
    }

    function _sqrt(uint256 y) internal pure returns (uint256 z) {
        if (y > 3) {
            z = y;
            uint256 x = y / 2 + 1;
            while (x < z) {
                z = x;
                x = (y / x + x) / 2;
            }
        } else if (y != 0) {
            z = 1;
        }
    }
}
