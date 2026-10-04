// Hardhat 2's EIP-1193 provider with ethers 6. The installed hardhat-ethers
// plugin targets Hardhat 3 and cannot be loaded into this project's config.
const hre = require('hardhat');
const ethers = require('ethers');
const provider = new ethers.BrowserProvider(hre.network.provider);
provider.pollingInterval = 10;
module.exports = {
  ...ethers,
  provider,
  getSigners: async () => Promise.all((await provider.send('eth_accounts', [])).map(address => provider.getSigner(address))),
  getContractFactory: async (name, signer) => {
    const artifact = await hre.artifacts.readArtifact(name);
    return new ethers.ContractFactory(artifact.abi, artifact.bytecode, signer || await provider.getSigner());
  },
};
