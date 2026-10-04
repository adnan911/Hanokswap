// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "../interfaces/IDojangScroll.sol";

/// @title DojangAttestationHook
/// @notice Attestation Guard and Dynamic Fee Rebate Hook for Hanokswap on Giwa Chain.
contract DojangAttestationHook {
    IDojangScroll public immutable dojangScroll;
    address public owner;
    address public trustedAttester; // Dunamu Official Attester
    
    bytes32 public kycSchemaUID;
    bytes32 public vipSchemaUID;
    bytes32 public projectVerifiedSchemaUID;

    // Default fee discounts (in basis points off the standard pool fee: 10000 = 100%)
    uint256 public kycDiscountBps = 2000; // 20% discount
    uint256 public vipDiscountBps = 5000; // 50% discount

    error UnauthorizedDojangAttestation();
    error ExpiredAttestation();
    error RevokedAttestation();
    error OnlyOwner();

    event TrustedAttesterUpdated(address indexed newAttester);
    event SchemasConfigured(bytes32 kycSchema, bytes32 vipSchema, bytes32 projectSchema);
    event FeeDiscountsUpdated(uint256 kycDiscountBps, uint256 vipDiscountBps);

    modifier onlyOwner() {
        if (msg.sender != owner) revert OnlyOwner();
        _;
    }

    constructor(
        address _dojangScroll,
        address _trustedAttester,
        bytes32 _kycSchemaUID,
        bytes32 _vipSchemaUID,
        bytes32 _projectVerifiedSchemaUID
    ) {
        require(_dojangScroll != address(0), "Hook: ZERO_SCROLL");
        dojangScroll = IDojangScroll(_dojangScroll);
        trustedAttester = _trustedAttester;
        owner = msg.sender;

        kycSchemaUID = _kycSchemaUID;
        vipSchemaUID = _vipSchemaUID;
        projectVerifiedSchemaUID = _projectVerifiedSchemaUID;
    }

    function setTrustedAttester(address _attester) external onlyOwner {
        trustedAttester = _attester;
        emit TrustedAttesterUpdated(_attester);
    }

    function configureSchemas(
        bytes32 _kyc,
        bytes32 _vip,
        bytes32 _project
    ) external onlyOwner {
        kycSchemaUID = _kyc;
        vipSchemaUID = _vip;
        projectVerifiedSchemaUID = _project;
        emit SchemasConfigured(_kyc, _vip, _project);
    }

    function setFeeDiscounts(uint256 _kycDiscountBps, uint256 _vipDiscountBps) external onlyOwner {
        require(_kycDiscountBps <= 5000 && _vipDiscountBps <= 8000, "Hook: DISCOUNT_TOO_HIGH");
        kycDiscountBps = _kycDiscountBps;
        vipDiscountBps = _vipDiscountBps;
        emit FeeDiscountsUpdated(_kycDiscountBps, _vipDiscountBps);
    }

    /// @notice Verifies whether a specific attestation UID belongs to user and is valid
    function verifyAttestation(address user, bytes32 attestationUID, bytes32 expectedSchema) public view returns (bool) {
        if (trustedAttester == address(0) || expectedSchema == bytes32(0)) return false;
        if (attestationUID == bytes32(0)) return false;
        if (!dojangScroll.isAttestationValid(attestationUID)) return false;

        IDojangScroll.Attestation memory att = dojangScroll.getAttestation(attestationUID);

        if (att.recipient != user) return false;
        if (trustedAttester != address(0) && att.attester != trustedAttester) return false;
        if (expectedSchema != bytes32(0) && att.schema != expectedSchema) return false;
        if (att.expirationTime != 0 && att.expirationTime <= block.timestamp) return false;
        // These verification schemas begin with a boolean. Merely possessing
        // a record (including one explicitly stating false) is not proof.
        if (att.data.length < 32) return false;
        uint256 flag;
        bytes memory payload = att.data;
        assembly { flag := mload(add(payload, 32)) }
        if (flag != 1) return false;

        return true;
    }

    /// @notice Check if user has active KYC verification
    function isKYCVerified(address user) public view returns (bool) {
        return _hasVerifiedFlag(user, kycSchemaUID);
    }

    /// @notice Check if user has VIP status
    function isVIPTrader(address user) public view returns (bool) {
        return _hasVerifiedFlag(user, vipSchemaUID);
    }

    /// @notice Check if a deployed token or project is verified by Dunamu/Dojang
    function isProjectVerified(address tokenAddress) public view returns (bool) {
        return _hasVerifiedFlag(tokenAddress, projectVerifiedSchemaUID);
    }

    function _hasVerifiedFlag(address user, bytes32 schema) private view returns (bool) {
        if (trustedAttester == address(0) || schema == bytes32(0)) return false;
        if (!dojangScroll.hasValidAttestation(user, schema, trustedAttester)) return false;
        // Query the same issuer-specific record used by hasValidAttestation.
        bytes32 uid = dojangScroll.getAttestationUIDByAttester(user, schema, trustedAttester);
        return verifyAttestation(user, uid, schema);
    }

    /// @notice Computes dynamic fee discount for a user
    /// @return discountBps Basis points discount (e.g. 2000 = 20% off swap fee)
    /// @return tierName User's verified status string
    function getUserFeeDiscount(address user) external view returns (uint256 discountBps, string memory tierName) {
        if (isVIPTrader(user)) {
            return (vipDiscountBps, "DUNAMU_VIP_TIER");
        }
        if (isKYCVerified(user)) {
            return (kycDiscountBps, "UPBIT_KYC_VERIFIED");
        }
        return (0, "STANDARD_TIER");
    }
}
