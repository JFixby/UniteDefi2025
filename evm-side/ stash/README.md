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

## Project Files

### Core Implementation Files

#### `balance.ts` (7.6KB, 213 lines)
**Purpose**: Comprehensive balance checking utility for Ethereum/Polygon networks

**Key Features**:
- **Multi-token balance checking** for ALICE and CAROL wallets
- **Supported tokens**: USDT, USDC, WETH, WMATIC, BNL (official addresses)
- **Network support**: Polygon and Ethereum Mainnet
- **Robust error handling** with exponential backoff retry logic
- **Rate limiting protection** for RPC calls
- **Native token balance** checking (ETH/MATIC)
- **Formatted output** with clear balance summaries

**Technical Details**:
- Uses ethers.js for blockchain interaction
- Implements retry mechanism with configurable delays
- Validates private keys before execution
- Provides detailed error messages and troubleshooting tips
- Supports both Polygon and Ethereum mainnet networks

#### `variables.ts` (1.7KB, 56 lines)
**Purpose**: Centralized configuration and environment variable management

**Key Features**:
- **Environment variable loading** with dotenv
- **Network configuration** (POLYGON/ETH_MAINNET)
- **RPC URL management** for different networks
- **Private key validation** for ALICE and CAROL
- **API token management** for 1inch Dev Portal
- **Type-safe network selection** with validation

**Configuration Options**:
- `ALICE_PRIVATE_KEY` - Private key for ALICE wallet
- `CAROL_PRIVATE_KEY` - Private key for CAROL wallet
- `DEV_PORTAL_API_TOKEN` - 1inch API token
- `NETWORK` - Target network (POLYGON/ETH_MAINNET)
- `POLYGON_RPC_URL` - Custom Polygon RPC endpoint
- `ETHEREUM_RPC_URL` - Custom Ethereum RPC endpoint

#### `print-variables.ts` (2.0KB, 66 lines)
**Purpose**: Debug utility for displaying current configuration state

**Key Features**:
- **Configuration validation** display
- **Secure private key display** (truncated for security)
- **Network information** output
- **Validation status** reporting
- **Full credential display** for debugging (when available)

**Output Includes**:
- Environment variable status
- RPC URL configurations
- Chain ID mappings
- Private key validation results
- API token validation status

### Configuration Files

#### `package.json` (496B, 25 lines)
**Purpose**: Node.js project configuration and dependency management

**Dependencies**:
- **Core**: `@1inch/cross-chain-sdk`, `ethers`, `dotenv`
- **Development**: `typescript`, `ts-node`, `nodemon`, `@types/node`

**Scripts**:
- `test` - Placeholder for test execution
- TypeScript compilation and development tools configured

#### `tsconfig.json` (505B, 26 lines)
**Purpose**: TypeScript compiler configuration

**Key Settings**:
- **Target**: ES2020 for modern JavaScript features
- **Module**: CommonJS for Node.js compatibility
- **Strict mode**: Enabled for type safety
- **Output**: Compiled to `./dist` directory
- **Source maps**: Enabled for debugging
- **Declaration files**: Generated for type definitions

### Generated Files

#### `package-lock.json` (69KB, 1940 lines)
**Purpose**: Locked dependency versions for reproducible builds

**Contains**:
- Exact versions of all dependencies and sub-dependencies
- Integrity hashes for security verification
- Dependency tree structure

#### `node_modules/` (Directory)
**Purpose**: Installed npm packages and dependencies

**Contains**:
- All project dependencies and their sub-dependencies
- TypeScript type definitions
- Development tools and utilities

## File Structure Summary

```
eth-side/
├── balance.ts              # Main balance checking utility
├── variables.ts            # Configuration management
├── print-variables.ts      # Debug utility
├── package.json            # Project configuration
├── tsconfig.json           # TypeScript configuration
├── package-lock.json       # Dependency lock file
├── node_modules/           # Installed dependencies
└── README.md              # This documentation
```

## Usage Examples

### Check Balances
```bash
npx ts-node balance.ts
```

### Print Configuration
```bash
npx ts-node print-variables.ts
```

### Development
```bash
npm install
npx tsc
``` 