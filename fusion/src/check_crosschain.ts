import {
    SDK,
    NetworkEnum,
    PresetEnum,
    HashLock,
    PrivateKeyProviderConnector,
    OrderStatus
} from '@1inch/cross-chain-sdk'
import { ethers } from 'ethers'
import { randomBytes } from 'node:crypto'
import * as dotenv from 'dotenv'

// Load environment variables
dotenv.config()

// Token addresses from tokens.py
const TOKENS = {
    mainnet: {
        USDC: '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48'
    },
    polygon: {
        USDT: '0xc2132D05D31c914a87C6611C10748AEb04B58e8F'
    }
}

// Simple cross-chain swap: USDC (Ethereum) -> USDT (Polygon)
async function simpleCrossChainSwap() {
    console.log('🚀 Starting cross-chain swap: USDC (Ethereum) -> USDT (Polygon)')
    console.log('=' .repeat(60))

    // Configuration
    const privateKey = process.env.PRIVATE_KEY || '0x' // Replace with your private key
    const rpc = process.env.ETHEREUM_RPC_URL || 'https://ethereum-rpc.publicnode.com'
    const authKey = process.env.DEV_PORTAL_API_TOKEN || 'your-auth-key' // Get from 1inch dev portal
    const source = 'sdk-tutorial'

    console.log('📋 Configuration:')
    console.log(`   RPC: ${rpc}`)
    console.log(`   Auth Key: ${authKey.substring(0, 10)}...`)
    console.log(`   Source: ${source}`)

    // Initialize ethers provider and wallet
    console.log('\n🔧 Initializing provider and wallet...')
    const provider = new ethers.JsonRpcProvider(rpc)
    const wallet = new ethers.Wallet(privateKey, provider)
    const walletAddress = wallet.address
    console.log(`   Wallet address: ${walletAddress}`)

    // Create Web3-like adapter for ethers
    const web3LikeAdapter = {
        eth: {
            call: async (transactionConfig: { to?: string; data?: string }) => {
                return provider.call(transactionConfig)
            }
        },
        extend: () => web3LikeAdapter
    }

    // Initialize SDK
    console.log('\n🔧 Initializing 1inch Cross-Chain SDK...')
    const sdk = new SDK({
        url: 'https://api.1inch.dev/fusion-plus',
        authKey,
        blockchainProvider: new PrivateKeyProviderConnector(privateKey, web3LikeAdapter)
    })
    console.log('   SDK initialized successfully')

    // Swap parameters
    const amount = '10000000' // 10 USDC (6 decimals) - minimum viable amount
    const srcChainId = NetworkEnum.ETHEREUM
    const dstChainId = NetworkEnum.POLYGON
    const srcTokenAddress = TOKENS.mainnet.USDC
    const dstTokenAddress = TOKENS.polygon.USDT

    console.log('\n📊 Swap Parameters:')
    console.log(`   Amount: ${amount} (10 USDC)`)
    console.log(`   Source Chain: Ethereum (${srcChainId})`)
    console.log(`   Destination Chain: Polygon (${dstChainId})`)
    console.log(`   Source Token: USDC (${srcTokenAddress})`)
    console.log(`   Destination Token: USDT (${dstTokenAddress})`)

    try {
        // Step 1: Get quote
        console.log('\n🔍 Step 1: Getting quote...')
        console.log('   📋 Quote request parameters:')
        console.log(`      Amount: ${amount} wei (${parseInt(amount) / 1000000} USDC)`)
        console.log(`      Source Chain ID: ${srcChainId}`)
        console.log(`      Destination Chain ID: ${dstChainId}`)
        console.log(`      Source Token: ${srcTokenAddress}`)
        console.log(`      Destination Token: ${dstTokenAddress}`)
        console.log(`      Wallet Address: ${walletAddress}`)
        console.log(`      Enable Estimate: true`)
        
        const quoteRequest = {
            amount,
            srcChainId: srcChainId as any,
            dstChainId: dstChainId as any,
            enableEstimate: true,
            srcTokenAddress,
            dstTokenAddress,
            walletAddress
        }
        
        console.log('   🔄 Sending quote request to 1inch API...')
        console.log('   🌐 API URL: https://api.1inch.dev/fusion-plus')
        console.log('   🔑 Auth Key: ' + authKey.substring(0, 10) + '...')
        
        let quote
        try {
            quote = await sdk.getQuote(quoteRequest)
            console.log('   ✅ Quote request successful')
        } catch (quoteError: any) {
            console.log('   ❌ Quote request failed')
            console.log('   📊 Error details:')
            console.log(`      Status: ${quoteError.response?.status || 'Unknown'}`)
            console.log(`      Message: ${quoteError.response?.data?.description || quoteError.message}`)
            console.log(`      Error Code: ${quoteError.code || 'Unknown'}`)
            
            if (quoteError.response?.data) {
                console.log('   📋 Full API Response:')
                console.log(JSON.stringify(quoteError.response.data, null, 2))
            }
            
            if (quoteError.config?.url) {
                console.log('   🔗 Request URL:')
                console.log(quoteError.config.url)
            }
            
            throw quoteError
        }

        console.log('✅ Quote received:')
        console.log(`   Quote ID: ${quote.quoteId}`)
        console.log(`   Source Amount: ${quote.srcTokenAmount}`)
        console.log(`   Destination Amount: ${quote.dstTokenAmount}`)
        console.log(`   Recommended Preset: ${quote.recommendedPreset}`)
        console.log(`   Source Escrow Factory: ${quote.srcEscrowFactory}`)
        console.log(`   Destination Escrow Factory: ${quote.dstEscrowFactory}`)

        // Display presets
        console.log('\n📋 Available Presets:')
        Object.entries(quote.presets).forEach(([preset, data]) => {
            console.log(`   ${preset.toUpperCase()}:`)
            console.log(`     Auction Duration: ${data.auctionDuration}s`)
            console.log(`     Initial Rate Bump: ${data.initialRateBump}`)
            console.log(`     Secrets Count: ${data.secretsCount}`)
            console.log(`     Cost in DST Token: ${data.costInDstToken}`)
        })

        // Step 2: Choose preset and generate secrets
        console.log('\n🔐 Step 2: Generating secrets...')
        const preset = PresetEnum.fast
        console.log(`   Selected preset: ${preset}`)

        const secrets = Array.from({
            length: quote.presets[preset].secretsCount
        }).map(() => '0x' + randomBytes(32).toString('hex'))

        console.log(`   Generated ${secrets.length} secrets`)

        // Create hash lock
        const hashLock = secrets.length === 1
            ? HashLock.forSingleFill(secrets[0])
            : HashLock.forMultipleFills(HashLock.getMerkleLeaves(secrets))

        const secretHashes = secrets.map((s) => HashLock.hashSecret(s))
        console.log(`   Created hash lock with ${secretHashes.length} secret hashes`)

        // Step 3: Create order
        console.log('\n📝 Step 3: Creating order...')
        const { hash, quoteId, order } = await sdk.createOrder(quote, {
            walletAddress,
            hashLock,
            preset,
            source,
            secretHashes
        })

        console.log('✅ Order created:')
        console.log(`   Order Hash: ${hash}`)
        console.log(`   Quote ID: ${quoteId}`)
        console.log(`   Order Maker: ${order.maker}`)
        console.log(`   Order Salt: ${order.salt}`)

        // Step 4: Submit order
        console.log('\n📤 Step 4: Submitting order...')
        const orderInfo = await sdk.submitOrder(
            quote.srcChainId,
            order,
            quoteId,
            secretHashes
        )

        console.log('✅ Order submitted:')
        console.log(`   Order Hash: ${orderInfo.orderHash}`)
        console.log(`   Signature: ${orderInfo.signature.substring(0, 20)}...`)
        console.log(`   Quote ID: ${orderInfo.quoteId}`)

        // Step 5: Monitor and submit secrets
        console.log('\n⏳ Step 5: Monitoring order status and submitting secrets...')
        await monitorAndSubmitSecrets(sdk, hash, secrets)

        console.log('\n🎉 Cross-chain swap completed successfully!')
        console.log('=' .repeat(60))

    } catch (error: any) {
        console.error('\n❌ Error during cross-chain swap:')
        console.error('   📊 Error Type:', error.constructor.name)
        console.error('   📝 Error Message:', error.message)
        
        if (error.response) {
            console.error('   🌐 HTTP Status:', error.response.status)
            console.error('   📋 Response Data:', JSON.stringify(error.response.data, null, 2))
        }
        
        if (error.config) {
            console.error('   🔗 Request URL:', error.config.url)
            console.error('   📤 Request Method:', error.config.method)
        }
        
        if (error.code) {
            console.error('   🔢 Error Code:', error.code)
        }
        
        console.error('   📍 Stack Trace:')
        console.error(error.stack)
        
        throw error
    }
}

