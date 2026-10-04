// Single source of truth for every fixed Arc-native / Circle-infrastructure
// address the app uses. Before this file existed, these were copy-pasted
// into 15+ components independently — which is exactly how the app ended
// up with stale references (e.g. multiple components still pointing at
// ArcFactoryV2 v4 after v4c became the live pool-creation contract, while
// others had already moved on). Import from here instead of redeclaring
// a local constant — a future contract migration then only needs an edit
// in one place.
//
// The one thing deliberately NOT centralized here is the multi-chain
// bridge matrix (15+ testnet chains' USDC/EURC addresses, CCTP domains,
// viem chain objects) — that lives in BridgeForm.tsx as CHAIN_CONFIGS and
// is exported from there. Moving it here would mean re-importing a dozen
// viem chain definitions into this file for no real benefit; components
// that need a subset of it (e.g. UnifiedBalance.tsx) should import
// CHAIN_CONFIGS from BridgeForm.tsx instead of maintaining their own copy.

// ---- GIWA Chain (OP Stack Layer 2) System Contracts ----
export const GIWA_MULTICALL3 = "0xcA11bde05977b3631167028862bE2a173976CA11" as `0x${string}`;
export const GIWA_WETH = "0x4200000000000000000000000000000000000006" as `0x${string}`;
export const GIWA_L2_CROSS_DOMAIN_MESSENGER = "0x4200000000000000000000000000000000000007" as `0x${string}`;
export const GIWA_L2_STANDARD_BRIDGE = "0x4200000000000000000000000000000000000010" as `0x${string}`;
export const GIWA_GAS_PRICE_ORACLE = "0x420000000000000000000000000000000000000F" as `0x${string}`;
export const GIWA_L1_STANDARD_BRIDGE = "0x77b2ffc0F57598cAe1DB76cb398059cF5d10A7E7" as `0x${string}`;
export const GIWA_L1_CROSS_DOMAIN_MESSENGER = "0x23ce19ED800fbbC964B9350b01B9113a8508D3F1" as `0x${string}`;
export const GIWA_OPTIMISM_PORTAL = "0x956962C34687A954e611A83619ABaA37Ce6bC78A" as `0x${string}`;

// ---- GIWA DEX Protocol Core Contracts (Live on Giwa Sepolia Chain ID: 91342) ----
export const GIWA_DEX_FEE_VAULT = "0xe1525f69bf27890b5592ed7eb2e08bdb883d74b3" as `0x${string}`;
export const GIWA_DEX_CL_DEPLOYER = "0xcc3ff7d2392694e18fb527307d40ccdb071c7a51" as `0x${string}`;
export const GIWA_DEX_STABLE_DEPLOYER = "0xd17d149ba8f4680d141db30d56d3f98c471632c6" as `0x${string}`;
export const GIWA_DEX_FACTORY = "0xde7e4fdaaef35680adb15f026a5087801366c316" as `0x${string}`;
export const GIWA_DEX_ROUTER = "0xb8b68746130e71b9f9d7b6af2a69d221ecc7e78f" as `0x${string}`;
export const GIWA_POOL_WETH_USDC = "0xE9c27006b15E681C0edE87a37Bbb678E7F201F7C" as `0x${string}`;
export const GIWA_POOL_USDC_EURC = "0xd618c9bFED8DdfB7Eed03450940B62E2E3cb91b1" as `0x${string}`;
export const GIWA_POOL_KRWC_FX = "0x89C3000000000000000000000000000000000001" as `0x${string}`;
export const GIWA_POOL_BTC_USDC = "0x89C3000000000000000000000000000000000002" as `0x${string}`;
export const GIWA_POOL_HANOK_ETH = "0x89C3000000000000000000000000000000000003" as `0x${string}`;
export const GIWA_POOL_GIWA_USDC = "0x89C3000000000000000000000000000000000004" as `0x${string}`;


// ---- GIWA Dojang (EAS Attestation) & up.id Web3 Identity Layer ----
export const GIWA_DOJANG_SCHEMA_BOOK = "0x89C1000000000000000000000000000000000001" as `0x${string}`;
export const GIWA_DOJANG_SCROLL = "0x89C1000000000000000000000000000000000002" as `0x${string}`;
export const GIWA_UP_ID_REGISTRY = "0x89C1000000000000000000000000000000000003" as `0x${string}`;
export const GIWA_DOJANG_ATTESTATION_HOOK = "0x89C1000000000000000000000000000000000004" as `0x${string}`;
export const GIWA_DOJANG_FAUCET = "0x89C1000000000000000000000000000000000005" as `0x${string}`;
export const GIWA_DUNAMU_OFFICIAL_ATTESTER = "0x89C10000000000000000000000000000000000AA" as `0x${string}`;

