// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "./DojangAttestationHook.sol";

/// @title DojangFaucet
/// @notice Sybil-Resistant Giwa Sepolia Testnet Faucet gated by Dunamu Dojang Attestations.
contract DojangFaucet {
    DojangAttestationHook public immutable hook;
    address public owner;

    uint256 public constant DRIP_AMOUNT = 0.05 ether;
    uint256 public constant COOLDOWN = 1 days;

    mapping(address => uint256) public lastDripTime;
    mapping(bytes32 => bool) public usedProofCodes;

    event Drip(address indexed recipient, uint256 amount);
    event Funded(address indexed sender, uint256 amount);

    error SybilCheckFailed();
    error FaucetCooldownActive();
    error InsufficientFaucetBalance();
    error CodeAlreadyUsed();

    constructor(address _hook) {
        require(_hook != address(0), "Zero hook address");
        hook = DojangAttestationHook(_hook);
        owner = msg.sender;
    }

    receive() external payable {
        emit Funded(msg.sender, msg.value);
    }

    /// @notice Request testnet ETH using on-chain Dojang KYC Attestation
    function requestWithAttestation(bytes32 attestationUID) external {
        if (!hook.verifyAttestation(msg.sender, attestationUID, hook.kycSchemaUID()) && !hook.isKYCVerified(msg.sender)) {
            revert SybilCheckFailed();
        }

        _executeDrip(msg.sender);
    }

    /// @notice Request testnet ETH using a one-time cryptographic proof code issued by Upbit VerifyCodeResolver
    function requestWithProofCode(bytes32, bytes calldata) external pure {
        // No proof-code issuer/domain/signature validation is configured.
        // Arbitrary hashes must never bypass the attestation gate.
        revert("Faucet: PROOF_CODES_UNSUPPORTED");
    }

    function _executeDrip(address recipient) internal {
        if (block.timestamp < lastDripTime[recipient] + COOLDOWN) {
            revert FaucetCooldownActive();
        }
        if (address(this).balance < DRIP_AMOUNT) {
            revert InsufficientFaucetBalance();
        }

        lastDripTime[recipient] = block.timestamp;
        (bool sent, ) = payable(recipient).call{value: DRIP_AMOUNT}("");
        require(sent, "ETH transfer failed");

        emit Drip(recipient, DRIP_AMOUNT);
    }
}
