# Cross-Chain Order Examples

This document provides comprehensive examples of how to create cross-chain orders using the 1inch Cross-Chain SDK. All examples are based on the test file `cross-chain-resolver-example/tests/main.spec.ts`.

## Overview

The `Sdk.CrossChainOrder.new()` method creates cross-chain swap orders that enable atomic swaps between different blockchain networks. Each order consists of four main parameter groups:

1. **Escrow Factory Address** - The factory contract that manages escrow deployments
2. **Order Details** - Basic swap parameters (amounts, assets, maker)
3. **Cross-Chain Configuration** - Hash locks, time locks, and chain IDs
4. **Auction & Access Control** - Auction settings and whitelist configuration
5. **Order Options** - Fill permissions and nonce

```typescript
import { CrossChainOrder } from '@1inch/cross-chain-sdk'
```

## Common Parameters

All examples use these shared parameters:

```typescript


// Common order parameters
const commonParams = {
    salt: Sdk.randBigInt(1000n),
    maker: new Address(await srcChainUser.getAddress()),
    makingAmount: parseUnits('1', 8),          // 1 BTC
    takingAmount: parseUnits('15', 18),        // 15 ETH (approximate rate)
    makerAsset: new Address(config.chain.source.tokens.BTC.address),
    takerAsset: new Address(config.chain.destination.tokens.ETH.address)
}

// Common time locks
const commonTimeLocks = {
    srcWithdrawal: 10n,           // 10s finality lock
    srcPublicWithdrawal: 120n,    // 2m for private withdrawal
    srcCancellation: 121n,        // 1s after public withdrawal
    srcPublicCancellation: 122n,  // 1s after private cancellation
    dstWithdrawal: 10n,           // 10s finality lock
    dstPublicWithdrawal: 100n,    // 100s private withdrawal
    dstCancellation: 101n         // 1s after public withdrawal
}

// Common auction settings
const commonAuction = {
    initialRateBump: 0,
    points: [],
    duration: 120n,
    startTime: srcTimestamp
}

// Common whitelist
const commonWhitelist = [
    {
        address: new Address(src.resolver),
        allowFrom: 0n
    }
]
```

## Example 1: Single Fill Order (100% Fill)

**Use Case**: Simple atomic swap with single execution
**Test**: "should swap Bitcoin -> Ethereum. Single fill only"

```typescript
const secret = uint8ArrayToHex(randomBytes(32))
const order = Sdk.CrossChainOrder.new(
    new Address(src.escrowFactory),
    {
        salt: Sdk.randBigInt(1000n),
        maker: new Address(await srcChainUser.getAddress()),
        makingAmount: parseUnits('1', 8),          // 1 BTC
        takingAmount: parseUnits('15', 18),        // 15 ETH
        makerAsset: new Address(config.chain.source.tokens.BTC.address),
        takerAsset: new Address(config.chain.destination.tokens.ETH.address)
    },
    {
        hashLock: Sdk.HashLock.forSingleFill(secret),
        timeLocks: Sdk.TimeLocks.new({
            srcWithdrawal: 10n,           // 10s finality lock
            srcPublicWithdrawal: 120n,    // 2m for private withdrawal
            srcCancellation: 121n,        // 1s after public withdrawal
            srcPublicCancellation: 122n,  // 1s after private cancellation
            dstWithdrawal: 10n,           // 10s finality lock
            dstPublicWithdrawal: 100n,    // 100s private withdrawal
            dstCancellation: 101n         // 1s after public withdrawal
        }),
        srcChainId,
        dstChainId,
        srcSafetyDeposit: parseEther('0.001'),
        dstSafetyDeposit: parseEther('0.001')
    },
    {
        auction: new Sdk.AuctionDetails({
            initialRateBump: 0,
            points: [],
            duration: 120n,
            startTime: srcTimestamp
        }),
        whitelist: [
            {
                address: new Address(src.resolver),
                allowFrom: 0n
            }
        ],
        resolvingStartTime: 0n
    },
    {
        nonce: Sdk.randBigInt(UINT_40_MAX),
        allowPartialFills: false,
        allowMultipleFills: false
    }
)
```

**Key Features**:
- `hashLock: Sdk.HashLock.forSingleFill(secret)` - Single secret for one-time use
- `allowPartialFills: false` - Must fill entire order
- `allowMultipleFills: false` - Cannot be filled multiple times
- Standard time locks with finality periods

## Example 2: Multiple Fill Order (100% Fill)

**Use Case**: Order that can be filled multiple times, filled completely
**Test**: "should swap Bitcoin -> Ethereum. Multiple fills. Fill 100%"

