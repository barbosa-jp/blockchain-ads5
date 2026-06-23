const { ethers, run, network } = require("hardhat");

const VOTING_PERIOD = 3 * 24 * 60 * 60; // 3 dias

async function main() {
     const [deployer] = await ethers.getSigners();
     console.log("Deploying contracts with the account:", deployer.address);
     console.log("Balance:", ethers.formatEther(await ethers.provider.getBalance(deployer.address)), "ETH");

     const AcademicToken = await ethers.getContractFactory("AcademicToken");
     const token = await AcademicToken.deploy();
     await token.waitForDeployment();
     const tokenAddress = await token.getAddress();
     console.log("AcademicToken deployed to:", tokenAddress);

     const AcademicChain = await ethers.getContractFactory("AcademicChain");
     const contract = await AcademicChain.deploy(VOTING_PERIOD, tokenAddress);
     await contract.waitForDeployment();

     const address = await contract.getAddress();
     console.log("AcademicChain deployed to:", address);
     console.log(`Set in .env: CONTRACT_ADDRESS=${address}`);
     console.log(`Set in .env: TOKEN_ADDRESS=${tokenAddress}`);

     if (network.name === "sepolia") {
          console.log("\nWaiting 5 confirmations before verifying on Etherscan...");
          await contract.deploymentTransaction().wait(5);

          await run("verify:verify", {
               address: tokenAddress,
               constructorArguments: [],
          });
          console.log("AcademicToken verified:", `https://sepolia.etherscan.io/address/${tokenAddress}`);

          await run("verify:verify", {
               address,
               constructorArguments: [VOTING_PERIOD, tokenAddress],
          });
          console.log("AcademicChain verified:", `https://sepolia.etherscan.io/address/${address}`);
     }
}

main().catch((error) => {
     console.error(error);
     process.exit(1);
});