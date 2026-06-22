const { ethers, run, network } = require("hardhat");

const VOTING_PERIOD = 3 * 24 * 60 * 60; // 3 dias

async function main() {
     const [deployer] = await ethers.getSigners();
     console.log("Deploying contracts with the account:", deployer.address);
     console.log("Balance:", ethers.formatEther(await ethers.provider.getBalance(deployer.address)), "ETH");

     const AcademicChain = await ethers.getContractFactory("AcademicChain");
     const contract = await AcademicChain.deploy(VOTING_PERIOD);
     await contract.waitForDeployment();

     const address = await contract.getAddress();
     console.log("AcademicChain deployed to:", address);
     console.log(`Set in .env: CONTRACT_ADDRESS=${address}`);

     if (network.name === "sepolia") {
          console.log("\nWaiting 5 confirmations before verifying on Etherscan...");
          await contract.deploymentTransaction().wait(5);

          await run("verify:verify", {
               address,
               constructorArguments: [VOTING_PERIOD],
          });

          console.log("Verified:", `https://sepolia.etherscan.io/address/${address}`);
     }
}

main().catch((error) => {
     console.error(error);
     process.exit(1);
});