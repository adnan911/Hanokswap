// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title GiwaTimelockController
/// @notice 48-hour Timelock controller enforcing execution delay on administrative and fee adjustments.
contract GiwaTimelockController {
    uint256 public constant MIN_DELAY = 48 hours;
    uint256 public constant MAX_DELAY = 30 days;

    address public admin;
    uint256 public delay;

    mapping(bytes32 => bool) public queuedTransactions;

    event TransactionQueued(bytes32 indexed txHash, address indexed target, uint256 value, string signature, bytes data, uint256 eta);
    event TransactionExecuted(bytes32 indexed txHash, address indexed target, uint256 value, string signature, bytes data, uint256 eta);
    event TransactionCancelled(bytes32 indexed txHash);
    event DelayUpdated(uint256 newDelay);
    event AdminUpdated(address newAdmin);

    modifier onlyAdmin() {
        require(msg.sender == admin, "Timelock: FORBIDDEN");
        _;
    }

    modifier onlyTimelock() {
        require(msg.sender == address(this), "Timelock: CALL_MUST_COME_FROM_TIMELOCK");
        _;
    }

    constructor(address _admin, uint256 _delay) {
        require(_admin != address(0), "Timelock: ZERO_ADMIN");
        require(_delay >= MIN_DELAY && _delay <= MAX_DELAY, "Timelock: INVALID_DELAY");
        admin = _admin;
        delay = _delay;
    }

    function queueTransaction(
        address target,
        uint256 value,
        string calldata signature,
        bytes calldata data,
        uint256 eta
    ) external onlyAdmin returns (bytes32 txHash) {
        require(eta >= block.timestamp + delay, "Timelock: ETA_TOO_SOON");

        txHash = keccak256(abi.encode(target, value, signature, data, eta));
        require(!queuedTransactions[txHash], "Timelock: ALREADY_QUEUED");

        queuedTransactions[txHash] = true;
        emit TransactionQueued(txHash, target, value, signature, data, eta);
    }

    function cancelTransaction(bytes32 txHash) external onlyAdmin {
        require(queuedTransactions[txHash], "Timelock: NOT_QUEUED");
        queuedTransactions[txHash] = false;
        emit TransactionCancelled(txHash);
    }

    function executeTransaction(
        address target,
        uint256 value,
        string calldata signature,
        bytes calldata data,
        uint256 eta
    ) external payable onlyAdmin returns (bytes memory) {
        bytes32 txHash = keccak256(abi.encode(target, value, signature, data, eta));
        require(queuedTransactions[txHash], "Timelock: NOT_QUEUED");
        require(block.timestamp >= eta, "Timelock: TRANSACTION_STILL_LOCKED");
        require(block.timestamp <= eta + 14 days, "Timelock: TRANSACTION_EXPIRED");

        queuedTransactions[txHash] = false;

        bytes memory callData;
        if (bytes(signature).length == 0) {
            callData = data;
        } else {
            callData = abi.encodePacked(bytes4(keccak256(bytes(signature))), data);
        }

        (bool success, bytes memory returnData) = target.call{value: value}(callData);
        require(success, "Timelock: TRANSACTION_EXECUTION_REVERTED");

        emit TransactionExecuted(txHash, target, value, signature, data, eta);
        return returnData;
    }

    function setDelay(uint256 newDelay) external onlyTimelock {
        require(newDelay >= MIN_DELAY && newDelay <= MAX_DELAY, "Timelock: INVALID_DELAY");
        delay = newDelay;
        emit DelayUpdated(newDelay);
    }

    function setAdmin(address newAdmin) external onlyTimelock {
        require(newAdmin != address(0), "Timelock: ZERO_ADMIN");
        admin = newAdmin;
        emit AdminUpdated(newAdmin);
    }
}
