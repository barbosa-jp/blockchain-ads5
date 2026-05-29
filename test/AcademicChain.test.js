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

  async function deployWithIssuerFixture() {
    const ctx = await deployFixture();
    await ctx.contract.authorizeIssuer(ctx.issuer.address);
    return ctx;
  }

  describe("Deployment", function () {
    it("sets deployer as owner", async function () {
      const { contract, owner } = await loadFixture(deployFixture);
      expect(await contract.owner()).to.equal(owner.address);
    });
  });

  describe("Issuer Management", function () {
    it("owner authorizes an issuer and emits event", async function () {
      const { contract, issuer } = await loadFixture(deployFixture);
      await expect(contract.authorizeIssuer(issuer.address))
        .to.emit(contract, "IssuerAuthorized")
        .withArgs(issuer.address);
      expect(await contract.isAuthorizedIssuer(issuer.address)).to.be.true;
    });

    it("non-owner cannot authorize an issuer", async function () {
      const { contract, other, issuer } = await loadFixture(deployFixture);
      await expect(contract.connect(other).authorizeIssuer(issuer.address))
        .to.be.revertedWithCustomError(contract, "OwnableUnauthorizedAccount");
    });

    it("owner revokes an issuer and emits event", async function () {
      const { contract, issuer } = await loadFixture(deployWithIssuerFixture);
      await expect(contract.revokeIssuer(issuer.address))
        .to.emit(contract, "IssuerRevoked")
        .withArgs(issuer.address);
      expect(await contract.isAuthorizedIssuer(issuer.address)).to.be.false;
    });

    it("non-owner cannot revoke an issuer", async function () {
      const { contract, other, issuer } = await loadFixture(deployWithIssuerFixture);
      await expect(contract.connect(other).revokeIssuer(issuer.address))
        .to.be.revertedWithCustomError(contract, "OwnableUnauthorizedAccount");
    });

    it("authorizeIssuer reverts on zero address", async function () {
      const { contract } = await loadFixture(deployFixture);
      await expect(contract.authorizeIssuer(ethers.ZeroAddress))
        .to.be.revertedWith("Endereco invalido");
    });

    // it("revoked issuer cannot issue certificates", async function () {
    //   const { contract, issuer, student } = await loadFixture(deployWithIssuerFixture);
    //   await contract.revokeIssuer(issuer.address);
    //   await expect(
    //     contract.connect(issuer).issueCertificate(student.address, "X", "Y", 1, HASH_A)
    //   ).to.be.revertedWith("Nao autorizado");
    // });
  });
});