// ---- GIWA Execution & Trading Periphery (Phase 2) ----
export const GIWA_PERMIT2 = "0x000000000022D473030F116dDEE9F6B43aC78BA3" as `0x${string}`;
export const GIWA_LIMIT_ORDER_BOOK = "0x89C2000000000000000000000000000000000001" as `0x${string}`;
export const GIWA_DCA_STREAMER = "0x89C2000000000000000000000000000000000002" as `0x${string}`;

// ---- GIWA Liquidity Provider & Yield Architecture (Phase 4) ----
export const GIWA_HANOK_TOKEN = "0x89C4000000000000000000000000000000000001" as `0x${string}`;
export const GIWA_VE_HANOK = "0x89C4000000000000000000000000000000000002" as `0x${string}`;
export const GIWA_GAUGE_CONTROLLER = "0x89C4000000000000000000000000000000000003" as `0x${string}`;
export const GIWA_MULTI_REWARD_FARMING = "0x89C4000000000000000000000000000000000004" as `0x${string}`;
export const GIWA_ALM_VAULT_WETH_USDC = "0x89C4000000000000000000000000000000000005" as `0x${string}`;
export const GIWA_ALM_VAULT_KRWC_USDC = "0x89C4000000000000000000000000000000000006" as `0x${string}`;

// ---- GIWA Token Launchpad & Deployer Infrastructure (Phase 5) ----
export const GIWA_BONDING_CURVE_LAUNCHPAD = "0x89C5000000000000000000000000000000000001" as `0x${string}`;
export const GIWA_LIQUIDITY_LOCKER = "0x89C5000000000000000000000000000000000002" as `0x${string}`;

// ---- GIWA Security, Governance & Risk Infrastructure (Phase 7) ----
export const GIWA_EMERGENCY_GUARDIAN = "0x89C6000000000000000000000000000000000001" as `0x${string}`;
export const GIWA_TIMELOCK_CONTROLLER = "0x89C6000000000000000000000000000000000002" as `0x${string}`;
export const GIWA_SAFE_MULTISIG = "0x89C6000000000000000000000000000000000003" as `0x${string}`; // 3-of-5 Safe
export const GIWA_PROTOCOL_FEE_VAULT = "0xe1525f69bf27890b5592ed7eb2e08bdb883d74b3" as `0x${string}`;


// Dojang EAS Standard Schema Hashes
export const DOJANG_KYC_SCHEMA_UID = "0x437cb3de8f2757c91e135c64b39934c5bd5caafb16c590b5a75606193e6186c4" as `0x${string}`;
export const DOJANG_VIP_SCHEMA_UID = "0x289fa3bc839d5b03848bfe811d73905cf784d14b43f114ad473d09a7b971a179" as `0x${string}`;
export const DOJANG_PROJECT_VERIFIED_SCHEMA_UID = "0x9ab83cf2093e0b04a80693a67d025fa890e0b355cf3c078b548b29df920f1885" as `0x${string}`;

// ---- Supported Tokens on GIWA / Multi-chain ----
export const USDC_ADDRESS = "0x3600000000000000000000000000000000000000" as `0x${string}`;
export const EURC_ADDRESS = "0x89B50855Aa3bE2F677cD6303Cec089B5F319D72a" as `0x${string}`;
export const KRWC_ADDRESS = "0x89C0000000000000000000000000000000000001" as `0x${string}`;
export const USYC_ADDRESS = "0xe9185F0c5F296Ed1797AaE4238D26CCaBEadb86C" as `0x${string}`;
export const ARCC_ADDRESS = "0x215D82093892AA24b2901aeb4fcCca933346De18" as `0x${string}`;
export const CIRBTC_ADDRESS = "0xf0C4a4CE82A5746AbAAd9425360Ab04fbBA432BF" as `0x${string}`;


// ---- Curated Giwa Pool & Protocol Instances ----
export const POOL_USDC_KRWC = "0x89C1000000000000000000000000000000000001" as `0x${string}`;
export const POOL_USDC_EURC = "0x3F0B83e551e272181e2A42144BB07E68d14bD497" as `0x${string}`;
export const POOL_USDC_CIRBTC = "0x954A5D017C9C18c27572df1644D974cB30e201Ac" as `0x${string}`;
export const POOL_EURC_CIRBTC = "0x1c80D206e692A5faf2E918693A88cFA48426F39b" as `0x${string}`;

// ---- Circle CCTP V2 (same address on every supported chain) ----
export const CCTP_TOKEN_MESSENGER = "0x8fe6b999dc680ccfdd5bf7eb0974218be2542daa" as `0x${string}`;
export const CCTP_MESSAGE_TRANSMITTER = "0xe737e5cebeeba77efe34d4aa090756590b1ce275" as `0x${string}`;

// ---- Circle Gateway (same address on every supported chain) ----
export const GATEWAY_WALLET_ADDRESS = "0x0077777d7EBA4688BDeF3E311b846F25870A19B9" as `0x${string}`;
export const GATEWAY_MINTER_ADDRESS = "0x0022222ABE238Cc2C7Bb1f21003F0a260052475B" as `0x${string}`;
