// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface Vm {
    function warp(uint256) external;
    function prank(address) external;
    function startPrank(address) external;
    function stopPrank() external;
    function deal(address, uint256) external;
}

contract MockERC20 {
    string public name;
    string public symbol;
    uint8 public decimals = 18;
    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;

    constructor(string memory _name, string memory _symbol) {
        name = _name;
        symbol = _symbol;
    }

    function mint(address to, uint256 amount) external {
        balanceOf[to] += amount;
    }

    function approve(address spender, uint256 amount) external returns (bool) {
        allowance[msg.sender][spender] = amount;
        return true;
    }

    function transfer(address to, uint256 amount) external returns (bool) {
        require(balanceOf[msg.sender] >= amount, "balance");
        balanceOf[msg.sender] -= amount;
        balanceOf[to] += amount;
        return true;
    }

    function transferFrom(address from, address to, uint256 amount) external returns (bool) {
        require(balanceOf[from] >= amount, "balance");
        require(allowance[from][msg.sender] >= amount, "allowance");
        allowance[from][msg.sender] -= amount;
        balanceOf[from] -= amount;
        balanceOf[to] += amount;
        return true;
    }
}

import "../contracts/dojang/SchemaBook.sol";
import "../contracts/dojang/DojangScroll.sol";
import "../contracts/dojang/UpIdRegistry.sol";
import "../contracts/dojang/DojangAttestationHook.sol";
import "../contracts/dojang/DojangGatedPool.sol";
import "../contracts/dojang/DojangFaucet.sol";

contract DojangTest {
    Vm constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));

    SchemaBook schemaBook;
    DojangScroll dojangScroll;
    UpIdRegistry upIdRegistry;
    DojangAttestationHook hook;
    DojangGatedPool pool;
    DojangFaucet faucet;

    MockERC20 tokenA;
    MockERC20 tokenB;

    address dunamuAttester = address(0x1111);
    address alice = address(0x2222);
    address bob = address(0x3333);

    bytes32 kycSchemaUID;
    bytes32 vipSchemaUID;
    bytes32 projectSchemaUID;

    function setUp() public {
        schemaBook = new SchemaBook();
        dojangScroll = new DojangScroll(address(schemaBook));
        upIdRegistry = new UpIdRegistry();

        // 1. Register schemas
        kycSchemaUID = schemaBook.register("bool isUpbitKYCVerified,uint8 tier,bytes32 countryCode", address(0), true);
        vipSchemaUID = schemaBook.register("bool isVIPTrader,uint256 monthlyVolumeUSD", address(0), true);
        projectSchemaUID = schemaBook.register("bool isDunamuVerifiedProject,string officialHandle", address(0), true);

        // 2. Deploy Hook
        hook = new DojangAttestationHook(
            address(dojangScroll),
            dunamuAttester,
            kycSchemaUID,
            vipSchemaUID,
            projectSchemaUID
        );

        // 3. Deploy Tokens & Pool
        tokenA = new MockERC20("Token A", "TKNA");
        tokenB = new MockERC20("Token B", "TKNB");
        pool = new DojangGatedPool(address(hook), address(tokenA), address(tokenB), 3000);

        // 4. Deploy Faucet & fund it
        faucet = new DojangFaucet(address(hook));
        vm.deal(address(faucet), 10 ether);
    }

    function test_UpIdRegistry() public {
        vm.startPrank(alice);
        bytes32 nameHash = upIdRegistry.register("alice.up.id", alice);
        require(nameHash != bytes32(0), "Name hash zero");

        // Forward resolution
        address resolved = upIdRegistry.resolveName("alice.up.id");
        require(resolved == alice, "Forward resolution failed");

        // Reverse resolution
        string memory primary = upIdRegistry.resolveAddress(alice);
        require(keccak256(bytes(primary)) == keccak256(bytes("alice.up.id")), "Reverse resolution failed");
        vm.stopPrank();
    }

    function test_DojangAttestation_KYC_And_FeeDiscounts() public {
        // Initial fee discount should be 0
        (uint256 initialDiscount, ) = hook.getUserFeeDiscount(alice);
        require(initialDiscount == 0, "Initial discount not 0");

        // Dunamu attests Alice as KYC verified
        vm.startPrank(dunamuAttester);
        IDojangScroll.AttestationRequest memory req = IDojangScroll.AttestationRequest({
            schema: kycSchemaUID,
            data: IDojangScroll.AttestationRequestData({
                recipient: alice,
                expirationTime: uint64(block.timestamp + 365 days),
                revocable: true,
                refUID: bytes32(0),
                data: abi.encode(true, uint8(1), bytes32("KR")),
                value: 0
            })
        });

        bytes32 attUID = dojangScroll.attest(req);
        vm.stopPrank();

        require(dojangScroll.isAttestationValid(attUID), "Attestation not valid");
        require(hook.isKYCVerified(alice), "Hook does not recognize KYC");

        // Fee discount should now be 20% (2000 bps)
        (uint256 kycDiscount, string memory tier) = hook.getUserFeeDiscount(alice);
        require(kycDiscount == 2000, "KYC discount not 2000 bps");
        require(keccak256(bytes(tier)) == keccak256(bytes("UPBIT_KYC_VERIFIED")), "Wrong tier string");
    }

    function test_DojangGatedPool_Restricts_Unverified() public {
        tokenA.mint(bob, 1000 ether);
        tokenB.mint(bob, 1000 ether);

        vm.startPrank(bob);
        tokenA.approve(address(pool), 1000 ether);
        tokenB.approve(address(pool), 1000 ether);

        // Bob is unverified, adding liquidity should fail
        bool failed = false;
        try pool.addLiquidity(100 ether, 100 ether) {
            failed = false;
        } catch {
            failed = true;
        }
        require(failed, "Unverified user was allowed to add liquidity");
        vm.stopPrank();
    }

    function test_DojangFaucet_Drip() public {
        // Dunamu attests Alice
        vm.startPrank(dunamuAttester);
        IDojangScroll.AttestationRequest memory req = IDojangScroll.AttestationRequest({
            schema: kycSchemaUID,
            data: IDojangScroll.AttestationRequestData({
                recipient: alice,
                expirationTime: uint64(block.timestamp + 365 days),
                revocable: true,
                refUID: bytes32(0),
                data: abi.encode(true, uint8(1), bytes32("KR")),
                value: 0
            })
        });
        bytes32 uid = dojangScroll.attest(req);
        vm.stopPrank();

        // Alice claims faucet
        vm.prank(alice);
        faucet.requestWithAttestation(uid);

        require(alice.balance == 0.05 ether, "Alice did not receive drip");
    }
}
