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

    event CertificateIssued(uint256 indexed id, address indexed student, address indexed issuedBy, string documentHash);
    event CertificateRevoked(uint256 indexed id, string reason);
    event IssuerAuthorized(address indexed issuer);
    event IssuerRevoked(address indexed issuer);

    modifier onlyIssuer() {
        require(owner() == msg.sender || authorizedIssuers[msg.sender], "Nao autorizado");
        _;
    }

    constructor() Ownable(msg.sender) {}

    function authorizeIssuer(address issuer) external onlyOwner {
        require(issuer != address(0), "Endereco invalido");
        authorizedIssuers[issuer] = true;
        emit IssuerAuthorized(issuer);
    }

    function revokeIssuer(address issuer) external onlyOwner {
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
}
