const { ethers } = require('ethers');
require('dotenv').config();

async function main() {
  const provider = new ethers.JsonRpcProvider('https://sepolia-rpc.giwa.io');
  const privateKey = process.env.DEPLOYER_PRIVATE_KEY || process.env.PRIVATE_KEY;
  if (!privateKey) {
    console.log('No private key configured');
    return;
  }
  const wallet = new ethers.Wallet(privateKey, provider);
  console.log('Wallet Address:', wallet.address);
  const balance = await provider.getBalance(wallet.address);
  console.log('Balance:', ethers.formatEther(balance), 'ETH');
}

main().catch(console.error);
