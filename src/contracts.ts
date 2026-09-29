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
export const GIWA_L1_STANDARD_BRIDGE = "0xfb81df377572C9907119Ee087dDcb1Fae3fD752C" as `0x${string}`;
export const GIWA_L1_CROSS_DOMAIN_MESSENGER = "0x6DaB826f3cF6932FB8614D00442612834873d61d" as `0x${string}`;
export const GIWA_OPTIMISM_PORTAL = "0xc0F78cB75F50685F7Ded019483687133b24C8e82" as `0x${string}`;

// ---- GIWA DEX Protocol Core Contracts (Live on Giwa Sepolia Chain ID: 91342) ----
export const GIWA_DEX_FEE_VAULT = "0xe1525f69bf27890b5592ed7eb2e08bdb883d74b3" as `0x${string}`;
export const GIWA_DEX_CL_DEPLOYER = "0xcc3ff7d2392694e18fb527307d40ccdb071c7a51" as `0x${string}`;
export const GIWA_DEX_STABLE_DEPLOYER = "0xd17d149ba8f4680d141db30d56d3f98c471632c6" as `0x${string}`;
export const GIWA_DEX_FACTORY = "0xde7e4fdaaef35680adb15f026a5087801366c316" as `0x${string}`;
export const GIWA_DEX_ROUTER = "0xb8b68746130e71b9f9d7b6af2a69d221ecc7e78f" as `0x${string}`;
export const GIWA_POOL_WETH_USDC = "0xE9c27006b15E681C0edE87a37Bbb678E7F201F7C" as `0x${string}`;
export const GIWA_POOL_USDC_EURC = "0xd618c9bFED8DdfB7Eed03450940B62E2E3cb91b1" as `0x${string}`;

// ---- Supported Tokens on GIWA / Multi-chain ----
export const USDC_ADDRESS = "0x3600000000000000000000000000000000000000" as `0x${string}`;
export const EURC_ADDRESS = "0x89B50855Aa3bE2F677cD6303Cec089B5F319D72a" as `0x${string}`;
export const KRWC_ADDRESS = "0x89C0000000000000000000000000000000000001" as `0x${string}`;
export const USYC_ADDRESS = "0xe9185F0c5F296Ed1797AaE4238D26CCaBEadb86C" as `0x${string}`;
export const ARCC_ADDRESS = "0x215D82093892AA24b2901aeb4fcCca933346De18" as `0x${string}`;
export const CIRBTC_ADDRESS = "0xf0C4a4CE82A5746AbAAd9425360Ab04fbBA432BF" as `0x${string}`;


// ---- ArcSwap ----
// Deprecated — kept only as a read-only price reference in a couple of
// screens. The live Swap UI trades against the ArcFactoryV2 v4c pool
// below (POOL_USDC_EURC), not this contract. See README.md/SECURITY.md.
export const ARC_SWAP_V5 = "0x3CD201DA3DdDF2d0E9fcBC606a32E821099dEAC1" as `0x${string}`;

// ---- Pool factories (ArcFactoryV2) ----
// v2/v3/v4/v4b are legacy — pools already created on them keep working,
// but createPool() should never be called against them again. v4c is the
// only one new pools are actually created on. All are owned by the
// 2-of-3 Safe multisig (0xa50FFedfC93eDB81F8Bcc23507db8aDdE7EE8Be0).
export const POOL_FACTORY_V2 = "0x23782643650D73b2Bb145B9145D62D743bF25CB0" as `0x${string}`;
export const POOL_FACTORY_V3 = "0x5ee0c6cc6879728a4835826D87b28702f8993559" as `0x${string}`;
export const POOL_FACTORY_V4 = "0x57B451D60F09222C2bb6c828FFE3703069A532Ed" as `0x${string}`;
export const POOL_FACTORY_V4B = "0xa42c3bDcd385350880165120fE7E72e43733f70B" as `0x${string}`;
/** The current pool factory — use this one for anything new. */
export const POOL_FACTORY_V4C = "0xD2dC496dcf4e6D8c9CFc710AC5C9A6Dc941CBbB0" as `0x${string}`;

// ---- Launch pool factory (ArcLaunchPoolFactory.sol) ----
// Permissionless, but scoped: only allows creating a (token, USDC) pool
// when the token was genuinely minted through Token Factory below (checked
// on-chain via its launchedAt() view, not just trusted). Has no owner at
// all, by design — see contracts/README.md and SECURITY.md. Not yet
// independently reviewed the way the contracts above were.
export const LAUNCH_POOL_FACTORY = "0x2b3B2E69C14DA2558E3ce6e2d58c04b2147E5ec0" as `0x${string}`;

// ---- Curated pool instances (deployed by ArcFactoryV2 v4c) ----
export const POOL_USDC_EURC = "0x3F0B83e551e272181e2A42144BB07E68d14bD497" as `0x${string}`;
export const POOL_USDC_CIRBTC = "0x954A5D017C9C18c27572df1644D974cB30e201Ac" as `0x${string}`;
export const POOL_EURC_CIRBTC = "0x1c80D206e692A5faf2E918693A88cFA48426F39b" as `0x${string}`;

// ---- ArcEscrow ----
// Deployed and verified, not yet wired into any screen.
export const ARC_ESCROW_V4 = "0xDDDe5a4E691F6ce6826CB85F09466E799FCFabfB" as `0x${string}`;

// ---- ArcTokenFactoryV2 ----
export const TOKEN_FACTORY = "0x1Fe800a2663988C043e4a9A393651f18Cd49D998" as `0x${string}`;

// ---- Circle CCTP V2 (same address on every supported chain) ----
export const CCTP_TOKEN_MESSENGER = "0x8fe6b999dc680ccfdd5bf7eb0974218be2542daa" as `0x${string}`;
export const CCTP_MESSAGE_TRANSMITTER = "0xe737e5cebeeba77efe34d4aa090756590b1ce275" as `0x${string}`;

// ---- Circle Gateway (same address on every supported chain) ----
export const GATEWAY_WALLET_ADDRESS = "0x0077777d7EBA4688BDeF3E311b846F25870A19B9" as `0x${string}`;
export const GATEWAY_MINTER_ADDRESS = "0x0022222ABE238Cc2C7Bb1f21003F0a260052475B" as `0x${string}`;
