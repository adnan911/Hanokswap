// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "../libraries/TransientReentrancyGuard.sol";

interface IERC20Reward {
    function balanceOf(address account) external view returns (uint256);
    function transfer(address recipient, uint256 amount) external returns (bool);
    function transferFrom(address sender, address recipient, uint256 amount) external returns (bool);
}

interface IVeHanokBoost {
    function balanceOf(address addr) external view returns (uint256);
    function totalLocked() external view returns (uint256);
}

/// @title HanokMultiRewardFarming (Multi-Reward LP Staking & veHANOK 2.5x Booster)
/// @notice Streams multiple tokens ($HANOK, $GIWA, $KRWC) to LP stakers with veHANOK yield boosting.
contract HanokMultiRewardFarming is TransientReentrancyGuard {
    struct RewardToken {
        address token;
        uint256 rewardRatePerSec;
        uint256 accRewardPerShare;
        uint256 lastUpdateTime;
    }

    struct UserInfo {
        uint256 amount;
        mapping(uint256 => uint256) rewardDebt;
        mapping(uint256 => uint256) pendingRewards;
    }

    address public immutable lpToken;
    address public immutable veHanok;
    address public owner;

    uint256 public totalStaked;
    RewardToken[] public rewardTokens;
    mapping(address => UserInfo) public userInfo;

    event Staked(address indexed user, uint256 amount);
    event Withdrawn(address indexed user, uint256 amount);
    event RewardClaimed(address indexed user, uint256 indexed rewardIndex, uint256 amount);
    event RewardTokenAdded(address indexed token, uint256 rewardRatePerSec);

    constructor(address _lpToken, address _veHanok) {
        lpToken = _lpToken;
        veHanok = _veHanok;
        owner = msg.sender;
    }

    modifier onlyOwner() {
        require(msg.sender == owner, "Only owner");
        _;
    }

    function addRewardToken(address _token, uint256 _ratePerSec) external onlyOwner {
        rewardTokens.push(RewardToken({
            token: _token,
            rewardRatePerSec: _ratePerSec,
            accRewardPerShare: 0,
            lastUpdateTime: block.timestamp
        }));
        emit RewardTokenAdded(_token, _ratePerSec);
    }

    function rewardTokensLength() external view returns (uint256) {
        return rewardTokens.length;
    }

    /// @notice Update accumulated rewards for all streaming reward tokens
    function updatePool() public {
        if (totalStaked == 0) {
            for (uint256 i = 0; i < rewardTokens.length; i++) {
                rewardTokens[i].lastUpdateTime = block.timestamp;
            }
            return;
        }

        for (uint256 i = 0; i < rewardTokens.length; i++) {
            RewardToken storage rt = rewardTokens[i];
            uint256 timePassed = block.timestamp - rt.lastUpdateTime;
            if (timePassed > 0) {
                uint256 rewardAmount = timePassed * rt.rewardRatePerSec;
                rt.accRewardPerShare += (rewardAmount * 1e18) / totalStaked;
                rt.lastUpdateTime = block.timestamp;
            }
        }
    }

    /// @notice Calculate user boost multiplier based on veHANOK balance (1.0x to 2.5x)
    function getUserBoost(address user) public view returns (uint256) {
        if (veHanok == address(0)) return 10000; // 1.0x
        uint256 veBal = IVeHanokBoost(veHanok).balanceOf(user);
        if (veBal == 0) return 10000; // 1.0x baseline

        // Boost formula: 1.0x + (1.5x * (veBal / 10000e18)), capped at 25000 (2.5x)
        uint256 bonus = (veBal * 15000) / 10000e18;
        uint256 boost = 10000 + bonus;
        return boost > 25000 ? 25000 : boost;
    }

    /// @notice Stake LP tokens to start farming multi-rewards
    function stake(uint256 amount) external nonReentrant {
        require(amount > 0, "Zero stake");
        updatePool();

        UserInfo storage u = userInfo[msg.sender];

        // Settle pending rewards
        if (u.amount > 0) {
            uint256 boost = getUserBoost(msg.sender);
            for (uint256 i = 0; i < rewardTokens.length; i++) {
                uint256 pending = ((u.amount * rewardTokens[i].accRewardPerShare) / 1e18) - u.rewardDebt[i];
                uint256 boostedPending = (pending * boost) / 10000;
                u.pendingRewards[i] += boostedPending;
            }
        }

        totalStaked += amount;
        u.amount += amount;

        for (uint256 i = 0; i < rewardTokens.length; i++) {
            u.rewardDebt[i] = (u.amount * rewardTokens[i].accRewardPerShare) / 1e18;
        }

        require(IERC20Reward(lpToken).transferFrom(msg.sender, address(this), amount), "Transfer failed");
        emit Staked(msg.sender, amount);
    }

    /// @notice Withdraw staked LP tokens and update reward states
    function withdraw(uint256 amount) external nonReentrant {
        UserInfo storage u = userInfo[msg.sender];
        require(amount > 0 && u.amount >= amount, "Invalid withdraw amount");
        updatePool();

        uint256 boost = getUserBoost(msg.sender);
        for (uint256 i = 0; i < rewardTokens.length; i++) {
            uint256 pending = ((u.amount * rewardTokens[i].accRewardPerShare) / 1e18) - u.rewardDebt[i];
            uint256 boostedPending = (pending * boost) / 10000;
            u.pendingRewards[i] += boostedPending;
        }

        u.amount -= amount;
        totalStaked -= amount;

        for (uint256 i = 0; i < rewardTokens.length; i++) {
            u.rewardDebt[i] = (u.amount * rewardTokens[i].accRewardPerShare) / 1e18;
        }

        require(IERC20Reward(lpToken).transfer(msg.sender, amount), "Transfer failed");
        emit Withdrawn(msg.sender, amount);
    }

    /// @notice Claim all accumulated multi-token rewards
    function claimRewards() external nonReentrant {
        updatePool();
        UserInfo storage u = userInfo[msg.sender];
        uint256 boost = getUserBoost(msg.sender);

        for (uint256 i = 0; i < rewardTokens.length; i++) {
            uint256 pending = ((u.amount * rewardTokens[i].accRewardPerShare) / 1e18) - u.rewardDebt[i];
            uint256 totalReward = u.pendingRewards[i] + ((pending * boost) / 10000);

            if (totalReward > 0) {
                u.pendingRewards[i] = 0;
                u.rewardDebt[i] = (u.amount * rewardTokens[i].accRewardPerShare) / 1e18;
                IERC20Reward(rewardTokens[i].token).transfer(msg.sender, totalReward);
                emit RewardClaimed(msg.sender, i, totalReward);
            }
        }
    }
}
