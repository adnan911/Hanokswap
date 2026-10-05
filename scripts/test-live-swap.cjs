const { ethers } = require('ethers');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

function loadArtifact(relativePath) {
  const fullPath = path.join(process.cwd(), 'artifacts', relativePath);
  return JSON.parse(fs.readFileSync(fullPath, 'utf-8'));
}

async function main() {
  const provider = new ethers.JsonRpcProvider('https://sepolia-rpc.giwa.io');
  const privateKey = process.env.DEPLOYER_PRIVATE_KEY || process.env.PRIVATE_KEY;
  const wallet = new ethers.Wallet(privateKey, provider);

  const manifest = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'deployments', 'giwa-sepolia.json'), 'utf-8'));
  const { USDC, EURC, GiwaUniversalRouter, GiwaPoolFactory } = manifest.contracts;

  console.log('=================================================');
  console.log('🧪 Testing Live Swap on GIWA Sepolia');
  console.log('=================================================');
  console.log('Wallet: ', wallet.address);
  console.log('Router: ', GiwaUniversalRouter);
  console.log('USDC:   ', USDC);
  console.log('EURC:   ', EURC);

  const erc20Artifact = loadArtifact('contracts/test/TestnetERC20.sol/TestnetERC20.json');
  const routerArtifact = loadArtifact('contracts/periphery/GiwaUniversalRouter.sol/GiwaUniversalRouter.json');

  const usdcContract = new ethers.Contract(USDC, erc20Artifact.abi, wallet);
  const eurcContract = new ethers.Contract(EURC, erc20Artifact.abi, wallet);
  const routerContract = new ethers.Contract(GiwaUniversalRouter, routerArtifact.abi, wallet);

  const usdcBalBefore = await usdcContract.balanceOf(wallet.address);
  const eurcBalBefore = await eurcContract.balanceOf(wallet.address);
  console.log(`Initial Balances:`);
  console.log(`  USDC: ${ethers.formatUnits(usdcBalBefore, 6)}`);
  console.log(`  EURC: ${ethers.formatUnits(eurcBalBefore, 6)}`);

  const swapAmount = ethers.parseUnits('100', 6); // Swap 100 USDC -> EURC
  console.log(`\n1. Approving Router for 100 USDC...`);
  const approveTx = await usdcContract.approve(GiwaUniversalRouter, swapAmount);
  await approveTx.wait();
  console.log('   ✅ Approved!');

  console.log(`\n2. Executing exactInputSingle swap (USDC -> EURC via Stableswap Pool)...`);
  const deadline = Math.floor(Date.now() / 1000) + 1200; // 20 minutes
  
  const swapParams = {
    tokenIn: USDC,
    tokenOut: EURC,
    fee: 100, // 0.01%
    recipient: wallet.address,
    deadline: deadline,
    amountIn: swapAmount,
    amountOutMinimum: 0n, // test swap
    sqrtPriceLimitX96: 0n,
    isStable: true,
  };

  const swapTx = await routerContract.exactInputSingle(swapParams);
  console.log('   Tx Hash:', swapTx.hash);
  const receipt = await swapTx.wait();
  console.log('   ✅ Swap confirmed in block:', receipt.blockNumber);

  const usdcBalAfter = await usdcContract.balanceOf(wallet.address);
  const eurcBalAfter = await eurcContract.balanceOf(wallet.address);
  console.log(`\nFinal Balances:`);
  console.log(`  USDC: ${ethers.formatUnits(usdcBalAfter, 6)} (Diff: ${ethers.formatUnits(usdcBalAfter - usdcBalBefore, 6)})`);
  console.log(`  EURC: ${ethers.formatUnits(eurcBalAfter, 6)} (Diff: +${ethers.formatUnits(eurcBalAfter - eurcBalBefore, 6)})`);

  console.log('\n=================================================');
  console.log('🎉 LIVE ON-CHAIN SWAP SUCCEEDED ON GIWA SEPOLIA!');
  console.log('=================================================');
}

main().catch(console.error);
