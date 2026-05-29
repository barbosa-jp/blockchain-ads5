const { expect } = require("chai");
const { ethers } = require("hardhat");
const { loadFixture } = require("@nomicfoundation/hardhat-toolbox/network-helpers");

describe("AcademicChain", function () {
  const HASH_A = "a".repeat(64);
  const HASH_B = "b".repeat(64);

  async function deployFixture() {
    const [owner, issuer, student, other] = await ethers.getSigners();
    const AcademicChain = await ethers.getContractFactory("AcademicChain");
    const contract = await AcademicChain.deploy();
    return { contract, owner, issuer, student, other };
  }

  describe("Deployment", function () {
    it("sets deployer as owner", async function () {
      const { contract, owner } = await loadFixture(deployFixture);
      expect(await contract.owner()).to.equal(owner.address);
    });
  });
});
