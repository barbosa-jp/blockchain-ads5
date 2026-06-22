const { ethers } = require("hardhat");

async function main() {
     const [deployer] = await ethers.getSigners();
     console.log("Deploying contracts with the account:", deployer.address);
     console.log("Balance:", ethers.formatEther(await ethers.provider.getBalance(deployer.address)), "ETH");

     const AcademicChain = await ethers.getContractFactory("AcademicChain");
     const contract = await AcademicChain.deploy();
     await contract.waitForDeployment();

     const address = await contract.getAddress();
     console.log("AcademicChain deployed to:", address);
     console.log(`Set in .env: CONTRACT_ADDRESS=${address}`);
}

main().catch((error) => {
     console.error(error);
     process.exit(1);
});