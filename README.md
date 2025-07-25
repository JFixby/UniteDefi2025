# UniteDefi2025

## Requirements for Lightning Network

To run the Lightning Network components in this project, you will need:

- **Docker**: Containerization platform for running services.
- **Docker Compose**: Tool for defining and running multi-container Docker applications.
- **Polar**: GUI tool for creating and managing Lightning Network regtest environments.

Please ensure all three are installed on your system before attempting to run the Lightning Network setup.

---

## Documentation Overview

This repository contains the full documentation for the 1inch Network and its protocols, located in the `1inch-docs` folder. Below is a summary of the main topics and structure:

---

### 1. Project Overview (`1inch-docs/README.md`)
- Built with Docusaurus 2 for static site generation.
- Instructions for installation, development, build, and deployment.
- Main domains: Aggregation Protocol, Limit Order Protocol, Liquidity Protocol, and Opensource/Web3 utilities.

---

### 2. Main Network Overview (`1inch-docs/docs/1inch-network-overview.mdx`)
- **1inch Network** unites decentralized protocols for efficient, secure DeFi operations across multiple chains.
- Key components: dApp, Aggregation Protocol, Liquidity Protocol, Limit Order Protocol, P2P transactions, and Mobile Wallet.
- Supported on many EVM-compatible networks.
- Governance is split between the 1inch Foundation, core contributors, and the DAO.

---

### 3. Wallet Auto-Connect (`1inch-docs/docs/wallet-auto-connect.mdx`)
- How to detect and interact with the 1inch Wallet provider in web3 applications.
- Code snippets for provider injection and retrieving accounts/network.

---

### 4. Aggregation Protocol (`1inch-docs/docs/aggregation-protocol/`)
- **Introduction**: The 1inch API v5 (Pathfinder) finds optimal swap routes across multiple protocols and market depths.
- Supported networks: Ethereum, BNB, Polygon, and more.
- Migration notice: public Swap API is deprecated; use the Developer Portal.
- Quick start guide and further documentation in subfolders.

---

### 5. Educational Resources (`1inch-docs/docs/educational-resources/`)
- Articles for all levels (beginner, intermediate, advanced).
  - **Beginner**: Key DeFi concepts, staking, slippage, etc.
  - **Intermediate**: Using the dApp, troubleshooting, reading block explorers.
  - **Advanced**: Developer-focused topics like MEV, transaction data, and advanced strategies.

---

### 6. Fusion Swap (`1inch-docs/docs/fusion-swap/`)
- **Introduction**: Fusion Mode enables gasless swaps using a Dutch auction mechanism, filled by third-party Resolvers.
- Describes how the auction rate works and how Resolvers can profit.
- SDK available for integration.

---

### 7. Governance (`1inch-docs/docs/governance/`)
- **Overview**: The 1inch DAO governs the network, with decisions made via the 1INCH token.
- Explains the DAO’s role, governance process, and the need for staking to vote.
- Additional docs cover proposal lifecycle, treasury, instant governance, and glossary.

---

### 8. Limit Order Protocol (`1inch-docs/docs/limit-order-protocol/`)
- **Introduction**: Smart contracts for flexible, gas-efficient limit and RFQ orders on EVM chains.
- Features: partial fill, predicates, cancellation, validation, and callback.
- RFQ orders are optimized for market-makers.
- Supported token standards: ERC-20, ERC-721, ERC-1155, and extensible.
- Integration with the 1inch dApp and APIs.

---

### 9. RabbitHole (`1inch-docs/docs/rabbithole/`)
- **Summary**: RabbitHole is a proxy to protect MetaMask users from sandwich attacks by routing transactions through Flashbots.
- Explains technical limitations and how the feature works for MetaMask on Mainnet.

---

### 10. Spot Price Aggregator (`1inch-docs/docs/spot-price-aggregator/`)
- **Introduction**: Smart contracts to extract token price data from DEXes, intended for off-chain use.
- Handles wrapped tokens and uses connector tokens for indirect pairs.
- Lists supported deployments, DEXes, wrappers, and connectors for Ethereum and BSC.
- Provides links to oracles and contract addresses.

---

**In summary:**
The `1inch-docs` folder contains comprehensive documentation for all major 1inch protocols and tools, including user guides, developer resources, governance, and technical references. The docs are organized by protocol and topic, with special sections for educational content and advanced features like Fusion Mode and RabbitHole.