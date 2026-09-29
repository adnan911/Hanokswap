import fs from "fs";
import path from "path";
import {
  GIWA_DEX_FEE_VAULT,
  GIWA_DEX_CL_DEPLOYER,
  GIWA_DEX_STABLE_DEPLOYER,
  GIWA_DEX_FACTORY,
  GIWA_DEX_ROUTER,
} from "../src/contracts";

const COMPILER_VERSION = "v0.8.26+commit.8a97fa7a";

interface ContractToVerify {
  name: string;
  address: string;
  files: string[];
  constructorArgs?: string;
}

const contracts: ContractToVerify[] = [
  {
    name: "ProtocolFeeVault",
    address: GIWA_DEX_FEE_VAULT,
    files: [
      "contracts/interfaces/IProtocolFeeVault.sol",
      "contracts/governance/ProtocolFeeVault.sol",
    ],
  },
  {
    name: "GiwaCLDeployer",
    address: GIWA_DEX_CL_DEPLOYER,
    files: [
      "contracts/interfaces/IGiwaPoolDeployer.sol",
      "contracts/interfaces/IGiwaCLPool.sol",
      "contracts/libraries/TransientReentrancyGuard.sol",
      "contracts/libraries/FullMath.sol",
      "contracts/libraries/TickMath.sol",
      "contracts/libraries/SqrtPriceMath.sol",
      "contracts/libraries/SwapMath.sol",
      "contracts/libraries/TickBitmap.sol",
      "contracts/libraries/SafeCast.sol",
      "contracts/core/GiwaCLPool.sol",
      "contracts/core/GiwaCLDeployer.sol",
    ],
  },
  {
    name: "GiwaStableDeployer",
    address: GIWA_DEX_STABLE_DEPLOYER,
    files: [
      "contracts/interfaces/IGiwaPoolDeployer.sol",
      "contracts/interfaces/IGiwaStablePool.sol",
      "contracts/libraries/TransientReentrancyGuard.sol",
      "contracts/core/GiwaStablePool.sol",
      "contracts/core/GiwaStableDeployer.sol",
    ],
  },
  {
    name: "GiwaPoolFactory",
    address: GIWA_DEX_FACTORY,
    files: [
      "contracts/interfaces/IGiwaPoolFactory.sol",
      "contracts/interfaces/IGiwaPoolDeployer.sol",
      "contracts/core/GiwaPoolFactory.sol",
    ],
  },
  {
    name: "GiwaUniversalRouter",
    address: GIWA_DEX_ROUTER,
    files: [
      "contracts/interfaces/IGiwaUniversalRouter.sol",
      "contracts/interfaces/IGiwaPoolFactory.sol",
      "contracts/interfaces/IGiwaCLPool.sol",
      "contracts/interfaces/IGiwaStablePool.sol",
      "contracts/libraries/TransientReentrancyGuard.sol",
      "contracts/periphery/GiwaUniversalRouter.sol",
    ],
  },
];

function buildFlattened(filePaths: string[]): string {
  let combined = "// SPDX-License-Identifier: MIT\npragma solidity ^0.8.20;\n\n";
  const seenPragmas = new Set<string>();

  for (const f of filePaths) {
    const content = fs.readFileSync(path.join(process.cwd(), f), "utf8");
    const lines = content.split("\n");
    for (const line of lines) {
      if (line.startsWith("// SPDX-License-Identifier:") || line.startsWith("pragma solidity") || line.startsWith("import ")) {
        continue;
      }
      combined += line + "\n";
    }
  }
  return combined;
}

async function verifyContract(c: ContractToVerify) {
  console.log(`\n⏳ Submitting verification for ${c.name} (${c.address})...`);
  const flattened = buildFlattened(c.files);

  const payload = {
    compiler_version: COMPILER_VERSION,
    source_code: flattened,
    is_optimization_enabled: true,
    optimization_runs: 200,
    evm_version: "cancun",
    autodetect_constructor_args: true,
    contract_name: c.name,
  };

  try {
    const res = await fetch(`https://sepolia-explorer.giwa.io/api/v2/smart-contracts/${c.address}/verification/via/flattened-code`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const data = await res.json();
    console.log(`   Response for ${c.name}:`, data);
  } catch (err) {
    console.error(`   ❌ Verification submission failed for ${c.name}:`, err);
  }
}

async function main() {
  console.log("=================================================");
  console.log("🔍 Giwa Sepolia Blockscout Verification Submitter");
  console.log("=================================================");

  for (const c of contracts) {
    await verifyContract(c);
  }

  console.log("\n=================================================");
  console.log("🎉 All contract verification payloads submitted!");
  console.log("=================================================");
}

main();
