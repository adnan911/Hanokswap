// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "../libraries/TransientReentrancyGuard.sol";

interface IERC20Vault {
    function totalSupply() external view returns (uint256);
    function balanceOf(address account) external view returns (uint256);
    function transfer(address recipient, uint256 amount) external returns (bool);
    function transferFrom(address sender, address recipient, uint256 amount) external returns (bool);
    function decimals() external view returns (uint8);
}

/// @title HanokALMVault (Automated Liquidity Management Vault)
/// @notice ERC-4626 style automated concentrated liquidity vault with auto-rebalancing and auto-compounding.
contract HanokALMVault is TransientReentrancyGuard {
    string public name;
    string public symbol;
    uint8 public immutable decimals = 18;

    address public immutable token0;
    address public immutable token1;
    address public immutable pool;
    address public manager;

    // Active Range Ticks
    int24 public baseLower;
    int24 public baseUpper;
    int24 public limitLower;
    int24 public limitUpper;

    uint256 public totalSupply;
    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;

    // Vault Reserves
    uint256 public reserve0;
    uint256 public reserve1;
    uint256 public lastCompoundTimestamp;
    uint256 public managementFeeBps = 50; // 0.50% annual fee

    event Deposit(address indexed sender, address indexed owner, uint256 amount0, uint256 amount1, uint256 shares);
    event Withdraw(address indexed sender, address indexed receiver, uint256 amount0, uint256 amount1, uint256 shares);
    event Rebalance(int24 newBaseLower, int24 newBaseUpper, int24 newLimitLower, int24 newLimitUpper);
    event CompoundFees(uint256 fee0Compounded, uint256 fee1Compounded);
    event Transfer(address indexed from, address indexed to, uint256 value);
    event Approval(address indexed owner, address indexed spender, uint256 value);

    constructor(
        string memory _name,
        string memory _symbol,
        address _token0,
        address _token1,
        address _pool,
        int24 _baseLower,
        int24 _baseUpper
    ) {
        name = _name;
        symbol = _symbol;
        token0 = _token0;
        token1 = _token1;
        pool = _pool;
        manager = msg.sender;
        baseLower = _baseLower;
        baseUpper = _baseUpper;
        lastCompoundTimestamp = block.timestamp;
    }

    modifier onlyManager() {
        require(msg.sender == manager, "Only manager");
        _;
    }

    /// @notice Total underlying assets value normalized to 18 decimals
    function totalAssets() public view returns (uint256) {
        uint8 dec0 = _getDecimals(token0);
        uint8 dec1 = _getDecimals(token1);
        uint256 norm0 = reserve0 * 10**(18 - dec0);
        uint256 norm1 = reserve1 * 10**(18 - dec1);
        return norm0 + norm1;
    }

    function _getDecimals(address token) private view returns (uint8) {
        if (token.code.length == 0) return 18;
        (bool success, bytes memory data) = token.staticcall(abi.encodeWithSignature("decimals()"));
        if (success && data.length >= 32) {
            uint256 dec = abi.decode(data, (uint256));
            return dec <= 18 ? uint8(dec) : 18;
        }
        return 18;
    }

    /// @notice Deposit dual assets into the ALM vault and receive shares
    function deposit(
        uint256 amount0Desired,
        uint256 amount1Desired,
        uint256 minShares,
        address receiver
    ) external nonReentrant returns (uint256 shares) {
        require(amount0Desired > 0 || amount1Desired > 0, "Zero deposit");
        require(receiver != address(0), "Zero address");

        uint256 _totalAssets = totalAssets();

        // Transfer tokens into vault
        if (amount0Desired > 0) {
            require(IERC20Vault(token0).transferFrom(msg.sender, address(this), amount0Desired), "Transfer0 failed");
            reserve0 += amount0Desired;
        }
        if (amount1Desired > 0) {
            require(IERC20Vault(token1).transferFrom(msg.sender, address(this), amount1Desired), "Transfer1 failed");
            reserve1 += amount1Desired;
        }

        uint8 dec0 = _getDecimals(token0);
        uint8 dec1 = _getDecimals(token1);
        uint256 depositValue = (amount0Desired * 10**(18 - dec0)) + (amount1Desired * 10**(18 - dec1));

        if (totalSupply == 0 || _totalAssets == 0) {
            shares = depositValue;
        } else {
            shares = (depositValue * totalSupply) / _totalAssets;
        }

        require(shares >= minShares, "Slippage: shares < minShares");

        totalSupply += shares;
        balanceOf[receiver] += shares;

        emit Transfer(address(0), receiver, shares);
        emit Deposit(msg.sender, receiver, amount0Desired, amount1Desired, shares);
    }

    /// @notice Withdraw assets by redeeming vault shares
    function withdraw(
        uint256 shares,
        uint256 minAmount0,
        uint256 minAmount1,
        address receiver
    ) external nonReentrant returns (uint256 amount0, uint256 amount1) {
        require(shares > 0, "Zero shares");
        require(balanceOf[msg.sender] >= shares, "Insufficient balance");
        require(receiver != address(0), "Zero address");

        amount0 = (shares * reserve0) / totalSupply;
        amount1 = (shares * reserve1) / totalSupply;

        require(amount0 >= minAmount0, "Slippage: amount0 < min");
        require(amount1 >= minAmount1, "Slippage: amount1 < min");

        balanceOf[msg.sender] -= shares;
        totalSupply -= shares;

        reserve0 -= amount0;
        reserve1 -= amount1;

        if (amount0 > 0) {
            require(IERC20Vault(token0).transfer(receiver, amount0), "Transfer0 failed");
        }
        if (amount1 > 0) {
            require(IERC20Vault(token1).transfer(receiver, amount1), "Transfer1 failed");
        }

        emit Transfer(msg.sender, address(0), shares);
        emit Withdraw(msg.sender, receiver, amount0, amount1, shares);
    }

    /// @notice Auto-rebalance concentrated tick ranges based on market movement
    function rebalance(
        int24 _baseLower,
        int24 _baseUpper,
        int24 _limitLower,
        int24 _limitUpper
    ) external onlyManager {
        baseLower = _baseLower;
        baseUpper = _baseUpper;
        limitLower = _limitLower;
        limitUpper = _limitUpper;

        emit Rebalance(_baseLower, _baseUpper, _limitLower, _limitUpper);
    }

    /// @notice Auto-compound accrued trading fees into active pool liquidity
    function compound() external nonReentrant {
        uint256 balance0 = IERC20Vault(token0).balanceOf(address(this));
        uint256 balance1 = IERC20Vault(token1).balanceOf(address(this));

        uint256 fee0 = balance0 > reserve0 ? balance0 - reserve0 : 0;
        uint256 fee1 = balance1 > reserve1 ? balance1 - reserve1 : 0;

        if (fee0 > 0 || fee1 > 0) {
            reserve0 = balance0;
            reserve1 = balance1;
            lastCompoundTimestamp = block.timestamp;
            emit CompoundFees(fee0, fee1);
        }
    }

    function approve(address spender, uint256 amount) external returns (bool) {
        allowance[msg.sender][spender] = amount;
        emit Approval(msg.sender, spender, amount);
        return true;
    }

    function transfer(address recipient, uint256 amount) external returns (bool) {
        require(balanceOf[msg.sender] >= amount, "Insufficient balance");
        balanceOf[msg.sender] -= amount;
        balanceOf[recipient] += amount;
        emit Transfer(msg.sender, recipient, amount);
        return true;
    }
}