```typescript
// Generate 11 secrets for multiple fills
const secrets = Array.from({length: 11}).map(() => uint8ArrayToHex(randomBytes(32)))
const secretHashes = secrets.map((s) => Sdk.HashLock.hashSecret(s))
const leaves = Sdk.HashLock.getMerkleLeaves(secrets)

const order = Sdk.CrossChainOrder.new(
    new Address(src.escrowFactory),
    {
        salt: Sdk.randBigInt(1000n),
        maker: new Address(await srcChainUser.getAddress()),
        makingAmount: parseUnits('1', 8),          // 1 BTC
        takingAmount: parseUnits('15', 18),        // 15 ETH
        makerAsset: new Address(config.chain.source.tokens.BTC.address),
        takerAsset: new Address(config.chain.destination.tokens.ETH.address)
    },
    {
        hashLock: Sdk.HashLock.forMultipleFills(leaves),
        timeLocks: Sdk.TimeLocks.new({
            srcWithdrawal: 10n,           // 10s finality lock
            srcPublicWithdrawal: 120n,    // 2m for private withdrawal
            srcCancellation: 121n,        // 1s after public withdrawal
            srcPublicCancellation: 122n,  // 1s after private cancellation
            dstWithdrawal: 10n,           // 10s finality lock
            dstPublicWithdrawal: 100n,    // 100s private withdrawal
            dstCancellation: 101n         // 1s after public withdrawal
        }),
        srcChainId,
        dstChainId,
        srcSafetyDeposit: parseEther('0.001'),
        dstSafetyDeposit: parseEther('0.001')
    },
    {
        auction: new Sdk.AuctionDetails({
            initialRateBump: 0,
            points: [],
            duration: 120n,
            startTime: srcTimestamp
        }),
        whitelist: [
            {
                address: new Address(src.resolver),
                allowFrom: 0n
            }
        ],
        resolvingStartTime: 0n
    },
    {
        nonce: Sdk.randBigInt(UINT_40_MAX),
        allowPartialFills: true,
        allowMultipleFills: true
    }
)
```

**Key Features**:
- `hashLock: Sdk.HashLock.forMultipleFills(leaves)` - Merkle tree of secrets
- `allowPartialFills: true` - Can fill partial amounts
- `allowMultipleFills: true` - Can be filled multiple times
- Uses last secret index for 100% fill

## Example 3: Multiple Fill Order (50% Partial Fill)

**Use Case**: Order that can be filled multiple times, filled partially
**Test**: "should swap Bitcoin -> Ethereum. Multiple fills. Fill 50%"

```typescript
// Generate 11 secrets for multiple fills
const secrets = Array.from({length: 11}).map(() => uint8ArrayToHex(randomBytes(32)))
const secretHashes = secrets.map((s) => Sdk.HashLock.hashSecret(s))
const leaves = Sdk.HashLock.getMerkleLeaves(secrets)

const order = Sdk.CrossChainOrder.new(
    new Address(src.escrowFactory),
    {
        salt: Sdk.randBigInt(1000n),
        maker: new Address(await srcChainUser.getAddress()),
        makingAmount: parseUnits('1', 8),          // 1 BTC
        takingAmount: parseUnits('15', 18),        // 15 ETH
        makerAsset: new Address(config.chain.source.tokens.BTC.address),
        takerAsset: new Address(config.chain.destination.tokens.ETH.address)
    },
    {
        hashLock: Sdk.HashLock.forMultipleFills(leaves),
        timeLocks: Sdk.TimeLocks.new({
            srcWithdrawal: 10n,           // 10s finality lock
            srcPublicWithdrawal: 120n,    // 2m for private withdrawal
            srcCancellation: 121n,        // 1s after public withdrawal
            srcPublicCancellation: 122n,  // 1s after private cancellation
            dstWithdrawal: 10n,           // 10s finality lock
            dstPublicWithdrawal: 100n,    // 100s private withdrawal
            dstCancellation: 101n         // 1s after public withdrawal
        }),
        srcChainId,
        dstChainId,
        srcSafetyDeposit: parseEther('0.001'),
        dstSafetyDeposit: parseEther('0.001')
    },
    {
        auction: new Sdk.AuctionDetails({
            initialRateBump: 0,
            points: [],
            duration: 120n,
            startTime: srcTimestamp
        }),
        whitelist: [
            {
                address: new Address(src.resolver),
                allowFrom: 0n
            }
        ],
        resolvingStartTime: 0n
    },
    {
        nonce: Sdk.randBigInt(UINT_40_MAX),
        allowPartialFills: true,
        allowMultipleFills: true
    }
)

// Calculate fill amount and secret index
const fillAmount = order.makingAmount / 2n  // 50% fill
const idx = Number((BigInt(secrets.length - 1) * (fillAmount - 1n)) / order.makingAmount)
```

