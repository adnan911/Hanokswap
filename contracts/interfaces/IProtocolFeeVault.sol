// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title IProtocolFeeVault
/// @notice Interface for the Protocol Fee Splitter (70% LPs, 20% POL Treasury, 10% Buyback/Burn).
interface IProtocolFeeVault {
    event FeesDistributed(address indexed token, uint256 lpShare, uint256 treasuryShare, uint256 burnShare);
    event TreasuryUpdated(address indexed newTreasury);
    event SharesUpdated(uint256 lpBps, uint256 treasuryBps, uint256 burnBps);

    function lpShareBps() external view returns (uint256);
    function treasuryShareBps() external view returns (uint256);
    function burnShareBps() external view returns (uint256);
    function treasury() external view returns (address);

    function distributeFees(address token) external returns (uint256 lpAmount, uint256 treasuryAmount, uint256 burnAmount);
    function setShares(uint256 _lpBps, uint256 _treasuryBps, uint256 _burnBps) external;
    function setTreasury(address _newTreasury) external;
}
