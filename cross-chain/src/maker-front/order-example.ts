import { CrossChainOrder, HashLock, TimeLocks } from '@1inch/cross-chain-sdk'
import { Address, NetworkEnum, AuctionDetails } from '@1inch/fusion-sdk'
import { OrderWrapper } from './order'
import { ESCROW_FACTORY } from '@1inch/cross-chain-sdk'
import fs from 'fs'
import path from 'path'
import { randomBytes } from 'crypto'

// Type assertion for supported chains
type SupportedChain = NetworkEnum.ETHEREUM | NetworkEnum.POLYGON | NetworkEnum.BINANCE | NetworkEnum.OPTIMISM | NetworkEnum.ARBITRUM | NetworkEnum.AVALANCHE | NetworkEnum.GNOSIS | NetworkEnum.COINBASE | NetworkEnum.ZKSYNC | NetworkEnum.LINEA | NetworkEnum.SONIC | NetworkEnum.UNICHAIN

// Bitcoin chain ID constant
const BITCOIN_CHAIN_ID = 0

// Helper function to generate random salt
function generateRandomSalt(): bigint {
    return BigInt(Math.floor(Math.random() * 1000000))
}

// Helper function to get current timestamp
function getCurrentTimestamp(): bigint {
    return BigInt(Math.floor(Date.now() / 1000))
}

// Helper function to convert uint8Array to hex
function uint8ArrayToHex(bytes: Uint8Array): string {
    return '0x' + Buffer.from(bytes).toString('hex')
}

// Helper function to save order as JSON
function saveOrderAsJson(orderWrapper: OrderWrapper, filename: string): void {
    const orderData = {
        crossChainOrder: {
            dstChainId: orderWrapper.crossChainOrder.dstChainId,
            maker: orderWrapper.crossChainOrder.maker.toString(),
            takerAsset: orderWrapper.crossChainOrder.takerAsset.toString(),
            makerAsset: orderWrapper.crossChainOrder.makerAsset.toString(),
            takingAmount: orderWrapper.crossChainOrder.takingAmount.toString(),
            makingAmount: orderWrapper.crossChainOrder.makingAmount.toString(),
            salt: orderWrapper.crossChainOrder.salt.toString(),
            receiver: orderWrapper.crossChainOrder.receiver.toString(),
            deadline: orderWrapper.crossChainOrder.deadline.toString(),
            auctionStartTime: orderWrapper.crossChainOrder.auctionStartTime.toString(),
            auctionEndTime: orderWrapper.crossChainOrder.auctionEndTime.toString(),
            nonce: orderWrapper.crossChainOrder.nonce.toString(),
            partialFillAllowed: orderWrapper.crossChainOrder.partialFillAllowed,
            multipleFillsAllowed: orderWrapper.crossChainOrder.multipleFillsAllowed
        },
        orderHash: orderWrapper.crossChainOrder.getOrderHash(NetworkEnum.ETHEREUM),
        typedData: orderWrapper.crossChainOrder.getTypedData(NetworkEnum.ETHEREUM)
    }

    // Ensure orders directory exists
    const ordersDir = path.join(__dirname, '../../orders')
    if (!fs.existsSync(ordersDir)) {
        fs.mkdirSync(ordersDir, { recursive: true })
    }

    const filePath = path.join(ordersDir, filename)
    fs.writeFileSync(filePath, JSON.stringify(orderData, null, 2))
    console.log(`Order saved to: ${filePath}`)
}

// Create BTC to EVM order (Bitcoin to Ethereum)
function createBtcToEvmOrder(): OrderWrapper {
    console.log('Creating BTC to EVM order...')

    const secret = uint8ArrayToHex(randomBytes(32))
    const srcTimestamp = getCurrentTimestamp()

    const orderInfo = {
        makerAsset: new Address('0x0000000000000000000000000000000000000000'), // BTC address
        takerAsset: new Address('0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee'), // ETH
        makingAmount: BigInt('100000000'), // 1 BTC (8 decimals)
        takingAmount: BigInt('15000000000000000000'), // 15 ETH (18 decimals)
        maker: new Address('0x742d35Cc6634C0532925a3b8D4C9db96C4b4d8b6'), // Alice's address
        salt: generateRandomSalt(),
        receiver: new Address('0x742d35Cc6634C0532925a3b8D4C9db96C4b4d8b6') // Same as maker
    }

    const escrowParams = {
        hashLock: HashLock.forSingleFill(secret),
        srcChainId: BITCOIN_CHAIN_ID as SupportedChain, // Bitcoin as source
        dstChainId: NetworkEnum.ETHEREUM as SupportedChain,  // Ethereum as destination
        srcSafetyDeposit: BigInt('10000000'), // 0.1 BTC safety deposit (8 decimals)
        dstSafetyDeposit: BigInt('1000000000000000000'), // 1 ETH safety deposit
        timeLocks: TimeLocks.new({
            srcWithdrawal: 10n,           // 10s finality lock
            srcPublicWithdrawal: 120n,    // 2m for private withdrawal
            srcCancellation: 121n,        // 1s after public withdrawal
            srcPublicCancellation: 122n,  // 1s after private cancellation
            dstWithdrawal: 10n,           // 10s finality lock
            dstPublicWithdrawal: 100n,    // 100s private withdrawal
            dstCancellation: 101n         // 1s after public withdrawal
        })
    }

    const details = {
        auction: new AuctionDetails({
            initialRateBump: 0,
            points: [],
            duration: 120n,
            startTime: srcTimestamp
        }),
        fees: {
            integratorFee: {
                ratio: BigInt('100'), // 1% fee ratio
                receiver: new Address('0x742d35Cc6634C0532925a3b8D4C9db96C4b4d8b6')
            },
            bankFee: BigInt('500000') // 0.005 BTC bank fee (8 decimals)
        },
        whitelist: [
            {
                address: new Address('0x742d35Cc6634C0532925a3b8D4C9db96C4b4d8b6'),
                allowFrom: 0n
            }
        ],
        resolvingStartTime: 0n
    }

    const extra = {
        nonce: BigInt('1'),
        orderExpirationDelay: BigInt('12'),
        enablePermit2: false,
        source: 'cross-chain-example',
        allowMultipleFills: false,
        allowPartialFills: false
    }

    const crossChainOrder = CrossChainOrder.new(
        ESCROW_FACTORY[NetworkEnum.ETHEREUM], // Using Ethereum factory for BTC->ETH
        orderInfo,
        escrowParams,
        details,
        extra
    )

    return new OrderWrapper(crossChainOrder)
}

