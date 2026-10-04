# HanokSwap GIWA Sepolia testnet audit

Date: 2 October 2026 (Asia/Dhaka). Decision: **not ready for a public testnet launch**.

This review covers the current Solidity sources, frontend transaction paths, deployment/indexer scripts, API sources and related project documentation. It includes local regression tests, a local deployment smoke test, browser checks and read-only GIWA RPC checks. It is not a formal external security audit or a guarantee of safety. Existing uncommitted project work was preserved; no GIWA deployment or wallet transaction was sent.

## Live deployment evidence

The read-only probe at `2026-10-01T19:30:51.782Z` used chain 91342. See [raw RPC results](../.gsd/live-network-audit.json) and [probe script](../scripts/audit-giwa.ts).

| Configuration | Address | Observation |
|---|---|---|
| Factory | `0xde7e4fdaaef35680adb15f026a5087801366c316` | Code exists |
| Router | `0xb8b68746130e71b9f9d7b6af2a69d221ecc7e78f` | Code exists; factory agrees; `permit2()` reverts |
| WETH/USDC pool | `0xE9c27006b15E681C0edE87a37Bbb678E7F201F7C` | Code exists |
| USDC/EURC pool | `0xd618c9bFED8DdfB7Eed03450940B62E2E3cb91b1` | Code exists |
| WETH | `0x4200000000000000000000000000000000000006` | Code exists |
| USDC | `0x3600000000000000000000000000000000000000` | **No code** |
| EURC | `0x89B50855Aa3bE2F677cD6303Cec089B5F319D72a` | **No code** |
| KRWC | `0x89C0000000000000000000000000000000000001` | **No code** |
| Custom DojangScroll | `0x89C1000000000000000000000000000000000002` | **No code** |
| DCA streamer | `0x89C2000000000000000000000000000000000002` | **No code** |
| Launchpad | `0x89C5000000000000000000000000000000000001` | **No code** |

Code presence does not establish initialized pools, reserves, source verification or matching runtime bytecode. The router read demonstrates an ABI mismatch with the updated source. Existing deployments have not acquired the fixes below. Pool addresses referring to nonexistent tokens cannot support the advertised swaps.

## Official GIWA comparison

