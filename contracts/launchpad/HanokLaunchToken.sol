// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title HanokLaunchToken (Anti-Snipe & Max-Wallet Protected ERC-20)
/// @notice Production-grade token template with built-in Max-Wallet (1-2%), Max-TX (0.5%), and block anti-sniper cooldown.
contract HanokLaunchToken {
    string public name;
    string public symbol;
    uint8 public immutable decimals;
    uint256 public immutable totalSupply;

    address public owner;
    address public dexPair;
    bytes32 public dojangAttestationUID;

    uint256 public maxWalletLimit;
    uint256 public maxTxLimit;
    uint256 public cooldownSeconds = 30; // 30 second cooldown during launch phase
    bool public limitsInEffect = true;

    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;
    mapping(address => uint256) public lastTxTimestamp;
    mapping(address => bool) public isExcludedFromLimits;

    event Transfer(address indexed from, address indexed to, uint256 value);
    event Approval(address indexed owner, address indexed spender, uint256 value);
    event LimitsDisabled();

    constructor(
        string memory _name,
        string memory _symbol,
        uint8 _decimals,
        uint256 _initialSupply,
        uint256 _maxWalletBps, // e.g. 100 = 1.00%
        uint256 _maxTxBps,     // e.g. 50 = 0.50%
        bytes32 _dojangUID
    ) {
        name = _name;
        symbol = _symbol;
        decimals = _decimals;
        totalSupply = _initialSupply * 10**_decimals;
        owner = msg.sender;
        dojangAttestationUID = _dojangUID;

        maxWalletLimit = (totalSupply * _maxWalletBps) / 10000;
        maxTxLimit = (totalSupply * _maxTxBps) / 10000;

        isExcludedFromLimits[msg.sender] = true;
        isExcludedFromLimits[address(this)] = true;

        balanceOf[msg.sender] = totalSupply;
        emit Transfer(address(0), msg.sender, totalSupply);
    }

    modifier onlyOwner() {
        require(msg.sender == owner, "Only owner");
        _;
    }

    function setDexPair(address _pair) external onlyOwner {
        dexPair = _pair;
        isExcludedFromLimits[_pair] = true;
    }

    function disableLimits() external onlyOwner {
        limitsInEffect = false;
        emit LimitsDisabled();
    }

    function transfer(address to, uint256 amount) external returns (bool) {
        _transfer(msg.sender, to, amount);
        return true;
    }

    function approve(address spender, uint256 amount) external returns (bool) {
        allowance[msg.sender][spender] = amount;
        emit Approval(msg.sender, spender, amount);
        return true;
    }

    function transferFrom(address from, address to, uint256 amount) external returns (bool) {
        uint256 allowed = allowance[from][msg.sender];
        if (allowed != type(uint256).max) {
            require(allowed >= amount, "Insufficient allowance");
            allowance[from][msg.sender] = allowed - amount;
        }
        _transfer(from, to, amount);
        return true;
    }

    function _transfer(address from, address to, uint256 amount) internal {
        require(from != address(0), "Transfer from zero");
        require(to != address(0), "Transfer to zero");
        require(balanceOf[from] >= amount, "Insufficient balance");

        if (limitsInEffect) {
            if (!isExcludedFromLimits[from] && !isExcludedFromLimits[to]) {
                require(amount <= maxTxLimit, "Exceeds Max TX limit");
                require(balanceOf[to] + amount <= maxWalletLimit, "Exceeds Max Wallet limit");
                require(block.timestamp >= lastTxTimestamp[from] + cooldownSeconds, "Anti-snipe cooldown active");
                lastTxTimestamp[from] = block.timestamp;
            }
        }

        balanceOf[from] -= amount;
        balanceOf[to] += amount;
        emit Transfer(from, to, amount);
    }
}
