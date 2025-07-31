# ETH-Side: Ethereum Implementation for BTC-ETH Swaps

This module handles the **Ethereum side** of the Bitcoin-Ethereum cross-chain swap implementation, extending the 1inch Fusion+ protocol to support Bitcoin swaps using the Lightning Network.

## Overview

The eth-side is responsible for:
- Managing Ethereum/Polygon side of cross-chain swaps
- Integrating with 1inch Limit Order Protocol contracts
- Handling HTLC (Hash Time Locked Contract) logic on EVM chains
- Processing swap settlements and escrow management
- Coordinating with Lightning Network for Bitcoin transfers

## Architecture

```
Lightning Network ⬄ Polygon (1inch) ⬄ Ethereum Mainnet
                    ↑
                ETH-Side handles this layer
```

## Key Components

### 1. Cross-Chain Order Management
- Uses `@1inch/cross-chain-sdk` for Fusion+ integration
- Manages escrow contracts and settlement logic
- Handles order creation and resolution

### 2. HTLC Implementation
- Hash Time Locked Contracts for secure cross-chain swaps
- Time-based settlement with automatic refund mechanisms
- Secret management for atomic swap completion

### 3. Polygon Integration
- Uses Polygon for cheaper and faster transactions
- Compatible with Ethereum tooling and contracts
- Supports 1inch Limit Order Protocol deployment

## Dependencies

- `@1inch/cross-chain-sdk` - Core cross-chain functionality
- `ethers` - Ethereum blockchain interaction
- `@1inch/byte-utils` - Byte encoding/decoding utilities

## Usage

This module works in conjunction with:
- **Lightning Network side** - Handles Bitcoin transfers
- **Cross-chain resolver** - Coordinates between chains
- **1inch Fusion+ protocol** - Provides liquidity and order matching

## Development

```bash
npm install
npm run build
npm test
```

## Integration Points

- Receives swap requests from Lightning Network
- Creates escrow contracts on Polygon/Ethereum
- Manages settlement and refund logic
- Communicates with 1inch Fusion+ for order execution 