# ⚡ Lightning Network + 1inch Fusion+ Cross-Chain Swap

## 1. Project Overview

This project extends 1inch Fusion+ to Bitcoin by leveraging the Lightning Network for instant, low-cost Bitcoin transactions while maintaining the security and efficiency of 1inch's proven cross-chain swap protocol. The solution enables seamless bidirectional swaps between Bitcoin and Ethereum (via Polygon) with near-instant settlement on the Bitcoin side and competitive pricing through 1inch's Dutch auction mechanism.

### 1.1 Problem Description for Hackathon

**Task**: Extend Fusion+ to Bitcoin

**Qualification Requirements**:
- Preserve hashlock and timelock functionality for the non-EVM implementation
- Swap functionality should be bidirectional (swaps should be possible to and from Ethereum)
- Onchain (mainnet/L2 or testnet) execution of token transfers should be presented during the final demo

**Stretch Goals**:
- UI implementation
- Enable partial fills

**Previous Solution Review**: The existing hashlocked-cli implementation was criticized for not following the existing 1inch cadence, requiring users to manually deploy escrows and requiring resolvers to watch for settlement transactions. The jury requested a solution that builds on this idea with PSBT support, automated resolver settlement, and a proper relayer system.

## 2. Executive Summary

### 2.1 Solution Overview

Our solution integrates Lightning Network with 1inch Fusion+ to create a seamless cross-chain swap experience:

**Bitcoin Side**: Lightning Network provides instant, zero-fee transactions with built-in HTLC support
**Ethereum Side**: 1inch Fusion+ handles the EVM portion using Polygon for cost efficiency
**Bridge**: Automated resolver system coordinates between both networks using shared secrets

**Key Innovations**:
- **Instant Bitcoin Settlement**: Lightning Network enables sub-second Bitcoin transactions
- **Cost Efficiency**: Polygon reduces Ethereum gas costs by 99%+
- **Automated Execution**: Resolvers handle all cross-chain coordination automatically
- **Bidirectional Support**: Swaps work in both directions (BTC→ETH and ETH→BTC)

## 3. Architecture

### 3.1 System Components

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   Lightning     │    │   1inch Fusion+  │    │   Polygon       │
│   Network       │    │   (Resolver)     │    │   (EVM Side)    │
│                 │    │                  │    │                 │
│ • HTLC Support  │◄──►│ • Order Matching │◄──►│ • Smart         │
│ • Instant Tx    │    │ • Secret Mgmt    │    │   Contracts     │
│ • Zero Fees     │    │ • Cross-chain    │    │ • Escrow        │
│ • PSBT Support  │    │   Coordination   │    │ • Dutch Auction │
└─────────────────┘    └──────────────────┘    └─────────────────┘
```

### 3.2 Technical Stack

**Bitcoin Layer**:
- Lightning Network (LND nodes)
- HTLC (Hash Time Locked Contracts)
- PSBT (Partially Signed Bitcoin Transactions)

**Ethereum Layer**:
- Polygon Network (L2 scaling solution)
- 1inch Fusion+ Protocol
- Smart Contracts (Escrow, Settlement)

**Bridge Layer**:
- Cross-chain SDK
- Resolver System
- Secret Management

## 4. Roles, Stakeholders, and Participants

### 4.1 Core Participants

**Maker (User)**:
- Initiates the swap
- Signs the 1inch Fusion order
- Provides source assets (BTC or ETH)
- Receives destination assets automatically

**Resolver (Professional Trader/Market Maker)**:
- KYC/KYB verified entities
- Executes cross-chain coordination
- Provides liquidity and competitive pricing
- Handles all technical complexity

**Lightning Network Node**:
- Processes Bitcoin HTLCs
- Enables instant settlement
- Provides routing and liquidity

### 4.2 Supporting Infrastructure

**1inch Network**:
- Order matching and routing
- Dutch auction mechanism
- Relayer services

**Polygon Network**:
- Low-cost EVM execution
- Fast finality
- Ethereum compatibility

## 5. Main User Scenario for Demo

### 5.1 BTC → ETH Swap Flow

1. **Order Creation**: User creates 1inch Fusion+ order for BTC→ETH swap
2. **Lightning HTLC**: Resolver creates Lightning Network HTLC with shared secret
3. **Polygon Escrow**: Resolver deposits ETH into Polygon escrow contract
4. **Bitcoin Payment**: User sends Bitcoin to Lightning HTLC address
5. **Secret Revelation**: Resolver reveals secret to claim Bitcoin
6. **ETH Delivery**: User receives ETH on Polygon (can bridge to mainnet)

### 5.2 ETH → BTC Swap Flow

1. **Order Creation**: User creates 1inch Fusion+ order for ETH→BTC swap
2. **Polygon Escrow**: Resolver creates escrow on Polygon for user's ETH
3. **Lightning HTLC**: Resolver creates Lightning HTLC for Bitcoin delivery
4. **Secret Revelation**: Resolver reveals secret to claim ETH
5. **Bitcoin Delivery**: User receives Bitcoin via Lightning Network

## 6. Technical Details for Developers and Jury

### 6.1 Addressing 1inch Concerns

**Previous Issues Addressed**:

1. **Manual Escrow Deployment**: ✅ Automated by resolvers
2. **User Involvement**: ✅ Zero user interaction after order creation
3. **Settlement Watching**: ✅ Automated by resolver system
4. **PSBT Support**: ✅ Integrated for Bitcoin transactions
5. **Relayer System**: ✅ Built on 1inch's existing infrastructure

**Improvements Over Hashlocked-CLI**:
- Follows 1inch Fusion+ cadence exactly
- Automated resolver settlement
- No manual escrow deployment required
- Integrated relayer system
- PSBT support for seamless Bitcoin transactions

### 6.2 Lightning Network Advantages

**Why Lightning Network?**:

1. **Instant Settlement**: Sub-second Bitcoin transactions vs. 10+ minute L1 confirmations
2. **Zero Transaction Fees**: No Bitcoin network fees for HTLC operations
3. **Built-in HTLC Support**: Native Lightning Network HTLCs
4. **Arbitrage Opportunities**: Faster execution enables better arbitrage
5. **Scalability**: Handles thousands of transactions per second
6. **PSBT Support**: Partially Signed Bitcoin Transactions for seamless integration

**Arbitrage Benefits**:
- **Faster Execution**: Lightning enables immediate arbitrage opportunities
- **Lower Costs**: Zero fees reduce arbitrage barriers
- **Better Pricing**: Instant settlement improves market efficiency

### 6.3 1inch Integration Details

**Resolver Role**:
- KYC/KYB verified entities with legal agreements
- Handle all cross-chain coordination
- Provide competitive pricing through Dutch auctions
- Execute settlements automatically

**Swap Scenario**:
1. User signs 1inch Fusion+ order
2. Resolver creates escrows on both chains
3. Resolver coordinates Lightning Network HTLC
4. Automated secret revelation and settlement
5. User receives assets without further interaction

**1inch Benefits**:
- **Dutch Auction**: Competitive pricing through resolver competition
- **Partial Fills**: Large orders can be filled by multiple resolvers
- **Gas Optimization**: Automatic gas price adjustments
- **Security**: Battle-tested smart contracts and protocols

**1inch Network Benefits**:
- **Increased Volume**: Bitcoin integration expands market reach
- **Better Liquidity**: Lightning Network provides instant Bitcoin liquidity
- **Competitive Advantage**: First major DEX with Lightning integration
- **User Experience**: Seamless cross-chain swaps

## 7. Polygon Usage and Technical Considerations

### 7.1 Why Polygon?

**Cost Efficiency**:
- **99%+ Gas Savings**: ~0.0003 ETH vs 10.51 ETH on mainnet
- **Faster Transactions**: 2-second finality vs 12+ seconds
- **Ethereum Compatibility**: Same smart contracts, same tooling

**Production Readiness**:
- **Mainnet Compatibility**: Code runs identically on Ethereum mainnet
- **Easy Migration**: Simple parameter change for mainnet deployment
- **Risk Management**: Test thoroughly on Polygon before mainnet

### 7.2 Cross-Chain Bridge Strategy

**Polygon → Ethereum Mainnet**:
- Use 1inch cross-chain swap to bridge results
- Leverage existing 1inch infrastructure
- Maintain user experience consistency

**Lightning → Bitcoin L1**:
- Lightning Network provides instant settlement
- Optional L1 settlement available through Lightning
- Similar to how Lightning works over Bitcoin L1

### 7.3 Implementation Strategy

**Hackathon Phase**:
- Use Polygon for cost-effective development and testing
- Lightning Network testnet for Bitcoin operations
- Full end-to-end functionality demonstration

**Production Phase**:
- Deploy on Ethereum mainnet with same codebase
- Use Lightning Network mainnet
- Maintain Polygon as cost-effective alternative

## 8. Getting Started

### 8.1 Prerequisites

```bash
# Node.js 16+
node --version

