// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "../interfaces/IProtocolFeeVault.sol";

interface IERC20Transferable {
    function balanceOf(address account) external view returns (uint256);
    function transfer(address recipient, uint256 amount) external returns (bool);
}

/// @title ProtocolFeeVault
/// @notice Manages protocol fee accumulation and automated distribution on Giwa Chain.
/// @dev Default split: 70% Liquidity Providers, 20% Protocol-Owned Liquidity (POL) Treasury, 10% Burn / Staking.
contract ProtocolFeeVault is IProtocolFeeVault {
    address public owner;
    address public override treasury;

    uint256 public override lpShareBps = 7000;       // 70.00%
    uint256 public override treasuryShareBps = 2000; // 20.00%
    uint256 public override burnShareBps = 1000;     // 10.00%
    uint256 public constant BPS_DENOMINATOR = 10000;

    address public constant DEAD_ADDRESS = 0x000000000000000000000000000000000000dEaD;

    modifier onlyOwner() {
        require(msg.sender == owner, "FeeVault: FORBIDDEN");
        _;
    }

    constructor(address _treasury) {
        require(_treasury != address(0), "FeeVault: ZERO_ADDRESS");
        owner = msg.sender;
        treasury = _treasury;
    }

    function setTreasury(address _newTreasury) external override onlyOwner {
        require(_newTreasury != address(0), "FeeVault: ZERO_ADDRESS");
        treasury = _newTreasury;
        emit TreasuryUpdated(_newTreasury);
    }

    function setShares(
        uint256 _lpBps,
        uint256 _treasuryBps,
        uint256 _burnBps
    ) external override onlyOwner {
        require(_lpBps + _treasuryBps + _burnBps == BPS_DENOMINATOR, "FeeVault: INVALID_SUM");
        lpShareBps = _lpBps;
        treasuryShareBps = _treasuryBps;
        burnShareBps = _burnBps;
        emit SharesUpdated(_lpBps, _treasuryBps, _burnBps);
    }

    function distributeFees(address token)
        external
        override
        returns (uint256 lpAmount, uint256 treasuryAmount, uint256 burnAmount)
    {
        uint256 balance = IERC20Transferable(token).balanceOf(address(this));
        require(balance > 0, "FeeVault: NO_FEES_TO_DISTRIBUTE");

        treasuryAmount = (balance * treasuryShareBps) / BPS_DENOMINATOR;
        burnAmount = (balance * burnShareBps) / BPS_DENOMINATOR;
        lpAmount = balance - treasuryAmount - burnAmount;

        if (treasuryAmount > 0) {
            _safeTransfer(token, treasury, treasuryAmount);
        }
        if (burnAmount > 0) {
            _safeTransfer(token, DEAD_ADDRESS, burnAmount);
        }
        // lpAmount is retained for dynamic LP reward streaming or routed to gauge distributor

        emit FeesDistributed(token, lpAmount, treasuryAmount, burnAmount);
    }

    function _safeTransfer(address token, address to, uint256 value) private {
        (bool success, bytes memory data) = token.call(
            abi.encodeWithSelector(IERC20Transferable.transfer.selector, to, value)
        );
        require(success && (data.length == 0 || abi.decode(data, (bool))), "FeeVault: TRANSFER_FAILED");
    }

    function transferOwnership(address newOwner) external onlyOwner {
        require(newOwner != address(0), "FeeVault: ZERO_ADDRESS");
        owner = newOwner;
    }
}