**Key Features**:
- Same structure as Example 2 but with partial fill
- `fillAmount = order.makingAmount / 2n` - Fills 50% of order
- Calculates appropriate secret index for partial amount
- Pro-rata calculation for destination amount

## Example 4: ETH to BTC Swap

**Use Case**: Reverse direction swap from Ethereum to Bitcoin
**Test**: "should swap Ethereum -> Bitcoin. Single fill only"

```typescript
const secret = uint8ArrayToHex(randomBytes(32))
const order = Sdk.CrossChainOrder.new(
    new Address(src.escrowFactory),
    {
        salt: Sdk.randBigInt(1000n),
        maker: new Address(await srcChainUser.getAddress()),
        makingAmount: parseUnits('15', 18),        // 15 ETH
        takingAmount: parseUnits('1', 8),          // 1 BTC
        makerAsset: new Address(config.chain.source.tokens.ETH.address),
        takerAsset: new Address(config.chain.destination.tokens.BTC.address)
    },
    {
        hashLock: Sdk.HashLock.forSingleFill(secret),
        timeLocks: Sdk.TimeLocks.new({
            srcWithdrawal: 10n,           // 10s finality lock
            srcPublicWithdrawal: 120n,    // 2m for private withdrawal
            srcCancellation: 121n,        // 1s after public withdrawal
            srcPublicCancellation: 122n,  // 1s after private cancellation
            dstWithdrawal: 10n,           // 10s finality lock
            dstPublicWithdrawal: 100n,    // 100s private withdrawal
            dstCancellation: 101n         // 1s after public withdrawal
        }),
        srcChainId,
        dstChainId,
        srcSafetyDeposit: parseEther('0.001'),
        dstSafetyDeposit: parseEther('0.001')
    },
    {
        auction: new Sdk.AuctionDetails({
            initialRateBump: 0,
            points: [],
            duration: 120n,
            startTime: srcTimestamp
        }),
        whitelist: [
            {
                address: new Address(src.resolver),
                allowFrom: 0n
            }
        ],
        resolvingStartTime: 0n
    },
    {
        nonce: Sdk.randBigInt(UINT_40_MAX),
        allowPartialFills: false,
        allowMultipleFills: false
    }
)
```

**Key Features**:
- `makerAsset: ETH` and `takerAsset: BTC` - Reverse direction swap
- `makingAmount: parseUnits('15', 18)` - 15 ETH (18 decimals)
- `takingAmount: parseUnits('1', 8)` - 1 BTC (8 decimals)
- Same security features as BTC to ETH swaps

## Example 5: Cancellation Order

**Use Case**: Order designed for cancellation testing
**Test**: "should cancel swap Bitcoin -> Ethereum"

```typescript
const hashLock = Sdk.HashLock.forSingleFill(uint8ArrayToHex(randomBytes(32)))
const order = Sdk.CrossChainOrder.new(
    new Address(src.escrowFactory),
    {
        salt: Sdk.randBigInt(1000n),
        maker: new Address(await srcChainUser.getAddress()),
        makingAmount: parseUnits('1', 8),          // 1 BTC
        takingAmount: parseUnits('15', 18),        // 15 ETH
        makerAsset: new Address(config.chain.source.tokens.BTC.address),
        takerAsset: new Address(config.chain.destination.tokens.ETH.address)
    },
    {
        hashLock,
        timeLocks: Sdk.TimeLocks.new({
            srcWithdrawal: 0n,            // No finality lock for testing
            srcPublicWithdrawal: 120n,    // 2m for private withdrawal
            srcCancellation: 121n,        // 1s after public withdrawal
            srcPublicCancellation: 122n,  // 1s after private cancellation
            dstWithdrawal: 0n,            // No finality lock for testing
            dstPublicWithdrawal: 100n,    // 100s private withdrawal
            dstCancellation: 101n         // 1s after public withdrawal
        }),
        srcChainId,
        dstChainId,
        srcSafetyDeposit: parseEther('0.001'),
        dstSafetyDeposit: parseEther('0.001')
    },
    {
        auction: new Sdk.AuctionDetails({
            initialRateBump: 0,
            points: [],
            duration: 120n,
            startTime: srcTimestamp
        }),
        whitelist: [
            {
                address: new Address(src.resolver),
                allowFrom: 0n
            }
        ],
        resolvingStartTime: 0n
    },
    {
        nonce: Sdk.randBigInt(UINT_40_MAX),
        allowPartialFills: false,
        allowMultipleFills: false
    }
)
```

