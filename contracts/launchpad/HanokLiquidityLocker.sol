// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "../libraries/TransientReentrancyGuard.sol";

interface IERC20Lockable {
    function balanceOf(address account) external view returns (uint256);
    function transfer(address recipient, uint256 amount) external returns (bool);
    function transferFrom(address sender, address recipient, uint256 amount) external returns (bool);
}

/// @title HanokLiquidityLocker (Cryptographic LP Token Locker & Burner)
/// @notice Secures DEX liquidity with verifiable time-locks (3M, 6M, 1Y, 2Y) and permanent LP burns to protect users from rug-pulls.
contract HanokLiquidityLocker is TransientReentrancyGuard {
    address public constant DEAD_ADDRESS = 0x000000000000000000000000000000000000dEaD;

    struct LockRecord {
        uint256 lockId;
        address lpToken;
        address owner;
        uint256 amount;
        uint256 unlockTimestamp;
        bool isBurntPermanently;
        bool isWithdrawn;
        string projectName;
    }

    uint256 public nextLockId = 1;
    mapping(uint256 => LockRecord) public locks;
    mapping(address => uint256[]) public userLockIds;
    mapping(address => uint256[]) public poolLockIds;

    event LiquidityLocked(
        uint256 indexed lockId,
        address indexed lpToken,
        address indexed owner,
        uint256 amount,
        uint256 unlockTimestamp,
        bool isBurnt,
        string projectName
    );
    event LiquidityWithdrawn(uint256 indexed lockId, address indexed owner, uint256 amount);

    /// @notice Lock LP tokens for a specified duration
    function lockLiquidity(
        address _lpToken,
        uint256 _amount,
        uint256 _unlockTimestamp,
        bool _burnPermanently,
        string memory _projectName
    ) external nonReentrant returns (uint256 lockId) {
        require(_amount > 0, "Zero amount");
        if (!_burnPermanently) {
            require(_unlockTimestamp > block.timestamp + 30 days, "Min lock 30 days");
        }

        lockId = nextLockId++;
        address lockOwner = _burnPermanently ? DEAD_ADDRESS : msg.sender;

        locks[lockId] = LockRecord({
            lockId: lockId,
            lpToken: _lpToken,
            owner: lockOwner,
            amount: _amount,
            unlockTimestamp: _burnPermanently ? type(uint256).max : _unlockTimestamp,
            isBurntPermanently: _burnPermanently,
            isWithdrawn: false,
            projectName: _projectName
        });

        userLockIds[msg.sender].push(lockId);
        poolLockIds[_lpToken].push(lockId);

        address destination = _burnPermanently ? DEAD_ADDRESS : address(this);
        require(IERC20Lockable(_lpToken).transferFrom(msg.sender, destination, _amount), "Transfer failed");

        emit LiquidityLocked(lockId, _lpToken, lockOwner, _amount, locks[lockId].unlockTimestamp, _burnPermanently, _projectName);
    }

    /// @notice Withdraw unlocked LP tokens after maturity
    function withdraw(uint256 _lockId) external nonReentrant {
        LockRecord storage record = locks[_lockId];
        require(!record.isBurntPermanently, "Permanently burnt LP");
        require(!record.isWithdrawn, "Already withdrawn");
        require(msg.sender == record.owner, "Only owner");
        require(block.timestamp >= record.unlockTimestamp, "Lock not matured");

        record.isWithdrawn = true;
        require(IERC20Lockable(record.lpToken).transfer(msg.sender, record.amount), "Transfer failed");

        emit LiquidityWithdrawn(_lockId, msg.sender, record.amount);
    }

    /// @notice Verify lock status for DEX project badges
    function getPoolLockSummary(address _lpToken) external view returns (
        uint256 totalLockedAmount,
        bool hasActiveLock,
        bool hasPermanentBurn,
        uint256 longestUnlockTimestamp
    ) {
        uint256[] memory ids = poolLockIds[_lpToken];
        for (uint256 i = 0; i < ids.length; i++) {
            LockRecord memory rec = locks[ids[i]];
            if (!rec.isWithdrawn) {
                totalLockedAmount += rec.amount;
                hasActiveLock = true;
                if (rec.isBurntPermanently) {
                    hasPermanentBurn = true;
                }
                if (rec.unlockTimestamp > longestUnlockTimestamp && !rec.isBurntPermanently) {
                    longestUnlockTimestamp = rec.unlockTimestamp;
                }
            }
        }
    }
}
