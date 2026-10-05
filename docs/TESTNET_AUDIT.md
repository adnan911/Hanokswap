# HanokSwap GIWA Sepolia testnet audit

Date: 5 October 2026. Milestone status: **Core testnet swap foundation verified live on GIWA Sepolia**.

This comprehensive review covers the current Solidity sources, frontend transaction paths, deployment/indexer scripts, API sources, local regression suites, and live GIWA Sepolia (`Chain ID: 91342`) RPC audits.

---

## 1. Live Deployment & On-Chain Audit Evidence

The read-only probe executed against live GIWA Sepolia (`Chain ID: 91342`). See [raw RPC results](../.gsd/live-network-audit.json), [probe script](../scripts/audit-giwa.ts), and [manifest](../deployments/giwa-sepolia.json).

| Configuration / Contract | Live On-Chain Address | Verification Status |
|---|---|---|
| **GiwaPoolFactory** | `0x61B268c494949550A70bE68eE1d0142b7342C4CC` | Deployed & verified on-chain |
| **GiwaUniversalRouter** | `0xEB75E64De5b487E17F766946fb6870e81d1e3a2E` | Deployed; `factory()` & `permit2()` getters verified |
| **ProtocolFeeVault** | `0xd0dd202AAC50ad77D1B03C2143eADbC8E0E440B6` | Deployed (Fee splitter connected to Treasury) |
| **GiwaCLDeployer** | `0xe1b238bfa7859e6E04a263ec2619bE490dC9449e` | Deployed; Factory authorized |
| **GiwaStableDeployer** | `0x258cD650E66824E77CC3A0777F40f7845dDA8F4B` | Deployed; Factory authorized |
| **WETH** (Wrapped Ether) | `0x4200000000000000000000000000000000000006` | Live OP Stack system contract |
| **Mock USDC** (`USDC`, 6 dec) | `0x8A2e4292823DCF10f7e3E72263A639Ee58742159` | Deployed; Faucet enabled; 10M minted |
| **Mock EURC** (`EURC`, 6 dec) | `0xaB4a8f8e103E1bea55Bac9158A6e670D1cB2AdEb` | Deployed; Faucet enabled; 10M minted |
| **Mock KRWC** (`KRWC`, 6 dec) | `0x9a0E572DaE28abFd0de5239c5a1Ac2b6BaaC9956` | Deployed; Faucet enabled; 10M minted |
| **Mock USYC** (`USYC`, 6 dec) | `0x9C4A6983B4497cdAE566Aab1b9E2Fc29d6eF40F2` | Deployed; Faucet enabled; 10M minted |
| **Pool: WETH / USDC** | `0x8E80F917Cf7CC54bD83A746780bA93E22c173570` | CLAMM (0.30% fee); Price initialized |
| **Pool: USDC / EURC** | `0xa2a0FB6706D356b60F62f36FA5A31865E60D72e8` | Stableswap (0.01% fee); Seeded with 100k liquidity |
| **Pool: USDC / KRWC** | `0xBA3ea5E8458938066AAb2D5b302C84D1bC689514` | Stableswap (0.01% fee); Seeded with 100k liquidity |

### Empirical Swap Proof
- **Live Swap Execution**: Tested via `scripts/test-live-swap.cjs`.
- **Tx Hash**: [`0x8e63c0c4983da8cd63665b1e932fcd72cb087752b9c14805085eeda178eeee36`](https://sepolia-explorer.giwa.io/tx/0x8e63c0c4983da8cd63665b1e932fcd72cb087752b9c14805085eeda178eeee36)
- **Block**: `37830648`
- **Result**: Swapped 100 USDC for 99.98901 EURC with on-chain balance confirmation.

---

## 2. Official GIWA Configuration Comparison

| Component / Contract | Official Address / Spec | Current HanokSwap State |
|---|---|---|
| **L1StandardBridge** | `0x77b2ffc0F57598cAe1DB76cb398059cF5d10A7E7` | Synced with official registry |
| **L1CrossDomainMessenger** | `0x23ce19ED800fbbC964B9350b01B9113a8508D3F1` | Synced with official registry |
| **OptimismPortal** | `0x956962C34687A954e611A83619ABaA37Ce6bC78A` | Synced with official registry |
| **Flashblocks RPC** | `https://sepolia-rpc-flashblocks.giwa.io` | Configured with 200ms preconfirmation disclaimer |
| **Dojang Registry** | `0xd5077b67dcb56caC8b270C7788FC3E6ee03F17B9` | Targeted for official EAS adapter integration |

---

## 3. Verified Security Fixes Completed in Source

| Area | Issue & Vulnerability Patched | Evidence / Test |
|---|---|---|
| **Router custody** | Public sweeps/unwraps and unfinished swap functions reverted explicitly. | Passing contract regressions |
| **Routing & Permit2** | Enforce exact input token match, valid recipient, non-zero amount, and connected hops. | Passing contract regressions |
| **Partial fills** | CL partial fills atomically reverted to prevent stranding funds. | Rollback / allowance tests |
| **Transfer accounting** | Balance delta verification prevents deficit from fee-on-transfer tokens. | Passing taxed-transfer tests |
| **Stable fees** | Factory fee multiplier corrected to match pool denominator (`10^10`). Tier 100 = 0.01%. | On-chain swap & quote tests |
| **Custom identity** | Replaced mock authentication flags; requires true verification and valid nonces. | Dojang regression suite |
| **Swap Execution** | Real ABI encoding, slippage estimation, approval verification, and receipt tracking. | Frontend test suite |

---

## 4. Full Audit Verification Matrix

| Verification Check | Status | Details |
|---|---|---|
| `npm run test:contracts` | **PASS (19/19)** | Dojang ecosystem, Router security, fee scaling, transfer taxes, partial fills |
| `npm run test:frontend` | **PASS (8/8)** | Multihop encoding, slippage arithmetic, signature rejection, reverted tx handling, indexer chunk failure safety |
| `npm run build` | **PASS** | TypeScript typechecking and Vite production bundling succeed |
| `npm run lint` | **PASS (0 errors)** | 33 style/hook warnings, zero fatal errors |
| `scripts/audit-giwa.ts` | **PASS** | 100% agreement on deployed bytecode across all live contracts & tokens |
| Live On-Chain Swap | **PASS** | Confirmed on block 37830648 |

---

## 5. Remaining Items & Development Priorities

| Priority | Module | Description | Action Required |
|---|---|---|---|
| **High** | Official Dojang Integration | Replace local EAS mock addresses with official registry `0xd5077b67dcb56caC8b270C7788FC3E6ee03F17B9`. | Implement read-only `isVerified(address, bytes32)` adapter in frontend. |
| **High** | CLAMM Position Manager | CL pool global fee growth & position tracking. | Build position manager contract and add tick crossing & liquidity tests. |
| **Medium** | Launchpad Bonding Curve | Net reserve calculation after fees and pool graduation migration. | Implement reserve solvency logic and LP share escrow. |
| **Medium** | ALM Vault Economics | Vault valuation logic for non-1:1 pairs (WETH/USDC). | Define share pricing model and rebalance tests before opening deposits. |
| **Low** | Frontend Cleanup | 33 ESLint hook dependency warnings. | Clean up memoization and effect dependencies. |
