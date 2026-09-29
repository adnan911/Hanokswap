// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title EmergencyGuardian
/// @notice Multi-Sig circuit breaker contract allowing granular pool pause and emergency stop without freezing the entire protocol.
contract EmergencyGuardian {
    address public multiSigAdmin;
    mapping(address => bool) public isPoolPaused;
    mapping(address => bool) public isGuardian;

    event PoolPaused(address indexed pool, address indexed triggeredBy);
    event PoolUnpaused(address indexed pool, address indexed triggeredBy);
    event GuardianStatusSet(address indexed guardian, bool active);
    event MultiSigAdminUpdated(address indexed newAdmin);

    modifier onlyAdmin() {
        require(msg.sender == multiSigAdmin, "Guardian: FORBIDDEN_ADMIN");
        _;
    }

    modifier onlyGuardianOrAdmin() {
        require(msg.sender == multiSigAdmin || isGuardian[msg.sender], "Guardian: FORBIDDEN_GUARDIAN");
        _;
    }

    constructor(address _multiSigAdmin) {
        require(_multiSigAdmin != address(0), "Guardian: ZERO_ADMIN");
        multiSigAdmin = _multiSigAdmin;
    }

    function setGuardian(address guardian, bool active) external onlyAdmin {
        require(guardian != address(0), "Guardian: ZERO_ADDRESS");
        isGuardian[guardian] = active;
        emit GuardianStatusSet(guardian, active);
    }

    function pausePool(address pool) external onlyGuardianOrAdmin {
        require(!isPoolPaused[pool], "Guardian: ALREADY_PAUSED");
        isPoolPaused[pool] = true;
        emit PoolPaused(pool, msg.sender);
    }

    function unpausePool(address pool) external onlyAdmin {
        require(isPoolPaused[pool], "Guardian: NOT_PAUSED");
        isPoolPaused[pool] = false;
        emit PoolUnpaused(pool, msg.sender);
    }

    function setMultiSigAdmin(address newAdmin) external onlyAdmin {
        require(newAdmin != address(0), "Guardian: ZERO_ADMIN");
        multiSigAdmin = newAdmin;
        emit MultiSigAdminUpdated(newAdmin);
    }
}
