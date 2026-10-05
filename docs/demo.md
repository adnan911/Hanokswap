# Hanokswap: Dunamu Giwa Chain DEX Demo & Verification Guide

## 1. Overview
Hanokswap is the native decentralized exchange (DEX) engineered for **Dunamu's GIWA Chain** (OP Stack Layer-2 Rollup with **0.2s Flashblocks**).

- **Chain Name:** GIWA Sepolia Testnet
- **Chain ID:** `91342` (`0x164ce`)
- **Standard RPC:** `https://sepolia-rpc.giwa.io`
- **Flashblocks Sub-second RPC:** `https://sepolia-rpc-flashblocks.giwa.io`
- **Block Explorer:** `https://sepolia-explorer.giwa.io`

---

## 2. Core Implemented Features

### 1. Ultra-Fast Sub-Second Swap (0.2s Flashblocks)
- Automated Multi-Hop Smart Order Routing.
- Direct integration with `GiwaUniversalRouter` (`0xEB75E64De5b487E17F766946fb6870e81d1e3a2E`) and `GiwaPoolFactory` (`0x61B268c494949550A70bE68eE1d0142b7342C4CC`).
- Upbit KRW FX live oracle price feed proxy.

### 2. Dual Concentrated Liquidity (CLAMM) & Stableswap Pools
- **CLAMM Pool (Tick-spaced 3000 bps):** WETH / USDC (`0x8E80F917Cf7CC54bD83A746780bA93E22c173570`).
- **Deep Stableswap Pool (Stable Curve):** KRWC / USDC (`0xBA3ea5E8458938066AAb2D5b302C84D1bC689514`).
- **Forex Stableswap Pool:** USDC / EURC (`0xa2a0FB6706D356b60F62f36FA5A31865E60D72e8`).

### 3. No-Code GIWA Token Deployer (100% Real On-Chain)
- Direct bytecode deployment on GIWA Sepolia using Viem & `window.ethereum`.
- Automatic contract verification & initial liquidity seeding into `GiwaPoolFactory`.

### 4. Dunamu Dojang Attestation & `up.id` Web3 Identity
- Dunamu on-chain EAS attestation registry integration.
- `up.id` name formatting & reverse identity resolution.
- Fee rebate hook (up to 50% discount on swap fees for Dojang verified traders).

### 5. Korean Tax Exporter (국세청 NTS Hometax CSV)
- South Korean Income Tax Act (소득세법 제37조) 22% rate & basic exemption calculation.
- One-click UTF-8 BOM CSV export for Korean Excel / Hancom Office.

---

## 3. Verified Contracts on GIWA Sepolia
- **Universal Swap Router:** `0xEB75E64De5b487E17F766946fb6870e81d1e3a2E`
- **Pool Factory:** `0x61B268c494949550A70bE68eE1d0142b7342C4CC`
- **CLAMM Deployer:** `0xe1b238bfa7859e6E04a263ec2619bE490dC9449e`
- **Stableswap Deployer:** `0x258cD650E66824E77CC3A0777F40f7845dDA8F4B`
- **USDC Contract:** `0x8A2e4292823DCF10f7e3E72263A639Ee58742159`
- **KRWC Contract:** `0x9a0E572DaE28abFd0de5239c5a1Ac2b6BaaC9956`
- **EURC Contract:** `0xaB4a8f8e103E1bea55Bac9158A6e670D1cB2AdEb`
