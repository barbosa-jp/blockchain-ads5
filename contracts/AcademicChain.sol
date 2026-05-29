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
}
