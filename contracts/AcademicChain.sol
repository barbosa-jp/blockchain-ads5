// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";

contract AcademicChain is Ownable {
    struct Certificate {
        uint256 id;
        address student;
        string studentName;
        string courseName;
        uint256 workloadHours;
        string documentHash;
        address issuedBy;
        uint256 issuedAt;
        bool revoked;
        string revokeReason;
        uint256 revokedAt;
    }

    uint256 private _nextId = 1;

    mapping(uint256 => Certificate) public certificates;
    mapping(address => uint256[]) private _studentCertificates;
    mapping(string => uint256) private _certificateByHash;
    mapping(address => bool) public authorizedIssuers;
    uint256 public issuerCount;

    event CertificateIssued(uint256 indexed id, address indexed student, address indexed issuedBy, string documentHash);
    event CertificateRevoked(uint256 indexed id, string reason);
    event IssuerAuthorized(address indexed issuer);
    event IssuerRevoked(address indexed issuer);

    // --- DAO Voting ---
    enum ProposalType { AuthorizeIssuer, RevokeIssuer, RevokeCertificate }

    struct Proposal {
        uint256 id;
        ProposalType proposalType;
        address proposer;
        address targetAddress;
        uint256 targetCertId;
        string description;
        uint256 votesFor;
        uint256 votesAgainst;
        uint256 deadline;
        bool executed;
    }

    uint256 public constant VOTING_PERIOD = 3 days;
    uint256 private _nextProposalId = 1;
    uint256[] private _allProposalIds;
    mapping(uint256 => Proposal) public proposals;
    mapping(uint256 => mapping(address => bool)) public hasVoted;

    event ProposalCreated(uint256 indexed id, ProposalType proposalType, address indexed proposer, uint256 deadline);
    event VoteCast(uint256 indexed proposalId, address indexed voter, bool support);
    event ProposalExecuted(uint256 indexed proposalId, bool passed);

    modifier onlyIssuer() {
        require(owner() == msg.sender || authorizedIssuers[msg.sender], "Nao autorizado");
        _;
    }

    constructor() Ownable(msg.sender) {}

    function authorizeIssuer(address issuer) external onlyOwner {
        require(issuer != address(0), "Endereco invalido");
        _doAuthorizeIssuer(issuer);
    }

    function _doAuthorizeIssuer(address issuer) internal {
        authorizedIssuers[issuer] = true;
        issuerCount++;
        emit IssuerAuthorized(issuer);
    }

    function revokeIssuer(address issuer) external onlyOwner {
        _doRevokeIssuer(issuer);
    }

    function _doRevokeIssuer(address issuer) internal {
        if (authorizedIssuers[issuer]) issuerCount--;
        authorizedIssuers[issuer] = false;
        emit IssuerRevoked(issuer);
    }

    function isAuthorizedIssuer(address issuer) external view returns (bool) {
        return authorizedIssuers[issuer];
    }

    function issueCertificate(
        address student,
        string calldata studentName,
        string calldata courseName,
        uint256 workloadHours,
        string calldata documentHash
    ) external onlyIssuer returns (uint256) {
        require(student != address(0), "Endereco invalido");
        require(bytes(documentHash).length > 0, "Hash obrigatorio");
        require(_certificateByHash[documentHash] == 0, "Certificado ja existe");
        require(workloadHours > 0, "Carga horaria invalida");

        uint256 id = _nextId++;
        certificates[id] = Certificate({
            id: id,
            student: student,
            studentName: studentName,
            courseName: courseName,
            workloadHours: workloadHours,
            documentHash: documentHash,
            issuedBy: msg.sender,
            issuedAt: block.timestamp,
            revoked: false,
            revokeReason: "",
            revokedAt: 0
        });
        _studentCertificates[student].push(id);
        _certificateByHash[documentHash] = id;

        emit CertificateIssued(id, student, msg.sender, documentHash);
        return id;
    }

    function getCertificate(uint256 id) external view returns (Certificate memory) {
        require(id > 0 && id < _nextId, "Certificado nao existe");
        return certificates[id];
    }

    function revokeCertificate(uint256 id, string calldata reason) external onlyIssuer {
        _doRevokeCertificate(id, reason);
    }

    function _doRevokeCertificate(uint256 id, string memory reason) internal {
        require(id > 0 && id < _nextId, "Certificado nao existe");
        require(!certificates[id].revoked, "Ja revogado");
        require(bytes(reason).length > 0, "Motivo obrigatorio");
        certificates[id].revoked = true;
        certificates[id].revokeReason = reason;
        certificates[id].revokedAt = block.timestamp;
        emit CertificateRevoked(id, reason);
    }

    function getMyCertificates() external view returns (uint256[] memory) {
        return _studentCertificates[msg.sender];
    }

    function getCertificatesOf(address student) external view returns (uint256[] memory) {
        return _studentCertificates[student];
    }

    function verifyById(uint256 id) external view returns (bool valid, Certificate memory cert) {
        require(id > 0 && id < _nextId, "Certificado nao existe");
        cert = certificates[id];
        valid = !cert.revoked;
    }

    function verifyByHash(string calldata documentHash) external view returns (bool valid, Certificate memory cert) {
        uint256 id = _certificateByHash[documentHash];
        if (id == 0) {
            return (false, cert);
        }
        cert = certificates[id];
        valid = !cert.revoked;
    }

    function createProposal(
        ProposalType proposalType,
        address targetAddress,
        uint256 targetCertId,
        string calldata description
    ) external onlyIssuer returns (uint256) {
        require(bytes(description).length > 0, "Descricao obrigatoria");

        if (proposalType == ProposalType.AuthorizeIssuer) {
            require(targetAddress != address(0), "Endereco invalido");
            require(targetAddress != owner(), "Owner ja autorizado");
            require(!authorizedIssuers[targetAddress], "Ja e emissor");
        } else if (proposalType == ProposalType.RevokeIssuer) {
            require(authorizedIssuers[targetAddress], "Nao e emissor");
        } else {
            require(targetCertId > 0 && targetCertId < _nextId, "Certificado nao existe");
            require(!certificates[targetCertId].revoked, "Ja revogado");
        }

        uint256 id = _nextProposalId++;
        uint256 deadline = block.timestamp + VOTING_PERIOD;

        proposals[id] = Proposal({
            id: id,
            proposalType: proposalType,
            proposer: msg.sender,
            targetAddress: targetAddress,
            targetCertId: targetCertId,
            description: description,
            votesFor: 0,
            votesAgainst: 0,
            deadline: deadline,
            executed: false
        });

        _allProposalIds.push(id);
        emit ProposalCreated(id, proposalType, msg.sender, deadline);
        return id;
    }

    function getProposal(uint256 proposalId) external view returns (Proposal memory) {
        require(proposals[proposalId].id != 0, "Proposta nao existe");
        return proposals[proposalId];
    }

    function vote(uint256 proposalId, bool support) external onlyIssuer {
        Proposal storage p = proposals[proposalId];
        require(p.id != 0, "Proposta nao existe");
        require(block.timestamp < p.deadline, "Votacao encerrada");
        require(!hasVoted[proposalId][msg.sender], "Ja votou");

        hasVoted[proposalId][msg.sender] = true;

        if (support) {
            p.votesFor++;
        } else {
            p.votesAgainst++;
        }

        emit VoteCast(proposalId, msg.sender, support);
    }

    function executeProposal(uint256 proposalId) external {
        Proposal storage p = proposals[proposalId];
        require(p.id != 0, "Proposta nao existe");
        require(!p.executed, "Ja executada");
        require(block.timestamp >= p.deadline, "Votacao em andamento");

        p.executed = true;
        bool passed = p.votesFor > p.votesAgainst && p.votesFor > 0;

        if (passed) {
            if (p.proposalType == ProposalType.AuthorizeIssuer) {
                _doAuthorizeIssuer(p.targetAddress);
            } else if (p.proposalType == ProposalType.RevokeIssuer) {
                _doRevokeIssuer(p.targetAddress);
            } else {
                _doRevokeCertificate(p.targetCertId, p.description);
            }
        }

        emit ProposalExecuted(proposalId, passed);
    }

    function getActiveProposals() external view returns (uint256[] memory) {
        uint256 count = 0;
        for (uint256 i = 0; i < _allProposalIds.length; i++) {
            uint256 pid = _allProposalIds[i];
            if (!proposals[pid].executed && block.timestamp < proposals[pid].deadline) {
                count++;
            }
        }

        uint256[] memory active = new uint256[](count);
        uint256 index = 0;
        for (uint256 i = 0; i < _allProposalIds.length; i++) {
            uint256 pid = _allProposalIds[i];
            if (!proposals[pid].executed && block.timestamp < proposals[pid].deadline) {
                active[index++] = pid;
            }
        }

        return active;
    }
}
