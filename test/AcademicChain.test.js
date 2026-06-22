const { expect } = require("chai");
const { ethers } = require("hardhat");
const { loadFixture, time } = require("@nomicfoundation/hardhat-toolbox/network-helpers");
const { anyValue } = require("@nomicfoundation/hardhat-chai-matchers/withArgs");

describe("AcademicChain", function () {
  const HASH_A = "a".repeat(64);
  const HASH_B = "b".repeat(64);

  const THREE_DAYS = 3 * 24 * 60 * 60;

  async function deployFixture() {
    const [owner, issuer, student, other] = await ethers.getSigners();
    const AcademicChain = await ethers.getContractFactory("AcademicChain");
    const contract = await AcademicChain.deploy(THREE_DAYS);
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

  describe("Queries", function () {
    it("getMyCertificates returns certificate IDs for the caller", async function () {
      const { contract, student } = await loadFixture(deployWithCertFixture);
      const ids = await contract.connect(student).getMyCertificates();
      expect(ids.length).to.equal(1);
      expect(ids[0]).to.equal(1n);
    });

    it("getMyCertificates returns empty array for address with no certificates", async function () {
      const { contract, other } = await loadFixture(deployFixture);
      const ids = await contract.connect(other).getMyCertificates();
      expect(ids.length).to.equal(0);
    });

    it("getCertificatesOf returns all IDs for a given student", async function () {
      const { contract, student } = await loadFixture(deployFixture);
      await contract.issueCertificate(student.address, "X", "Y", 1, HASH_A);
      await contract.issueCertificate(student.address, "X", "Y", 1, HASH_B);
      const ids = await contract.getCertificatesOf(student.address);
      expect(ids.length).to.equal(2);
      expect(ids[0]).to.equal(1n);
      expect(ids[1]).to.equal(2n);
    });

    it("getCertificate reverts for a non-existent ID", async function () {
      const { contract } = await loadFixture(deployFixture);
      await expect(contract.getCertificate(99n))
        .to.be.revertedWith("Certificado nao existe");
    });

    it("getCertificate reverts for ID 0", async function () {
      const { contract } = await loadFixture(deployFixture);
      await expect(contract.getCertificate(0n))
        .to.be.revertedWith("Certificado nao existe");
    });
  });

  describe("Public Verification", function () {
    it("verifyById returns valid=true for an active certificate", async function () {
      const { contract } = await loadFixture(deployWithCertFixture);
      const [valid] = await contract.verifyById(1n);
      expect(valid).to.be.true;
    });

    it("verifyById returns valid=false after revocation", async function () {
      const { contract } = await loadFixture(deployWithCertFixture);
      await contract.revokeCertificate(1n, "motivo");
      const [valid] = await contract.verifyById(1n);
      expect(valid).to.be.false;
    });

    it("verifyByHash returns valid=true for a known active document hash", async function () {
      const { contract } = await loadFixture(deployWithCertFixture);
      const [valid] = await contract.verifyByHash(HASH_A);
      expect(valid).to.be.true;
    });

    it("verifyByHash returns valid=false for a known revoked document hash", async function () {
      const { contract } = await loadFixture(deployWithCertFixture);
      await contract.revokeCertificate(1n, "motivo");
      const [valid] = await contract.verifyByHash(HASH_A);
      expect(valid).to.be.false;
    });

    it("verifyByHash returns valid=false for an unknown hash", async function () {
      const { contract } = await loadFixture(deployFixture);
      const [valid] = await contract.verifyByHash(HASH_B);
      expect(valid).to.be.false;
    });

    it("verifyByHash returns correct certificate metadata", async function () {
      const { contract, student } = await loadFixture(deployWithCertFixture);
      const [valid, cert] = await contract.verifyByHash(HASH_A);
      expect(valid).to.be.true;
      expect(cert.student).to.equal(student.address);
      expect(cert.courseName).to.equal("Engenharia de Software");
      expect(cert.workloadHours).to.equal(40n);
    });
  });

  describe("Certificate Revocation", function () {
    it("owner revokes a certificate and emits CertificateRevoked", async function () {
      const { contract } = await loadFixture(deployWithCertFixture);
      await expect(contract.revokeCertificate(1n, "Emitido em erro"))
        .to.emit(contract, "CertificateRevoked")
        .withArgs(1n, "Emitido em erro");
    });

    it("authorized issuer revokes a certificate", async function () {
      const { contract, issuer } = await loadFixture(deployWithCertFixture);
      await expect(contract.connect(issuer).revokeCertificate(1n, "Fraude detectada"))
        .to.emit(contract, "CertificateRevoked");
    });

    it("unauthorized address cannot revoke", async function () {
      const { contract, other } = await loadFixture(deployWithCertFixture);
      await expect(contract.connect(other).revokeCertificate(1n, "motivo"))
        .to.be.revertedWith("Nao autorizado");
    });

    it("reverts when revoking a non-existent certificate", async function () {
      const { contract } = await loadFixture(deployFixture);
      await expect(contract.revokeCertificate(99n, "motivo"))
        .to.be.revertedWith("Certificado nao existe");
    });

    it("reverts when revoking an already-revoked certificate", async function () {
      const { contract } = await loadFixture(deployWithCertFixture);
      await contract.revokeCertificate(1n, "primeira vez");
      await expect(contract.revokeCertificate(1n, "segunda vez"))
        .to.be.revertedWith("Ja revogado");
    });

    it("reverts when revoke reason is empty", async function () {
      const { contract } = await loadFixture(deployWithCertFixture);
      await expect(contract.revokeCertificate(1n, ""))
        .to.be.revertedWith("Motivo obrigatorio");
    });

    it("marks certificate as revoked with reason and timestamp", async function () {
      const { contract } = await loadFixture(deployWithCertFixture);
      await contract.revokeCertificate(1n, "Emitido em erro");
      const cert = await contract.getCertificate(1n);
      expect(cert.revoked).to.be.true;
      expect(cert.revokeReason).to.equal("Emitido em erro");
      expect(cert.revokedAt).to.be.greaterThan(0n);
    });
  });

  describe("DAO Voting", function () {
    async function daoFixture() {
      const [owner, issuer, issuer2, student, other] = await ethers.getSigners();
      const AcademicChain = await ethers.getContractFactory("AcademicChain");
      const contract = await AcademicChain.deploy(THREE_DAYS);
      await contract.authorizeIssuer(issuer.address);
      await contract.issueCertificate(student.address, "Ana Lima", "Eng Software", 40, HASH_A);
      return { contract, owner, issuer, issuer2, student, other };
    }

    describe("createProposal", function () {
      it("issuer cria proposta AuthorizeIssuer e emite ProposalCreated", async function () {
        const { contract, issuer, issuer2 } = await loadFixture(daoFixture);
        await expect(
          contract.connect(issuer).createProposal(0, issuer2.address, 0, "Adicionar emissor")
        )
          .to.emit(contract, "ProposalCreated")
          .withArgs(1n, 0, issuer.address, anyValue);
      });

      it("nao autorizado nao pode criar proposta", async function () {
        const { contract, other, issuer2 } = await loadFixture(daoFixture);
        await expect(
          contract.connect(other).createProposal(0, issuer2.address, 0, "test")
        ).to.be.revertedWith("Nao autorizado");
      });

      it("reverte quando descricao esta vazia", async function () {
        const { contract, issuer, issuer2 } = await loadFixture(daoFixture);
        await expect(
          contract.connect(issuer).createProposal(0, issuer2.address, 0, "")
        ).to.be.revertedWith("Descricao obrigatoria");
      });

      it("reverte quando alvo ja e emissor (AuthorizeIssuer)", async function () {
        const { contract, issuer } = await loadFixture(daoFixture);
        await expect(
          contract.connect(issuer).createProposal(0, issuer.address, 0, "test")
        ).to.be.revertedWith("Ja e emissor");
      });

      it("reverte quando alvo nao e emissor (RevokeIssuer)", async function () {
        const { contract, issuer, other } = await loadFixture(daoFixture);
        await expect(
          contract.connect(issuer).createProposal(1, other.address, 0, "test")
        ).to.be.revertedWith("Nao e emissor");
      });

      it("reverte quando certificado nao existe (RevokeCertificate)", async function () {
        const { contract, issuer } = await loadFixture(daoFixture);
        await expect(
          contract.connect(issuer).createProposal(2, ethers.ZeroAddress, 99, "test")
        ).to.be.revertedWith("Certificado nao existe");
      });

      it("armazena a proposta com dados corretos", async function () {
        const { contract, issuer, issuer2 } = await loadFixture(daoFixture);
        await contract.connect(issuer).createProposal(0, issuer2.address, 0, "Adicionar emissor");
        const p = await contract.getProposal(1n);
        expect(p.id).to.equal(1n);
        expect(p.proposalType).to.equal(0);
        expect(p.proposer).to.equal(issuer.address);
        expect(p.targetAddress).to.equal(issuer2.address);
        expect(p.description).to.equal("Adicionar emissor");
        expect(p.votesFor).to.equal(0n);
        expect(p.executed).to.be.false;
      });
    });

    describe("vote", function () {
      async function withProposalFixture() {
        const ctx = await loadFixture(daoFixture);
        await ctx.contract.connect(ctx.issuer).createProposal(
          0, ctx.issuer2.address, 0, "Adicionar emissor"
        );
        return ctx;
      }

      it("issuer vota a favor e votesFor incrementa", async function () {
        const { contract, issuer } = await loadFixture(withProposalFixture);
        await contract.connect(issuer).vote(1n, true);
        const p = await contract.getProposal(1n);
        expect(p.votesFor).to.equal(1n);
        expect(p.votesAgainst).to.equal(0n);
      });

      it("issuer vota contra e votesAgainst incrementa", async function () {
        const { contract, issuer } = await loadFixture(withProposalFixture);
        await contract.connect(issuer).vote(1n, false);
        const p = await contract.getProposal(1n);
        expect(p.votesFor).to.equal(0n);
        expect(p.votesAgainst).to.equal(1n);
      });

      it("emite evento VoteCast", async function () {
        const { contract, issuer } = await loadFixture(withProposalFixture);
        await expect(contract.connect(issuer).vote(1n, true))
          .to.emit(contract, "VoteCast")
          .withArgs(1n, issuer.address, true);
      });

      it("reverte quando mesmo issuer tenta votar duas vezes", async function () {
        const { contract, issuer } = await loadFixture(withProposalFixture);
        await contract.connect(issuer).vote(1n, true);
        await expect(contract.connect(issuer).vote(1n, true))
          .to.be.revertedWith("Ja votou");
      });

      it("nao autorizado nao pode votar", async function () {
        const { contract, other } = await loadFixture(withProposalFixture);
        await expect(contract.connect(other).vote(1n, true))
          .to.be.revertedWith("Nao autorizado");
      });

      it("reverte em proposta inexistente", async function () {
        const { contract, issuer } = await loadFixture(withProposalFixture);
        await expect(contract.connect(issuer).vote(99n, true))
          .to.be.revertedWith("Proposta nao existe");
      });

      it("reverte quando votacao ja encerrou (apos deadline)", async function () {
        const { contract, issuer } = await loadFixture(withProposalFixture);
        await time.increase(3 * 24 * 60 * 60 + 1);
        await expect(contract.connect(issuer).vote(1n, true))
          .to.be.revertedWith("Votacao encerrada");
      });
    });

    describe("executeProposal", function () {
      async function withApprovedProposalFixture() {
        const ctx = await loadFixture(daoFixture);
        await ctx.contract.connect(ctx.issuer).createProposal(
          0, ctx.issuer2.address, 0, "Adicionar emissor"
        );
        await ctx.contract.connect(ctx.issuer).vote(1n, true);
        await ctx.contract.connect(ctx.owner).vote(1n, true);
        return ctx;
      }

      it("reverte quando votacao ainda esta em andamento", async function () {
        const { contract } = await loadFixture(withApprovedProposalFixture);
        await expect(contract.executeProposal(1n))
          .to.be.revertedWith("Votacao em andamento");
      });

      it("reverte em proposta inexistente", async function () {
        const { contract } = await loadFixture(daoFixture);
        await time.increase(THREE_DAYS + 1);
        await expect(contract.executeProposal(99n))
          .to.be.revertedWith("Proposta nao existe");
      });

      it("executa AuthorizeIssuer aprovada: issuer2 se torna emissor", async function () {
        const { contract, issuer2 } = await loadFixture(withApprovedProposalFixture);
        await time.increase(THREE_DAYS + 1);
        await expect(contract.executeProposal(1n))
          .to.emit(contract, "ProposalExecuted")
          .withArgs(1n, true);
        expect(await contract.isAuthorizedIssuer(issuer2.address)).to.be.true;
      });

      it("executa RevokeIssuer aprovada: emissor perde acesso", async function () {
        const { contract, issuer, owner } = await loadFixture(daoFixture);
        await contract.connect(issuer).createProposal(1, issuer.address, 0, "Remover emissor");
        await contract.connect(owner).vote(1n, true);
        await contract.connect(issuer).vote(1n, true);
        await time.increase(THREE_DAYS + 1);
        await contract.executeProposal(1n);
        expect(await contract.isAuthorizedIssuer(issuer.address)).to.be.false;
      });

      it("executa RevokeCertificate aprovada: certificado fica invalido", async function () {
        const { contract, issuer, owner } = await loadFixture(daoFixture);
        await contract.connect(issuer).createProposal(2, ethers.ZeroAddress, 1n, "Fraude detectada");
        await contract.connect(owner).vote(1n, true);
        await contract.connect(issuer).vote(1n, true);
        await time.increase(THREE_DAYS + 1);
        await contract.executeProposal(1n);
        const [valid] = await contract.verifyById(1n);
        expect(valid).to.be.false;
      });

      it("proposta rejeitada (mais votos contra) nao executa acao", async function () {
        const { contract, issuer, issuer2 } = await loadFixture(daoFixture);
        await contract.connect(issuer).createProposal(0, issuer2.address, 0, "Adicionar emissor");
        await contract.connect(issuer).vote(1n, false);
        await time.increase(THREE_DAYS + 1);
        await expect(contract.executeProposal(1n))
          .to.emit(contract, "ProposalExecuted")
          .withArgs(1n, false);
        expect(await contract.isAuthorizedIssuer(issuer2.address)).to.be.false;
      });

      it("proposta sem votos nao executa acao", async function () {
        const { contract, issuer, issuer2 } = await loadFixture(daoFixture);
        await contract.connect(issuer).createProposal(0, issuer2.address, 0, "Adicionar emissor");
        await time.increase(THREE_DAYS + 1);
        await expect(contract.executeProposal(1n))
          .to.emit(contract, "ProposalExecuted")
          .withArgs(1n, false);
        expect(await contract.isAuthorizedIssuer(issuer2.address)).to.be.false;
      });

      it("reverte quando proposta ja foi executada", async function () {
        const { contract } = await loadFixture(withApprovedProposalFixture);
        await time.increase(THREE_DAYS + 1);
        await contract.executeProposal(1n);
        await expect(contract.executeProposal(1n))
          .to.be.revertedWith("Ja executada");
      });
    });

    describe("getActiveProposals", function () {
      it("retorna IDs das propostas ainda em votacao", async function () {
        const { contract, issuer, issuer2 } = await loadFixture(daoFixture);
        await contract.connect(issuer).createProposal(0, issuer2.address, 0, "Proposta 1");
        const active = await contract.getActiveProposals();
        expect(active.length).to.equal(1);
        expect(active[0]).to.equal(1n);
      });

      it("nao retorna proposta ja executada", async function () {
        const { contract, issuer, issuer2, owner } = await loadFixture(daoFixture);
        await contract.connect(issuer).createProposal(0, issuer2.address, 0, "Proposta 1");
        await contract.connect(issuer).vote(1n, true);
        await contract.connect(owner).vote(1n, true);
        await time.increase(THREE_DAYS + 1);
        await contract.executeProposal(1n);
        const active = await contract.getActiveProposals();
        expect(active.length).to.equal(0);
      });

      it("nao retorna proposta com deadline expirado e nao executada", async function () {
        const { contract, issuer, issuer2 } = await loadFixture(daoFixture);
        await contract.connect(issuer).createProposal(0, issuer2.address, 0, "Proposta 1");
        await time.increase(THREE_DAYS + 1);
        const active = await contract.getActiveProposals();
        expect(active.length).to.equal(0);
      });

      it("retorna multiplas propostas ativas", async function () {
        const { contract, issuer, issuer2, owner } = await loadFixture(daoFixture);
        await contract.connect(issuer).createProposal(0, issuer2.address, 0, "Proposta 1");
        await contract.connect(owner).createProposal(2, ethers.ZeroAddress, 1n, "Proposta 2");
        const active = await contract.getActiveProposals();
        expect(active.length).to.equal(2);
        expect(active[0]).to.equal(1n);
        expect(active[1]).to.equal(2n);
      });
    });
  });
});
