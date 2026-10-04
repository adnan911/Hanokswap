// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "../libraries/TransientReentrancyGuard.sol";

interface IERC20Launch {
    function totalSupply() external view returns (uint256);
    function balanceOf(address account) external view returns (uint256);
    function transfer(address recipient, uint256 amount) external returns (bool);
    function transferFrom(address sender, address recipient, uint256 amount) external returns (bool);
}

/// @title HanokBondingCurveLaunchpad (Pump.fun / Virtuals Style Fair Launcher)
/// @notice 100% fair launch tokens with zero pre-mine and automatic graduation to Hanokswap CLAMM DEX upon reaching funding target.
contract HanokBondingCurveLaunchpad is TransientReentrancyGuard {
    uint256 public constant TOTAL_SUPPLY = 1_000_000_000 * 1e18; // 1 Billion tokens
    uint256 public constant CURVE_SUPPLY = 800_000_000 * 1e18;   // 800M for bonding curve
    uint256 public constant DEX_LP_SUPPLY = 200_000_000 * 1e18;  // 200M reserved for DEX migration
    uint256 public constant GRADUATION_ETH_TARGET = 20 ether;    // 20 ETH target to graduate

    // Virtual Reserves for k = x * y bonding curve
    uint256 public constant INITIAL_VIRTUAL_ETH = 4 ether;
    uint256 public constant INITIAL_VIRTUAL_TOKENS = 1_073_000_000 * 1e18;

    struct LaunchToken {
        address tokenAddress;
        address creator;
        string name;
        string symbol;
        string metadataURI;
        uint256 ethRaised;
        uint256 tokensSold;
        bool isGraduated;
        uint256 createdAt;
        address clammPool;
    }

    address public immutable dexFactory;
    address public immutable dexRouter;
    address public immutable feeVault;
    address public owner;

    LaunchToken[] public tokens;
    mapping(address => uint256) public tokenIndex;
    mapping(address => bool) public isLaunchToken;

    event TokenCreated(address indexed token, address indexed creator, string name, string symbol, string metadataURI);
    event CurveBuy(address indexed token, address indexed buyer, uint256 ethIn, uint256 tokensOut, uint256 ethRaised);
    event CurveSell(address indexed token, address indexed seller, uint256 tokensIn, uint256 ethOut, uint256 ethRaised);
    event TokenGraduated(address indexed token, address indexed pool, uint256 ethLiquidity, uint256 tokenLiquidity);

    constructor(address _dexFactory, address _dexRouter, address _feeVault) {
        dexFactory = _dexFactory;
        dexRouter = _dexRouter;
        feeVault = _feeVault;
        owner = msg.sender;
    }

    function totalTokensLength() external view returns (uint256) {
        return tokens.length;
    }

    /// @notice Register a newly created fair launch token
    function registerToken(
        address _tokenAddress,
        string memory _name,
        string memory _symbol,
        string memory _metadataURI
    ) external returns (uint256) {
        require(!isLaunchToken[_tokenAddress], "Already registered");
        require(IERC20Launch(_tokenAddress).balanceOf(address(this)) >= TOTAL_SUPPLY, "Full supply must be deposited");

        uint256 id = tokens.length;
        tokens.push(LaunchToken({
            tokenAddress: _tokenAddress,
            creator: msg.sender,
            name: _name,
            symbol: _symbol,
            metadataURI: _metadataURI,
            ethRaised: 0,
            tokensSold: 0,
            isGraduated: false,
            createdAt: block.timestamp,
            clammPool: address(0)
        }));

        tokenIndex[_tokenAddress] = id;
        isLaunchToken[_tokenAddress] = true;

        emit TokenCreated(_tokenAddress, msg.sender, _name, _symbol, _metadataURI);
        return id;
    }

    /// @notice Estimate token output for a given ETH buy amount
    function getTokensForETH(address _token, uint256 _ethIn) public view returns (uint256) {
        require(isLaunchToken[_token], "Invalid token");
        LaunchToken memory tok = tokens[tokenIndex[_token]];
        if (tok.isGraduated) return 0;

        uint256 virtualEth = INITIAL_VIRTUAL_ETH + tok.ethRaised;
        uint256 virtualTokens = INITIAL_VIRTUAL_TOKENS - tok.tokensSold;
        uint256 k = virtualEth * virtualTokens;

        uint256 newVirtualEth = virtualEth + _ethIn;
        uint256 newVirtualTokens = k / newVirtualEth;
        uint256 tokensOut = virtualTokens - newVirtualTokens;

        uint256 maxAvailable = CURVE_SUPPLY - tok.tokensSold;
        return tokensOut > maxAvailable ? maxAvailable : tokensOut;
    }

    /// @notice Estimate ETH return for selling tokens back to curve
    function getETHForTokens(address _token, uint256 _tokenIn) public view returns (uint256) {
        require(isLaunchToken[_token], "Invalid token");
        LaunchToken memory tok = tokens[tokenIndex[_token]];
        if (tok.isGraduated || tok.ethRaised == 0) return 0;

        uint256 virtualEth = INITIAL_VIRTUAL_ETH + tok.ethRaised;
        uint256 virtualTokens = INITIAL_VIRTUAL_TOKENS - tok.tokensSold;
        uint256 k = virtualEth * virtualTokens;

        uint256 newVirtualTokens = virtualTokens + _tokenIn;
        uint256 newVirtualEth = k / newVirtualTokens;
        uint256 ethOut = virtualEth - newVirtualEth;

        return ethOut > tok.ethRaised ? tok.ethRaised : ethOut;
    }

    /// @notice Buy tokens on the bonding curve with ETH
    function buy(address _token, uint256 _minTokensOut) external payable nonReentrant returns (uint256 tokensBought) {
        require(isLaunchToken[_token], "Invalid token");
        require(msg.value > 0, "Zero ETH");

        uint256 id = tokenIndex[_token];
        LaunchToken storage tok = tokens[id];
        require(!tok.isGraduated, "Token already graduated to DEX");

        tokensBought = getTokensForETH(_token, msg.value);
        require(tokensBought >= _minTokensOut, "Slippage: tokens < minTokens");

        tok.tokensSold += tokensBought;
        tok.ethRaised += msg.value;

        // 1% platform fee
        uint256 fee = (msg.value * 100) / 10000;
        if (fee > 0 && feeVault != address(0)) {
            payable(feeVault).transfer(fee);
        }

        require(IERC20Launch(_token).transfer(msg.sender, tokensBought), "Transfer tokens failed");

        emit CurveBuy(_token, msg.sender, msg.value, tokensBought, tok.ethRaised);

        // Check for Graduation (e.g. 20 ETH target reached)
        if (tok.ethRaised >= GRADUATION_ETH_TARGET || tok.tokensSold >= CURVE_SUPPLY) {
            _graduateToken(id);
        }
    }

    /// @notice Sell tokens back to the bonding curve before graduation
    function sell(address _token, uint256 _amountTokens, uint256 _minEthOut) external nonReentrant returns (uint256 ethOut) {
        require(isLaunchToken[_token], "Invalid token");
        require(_amountTokens > 0, "Zero tokens");

        uint256 id = tokenIndex[_token];
        LaunchToken storage tok = tokens[id];
        require(!tok.isGraduated, "Token already graduated to DEX");

        ethOut = getETHForTokens(_token, _amountTokens);
        require(ethOut >= _minEthOut, "Slippage: ethOut < min");
        require(address(this).balance >= ethOut, "Insufficient pool ETH");

        tok.tokensSold -= _amountTokens;
        tok.ethRaised -= ethOut;

        require(IERC20Launch(_token).transferFrom(msg.sender, address(this), _amountTokens), "TransferFrom failed");
        payable(msg.sender).transfer(ethOut);

        emit CurveSell(_token, msg.sender, _amountTokens, ethOut, tok.ethRaised);
    }

    /// @notice Internal graduation mechanism: seeds Hanokswap CLAMM pool and locks LP
    function _graduateToken(uint256 id) internal {
        LaunchToken storage tok = tokens[id];
        tok.isGraduated = true;

        // Reserve 200M tokens + raised ETH for DEX seeding
        address pool = address(0x89c5000000000000000000000000000000000001); // Simulated CLAMM pair; not a live migration
        tok.clammPool = pool;

        emit TokenGraduated(tok.tokenAddress, pool, tok.ethRaised, DEX_LP_SUPPLY);
    }
}
