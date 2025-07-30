import {
    HashLock,
    NetworkEnum,
    OrderStatus,
    PresetEnum,
    PrivateKeyProviderConnector,
    SDK
} from '@1inch/cross-chain-sdk'
import Web3 from 'web3'
import { randomBytes } from 'node:crypto'
import dotenv from 'dotenv'
import { TOKENS, getTokenInfo, formatTokenAmount } from './tokens'

// Load environment variables from .env file
dotenv.config()

// Configuration
const privateKey = process.env.PRIVATE_KEY ? `0x${process.env.PRIVATE_KEY}` : '0x' // Add 0x prefix if not present
const rpc = process.env.ETHEREUM_RPC_URL || 'https://ethereum-rpc.publicnode.com'
const authKey = process.env.DEV_PORTAL_API_TOKEN || 'auth-key' // Set your 1inch auth key
const source = 'crosschain-swap-example'

// Amount: 1.33 USDC (6 decimals)
const USDC_AMOUNT = '1330000' // 1.33 * 10^6
const USDC_AMOUNT_READABLE = '1.33'

async function sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms))
}

async function performCrossChainSwap(): Promise<void> {
    try {
        console.log(`🚀 Starting cross-chain swap: ${USDC_AMOUNT_READABLE} USDC (Ethereum) → USDT (Polygon)`)
        
        // Initialize Web3 and SDK
        const web3 = new Web3(rpc)
        const walletAddress = web3.eth.accounts.privateKeyToAccount(privateKey).address
        
        console.log(`📱 Wallet address: ${walletAddress}`)
        
        const sdk = new SDK({
            url: 'https://api.1inch.dev/fusion-plus',
            authKey,
            blockchainProvider: new PrivateKeyProviderConnector(privateKey, web3 as any)
        })

        // Get quote
        console.log('📊 Getting quote...')
        const srcTokenAddress = TOKENS.ETHEREUM.USDC
        const dstTokenAddress = TOKENS.POLYGON.USDT
        console.log(`  Source token: ${srcTokenAddress}`)
        console.log(`  Destination token: ${dstTokenAddress}`)
        console.log(`  Amount: ${USDC_AMOUNT_READABLE} USDC`)
        
        const quote = await sdk.getQuote({
            amount: USDC_AMOUNT,
            srcChainId: NetworkEnum.ETHEREUM,
            dstChainId: NetworkEnum.POLYGON,
            enableEstimate: true,
            srcTokenAddress,
            dstTokenAddress,
            walletAddress
        })

        console.log(`📈 Quote received:`)
        console.log(`  Source: ${srcTokenAddress} (Ethereum)`)
        console.log(`  Destination: ${dstTokenAddress} (Polygon)`)
        console.log(`  Input amount: ${quote.srcTokenAmount}`)
        console.log(`  Output amount: ${quote.dstTokenAmount}`)

        // Select preset
        const preset = PresetEnum.fast
        console.log(`⚡ Using preset: ${preset}`)

        // Generate secrets
        console.log('🔐 Generating secrets...')
        const secrets = Array.from({
            length: quote.presets[preset].secretsCount
        }).map(() => '0x' + randomBytes(32).toString('hex'))

        const hashLock = secrets.length === 1
            ? HashLock.forSingleFill(secrets[0])
            : HashLock.forMultipleFills(HashLock.getMerkleLeaves(secrets))

        const secretHashes = secrets.map((s) => HashLock.hashSecret(s))
        console.log(`Generated ${secrets.length} secrets`)

        // Create order
        console.log('📝 Creating order...')
        const { hash, quoteId, order } = await sdk.createOrder(quote, {
            walletAddress,
            hashLock,
            preset,
            source,
            secretHashes
        })
        console.log(`✅ Order created with hash: ${hash}`)

        // Submit order
        console.log('📤 Submitting order...')
        const orderInfo = await sdk.submitOrder(
            quote.srcChainId,
            order,
            quoteId,
            secretHashes
        )
        console.log(`✅ Order submitted`)

        // Monitor and submit secrets
        console.log('🔄 Monitoring order status and submitting secrets...')
        let attempts = 0
        const maxAttempts = 300 // 5 minutes with 1-second intervals
        
        while (attempts < maxAttempts) {
            const secretsToShare = await sdk.getReadyToAcceptSecretFills(hash)

            if (secretsToShare.fills.length) {
                for (const { idx } of secretsToShare.fills) {
                    await sdk.submitSecret(hash, secrets[idx])
                    console.log(`🔓 Shared secret ${idx}`)
                }
            }

            // Check order status
            const { status } = await sdk.getOrderStatus(hash)
            console.log(`📊 Order status: ${status}`)

            if (status === OrderStatus.Executed) {
                console.log('🎉 Swap completed successfully!')
                break
            } else if (status === OrderStatus.Expired) {
                console.log('⏰ Order expired')
                break
            } else if (status === OrderStatus.Refunded) {
                console.log('↩️ Order refunded')
                break
            }

            attempts++
            await sleep(1000)
        }

        if (attempts >= maxAttempts) {
            console.log('⏰ Timeout reached. Check order status manually.')
        }

        // Final status check
        const finalStatus = await sdk.getOrderStatus(hash)
        console.log('📋 Final order status:', finalStatus)

    } catch (error) {
        console.error('❌ Error during cross-chain swap:', error)
        throw error
    }
}

// Export the function
export { performCrossChainSwap }

// Run if this file is executed directly
if (require.main === module) {
    performCrossChainSwap()
        .then(() => {
            console.log('✅ Cross-chain swap script completed')
            process.exit(0)
        })
        .catch((error) => {
            console.error('❌ Cross-chain swap script failed:', error)
            process.exit(1)
        })
}



