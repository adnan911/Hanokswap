# Hanokswap

Next-generation decentralized exchange and token launchpad engineered for the **GIWA Sepolia Testnet** (`Chain ID: 91342`). Powered by OP Stack Layer 2 and 0.2s sub-second Flashblocks finality.

## Features
- **0.2s Flashblocks DEX:** Ultra-low latency swap with minimal slippage across Giwa testnet assets (ETH, WETH, USDC, KRWC, EURC, USYC).
- **1-Click ERC-20 Token Deployer:** Launch custom tokens directly onto Giwa Sepolia with live preview, auto-wallet watch asset integration, and local registry.
- **Concentrated Liquidity & Stableswap Pools:** Factory & Router supporting CLAMM (Uni V3 model) and Stableswap (Curve model).
- **Testnet Bridge & Faucet:** Native L1 Sepolia ⇄ L2 Giwa Sepolia standard bridge with built-in 1-click testnet token faucet.
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
