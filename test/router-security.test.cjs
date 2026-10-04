const assert = require('node:assert/strict');
const ethers = require('./support/ethers.cjs');

describe('UniversalRouter security regression', function () {
  let alice, bob, a, b, c, factory, router;
  const amount = 1000n;
  async function deploy(name, ...args) { const contract = await (await ethers.getContractFactory(name)).deploy(...args); await contract.waitForDeployment(); return contract; }
  const addr = contract => contract.getAddress();
  async function single() { return { tokenIn: await addr(a), tokenOut: await addr(b), fee: 100, recipient: alice.address, deadline: 9999999999n, amountIn: amount, amountOutMinimum: 1n, sqrtPriceLimitX96: 0n, isStable: true }; }
  async function hop(x, y, stable = true) { return { tokenIn: await addr(x), tokenOut: await addr(y), fee: 100, isStable: stable, sqrtPriceLimitX96: 0n }; }
  beforeEach(async () => {
    [alice, bob] = await ethers.getSigners();
    a = await deploy('MockERC20', 'A', 'A'); b = await deploy('MockERC20', 'B', 'B'); c = await deploy('MockERC20', 'C', 'C');
    factory = await deploy('AuditFactory');
    router = await deploy('GiwaUniversalRouter', await addr(factory), await addr(a), bob.address);
    await a.mint(alice.address, amount * 10n);
    await a.approve(await addr(router), amount * 10n);
    const pool = await deploy('AuditStablePool', await addr(a), await addr(b));
    await b.mint(await addr(pool), amount * 10n);
    await factory.setPool(await addr(a), await addr(b), await addr(pool));
  });
  it('executes an encoded stable swap and clears its pool allowance', async () => {
    await (await router.exactInputSingle(await single())).wait();
    assert.equal(await b.balanceOf(alice.address), amount);
    const pool = await factory.getPool(await addr(a), await addr(b), 100, true);
    assert.equal(await a.allowance(await addr(router), pool), 0n);
    assert.equal(await a.balanceOf(await addr(router)), 0n);
  });
  it('rejects single-hop Permit2 authorization for a different token', async () => {
    const permit = { permit: { permitted: { token: await addr(c), amount }, nonce: 0n, deadline: 9999999999n }, signature: '0x' };
    await assert.rejects(router.exactInputSingleWithPermit2(await single(), permit), /PERMIT_TOKEN_MISMATCH/);
  });
  it('rejects a nonexistent output token before swapping user input', async () => {
    const params = await single(); params.tokenOut = bob.address;
    await assert.rejects(router.exactInputSingle(params), /TOKEN_NOT_CONTRACT/);
    assert.equal(await a.balanceOf(alice.address), amount * 10n);
  });
  it('rejects taxed input without spending balances already held by the router', async () => {
    const taxed = await deploy('MockFeeOnTransferERC20', 'Taxed', 'TAX');
    await taxed.mint(alice.address, amount);
    await taxed.approve(await addr(router), amount);
    const params = await single(); params.tokenIn = await addr(taxed);
    await assert.rejects(router.exactInputSingle(params), /UNSUPPORTED_TRANSFER_FEE/);
    assert.equal(await taxed.balanceOf(alice.address), amount);
  });
  it('converts the stable fee tier correctly and quotes the advertised 0.01% fee', async () => {
    const stable = await deploy('GiwaStablePool', await addr(a), await addr(b), 100, bob.address);
    assert.equal(await stable.fee(), 1000000n);
    await a.mint(alice.address, 1000000n); await b.mint(alice.address, 1000000n);
    await a.approve(await addr(stable), 1000000n); await b.approve(await addr(stable), 1000000n);
    await (await stable.add_liquidity([1000000n, 1000000n], 1n)).wait();
    const output = await stable.get_dy(0, 1, 10000n);
    assert.ok(output > 9900n && output < 10000n, `unexpected output ${output}`);
  });
  it('does not mint stable LP shares for transfer-tax deposits', async () => {
    const taxed = await deploy('MockFeeOnTransferERC20', 'Taxed', 'TAX');
    const stable = await deploy('GiwaStablePool', await addr(taxed), await addr(b), 100, bob.address);
    await taxed.mint(alice.address, amount); await b.mint(alice.address, amount);
    await taxed.approve(await addr(stable), amount); await b.approve(await addr(stable), amount);
    await assert.rejects(stable.add_liquidity([amount, amount], 1n), /UNSUPPORTED_TRANSFER_FEE/);
    assert.equal(await stable.totalSupply(), 0n);
  });
  it('rejects multi-hop Permit2 authorization for a different token', async () => {
    const permit = { permit: { permitted: { token: await addr(c), amount }, nonce: 0n, deadline: 9999999999n }, signature: '0x' };
    await assert.rejects(router.exactInputMultiHopWithPermit2({ hops: [await hop(a, b)], recipient: alice.address, deadline: 9999999999n, amountIn: amount, amountOutMinimum: 1n }, permit), /PERMIT_TOKEN_MISMATCH/);
  });
  it('rejects disconnected hops without consuming donated balances', async () => {
    await c.mint(await addr(router), amount);
    await assert.rejects(router.exactInputMultiHop({ hops: [await hop(a, b), await hop(c, b)], recipient: alice.address, deadline: 9999999999n, amountIn: amount, amountOutMinimum: 1n }), /DISCONNECTED_HOPS/);
    assert.equal(await c.balanceOf(await addr(router)), amount);
    assert.equal(await b.balanceOf(alice.address), 0n);
  });
  it('rolls back partial CL fills instead of leaving user input behind', async () => {
    const pool = await deploy('AuditPartialCLPool', await addr(a), await addr(b));
    await b.mint(await addr(pool), amount);
    await factory.setPool(await addr(a), await addr(b), await addr(pool));
    const params = await single(); params.isStable = false;
    await assert.rejects(router.exactInputSingle(params), /PARTIAL_FILL/);
    assert.equal(await a.balanceOf(alice.address), amount * 10n);
    assert.equal(await a.balanceOf(await addr(router)), 0n);
  });
  it('fails explicitly for unfinished swap APIs and public custody sweeps', async () => {
    await assert.rejects(router.exactInput({ path: '0x', recipient: alice.address, deadline: 9999999999n, amountIn: amount, amountOutMinimum: 1n }, { value: 1n }), /EXACT_INPUT_PATH_UNSUPPORTED/);
    await assert.rejects(router.exactOutputSingle({ ...await single(), amountOut: 1n, amountInMaximum: amount }), /EXACT_OUTPUT_UNSUPPORTED/);
    await a.mint(await addr(router), amount);
    await assert.rejects(router.connect(bob).sweepToken(await addr(a), 0n, bob.address), /SWEEP_UNSUPPORTED/);
    await assert.rejects(router.connect(bob).unwrapWETH9(0n, bob.address), /UNWRAP_UNSUPPORTED/);
    assert.equal(await a.balanceOf(await addr(router)), amount);
  });
});
