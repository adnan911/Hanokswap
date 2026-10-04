# Hanokswap

Decentralized exchange prototype for the **GIWA Sepolia Testnet** (`Chain ID: 91342`). GIWA provides approximately 200ms Flashblocks preconfirmations; these are not final settlement.

**Launch status:** not ready for a public testnet launch. Identity, limit orders, DCA, launches, farming, and governance UI currently include local simulations and placeholder addresses. See [the testnet audit](docs/TESTNET_AUDIT.md) for verified fixes, limitations, and development priorities.

## Features
- **Swap execution:** ABI-encoded routes, pool/token deployment checks, approvals, on-chain simulation, and receipt validation. Current configured stablecoin addresses are undeployed, so these pairs are blocked.
- **Token deployer preview:** Local simulation; real ERC-20 deployment and launch migration are not connected.
- **Liquidity:** CLAMM and stableswap contract prototypes. UI stable deposits require real deployments; CL positions require a position manager and are blocked.
- **ETH bridge & faucet:** Source-chain bridge submission with simulation and receipts; official faucet links. L2 withdrawals still need external proving/finalization, and ERC-20 bridge mappings are not configured.
- **Developer Documentation & Guide:** Complete interactive setup guide with RPC parameters, smart contract ABIs, and code snippets (Foundry, Hardhat, viem).
- **Bilingual Experience:** Seamless instant toggle between English and Korean (`한국어`).

## Network Configuration
- **Network Name:** GIWA Sepolia Testnet
- **Chain ID:** `91342` (`0x164ce`)
- **Native Currency:** `ETH` (18 decimals)
- **Flashblocks RPC (200ms):** `https://sepolia-rpc-flashblocks.giwa.io`
- **Standard RPC:** `https://sepolia-rpc.giwa.io`
- **Explorer:** [https://sepolia-explorer.giwa.io](https://sepolia-explorer.giwa.io)

## Getting Started

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build
```
