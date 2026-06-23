# AcademicChain

DApp para emissão e verificação de certificados acadêmicos na blockchain Ethereum (Sepolia Testnet).

## Stack

| Camada | Tecnologia |
|---|---|
| Smart Contract | Solidity ^0.8.20 |
| Framework dev | Hardhat 2.28.x |
| Bibliotecas Solidity | OpenZeppelin Contracts ^5.x |
| Testes | Mocha + Chai + Hardhat Toolbox |
| Web3 lib | Ethers.js v6 |
| Rede de teste | Ethereum Sepolia |

## Pré-requisitos

- [Node.js v20 LTS](https://nodejs.org/)
- [Git](https://git-scm.com/)
- [MetaMask](https://metamask.io/) (para interagir com a DApp)

## Instalação

```bash
git clone https://github.com/barbosa-jp/blockchain-ads5.git
cd blockchain-ads5
npm install
```

## Variáveis de Ambiente

Copie o arquivo de exemplo e preencha com seus valores:

```bash
cp .env.example .env
```

| Variável | Descrição |
|---|---|
| `SEPOLIA_RPC_URL` | URL do RPC Sepolia (Alchemy ou Infura) |
| `PRIVATE_KEY` | Chave privada da carteira de deploy (use carteira dedicada para testes) |
| `ETHERSCAN_API_KEY` | API key do Etherscan (para verificação do contrato) |

> **Nunca commite o arquivo `.env`.** Ele já está no `.gitignore`.

## Compilar o contrato

```bash
npx hardhat compile
```

## Rodar os testes

```bash
npx hardhat test
```

## Relatório de cobertura

```bash
npx hardhat coverage
```

## Rodar localmente (Hardhat Network)

**Terminal 1 — subir o nó local:**

```bash
npx hardhat node
```

**Terminal 2 — fazer deploy:**

```bash
npx hardhat run scripts/deploy.js --network localhost
```

Anote o endereço exibido (`AcademicChain deployed to: 0x...`).

**Terminal 2 — popular com dados de teste:**

```bash
# Windows (PowerShell)
$env:CONTRACT_ADDRESS="0x_ENDERECO_DO_DEPLOY"; npx hardhat run scripts/seed.js --network localhost

# Linux/macOS
CONTRACT_ADDRESS=0x_ENDERECO_DO_DEPLOY npx hardhat run scripts/seed.js --network localhost
```

## Deploy na Sepolia

Certifique-se de que o `.env` está preenchido com `SEPOLIA_RPC_URL` e `PRIVATE_KEY`, e que a carteira tem Sepolia ETH.

```bash
npx hardhat run scripts/deploy.js --network sepolia
```

Para verificar o contrato no Etherscan:

```bash
npx hardhat verify --network sepolia <ENDERECO_DO_CONTRATO>
```

## Estrutura do Projeto

```
contracts/
  AcademicChain.sol   # Contrato principal
scripts/
  deploy.js           # Script de deploy
  seed.js             # Popula o contrato com dados de teste
test/
  AcademicChain.test.js  # 35 testes unitários
hardhat.config.js     # Configuração do Hardhat
.env.example          # Modelo de variáveis de ambiente
```

## Funcionalidades do Contrato

| Função | Acesso | Descrição |
|---|---|---|
| `authorizeIssuer` | onlyOwner | Autoriza endereço a emitir certificados |
| `revokeIssuer` | onlyOwner | Revoga autorização de emissor |
| `isAuthorizedIssuer` | público | Consulta se endereço é emissor autorizado |
| `issueCertificate` | onlyIssuer | Emite certificado on-chain |
| `getCertificate` | público | Retorna dados de um certificado por ID |
| `revokeCertificate` | onlyIssuer | Revoga certificado com motivo |
| `getMyCertificates` | público | Retorna IDs dos certificados do caller |
| `getCertificatesOf` | público | Retorna IDs dos certificados de um endereço |
| `verifyById` | público | Verifica validade por ID |
| `verifyByHash` | público | Verifica validade por hash SHA-256 do documento |

## Faucets Sepolia

Para obter ETH de teste:

- [Google Cloud Faucet](https://cloud.google.com/application/web3/faucet/ethereum/sepolia) — 0.05 ETH/dia
- [Alchemy Faucet](https://www.alchemy.com/faucets/ethereum-sepolia) — requer conta Alchemy
- [PoW Faucet](https://sepolia-faucet.pk910.de) — sem cadastro
