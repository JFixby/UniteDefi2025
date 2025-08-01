# Cross-Chain Order Creator CLI

This CLI tool allows you to create various types of cross-chain atomic swap orders between Bitcoin and Ethereum networks, based on the 1inch Cross-Chain SDK documentation.

## 🚀 Quick Start

### Prerequisites
- Node.js and npm installed
- TypeScript and ts-node installed
- Environment variables configured in `.env` file

### Basic Usage

```bash
# Create a single BTC to ETH order
npm run order:btc2evm single-fill

# Create a single ETH to BTC order  
npm run order:evm2btc single-fill

# Create all order types
npm run order:btc2evm all
npm run order:evm2btc all
```

## 📋 Available Order Types

### 1. Single Fill Order (100% Fill)
**Use Case**: Simple atomic swap with single execution
```bash
npm run order:btc2evm single-fill
npm run order:evm2btc single-fill
```

**Features**:
- Single secret for one-time use
- No partial fills allowed
- No multiple fills allowed
- Standard time locks with finality periods

### 2. Multiple Fill Order (100% Fill)
**Use Case**: Order that can be filled multiple times, filled completely
```bash
npm run order:btc2evm multiple-fill-100
npm run order:evm2btc multiple-fill-100
```

**Features**:
- Merkle tree of secrets for multiple fills
- Partial fills allowed
- Multiple fills allowed
- Uses last secret index for 100% fill

### 3. Multiple Fill Order (50% Partial Fill)
**Use Case**: Order that can be filled multiple times, filled partially
```bash
npm run order:btc2evm multiple-fill-50
npm run order:evm2btc multiple-fill-50
```

**Features**:
- Same structure as multiple fill but with partial fill
- Fills 50% of order
- Calculates appropriate secret index for partial amount
- Pro-rata calculation for destination amount

### 4. Reverse Direction Swaps
**Use Case**: Swap in the opposite direction
```bash
# BTC to ETH order creator, but create ETH to BTC swap
npm run order:btc2evm eth-to-btc

# ETH to BTC order creator, but create BTC to ETH swap  
npm run order:evm2btc btc-to-eth
```

**Features**:
- Reversed asset direction
- Same security features as regular swaps
- Different decimal precision handling

### 5. Cancellation Order
**Use Case**: Order designed for cancellation testing
```bash
npm run order:btc2evm cancellation
npm run order:evm2btc cancellation
```

**Features**:
- No finality locks for testing
- Same structure as regular orders
- Optimized for cancellation scenarios

## 🛠️ CLI Options

### Basic Commands
```bash
# Show help
npm run order:btc2evm --help
npm run order:evm2btc --help

# Create specific order type
npm run order:btc2evm [orderType]
npm run order:evm2btc [orderType]
```

### Available Options
- `--help, -h`: Show help message
- `--amount <value>`: Specify asset amount (BTC for BTC→ETH, ETH for ETH→BTC)
- `--eth-amount <value>`: Specify ETH amount (for BTC→ETH orders)
- `--btc-amount <value>`: Specify BTC amount (for ETH→BTC orders)
- `--output <path>`: Specify output directory (default: ../orders)

### Examples with Custom Amounts
```bash
# Create single fill with custom amounts
npm run order:btc2evm single-fill --amount 0.001 --eth-amount 0.01

# Create multiple fill with custom amounts
npm run order:evm2btc multiple-fill-50 --amount 0.01 --btc-amount 0.001

# Create all orders with custom output directory
npm run order:btc2evm all --output ./my-orders
```

## 📁 Output Structure

Orders are saved as JSON files in the specified output directory:

```
orders/
├── order-single_fill-1703123456789.json
├── order-multiple_fill_100-1703123456790.json
├── order-multiple_fill_50-1703123456791.json
├── order-eth_to_btc-1703123456792.json
└── order-cancellation-1703123456793.json
```

