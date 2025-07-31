# Escrow Deposit Implementation

## What it does

`deposit.ts` creates hash-locked escrows using the 1inch EscrowFactory. Users deposit native tokens (ETH, MATIC, etc.) that can only be withdrawn with a secret, or cancelled after a time period.

## How it works

```
User → EscrowDeposit Class → EscrowFactory → Escrow Contract
```

1. **Deposit**: User creates escrow with secret hash and timelock
2. **Lock**: Native tokens are locked in escrow contract
3. **Withdraw**: Taker reveals secret to unlock funds
4. **Cancel**: Anyone can cancel after timelock expires

## Key Parameters

### Deposit Parameters
```typescript
{
  hashedSecret: string,        // Hash of the secret (keccak256)
  amount: string,              // Amount to deposit (e.g., "0.01")
  takerAddress: string,        // Who can withdraw with secret
  timelock: {
    withdrawalPeriod: number,  // Seconds until withdrawal starts
    cancellationPeriod: number // Seconds until cancellation allowed
  },
  safetyDeposit: string        // Extra funds for gas
}
```

### Network Configuration
```typescript
{
  rpcUrl: string,              // RPC endpoint
  chainId: number,             // Chain ID (1=ETH, 137=Polygon)
  networkName: string          // Display name
}
```

## Quick Start

### Code Example
```typescript
import { EscrowDeposit } from './deposit';

const escrow = new EscrowDeposit(
  '0x1234...', // Private key
  '0xa7bcb4eac8964306f9e3764f67db6a7af6ddf99a', // Factory address
  { rpcUrl: 'https://polygon-rpc.com', chainId: 137, networkName: 'POLYGON' }
);

const result = await escrow.createDeposit({
  hashedSecret: '0xabcd...',
  amount: '0.01',
  takerAddress: '0x742d35Cc6634C0532925a3b8D4C9db96C4b4d8b6',
  timelock: { withdrawalPeriod: 3600, cancellationPeriod: 7200 },
  safetyDeposit: '0.001'
});
```

### Command Line
```bash
npx ts-node deposit.ts <private_key> <rpc_url> <chain_id> <network_name> <factory_address> <hashed_secret> [amount] [taker] [withdrawal_time] [cancel_time] [safety_deposit]
```

## Main Methods

- **`createDeposit(params)`** - Creates escrow, returns `{escrowAddress, txHash, blockTimestamp}`
- **`withdrawFromEscrow(escrowAddress, secret, immutables)`** - Withdraws funds using secret
- **`cancelEscrow(escrowAddress, immutables)`** - Cancels escrow after timelock
- **`getEscrowFactoryAddress()`** - Returns factory address
- **`getSignerAddress()`** - Returns signer address

## Contract Address

**EscrowFactory**: `0xa7bcb4eac8964306f9e3764f67db6a7af6ddf99a` (same on all networks)

## Security

- 🔐 **Keep secrets secure** - they unlock escrow funds
- ⏱️ **Timelocks are final** - cannot be changed after deployment
- ⚠️ **Never hardcode private keys** - use environment variables

## Error Handling

Handles invalid addresses, insufficient funds, network issues, and transaction failures.

## Gas Costs

- **Deploy**: ~200-300k gas
- **Withdraw**: ~50-100k gas  
- **Cancel**: ~30-50k gas

## Testing

Test on Polygon Mumbai, Goerli/Sepolia, or BSC Testnet. Covers deposit, withdrawal, cancellation, and error scenarios.

## Integration

`run_deposit.ts` provides higher-level interface with secret generation and multiple scenarios.

## Dependencies

- **Required**: `ethers ^6.0.0`, `typescript ^5.0.0`
- **Optional**: `dotenv ^16.0.0` for environment variables

## Troubleshooting

- **Invalid Address**: Verify contract address for your network
- **Insufficient Funds**: Ensure enough tokens for deposit + gas
- **Transaction Failed**: Check gas limits and network connectivity
- **Address Not Found**: Wait for confirmation, check transaction receipt

## Related Projects

**Cross-Chain Resolver Example** - Advanced cross-chain atomic swaps: [cross-chain-resolver-example](../cross-chain-resolver-example/)

### Key Contract Files:
- **`contracts/src/Resolver.sol`** - Orchestrates cross-chain swaps by deploying escrows on both chains and managing the atomic swap process
- **`contracts/src/TestEscrowFactory.sol`** - Extended escrow factory for testing, inherits from 1inch's EscrowFactory with test-specific configurations

### Key Test Files:
- **`tests/main.spec.ts`** - Comprehensive test suite demonstrating Ethereum ↔ BSC USDC swaps
- **`tests/config.ts`** - Network configuration for source and destination chains
- **`tests/resolver.ts`** - TypeScript wrapper for interacting with the Resolver contract

## Future Features

- ERC20 token support
- Batch operations
- Event monitoring
- Gas estimation

## License

For educational and development purposes. Use at your own risk in production. 