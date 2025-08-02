# Escrow Contract Deployment Guide

This guide explains how to deploy the Escrow contract using the TypeScript deployment scripts.

## Prerequisites

1. **Node.js and npm** installed
2. **Hardhat** configured
3. **Private key** with sufficient funds for deployment
4. **RPC URL** for the target network (optional)

## Installation

1. Install dependencies:
   ```bash
   npm install
   ```

2. Compile the contract:
   ```bash
   npm run compile
   ```

## Environment Setup

Create a `.env` file in the project root with the following variables:

```env
# Alice's private key for deployment
ALICE_PRIVATE_KEY=your_private_key_here

# Carol's private key for testing
CAROL_PRIVATE_KEY=your_carol_private_key_here

# Network selection (POLYGON or ETH_MAINNET)
NETWORK=POLYGON

# RPC URLs (optional - defaults to public RPCs)
POLYGON_RPC_URL=https://polygon-rpc.com
ETHEREUM_RPC_URL=https://eth-mainnet.g.alchemy.com/v2/demo

# Gas settings (optional)
GAS_PRICE=30
GAS_LIMIT=2000000
```

## Deployment Scripts

### 1. Helper Functions (`deployEscrowContractHelpers.ts`)

The `deployEscrowContractHelpers.ts` file contains reusable helper functions:

- `deployEscrowContract()` - Main deployment function
- `verifyContractDeployment()` - Verify contract deployment
- `getEscrowContract()` - Get contract instance
- `saveDeploymentInfo()` - Save deployment details
- `loadDeploymentInfo()` - Load deployment details
- `displayDeploymentInfo()` - Display formatted deployment info
- `validateDeploymentConfig()` - Validate deployment config

### 2. Contract Deployment (`deployEscrowContract.ts`)

This script deploys the contract to the network specified in `variables.ts` using Alice's account.

### 3. Contract Methods (`deposit.ts`)

The `deposit.ts` file contains TypeScript methods for interacting with the escrow contract:

- `EscrowContractManager` - Main class for contract interactions
- `createDeposit()` - Create a new deposit
- `claimDeposit()` - Claim a deposit
- `cancelDeposit()` - Cancel a deposit
- `getDepositInfo()` - Get deposit information
- `displayContractInfo()` - Display contract information
- `displayDepositInfo()` - Display deposit information

## Usage

### Deploy to Network

```bash
# Using npm script
npm run deploy:contract

# Or directly with ts-node
npx ts-node deployEscrowContract.ts
```

The network is determined by the `NETWORK` variable in `variables.ts` (POLYGON or ETH_MAINNET).

### Test Escrow Functionality

```bash
# Test deposit and claim functionality
npm run check:escrow

# Or directly with ts-node
npx ts-node checkEscrow.ts
```

This will:
1. Alice deposits 0.03 native tokens
2. Print transaction link on explorer
3. Pause and wait for user input
4. Carol claims the deposit
5. Print transaction link on explorer

### Deploy to Other Networks

You can modify the `deploy_escrow_polygon.ts` script or create new scripts for other networks:

```typescript
// Example for Ethereum mainnet
const deploymentConfig: DeploymentConfig = {
  networkName: "ethereum",
  rpcUrl: process.env.ETHEREUM_RPC_URL,
  privateKey: process.env.ALICE_PRIVATE_KEY,
  gasPrice: process.env.GAS_PRICE || "20",
  gasLimit: parseInt(process.env.GAS_LIMIT || "2000000")
};
```

## Network Configuration

Network configuration is provided through environment variables and the `variables.ts` file. The deployment scripts use the RPC URL and other network-specific settings from these sources.

## Output Files

After successful deployment, the following files are created:

1. **Deployment JSON** - `deployment-polygon-{timestamp}.json`
   - Contains full deployment information
   - Includes contract ABI
   - Useful for integration

2. **Address File** - `polygon-escrow-address.txt`
   - Contains just the contract address
   - Easy to read for scripts

## Example Output

```
🚀 Starting Escrow contract deployment to Polygon...
🌐 Network: polygon (Chain ID: 137)
📡 Connected to polygon via RPC
👤 Deployer address: 0x1234...5678
⛽ Gas limit: 2000000
💰 Gas price: 30 gwei
📦 Deploying contract...
⏳ Waiting for deployment confirmation...
✅ Contract deployed successfully!
📍 Contract address: 0xabcd...efgh
🔗 Transaction hash: 0x1234...5678
⛽ Gas used: 1234567

============================================================
🎉 ESCROW CONTRACT DEPLOYMENT SUCCESSFUL
============================================================
📋 Contract: Escrow
📍 Address: 0xabcd...efgh
🌐 Network: polygon
👤 Deployer: 0x1234...5678
🔗 Transaction: 0x1234...5678
⛽ Gas Used: 1234567
⏰ Timestamp: 2024-01-15T10:30:00.000Z
============================================================

📝 Next steps:
1. Verify the contract on the blockchain explorer
2. Test the contract functions
3. Update your application with the contract address
============================================================

💾 Deployment info saved to: deployment-polygon-1705312200000.json
📍 Contract address saved to: polygon-escrow-address.txt
🎉 Deployment completed successfully!
📋 Contract is ready for use on Polygon network
```

## Security Notes

1. **Never commit your private key** to version control
2. **Use environment variables** for sensitive data
3. **Verify the contract** on blockchain explorers after deployment
4. **Test thoroughly** on testnets before mainnet deployment

## Troubleshooting

### Common Issues

1. **"ALICE_PRIVATE_KEY environment variable is required"**
   - Make sure you have a `.env` file with your private key

2. **"Contract deployment failed - no code at address"**
   - Check your RPC URL and network connection
   - Verify you have sufficient funds for deployment

3. **"Gas estimation failed"**
   - Increase gas limit or adjust gas price
   - Check network congestion

4. **TypeScript compilation errors**
   - Run `npm install` to install dependencies
   - Check `tsconfig.json` configuration

### Getting Help

If you encounter issues:

1. Check the error messages carefully
2. Verify your environment setup
3. Test with a smaller gas limit first
4. Use testnets for initial testing 