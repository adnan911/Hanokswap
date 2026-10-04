// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import "../../test/mocks/MockERC20.sol";
import "../../test/mocks/MockWETH.sol";
import "../../test/mocks/MockFeeOnTransferERC20.sol";

contract AuditFactory {
    mapping(address => mapping(address => address)) private pools;
    function setPool(address a, address b, address pool) external { pools[a][b] = pool; pools[b][a] = pool; }
    function getPool(address a, address b, uint24, bool) external view returns (address) { return pools[a][b]; }
}

contract AuditStablePool {
    address[2] public coins;
    constructor(address a, address b) { coins = [a, b]; }
    function exchange(uint256 i, uint256 j, uint256 dx, uint256 minDy) external returns (uint256) {
        require(dx >= minDy);
        require(MockERC20(coins[i]).transferFrom(msg.sender, address(this), dx));
        require(MockERC20(coins[j]).transfer(msg.sender, dx));
        return dx;
    }
}

contract AuditPartialCLPool {
    address public token0;
    address public token1;
    constructor(address a, address b) { (token0, token1) = a < b ? (a, b) : (b, a); }
    function swap(address recipient, bool zeroForOne, int256 amount, uint160, bytes calldata) external returns (int256, int256) {
        uint256 spent = uint256(amount) / 2;
        require(MockERC20(zeroForOne ? token0 : token1).transferFrom(msg.sender, address(this), spent));
        require(MockERC20(zeroForOne ? token1 : token0).transfer(recipient, spent));
        return zeroForOne ? (int256(spent), -int256(spent)) : (-int256(spent), int256(spent));
    }
}

contract AuditFalseToken is MockERC20 {
    constructor() MockERC20("False", "FALSE") {}
    function transferFrom(address, address, uint256) external pure override returns (bool) { return false; }
}
