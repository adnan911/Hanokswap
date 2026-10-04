# Audit verification journal

## 2 October 2026 — GIWA Sepolia review

Scope finalized in SPEC.md from the user's request to audit everything for a testnet launch. Existing working-tree modifications were preserved; no remote deployment or transaction was sent.

Observed evidence:

- `npm run test:contracts`: exit 0, `19 passing (20s)`. Covers router custody, permit mismatch, disconnected routes, partial-fill rollback, fee-on-transfer input, stable fee scaling, trusted issuer/true flag/expiry, faucet proof rejection and failed token transfers.
- `npm run test:frontend`: exit 0, `tests 8`, `pass 8`, `fail 0`. Covers encoded swap tuples/native input, bigint minimum output, invalid amounts, rejected signing, reverted receipts, bridge constants, factory event decode and failed log chunks.
- `npx hardhat run scripts/deploy-hardhat.cjs --network hardhat`: exit 0. Deployed mock tokens, CL/stable deployers, factory and router; created both pool types in the ephemeral local network. This is not evidence of GIWA deployment or funded pools.
- `npm run build`: TypeScript and Vite pass; `4763 modules transformed`, `built in 10.88s` in a completed run. Final copy-only changes checked again. Warnings: dependency pure annotations and bundles above 500 kB; main bundle about 1.16 MB before gzip.
- `npm run lint`: exit 0, `33 problems (0 errors, 33 warnings)`. Warnings include unused prototype imports and hook dependencies; these remain report items.
- `git diff --check`: exit 0; Windows CRLF conversion notices only.
- Read-only GIWA RPC: exact output in live-network-audit.json, checked 2026-10-01T19:30:51.782Z. Configured stablecoins, custom Dojang, DCA and launchpad have no code. Existing router's `permit2()` reverts while `factory()` matches configured factory. Presence of pool/factory code is not source-equivalence or liquidity evidence.
- Browser: swap displays `Illustrative estimate (not a live quote)` and `Preconfirmation`; pool summary changed to `0` active pools and `₩0` TVL instead of simulated ALM values. Faucet displays `USDC (not connected)`, `Open Playground` and `Does not verify identity or change official faucet limits`. Screenshots in evidence/.

During final verification, TypeScript caught an unused mock attestation import after removing synthetic token deployment. Removed the import and reran the build successfully. A browser check exposed stale stablecoin allocation/identity-limit promises; corrected the copy and captured the final state.

Limitations: Foundry unavailable; no Foundry/fuzz/invariant results, deployed-bytecode comparison, live wallet flow, bridge destination settlement, backend credential integration or external audit. Final conclusions and unresolved findings are in ../docs/TESTNET_AUDIT.md. Testnet launch remains blocked; source fixes alone do not patch existing deployments.
