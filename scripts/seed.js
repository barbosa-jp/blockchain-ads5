const { ethers } = require("hardhat");

async function main() {
     const contractAddress = process.env.CONTRACT_ADDRESS;
     if (!contractAddress) {
          throw new Error("Set CONTRACT_ADDRESS env variable before running seed");
     }

     const [owner, issuer, student1, student2] = await ethers.getSigners();
     const contract = await ethers.getContractAt("AcademicChain", contractAddress);

     console.log("Authorizing issuer:", issuer.address);
     await (await contract.authorizeIssuer(issuer.address)).wait();

     const certs = [
          {
               student: student1.address,
               studentName: "Ana Lima",
               courseName: "Engenharia de Software",
               workloadHours: 40,
               documentHash: "a".repeat(64),
          },
          {
               student: student1.address,
               studentName: "Ana Lima",
               courseName: "Blockchain Fundamentals",
               workloadHours: 20,
               documentHash: "b".repeat(64),
          },
          {
               student: student2.address,
               studentName: "Carlos Souza",
               courseName: "Smart Contracts com Solidity",
               workloadHours: 60,
               documentHash: "c".repeat(64),
          },
     ];

     for (const cert of certs) {
          const tx = await contract
          .connect(issuer)
          .issueCertificate(
               cert.student,
               cert.studentName,
               cert.courseName,
               cert.workloadHours,
               cert.documentHash
          );
          
          const receipt = await tx.wait();
          console.log(`Issued "${cert.courseName}" to ${cert.studentName} - tx: ${receipt.hash}`);
     }

     console.log("Seed complete!");
}

main().catch((error) => {
     console.error(error);
     process.exit(1);
});