// Create EVM to BTC order (Ethereum to Bitcoin)
function createEvmToBtcOrder(): OrderWrapper {
    console.log('Creating EVM to BTC order...')

    const secret = uint8ArrayToHex(randomBytes(32))
    const srcTimestamp = getCurrentTimestamp()

    const orderInfo = {
        makerAsset: new Address('0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee'), // ETH
        takerAsset: new Address('0x0000000000000000000000000000000000000000'), // BTC address
        makingAmount: BigInt('15000000000000000000'), // 15 ETH (18 decimals)
        takingAmount: BigInt('100000000'), // 1 BTC (8 decimals)
        maker: new Address('0x742d35Cc6634C0532925a3b8D4C9db96C4b4d8b6'), // Alice's address
        salt: generateRandomSalt(),
        receiver: new Address('0x742d35Cc6634C0532925a3b8D4C9db96C4b4d8b6') // Same as maker
    }

    const escrowParams = {
        hashLock: HashLock.forSingleFill(secret),
        srcChainId: NetworkEnum.ETHEREUM as SupportedChain,  // Ethereum as source
        dstChainId: BITCOIN_CHAIN_ID as SupportedChain, // Bitcoin as destination
        srcSafetyDeposit: BigInt('1000000000000000000'), // 1 ETH safety deposit
        dstSafetyDeposit: BigInt('10000000'), // 0.1 BTC safety deposit (8 decimals)
        timeLocks: TimeLocks.new({
            srcWithdrawal: 10n,           // 10s finality lock
            srcPublicWithdrawal: 120n,    // 2m for private withdrawal
            srcCancellation: 121n,        // 1s after public withdrawal
            srcPublicCancellation: 122n,  // 1s after private cancellation
            dstWithdrawal: 10n,           // 10s finality lock
            dstPublicWithdrawal: 100n,    // 100s private withdrawal
            dstCancellation: 101n         // 1s after public withdrawal
        })
    }

    const details = {
        auction: new AuctionDetails({
            initialRateBump: 0,
            points: [],
            duration: 120n,
            startTime: srcTimestamp
        }),
        fees: {
            integratorFee: {
                ratio: BigInt('100'), // 1% fee ratio
                receiver: new Address('0x742d35Cc6634C0532925a3b8D4C9db96C4b4d8b6')
            },
            bankFee: BigInt('50000000000000000') // 0.05 ETH bank fee
        },
        whitelist: [
            {
                address: new Address('0x742d35Cc6634C0532925a3b8D4C9db96C4b4d8b6'),
                allowFrom: 0n
            }
        ],
        resolvingStartTime: 0n
    }

    const extra = {
        nonce: BigInt('2'),
        orderExpirationDelay: BigInt('12'),
        enablePermit2: false,
        source: 'cross-chain-example',
        allowMultipleFills: false,
        allowPartialFills: false
    }

    const crossChainOrder = CrossChainOrder.new(
        ESCROW_FACTORY[NetworkEnum.ETHEREUM], // Using Ethereum factory for ETH->BTC
        orderInfo,
        escrowParams,
        details,
        extra
    )

    return new OrderWrapper(crossChainOrder)
}

// Main function to create and save both orders
export function createOrderExamples(): void {
    try {
        console.log('Creating cross-chain order examples...')

        // Create BTC to EVM order
        const btcToEvmOrder = createBtcToEvmOrder()
        saveOrderAsJson(btcToEvmOrder, 'btc2evm-order.json')

        // Create EVM to BTC order
        const evmToBtcOrder = createEvmToBtcOrder()
        saveOrderAsJson(evmToBtcOrder, 'evm2btc-order.json')

        console.log('Order examples created successfully!')
        console.log('Files saved in: cross-chain/orders/')
        console.log('- btc2evm-order.json')
        console.log('- evm2btc-order.json')

    } catch (error) {
        console.error('Error creating order examples:', error)
        throw error
    }
}

// Export individual functions for testing
export { createBtcToEvmOrder, createEvmToBtcOrder }

// Run if this file is executed directly
if (require.main === module) {
    createOrderExamples()
}
