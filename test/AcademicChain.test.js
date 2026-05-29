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

  async function deployWithCertFixture() {
    const ctx = await deployWithIssuerFixture();
    await ctx.contract.issueCertificate(
      ctx.student.address,
      "Ana Lima",
      "Engenharia de Software",
      40,
      HASH_A
    );
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

    it("revoked issuer cannot issue certificates", async function () {
      const { contract, issuer, student } = await loadFixture(deployWithIssuerFixture);
      await contract.revokeIssuer(issuer.address);
      await expect(
        contract.connect(issuer).issueCertificate(student.address, "X", "Y", 1, HASH_A)
      ).to.be.revertedWith("Nao autorizado");
    });
  });

  describe("Certificate Issuance", function () {
    it("owner issues a certificate and emits CertificateIssued", async function () {
      const { contract, owner, student } = await loadFixture(deployFixture);
      await expect(
        contract.issueCertificate(student.address, "Ana Lima", "Eng Software", 40, HASH_A)
      )
        .to.emit(contract, "CertificateIssued")
        .withArgs(1n, student.address, owner.address, HASH_A);
    });

    it("authorized issuer issues a certificate", async function () {
      const { contract, issuer, student } = await loadFixture(deployWithIssuerFixture);
      await expect(
        contract.connect(issuer).issueCertificate(student.address, "Ana Lima", "Eng Software", 40, HASH_A)
      )
        .to.emit(contract, "CertificateIssued")
        .withArgs(1n, student.address, issuer.address, HASH_A);
    });

    it("unauthorized address cannot issue", async function () {
      const { contract, other, student } = await loadFixture(deployFixture);
      await expect(
        contract.connect(other).issueCertificate(student.address, "X", "Y", 1, HASH_A)
      ).to.be.revertedWith("Nao autorizado");
    });

    it("IDs increment correctly across multiple issuances", async function () {
      const { contract, owner, student } = await loadFixture(deployFixture);
      await contract.issueCertificate(student.address, "A", "B", 1, HASH_A);
      await expect(
        contract.issueCertificate(student.address, "A", "B", 1, HASH_B)
      )
        .to.emit(contract, "CertificateIssued")
        .withArgs(2n, student.address, owner.address, HASH_B);
    });

    it("reverts when student address is zero", async function () {
      const { contract } = await loadFixture(deployFixture);
      await expect(
        contract.issueCertificate(ethers.ZeroAddress, "X", "Y", 1, HASH_A)
      ).to.be.revertedWith("Endereco invalido");
    });

    it("reverts when documentHash is empty", async function () {
      const { contract, student } = await loadFixture(deployFixture);
      await expect(
        contract.issueCertificate(student.address, "X", "Y", 1, "")
      ).to.be.revertedWith("Hash obrigatorio");
    });

    it("reverts on duplicate document hash", async function () {
      const { contract, student } = await loadFixture(deployFixture);
      await contract.issueCertificate(student.address, "X", "Y", 1, HASH_A);
      await expect(
        contract.issueCertificate(student.address, "X", "Y", 1, HASH_A)
      ).to.be.revertedWith("Certificado ja existe");
    });

    it("reverts when workloadHours is zero", async function () {
      const { contract, student } = await loadFixture(deployFixture);
      await expect(
        contract.issueCertificate(student.address, "X", "Y", 0, HASH_A)
      ).to.be.revertedWith("Carga horaria invalida");
    });

    it("stores certificate data correctly", async function () {
      const { contract, owner, student } = await loadFixture(deployFixture);
      await contract.issueCertificate(student.address, "Ana Lima", "Eng Software", 40, HASH_A);
      const cert = await contract.getCertificate(1n);
      expect(cert.id).to.equal(1n);
      expect(cert.student).to.equal(student.address);
      expect(cert.studentName).to.equal("Ana Lima");
      expect(cert.courseName).to.equal("Eng Software");
      expect(cert.workloadHours).to.equal(40n);
      expect(cert.documentHash).to.equal(HASH_A);
      expect(cert.issuedBy).to.equal(owner.address);
      expect(cert.revoked).to.be.false;
    });

    it("_studentCertificates mapping is updated", async function () {
      const { contract, student } = await loadFixture(deployFixture);
      await contract.issueCertificate(student.address, "X", "Y", 1, HASH_A);
      const ids = await contract.getCertificatesOf(student.address);
      expect(ids.length).to.equal(1);
      expect(ids[0]).to.equal(1n);
    });
  });
});