### Order File Structure
```json
{
  "orderId": "order-single_fill-1703123456789",
  "timestamp": 1703123456789,
  "network": "polygon",
  "chainId": 137,
  "orderType": "SINGLE_FILL",
  "BTCSeller": {
    "EVMAddress": "0x...",
    "provides": {
      "asset": "BTC",
      "amount": "0.002"
    },
    "wants": {
      "asset": "ETH", 
      "amount": "20000000000000000"
    }
  },
  "timelock": {
    "withdrawalPeriod": 10,
    "cancellationPeriod": 121,
    "publicWithdrawalPeriod": 120,
    "publicCancellationPeriod": 122
  },
  "fillOptions": {
    "allowPartialFills": false,
    "allowMultipleFills": false
  },
  "status": "CREATED",
  "contracts": {
    "btcEscrowFactory": "0x",
    "accessToken": "0x"
  },
  "crossChain": {
    "srcChainId": 137,
    "dstChainId": 1,
    "srcSafetyDeposit": "1000000000000000",
    "dstSafetyDeposit": "1000000000000000",
    "hashLock": {
      "type": "SINGLE",
      "secret": "0x..."
    }
  }
}
```

## 🔧 Configuration

### Environment Variables
Create a `.env` file in the project root:

```env
# Network Configuration
RPC_URL=https://polygon-rpc.com
CHAIN_ID=137

# Wallet Configuration  
ALICE_PRIVATE_KEY=0x...
ALICE_ADDRESS=0x...

# Contract Addresses (update these with deployed addresses)
FACTORY_ADDRESS=0x...
ACCESS_TOKEN_ADDRESS=0x...
```

### Network Support
- **Polygon**: Chain ID 137 (default)
- **Ethereum**: Chain ID 1
- **Bitcoin**: Chain ID 1 (destination)

## 🎯 Order Execution Flow

### BTC to ETH Flow
1. **BTC Seller** creates order (provides BTC, wants ETH)
2. **ETH Buyer** fills order (provides ETH, receives BTC)
3. Atomic swap execution with hash locks

### ETH to BTC Flow  
1. **ETH Seller** creates order (provides ETH, wants BTC)
2. **BTC Buyer** fills order (provides BTC, receives ETH)
3. Atomic swap execution with hash locks

## 🔒 Security Features

### Hash Locks
- **Single Fill**: One secret for one-time use
- **Multiple Fill**: Merkle tree of secrets for multiple fills
- **Partial Fill**: Pro-rata secret selection

### Time Locks
- **Withdrawal Period**: Finality lock (10s)
- **Public Withdrawal**: Private withdrawal window (120s)
- **Cancellation Period**: Public cancellation window (121s)
- **Public Cancellation**: Private cancellation window (122s)

### Safety Deposits
- ETH deposits on both chains for gas fees
- Configurable amounts per order

## 🚨 Error Handling

The CLI includes comprehensive error handling:

```bash
# Invalid order type
❌ Unknown order type: invalid-type
Use --help to see available options

# Network connection issues
❌ Error: Network connection failed

# Invalid amounts
❌ Error: Invalid amount format
```

## 📚 Advanced Usage

### Custom Amounts
```bash
# Large amounts
npm run order:btc2evm single-fill --amount 1.0 --eth-amount 15.0

# Small amounts  
npm run order:evm2btc single-fill --amount 0.001 --btc-amount 0.0001
```

### Batch Order Creation
```bash
# Create all order types with custom amounts
npm run order:btc2evm all --amount 0.005 --eth-amount 0.05 --output ./batch-orders
```

### Integration with Other Tools
```bash
# Create order and immediately use for testing
npm run order:btc2evm single-fill && npm run test:order

# Create order for specific network
CHAIN_ID=1 npm run order:evm2btc single-fill
```

## 🔄 Order Lifecycle

1. **CREATED**: Order created and saved to file
2. **FILLED**: Order has been filled by counterparty
3. **COMPLETED**: Atomic swap successfully completed
4. **CANCELLED**: Order cancelled due to timeout or user action

## 📖 Additional Resources

- [1inch Cross-Chain SDK Documentation](../1inch-docs/)
- [Order Examples Documentation](./order_examples.md)
- [Cross-Chain Resolver Examples](../cross-chain-resolver-example/)

## 🤝 Contributing

To add new order types or modify existing ones:

1. Update the `OrderType` enum in the source files
2. Add the new order type to the `createOrderByType` function
3. Update the CLI argument parsing
4. Add corresponding npm scripts
5. Update this documentation

## 📄 License

MIT License - see LICENSE file for details. 