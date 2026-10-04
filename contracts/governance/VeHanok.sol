// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "../libraries/TransientReentrancyGuard.sol";

interface IERC20Token {
    function transfer(address to, uint256 amount) external returns (bool);
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
}

/// @title VeHanok (Voting Escrow ve(3,3) Tokenomics Engine)
/// @notice Locks HANOK governance tokens for up to 4 years to mint linear decaying voting power (veHANOK).
contract VeHanok is TransientReentrancyGuard {
    string public constant name = "Vote-Escrowed Hanok";
    string public constant symbol = "veHANOK";
    uint8 public constant decimals = 18;

    uint256 public constant WEEK = 7 days;
    uint256 public constant MAX_TIME = 4 * 365 days; // 4 years
    uint256 public constant MULTIPLIER = 10**18;

    struct LockedBalance {
        uint256 amount;
        uint256 end;
    }

    address public immutable token; // HANOK token address
    uint256 public totalLocked;
    mapping(address => LockedBalance) public locked;

    event Deposit(address indexed provider, uint256 value, uint256 locktime, uint256 timestamp);
    event Withdraw(address indexed provider, uint256 value, uint256 timestamp);

    constructor(address _token) {
        token = _token;
    }

    /// @notice Get voting power for an account at current timestamp
    function balanceOf(address addr) external view returns (uint256) {
        LockedBalance memory _locked = locked[addr];
        if (block.timestamp >= _locked.end || _locked.amount == 0) {
            return 0;
        }
        uint256 remainingTime = _locked.end - block.timestamp;
        return (_locked.amount * remainingTime) / MAX_TIME;
    }

    /// @notice Lock HANOK tokens for a designated lock duration
    function createLock(uint256 _value, uint256 _unlockTime) external nonReentrant {
        uint256 unlock_time = (_unlockTime / WEEK) * WEEK; // Round down to weekly epoch
        LockedBalance memory _locked = locked[msg.sender];

        require(_value > 0, "Zero lock value");
        require(_locked.amount == 0, "Withdraw existing lock first");
        require(unlock_time > block.timestamp, "Can only lock until future time");
        require(unlock_time <= block.timestamp + MAX_TIME, "Voting lock can be 4 years max");

        locked[msg.sender] = LockedBalance({
            amount: _value,
            end: unlock_time
        });
        totalLocked += _value;

        require(IERC20Token(token).transferFrom(msg.sender, address(this), _value), "Transfer failed");

        emit Deposit(msg.sender, _value, unlock_time, block.timestamp);
    }

    /// @notice Increase amount for existing lock
    function increaseAmount(uint256 _value) external nonReentrant {
        LockedBalance memory _locked = locked[msg.sender];
        require(_value > 0, "Zero value");
        require(_locked.amount > 0, "No existing lock");
        require(_locked.end > block.timestamp, "Lock expired");

        _locked.amount += _value;
        locked[msg.sender] = _locked;
        totalLocked += _value;

        require(IERC20Token(token).transferFrom(msg.sender, address(this), _value), "Transfer failed");

        emit Deposit(msg.sender, _value, _locked.end, block.timestamp);
    }

    /// @notice Withdraw unlocked HANOK tokens after expiration
    function withdraw() external nonReentrant {
        LockedBalance memory _locked = locked[msg.sender];
        require(block.timestamp >= _locked.end, "Lock not expired");
        uint256 value = _locked.amount;
        require(value > 0, "Zero locked balance");

        locked[msg.sender] = LockedBalance(0, 0);
        totalLocked -= value;

        require(IERC20Token(token).transfer(msg.sender, value), "Transfer failed");

        emit Withdraw(msg.sender, value, block.timestamp);
    }
}
