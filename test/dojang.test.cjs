const assert = require("node:assert");
const ethers = require('./support/ethers.cjs');

describe("Giwa Dojang & up.id Ecosystem", function () {
  let schemaBook, dojangScroll, upIdRegistry, hook, pool, faucet, tokenA, tokenB;
  let owner, dunamuAttester, alice, bob;
  let kycSchemaUID, vipSchemaUID, projectSchemaUID;

  beforeEach(async function () {
    [owner, dunamuAttester, alice, bob] = await ethers.getSigners();

    // 1. Deploy SchemaBook
    const SchemaBook = await ethers.getContractFactory("SchemaBook");
    schemaBook = await SchemaBook.deploy();

    // 2. Deploy DojangScroll
    const DojangScroll = await ethers.getContractFactory("DojangScroll");
    dojangScroll = await DojangScroll.deploy(await schemaBook.getAddress());

    // 3. Deploy UpIdRegistry
    const UpIdRegistry = await ethers.getContractFactory("UpIdRegistry");
    upIdRegistry = await UpIdRegistry.deploy();

    // 4. Register standard schemas
    const tx1 = await schemaBook.register(
      "bool isUpbitKYCVerified,uint8 tier,bytes32 countryCode",
      ethers.ZeroAddress,
      true
    );
    const rc1 = await tx1.wait();
    kycSchemaUID = rc1.logs[0].args[0];

    const tx2 = await schemaBook.register(
      "bool isVIPTrader,uint256 monthlyVolumeUSD",
      ethers.ZeroAddress,
      true
    );
    const rc2 = await tx2.wait();
    vipSchemaUID = rc2.logs[0].args[0];

    const tx3 = await schemaBook.register(
      "bool isDunamuVerifiedProject,string officialHandle",
      ethers.ZeroAddress,
      true
    );
    const rc3 = await tx3.wait();
    projectSchemaUID = rc3.logs[0].args[0];

    // 5. Deploy DojangAttestationHook
    const DojangAttestationHook = await ethers.getContractFactory("DojangAttestationHook");
    hook = await DojangAttestationHook.deploy(
      await dojangScroll.getAddress(),
      dunamuAttester.address,
      kycSchemaUID,
      vipSchemaUID,
      projectSchemaUID
    );

    // 6. Deploy Mock Tokens & Gated Pool
    const MockERC20 = await ethers.getContractFactory("MockERC20");
    tokenA = await MockERC20.deploy("Token A", "TKNA");
    tokenB = await MockERC20.deploy("Token B", "TKNB");

    const DojangGatedPool = await ethers.getContractFactory("DojangGatedPool");
    pool = await DojangGatedPool.deploy(
      await hook.getAddress(),
      await tokenA.getAddress(),
      await tokenB.getAddress(),
      3000
    );

    // 7. Deploy Faucet & fund with ETH
    const DojangFaucet = await ethers.getContractFactory("DojangFaucet");
    faucet = await DojangFaucet.deploy(await hook.getAddress());
    await owner.sendTransaction({
      to: await faucet.getAddress(),
      value: ethers.parseEther("5.0"),
    });
  });

  it("registers and resolves up.id names forward and reverse", async function () {
    await upIdRegistry.connect(alice).register("alice.up.id", alice.address);

    const resolved = await upIdRegistry.resolveName("alice.up.id");
    assert.strictEqual(resolved, alice.address);

    const primary = await upIdRegistry.resolveAddress(alice.address);
    assert.strictEqual(primary, "alice.up.id");
  });

  it("issues EAS attestations and applies dynamic fee discounts", async function () {
    const [initialDiscount] = await hook.getUserFeeDiscount(alice.address);
    assert.strictEqual(initialDiscount, 0n);

    // Dunamu attests alice
    const expiry = Math.floor(Date.now() / 1000) + 3600 * 24 * 365;
    const req = {
      schema: kycSchemaUID,
      data: {
        recipient: alice.address,
        expirationTime: expiry,
        revocable: true,
        refUID: ethers.ZeroHash,
        data: ethers.AbiCoder.defaultAbiCoder().encode(
          ["bool", "uint8", "bytes32"],
          [true, 1, ethers.encodeBytes32String("KR")]
        ),
        value: 0n,
      },
    };

    const tx = await dojangScroll.connect(dunamuAttester).attest(req);
    const rc = await tx.wait();
    const attUID = rc.logs[0].args[2];

    const isValid = await dojangScroll.isAttestationValid(attUID);
    assert.strictEqual(isValid, true);

    const isKYC = await hook.isKYCVerified(alice.address);
    assert.strictEqual(isKYC, true);

    const [discount, tier] = await hook.getUserFeeDiscount(alice.address);
    assert.strictEqual(discount, 2000n); // 20% discount
    assert.strictEqual(tier, "UPBIT_KYC_VERIFIED");
  });

  it("blocks unverified users from Dojang-gated compliance pool", async function () {
    await tokenA.mint(bob.address, ethers.parseEther("1000"));
    await tokenB.mint(bob.address, ethers.parseEther("1000"));

    await tokenA.connect(bob).approve(await pool.getAddress(), ethers.parseEther("1000"));
    await tokenB.connect(bob).approve(await pool.getAddress(), ethers.parseEther("1000"));

    let failed = false;
    try {
      await pool.connect(bob).addLiquidity(ethers.parseEther("10"), ethers.parseEther("10"));
    } catch (e) {
      failed = true;
    }
    assert.strictEqual(failed, true, "Unverified user should have been blocked");
  });

  it("allows verified user to claim testnet ETH from Dojang Faucet", async function () {
    // Attest alice
    const expiry = Math.floor(Date.now() / 1000) + 3600 * 24 * 365;
    const req = {
      schema: kycSchemaUID,
      data: {
        recipient: alice.address,
        expirationTime: expiry,
        revocable: true,
        refUID: ethers.ZeroHash,
        data: ethers.AbiCoder.defaultAbiCoder().encode(
          ["bool", "uint8", "bytes32"],
          [true, 1, ethers.encodeBytes32String("KR")]
        ),
        value: 0n,
      },
    };

    const tx = await dojangScroll.connect(dunamuAttester).attest(req);
    const rc = await tx.wait();
    const attUID = rc.logs[0].args[2];

    const beforeBlock = await ethers.provider.getBlockNumber();
    const preBalance = await ethers.provider.getBalance(alice.address, beforeBlock);
    const receipt = await (await faucet.connect(alice).requestWithAttestation(attUID)).wait();
    const postBalance = await ethers.provider.getBalance(alice.address, receipt.blockNumber);
    assert.strictEqual(postBalance + receipt.fee - preBalance, await faucet.DRIP_AMOUNT());
  });

  async function attestAs(issuer, verified, expiry = 0) {
    const receipt = await (await dojangScroll.connect(issuer).attest({
      schema: kycSchemaUID,
      data: { recipient: alice.address, expirationTime: expiry, revocable: true, refUID: ethers.ZeroHash,
        data: ethers.AbiCoder.defaultAbiCoder().encode(['bool', 'uint8', 'bytes32'], [verified, 1, ethers.ZeroHash]), value: 0n },
    })).wait();
    return receipt.logs[0].args[2];
  }

  it('rejects arbitrary proof-code faucet claims', async function () {
    await assert.rejects(faucet.connect(bob).requestWithProofCode(ethers.id('invented-code'), '0x'), /PROOF_CODES_UNSUPPORTED/);
  });
  it('does not treat a trusted negative attestation as verification', async function () {
    const uid = await attestAs(dunamuAttester, false);
    assert.strictEqual(await hook.isKYCVerified(alice.address), false);
    assert.strictEqual(await hook.verifyAttestation(alice.address, uid, kycSchemaUID), false);
    await assert.rejects(faucet.connect(alice).requestWithAttestation(uid));
  });
  it('does not let another issuer overwrite trusted verification', async function () {
    await attestAs(dunamuAttester, true);
    await attestAs(bob, false);
    assert.strictEqual(await hook.isKYCVerified(alice.address), true);
  });
  it('expires an attestation at its exact expiry timestamp', async function () {
    const block = await ethers.provider.getBlock('latest');
    const expiry = block.timestamp + 60;
    const uid = await attestAs(dunamuAttester, true, expiry);
    await ethers.provider.send('evm_setNextBlockTimestamp', [expiry]);
    await ethers.provider.send('evm_mine', []);
    assert.strictEqual(await dojangScroll.isAttestationValid(uid), false);
  });
  it('rejects failed token transfers without creating fake gated reserves', async function () {
    await attestAs(dunamuAttester, true);
    const falseToken = await (await ethers.getContractFactory('AuditFalseToken')).deploy();
    const guarded = await (await ethers.getContractFactory('DojangGatedPool')).deploy(await hook.getAddress(), await falseToken.getAddress(), await tokenB.getAddress(), 3000);
    await assert.rejects(guarded.connect(alice).addLiquidity(100n, 100n), /TransferFrom failed/);
    assert.strictEqual(await guarded.reserve0(), 0n);
    assert.strictEqual(await guarded.reserve1(), 0n);
  });
});
