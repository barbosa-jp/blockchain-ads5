const { ethers, network } = require("hardhat");

const RESET = "\x1b[0m";
const BOLD = "\x1b[1m";
const GREEN = "\x1b[32m";
const YELLOW = "\x1b[33m";
const CYAN = "\x1b[36m";
const RED = "\x1b[31m";

function log(label, value) {
  console.log(`  ${CYAN}${label}:${RESET} ${value}`);
}
function section(title) {
  console.log(`\n${BOLD}${YELLOW}▶ ${title}${RESET}`);
}
function success(msg) {
  console.log(`  ${GREEN}✔ ${msg}${RESET}`);
}

async function main() {
  const [owner, issuer, voter2] = await ethers.getSigners();
  const VOTING_PERIOD = 60; // 60 segundos para a demo

  console.log(`\n${BOLD}${CYAN}╔══════════════════════════════════════╗`);
  console.log(`║       AcademicChain — Demo DAO       ║`);
  console.log(`╚══════════════════════════════════════╝${RESET}`);

  // 1. Deploy
  section("1. Deploy dos contratos");
  const Token = await ethers.getContractFactory("AcademicToken");
  const token = await Token.deploy();
  await token.waitForDeployment();
  log("AcademicToken", await token.getAddress());

  await token.mint(owner.address, ethers.parseEther("100"));
  await token.mint(issuer.address, ethers.parseEther("100"));
  await token.mint(voter2.address, ethers.parseEther("100"));
  success("Tokens de governança mintados (100 ACT cada)");

  const AC = await ethers.getContractFactory("AcademicChain");
  const contract = await AC.deploy(VOTING_PERIOD, await token.getAddress());
  await contract.waitForDeployment();
  log("AcademicChain", await contract.getAddress());
  log("VOTING_PERIOD", `${VOTING_PERIOD} segundos`);
  log("Owner", owner.address);
  success("Contrato deployado");

  // 2. Autorizar emissor
  section("2. Autorizar emissor");
  await contract.authorizeIssuer(issuer.address);
  log("Emissor autorizado", issuer.address);
  log("issuerCount", await contract.issuerCount());
  success("Emissor autorizado com sucesso");

  // 3. Emitir certificado
  section("3. Emitir certificado");
  const tx = await contract
    .connect(issuer)
    .issueCertificate(owner.address, "Rafael Silva", "Blockchain & Web3", 60, "hash_abc123");
  const receipt = await tx.wait();
  const event = receipt.logs.find((l) => {
    try { return contract.interface.parseLog(l).name === "CertificateIssued"; } catch { return false; }
  });
  const parsed = contract.interface.parseLog(event);
  log("ID do certificado", parsed.args.id.toString());
  log("Aluno", "Rafael Silva");
  log("Curso", "Blockchain & Web3");
  const [valid] = await contract.verifyById(1n);
  log("Status", valid ? `${GREEN}VÁLIDO${RESET}` : `${RED}REVOGADO${RESET}`);
  success("Certificado emitido");

  // 4. Criar proposta
  section("4. Criar proposta de votação (revogar certificado)");
  await contract.connect(issuer).createProposal(2, ethers.ZeroAddress, 1n, "Documento fraudulento detectado");
  const proposal = await contract.getProposal(1n);
  log("Proposta ID", proposal.id.toString());
  log("Tipo", "RevokeCertificate");
  log("Descrição", proposal.description);
  log("Deadline", new Date(Number(proposal.deadline) * 1000).toLocaleTimeString());
  success("Proposta criada");

  // 5. Votar
  section("5. Votação");
  await contract.connect(owner).vote(1n, true);
  log("Voto 1", `${owner.address.slice(0, 10)}... → ${GREEN}A FAVOR${RESET}`);
  await contract.connect(issuer).vote(1n, true);
  log("Voto 2", `${issuer.address.slice(0, 10)}... → ${GREEN}A FAVOR${RESET}`);

  const p = await contract.getProposal(1n);
  log("Votos a favor", p.votesFor.toString());
  log("Votos contra", p.votesAgainst.toString());
  success("Votação registrada");

  // 6. Avançar tempo
  section("6. Avançando tempo (fim do período de votação)");
  await network.provider.send("evm_increaseTime", [VOTING_PERIOD + 1]);
  await network.provider.send("evm_mine");
  success(`${VOTING_PERIOD} segundos avançados`);

  // 7. Executar proposta
  section("7. Executar proposta");
  await contract.executeProposal(1n);
  const pFinal = await contract.getProposal(1n);
  log("Executada", pFinal.executed ? "Sim" : "Não");
  const quorum = pFinal.votesFor > pFinal.votesAgainst && pFinal.votesFor > 0n;
  log("Quórum atingido", quorum ? `${GREEN}SIM${RESET}` : `${RED}NÃO${RESET}`);
  success("Proposta executada");

  // 8. Resultado final
  section("8. Resultado final");
  const [validFinal] = await contract.verifyById(1n);
  log("Certificado ID 1", validFinal ? `${GREEN}VÁLIDO${RESET}` : `${RED}REVOGADO pela DAO${RESET}`);
  const active = await contract.getActiveProposals();
  log("Propostas ativas", active.length.toString());

  console.log(`\n${BOLD}${GREEN}╔══════════════════════════════════════╗`);
  console.log(`║         Demo concluída com êxito     ║`);
  console.log(`╚══════════════════════════════════════╝${RESET}\n`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