The official [contract registry](https://docs.giwa.io/network-information/contracts) supplies infrastructure contracts, not HanokSwap's own deployments. Corrected the repository's L1 bridge constants to:

| Contract | Official address |
|---|---|
| L1StandardBridge | `0x77b2ffc0F57598cAe1DB76cb398059cF5d10A7E7` |
| L1CrossDomainMessenger | `0x23ce19ED800fbbC964B9350b01B9113a8508D3F1` |
| OptimismPortal | `0x956962C34687A954e611A83619ABaA37Ce6bC78A` |

The previous values identified different infrastructure contracts. The [Flashblocks documentation](https://docs.giwa.io/giwa-chain/en/network-information/flashblocks) describes 200 ms preconfirmations; these are not finality. Public RPCs are rate limited and intended for development. UI finality claims were corrected.

Official [Dojang contracts](https://docs.giwa.io/giwa-chain/en/giwa-ecosystem/dojang/contracts) list DojangScroll at `0xd5077b67dcb56caC8b270C7788FC3E6ee03F17B9`. Its [verified-address API](https://docs.giwa.io/giwa-chain/en/giwa-ecosystem/dojang/verified-address) uses attester IDs with `isVerified(address,bytes32)` and `getVerifiedAddressAttestationUid(address,bytes32)`. The local prototype has a different ABI: replacing its address alone would break calls. Implement an adapter against the official API before representing any real verification.

The [official faucet guide](https://docs.giwa.io/get-started/faucets) and [Playground guide](https://docs.giwa.io/get-started/giwa-playground) do not establish the repository's USDC/EURC/KRWC addresses or promised allocations. Faucet buttons now open the official service and do not claim a mint occurred. L2 withdrawal initiation is not completed bridging: [GIWA bridging documentation](https://docs.giwa.io/giwa-chain/en/get-started/bridging/eth) requires the subsequent proof/finalization workflow and challenge period.

## Fixes completed in source

| Area | Bug and resulting behavior | Evidence |
|---|---|---|
| Router custody | Public sweep/unwrap could expose residual balances; unfinished swap APIs could accept funds without trading. These APIs now explicitly revert. | Contract regressions |
| Routing and Permit2 | Unchecked permit token/path connections could use the wrong asset or residual funds. Require matching input token, connected hops, deployed tokens, valid recipient and positive input. | Contract regressions |
| Partial fills | CL partial fills could strand input. Reject partial fills atomically; clear per-pool allowances after successful execution. | Rollback/allowance tests |
| Transfer accounting | Taxed input could produce accounting or custody deficits. Router and stable pool require exact balance increases; factory rejects tokens without code. | Taxed-transfer tests |
| Stable fees | Factory fee pips were multiplied by `10^6` rather than `10^4` against the stable denominator. This charged 100 times the intended fee; tier 100 now means 0.01%. | Actual pool quote test |
| Custom identity | Presence of a false attestation was treated as verified; other issuers could replace the trusted latest record. Require true verification flag and issuer-specific lookup; expiration is invalid at its exact timestamp. | Dojang regressions |
| Gated pool/faucet | Added guarded transfers/reentrancy checks; disabled arbitrary proof-code claims until a real verifier exists. | False-transfer/proof-code tests |
| Swap UI | Selector-only calldata, mock signing fallback and premature success were unsafe. Encode full multihop tuple; simulate, derive bigint minimum output, wait for approvals and successful swap receipt. Reject missing token/pool deployments. | Frontend ABI/slippage/receipt tests |
| Unsupported wallet actions | CL approval-only actions and synthetic token-deployment success were misleading. Fail before approvals/deployment; explicitly identify previews. Native output currently requires WETH. Permit2 UI execution stays unavailable pending integration. | Build/source review/browser |
| Bridge/faucet | Replaced dummy transfers and failure-as-success with encoded ETH bridge simulation/write and source receipt tracking; official faucet/Playground links submit no fake claims. ERC-20 bridging rejected without mappings. | Constants regression/build; no live bridge test |
| Pool metrics | Removed ghost KRWC pool, invented APY, lifetime-as-24h volume and simulated ALM values in live TVL. Missing token/pool code prevents listing. | Browser: TVL 0, pools 0 |
| Indexer | Factory event indexing/types were wrong, and failed chunks could be skipped while advancing. Correct event ABI and throw on incomplete fetch. | Event-decode/chunk-failure tests |
| Deployment | Updated deployer/factory/router constructor arguments, wired deployer authorization, added token-code preflight, and reconciled local Hardhat/ethers version use. | Local deployment creates both pool types |

## Remaining launch blockers

These findings remain unresolved. Severity describes the consequence if the feature is enabled, not proof that it is deployed or currently exploitable.

| Priority | Finding and location | Required action |
|---|---|---|
| Critical | Missing stablecoin deployments and router/source mismatch (`src/contracts.ts`) | Deploy clearly labelled mock stablecoins, deploy patched contracts, create/fund pools and publish a versioned manifest with chain, addresses, constructor args, deployment blocks and source verification. |
| Critical | Launchpad reserve and graduation logic (`contracts/launchpad/HanokBondingCurveLaunchpad.sol`) | `ethRaised` includes ETH already sent as fees; graduation merely sets a hardcoded address/emits an event. Implement net reserves and real pool migration/LP custody with solvency tests. Keep disabled. |
| High | Incomplete CL accounting (`contracts/core/GiwaCLPool.sol`) | Fee-growth globals are not accrued into LP positions; tick liquidity bounds/position bookkeeping need completion. Verify factory identity and build a position manager. Add fee, tick-crossing, partial-fill, burn/collect and invariant tests. Keep CL deposits disabled. |
| High | Gated liquidity cannot exit (`contracts/dojang/DojangGatedPool.sol`) | Implement owned LP shares and tested removal/redemption before enabling deposits. |
| High | Local identity differs from official Dojang (`src/lib/dojang.ts`, `src/hooks/useDojang.ts`, local contracts) | Replace browser self-issued flags and synthetic addresses with the official read-only adapter. Never authorize rebates, access or faucet limits from localStorage. |
| High | ALM values mixed assets at 1:1 (`contracts/yield/HanokALMVault.sol`) | Decimal normalization is not valuation. WETH and USDC cannot have equal unit value. Define share economics, trusted valuation and actual position/rebalance accounting before enabling. |
| High | Farming reward economics (`contracts/yield/HanokMultiRewardFarming.sol`) | Bound boosted liabilities to funded rewards; check token transfer success and exercise solvency/invariants. UI remains simulated. |
| High | Gauge weights and emergency controls (`contracts/governance/HanokGaugeController.sol`, `EmergencyGuardian.sol`) | Vote replacement subtracts current decayed power rather than stored contribution; enforce cumulative voting budget/expiry. A guardian flag must actually gate protected protocol calls. |
| High | Legacy chain/API paths (`api/rpc-proxy.js`, `api/token-metadata.js`, Circle/Arc components and chain aliases) | Isolate or remove Arc chain 5042002 paths from the GIWA release. Bind metadata signatures to content, chain and nonce/expiry; replace legacy creator checks. Test authorization and replay behavior. |
| High | Limit/DCA flows lack complete settlement (`src/lib/limitOrders.ts`, `src/lib/dca.ts`, corresponding periphery contracts) | Define funded escrow, cancellation/refunds, fee/taxed-token rules and real keepers; add execution and failure recovery tests before enabling writes. |
| Medium | Quote engines are illustrative (`src/lib/sor.ts`, `src/lib/giwaFlashblocks.ts`) | Hardcoded rates and pure arithmetic are not pending-state RPC quotes. Implement an actual quoter and cancellation of stale responses, and show quote age. Current execution simulates, but preview price is not executable price. |
| Medium | Indexer completeness (`scripts/indexer-worker.ts`, `src/lib/indexer.ts`) | Add stable swaps, reorg handling, timestamped 24h windows, deployment-based start blocks and a real continuous worker. Current fixes prevent silently skipping failed chunks, not all indexing failures. |
| Medium | Bridge lifecycle (`src/components/GiwaBridge.tsx`) | Track destination receipt and withdrawal proof/finalization, or route completion through an official bridge. Current confirmation means source transaction only. |
| Medium | Backend resilience and frontend debt | Test proxy path allowlists/timeouts/rate limits and fail-closed sensitive APIs. Resolve hook dependency warnings; use secure collision-resistant Permit2 nonces before integration; split large frontend bundles. |

Stable pool pricing/imbalance behavior also needs invariant and economic testing. Decimal rates alone do not justify a USD/EUR parity assumption. Passing the fee regression is not validation of the entire AMM.

## Validation and limitations

| Check | Result |
|---|---|
| `npm run test:contracts` | 19 passing; local Hardhat |
| `npm run test:frontend` | 8 passing; ABI, slippage, signer rejection, receipts, official constants and indexer regressions |
| `npm run build` | Pass; TypeScript and Vite production build |
| `npm run lint` | Exit 0; 0 errors, 33 warnings |
| `npx hardhat run scripts/deploy-hardhat.cjs --network hardhat` | Pass; mock tokens and both engine pools created locally |
| `git diff --check` | Exit 0; only Windows line-ending notices |
| GIWA RPC | Read-only code/getter evidence above |
| Browser | Swap preview identifies illustrative output/preconfirmation; pools show no fake live TVL; faucet identifies unconnected stablecoins and local identity |

Foundry was unavailable, so `.t.sol` suites/fuzzing were not run. No formal invariant suite, external audit, live wallet swaps, destination bridge settlement, backend credential integrations, load test or deployed-bytecode equivalence check was completed. Solidity compilation uses Hardhat; local deployment success is not GIWA launch evidence. Build warns about chunks above 500 kB and dependency annotation handling. Regression tests cover specified cases, not every economic or malicious-token behavior.

Visual evidence: [swap](../.gsd/evidence/swap-preview.jpg), [pools](../.gsd/evidence/pools-preview.jpg), [faucet](../.gsd/evidence/faucet-preview.jpg).

## What to develop next

1. **Stable swap testnet foundation.** Ship one tested stable pair with mock tokens clearly labelled test-only. Publish and automatically validate the manifest. Initialize/fund pools and verify runtime sources. Require successful small swap, deposit and withdrawal receipts before opening to testers.
2. **Trustworthy transaction experience.** Real executable quote, quote age, slippage/deadline, source/destination chain indication, approval receipt handling and transaction history. Add bridge completion status or an official completion link.
3. **Reliable data.** Reorg-aware indexer, measured reserves/TVL, real 24h volume and fee yield. No sample values in live metrics.
4. **Official Dojang reader.** Start with a verified-address badge tied to the official attester ID. Add protocol gating only after ABI, revocation, issuer and expiry tests pass.
5. **Concentrated liquidity.** Complete fee accounting and position management; test economics/invariants before the first public deposit.
6. **Advanced features.** Implement orders/DCA keepers, then launchpad migration, then ALM/farming/gauges with funded reward and solvency tests. Keep these as clearly labelled previews until each is verified.

For the first release, choose whether the intended stable pair is USD/USD mocks or USD/EUR mocks: the latter needs explicit exchange-rate economics. Official GIWA docs cannot supply HanokSwap deployment transactions or prove its pools match this source. Public deployment addresses/hashes and a test-only liquidity budget will be needed at deployment time; private keys are not needed for review.

## Folder documentation reviewed

Reviewed the root README, SECURITY, deployment/config files, contracts README, API and product/risk/terms/privacy material, `docs/GIWA_DEX_PRODUCTION_PLAN.md`, `docs/GIWA_DEX_MISSING_FEATURES_AND_DOJANG_SPEC.md`, and demo material. Much of the root documentation describes the former Arc/Circle architecture; implementation checkmarks are not deployment evidence. README and historical contract/security notices now distinguish that material from GIWA readiness. Before public launch, rewrite the user guide and risk disclosures for the exact enabled features and verified deployments. No legal-policy validation was performed.