// Helper function to monitor order status and submit secrets
async function monitorAndSubmitSecrets(sdk: SDK, orderHash: string, secrets: string[]) {
    console.log('   Starting monitoring loop...')
    let iteration = 0

    while (true) {
        iteration++
        console.log(`\n   📊 Monitoring iteration ${iteration}:`)

        try {
            // Check for secrets that need to be submitted
            const secretsToShare = await sdk.getReadyToAcceptSecretFills(orderHash)
            console.log(`     Secrets to share: ${secretsToShare.fills.length}`)

            if (secretsToShare.fills.length) {
                for (const { idx } of secretsToShare.fills) {
                    console.log(`     📤 Submitting secret for fill ${idx}...`)
                    await sdk.submitSecret(orderHash, secrets[idx])
                    console.log(`     ✅ Secret ${idx} submitted successfully`)
                }
            }

            // Check order status
            const { status } = await sdk.getOrderStatus(orderHash)
            console.log(`     📈 Order status: ${status}`)

            // Break if order is finished
            if (
                status === OrderStatus.Executed ||
                status === OrderStatus.Expired ||
                status === OrderStatus.Refunded
            ) {
                console.log(`     🏁 Order finished with status: ${status}`)
                break
            }

            // Wait before next check
            console.log('     ⏳ Waiting 2 seconds before next check...')
            await sleep(2000)

        } catch (error: any) {
            console.error(`     ❌ Error in monitoring iteration ${iteration}:`)
            console.error(`        📝 Error: ${error.message}`)
            console.error(`        🔢 Code: ${error.code || 'Unknown'}`)
            if (error.response) {
                console.error(`        🌐 Status: ${error.response.status}`)
                console.error(`        📋 Data: ${JSON.stringify(error.response.data, null, 2)}`)
            }
            await sleep(5000) // Wait longer on error
        }
    }

    const finalStatus = await sdk.getOrderStatus(orderHash)
    console.log('\n   📋 Final order status:')
    console.log(`     Status: ${finalStatus.status}`)
    if (finalStatus.fills) {
        console.log(`     Fills: ${finalStatus.fills.length}`)
        finalStatus.fills.forEach((fill, index) => {
            console.log(`       Fill ${index}: ${fill.txHash}`)
        })
    }
}

// Helper function to sleep
async function sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms))
}

// Export functions for use in other modules
export {
    simpleCrossChainSwap,
    monitorAndSubmitSecrets
}

// Run example if this file is executed directly
if (require.main === module) {
    simpleCrossChainSwap()
        .then(() => console.log('Simple cross-chain swap completed'))
        .catch(console.error)
}