# Lightning Network setup (Polar)
# 1inch API key
# Polygon testnet funds
```

### 8.2 Environment Setup

```bash
# Clone repository
git clone <repository-url>
cd UniteDefi2025

# Install dependencies
npm install

# Setup environment
cp .env.example .env
# Add your 1inch API key and private keys
```

### 8.3 Running the Demo

```bash
# Start Lightning Network nodes
cd LN
./setup_polar_macos.sh

# Run cross-chain swap
cd ../cross-chain-sdk
npm run demo:btc-eth-swap
```

## 9. Security Considerations

### 9.1 Hash Time Locked Contracts (HTLCs)
- **Hashlock**: SHA-256 hash ensures atomic execution
- **Timelock**: Automatic refunds prevent fund loss
- **Cross-chain Coordination**: Shared secrets enable trustless swaps

### 9.2 Lightning Network Security
- **HTLC Safety**: Built-in Lightning Network HTLC protection
- **Channel Security**: Established channels with sufficient capacity
- **Routing**: Automatic pathfinding with fallback options

### 9.3 1inch Fusion+ Security
- **Resolver Verification**: KYC/KYB verified entities
- **Smart Contract Audits**: Battle-tested 1inch contracts
- **Dutch Auction**: Competitive pricing prevents manipulation

## 10. Future Enhancements

### 10.1 Stretch Goals
- **UI Implementation**: Web interface for seamless user experience
- **Partial Fills**: Support for large order splitting
- **Mobile App**: Native mobile application

### 10.2 Production Features
- **Mainnet Deployment**: Full production deployment
- **Additional Networks**: Support for more EVM chains
- **Advanced Features**: Limit orders, stop-loss, etc.

## 11. Conclusion

This solution successfully extends 1inch Fusion+ to Bitcoin by leveraging the Lightning Network's instant settlement capabilities while maintaining the security and efficiency of 1inch's proven cross-chain protocol. The integration provides users with seamless bidirectional swaps between Bitcoin and Ethereum with near-instant settlement, competitive pricing, and zero manual intervention required.

The solution addresses all concerns raised by the 1inch jury regarding the previous hashlocked-cli implementation and provides a production-ready foundation for Lightning Network integration with major DEX protocols.