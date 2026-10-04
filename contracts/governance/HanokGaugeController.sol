// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface IVeHanok {
    function balanceOf(address addr) external view returns (uint256);
}

/// @title HanokGaugeController (Weekly Gauge Emission & Fee Allocation)
/// @notice veHANOK voters vote on liquidity pool gauges to direct weekly emissions and capture 100% protocol revenue.
contract HanokGaugeController {
    uint256 public constant WEEK = 7 days;
    uint256 public constant MAX_VOTE_WEIGHT = 10000; // 100.00%

    address public immutable veHanok;
    address public admin;

    // Registered Pool Gauges
    address[] public gauges;
    mapping(address => bool) public isGauge;
    
    // Voting Weights
    // user => gauge => weight
    mapping(address => mapping(address => uint256)) public userVoteWeight;
    // user => last vote epoch
    mapping(address => uint256) public lastUserVote;
    // gauge => total weight
    mapping(address => uint256) public gaugeWeights;
    uint256 public totalWeight;

    event GaugeAdded(address indexed gauge);
    event Voted(address indexed user, address indexed gauge, uint256 weight, uint256 totalUserPower);

    constructor(address _veHanok) {
        veHanok = _veHanok;
        admin = msg.sender;
    }

    modifier onlyAdmin() {
        require(msg.sender == admin, "Only admin");
        _;
    }

    function addGauge(address _gauge) external onlyAdmin {
        require(!isGauge[_gauge], "Already gauge");
        isGauge[_gauge] = true;
        gauges.push(_gauge);
        emit GaugeAdded(_gauge);
    }

    function gaugesLength() external view returns (uint256) {
        return gauges.length;
    }

    /// @notice Cast votes for a gauge using veHANOK voting power
    function vote(address _gauge, uint256 _userWeight) external {
        require(isGauge[_gauge], "Invalid gauge");
        require(_userWeight <= MAX_VOTE_WEIGHT, "Weight > 100%");
        require(block.timestamp >= lastUserVote[msg.sender] + 1 days, "Can vote once per day");

        uint256 power = IVeHanok(veHanok).balanceOf(msg.sender);
        require(power > 0, "No veHANOK power");

        uint256 oldWeight = userVoteWeight[msg.sender][_gauge];
        if (oldWeight > 0) {
            gaugeWeights[_gauge] -= (power * oldWeight) / MAX_VOTE_WEIGHT;
            totalWeight -= (power * oldWeight) / MAX_VOTE_WEIGHT;
        }

        userVoteWeight[msg.sender][_gauge] = _userWeight;
        uint256 newPowerWeight = (power * _userWeight) / MAX_VOTE_WEIGHT;

        gaugeWeights[_gauge] += newPowerWeight;
        totalWeight += newPowerWeight;
        lastUserVote[msg.sender] = block.timestamp;

        emit Voted(msg.sender, _gauge, _userWeight, power);
    }

    /// @notice Relative weight percentage for a gauge in the current epoch
    function getGaugeRelativeWeight(address _gauge) external view returns (uint256) {
        if (totalWeight == 0) return 0;
        return (gaugeWeights[_gauge] * 1e18) / totalWeight;
    }
}