**Key Features**:
- `srcWithdrawal: 0n` and `dstWithdrawal: 0n` - No finality locks for testing
- Same structure as Example 1 but optimized for cancellation
- User doesn't share secret, leading to cancellation after timeouts

## Parameter Reference

### Order Details
- `salt`: Random number for order uniqueness
- `maker`: Address of the order creator
- `makingAmount`: Amount of source asset to swap (e.g., 1 BTC = parseUnits('1', 8))
- `takingAmount`: Amount of destination asset to receive (e.g., 15 ETH = parseUnits('15', 18))
- `makerAsset`: Source chain token address (BTC or ETH)
- `takerAsset`: Destination chain token address (ETH or BTC)

### Cross-Chain Configuration
- `hashLock`: Single secret or Merkle tree of secrets
- `timeLocks`: Various timeout configurations
- `srcChainId`: Source blockchain ID
- `dstChainId`: Destination blockchain ID
- `srcSafetyDeposit`: ETH deposit on source chain
- `dstSafetyDeposit`: ETH deposit on destination chain

### Time Locks
- `srcWithdrawal`: Finality lock on source chain
- `srcPublicWithdrawal`: Time for private withdrawal on source
- `srcCancellation`: Time for public cancellation on source
- `srcPublicCancellation`: Time for private cancellation on source
- `dstWithdrawal`: Finality lock on destination chain
- `dstPublicWithdrawal`: Time for private withdrawal on destination
- `dstCancellation`: Time for public cancellation on destination

### Auction & Access Control
- `auction`: Auction configuration (rate bump, duration, etc.)
- `whitelist`: Allowed addresses to fill the order
- `resolvingStartTime`: When resolution can begin

### Order Options
- `nonce`: Unique order identifier
- `allowPartialFills`: Whether order can be partially filled
- `allowMultipleFills`: Whether order can be filled multiple times

## Usage Patterns

### BTC to ETH Swap Pattern
```typescript
// For Bitcoin to Ethereum swaps
makingAmount: parseUnits('1', 8),          // 1 BTC (8 decimals)
takingAmount: parseUnits('15', 18),        // 15 ETH (18 decimals)
makerAsset: new Address(config.chain.source.tokens.BTC.address),
takerAsset: new Address(config.chain.destination.tokens.ETH.address)
```

### ETH to BTC Swap Pattern
```typescript
// For Ethereum to Bitcoin swaps
makingAmount: parseUnits('15', 18),        // 15 ETH (18 decimals)
takingAmount: parseUnits('1', 8),          // 1 BTC (8 decimals)
makerAsset: new Address(config.chain.source.tokens.ETH.address),
takerAsset: new Address(config.chain.destination.tokens.BTC.address)
```

### Single Fill Pattern
```typescript
// For one-time atomic swaps
hashLock: Sdk.HashLock.forSingleFill(secret)
allowPartialFills: false
allowMultipleFills: false
```

### Multiple Fill Pattern
```typescript
// For orders that can be filled multiple times
const secrets = Array.from({length: N}).map(() => generateSecret())
const leaves = Sdk.HashLock.getMerkleLeaves(secrets)
hashLock: Sdk.HashLock.forMultipleFills(leaves)
allowPartialFills: true
allowMultipleFills: true
```

### Cancellation Pattern
```typescript
// For testing cancellation scenarios
srcWithdrawal: 0n
dstWithdrawal: 0n
// User doesn't share secret after order is filled
```

## Best Practices

1. **Security**: Use cryptographically secure random numbers for secrets
2. **Time Locks**: Set appropriate timeouts based on chain finality (Bitcoin has longer block times)
3. **Safety Deposits**: Ensure sufficient ETH for gas fees on both chains
4. **Whitelisting**: Restrict order filling to trusted resolvers
5. **Testing**: Use shorter timeouts for testing, longer for production
6. **Partial Fills**: Consider whether partial fills are needed for your use case
7. **Multiple Fills**: Use Merkle trees for orders that may be filled multiple times
8. **Decimal Precision**: Use correct decimal places (8 for BTC, 18 for ETH)
9. **Exchange Rates**: Monitor BTC/ETH exchange rates for accurate pricing
10. **Chain Finality**: Account for different finality times between Bitcoin and Ethereum

## Error Handling

- Ensure all addresses are valid and contracts are deployed
- Verify chain IDs match your target networks
- Check that time locks are reasonable for your use case
- Validate that safety deposits cover expected gas costs
- Test cancellation scenarios to ensure proper fund recovery 