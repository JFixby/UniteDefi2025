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
    console.log('📅 Timestamp:', new Date().toISOString())
    console.log('🖥️  Platform:', process.platform)
    console.log('📦 Node Version:', process.version)
    console.log('📁 Working Directory:', process.cwd())

    // Configuration
    console.log('\n🔧 Loading configuration from environment...')
    const privateKey = process.env.PRIVATE_KEY || '0x' // Replace with your private key
    const rpc = process.env.ETHEREUM_RPC_URL || 'https://ethereum-rpc.publicnode.com'
    const authKey = process.env.DEV_PORTAL_API_TOKEN || 'your-auth-key' // Get from 1inch dev portal
    const source = 'sdk-tutorial'

    console.log('📋 Configuration Details:')
    console.log(`   🔑 Private Key: ${privateKey.substring(0, 10)}...${privateKey.substring(privateKey.length - 4)}`)
    console.log(`   🌐 RPC URL: ${rpc}`)
    console.log(`   🔐 Auth Key: ${authKey.substring(0, 10)}...`)
    console.log(`   📝 Source: ${source}`)
    console.log(`   📊 Private Key Length: ${privateKey.length} characters`)
    console.log(`   🔐 Auth Key Length: ${authKey.length} characters`)

    // Initialize ethers provider and wallet
    console.log('\n🔧 Initializing provider and wallet...')
    console.log('   🌐 Creating JsonRpcProvider...')
    const provider = new ethers.JsonRpcProvider(rpc)
    console.log('   ✅ Provider created successfully')
    
    console.log('   🔑 Creating wallet from private key...')
    const wallet = new ethers.Wallet(privateKey, provider)
    const walletAddress = wallet.address
    console.log(`   ✅ Wallet created successfully`)
    console.log(`   📍 Wallet address: ${walletAddress}`)
    console.log(`   🔢 Address checksum: ${walletAddress === ethers.getAddress(walletAddress) ? 'Valid' : 'Invalid'}`)
    
    // Test provider connection
    console.log('   🔍 Testing provider connection...')
    try {
        const blockNumber = await provider.getBlockNumber()
        console.log(`   ✅ Provider connected! Current block: ${blockNumber}`)
    } catch (error: any) {
        console.log(`   ⚠️  Provider connection warning: ${error.message}`)
    }

    // Create Web3-like adapter for ethers
    console.log('   🔧 Creating Web3-like adapter...')
    const web3LikeAdapter = {
        eth: {
            call: async (transactionConfig: { to?: string; data?: string }) => {
                console.log(`      📞 Web3 call to: ${transactionConfig.to}`)
                return provider.call(transactionConfig)
            }
        },
        extend: () => web3LikeAdapter
    }
    console.log('   ✅ Web3-like adapter created')

    // Initialize SDK
    console.log('\n🔧 Initializing 1inch Cross-Chain SDK...')
    console.log('   🌐 SDK URL: https://api.1inch.dev/fusion-plus')
    console.log('   🔐 Creating PrivateKeyProviderConnector...')
    const blockchainProvider = new PrivateKeyProviderConnector(privateKey, web3LikeAdapter)
    console.log('   ✅ PrivateKeyProviderConnector created')
    
    const sdk = new SDK({
        url: 'https://api.1inch.dev/fusion-plus',
        authKey,
        blockchainProvider
    })
    console.log('   ✅ SDK initialized successfully')
    console.log('   📊 SDK instance created with blockchain provider')

    // Swap parameters
    console.log('\n📊 Setting up swap parameters...')
    const amount = '10000000' // 10 USDC (6 decimals) - minimum viable amount
    const srcChainId = NetworkEnum.ETHEREUM
    const dstChainId = NetworkEnum.POLYGON
    const srcTokenAddress = TOKENS.mainnet.USDC
    const dstTokenAddress = TOKENS.polygon.USDT

    console.log('📊 Swap Parameters:')
    console.log(`   💰 Amount: ${amount} wei (${parseInt(amount) / 1000000} USDC)`)
    console.log(`   🔗 Source Chain: Ethereum (${srcChainId})`)
    console.log(`   🎯 Destination Chain: Polygon (${dstChainId})`)
    console.log(`   🪙 Source Token: USDC (${srcTokenAddress})`)
    console.log(`   🪙 Destination Token: USDT (${dstTokenAddress})`)
    console.log(`   📏 Amount in USDC: ${parseInt(amount) / 1000000}`)
    console.log(`   🔢 Amount in wei: ${amount}`)
    console.log(`   📊 Token decimals: 6 (USDC standard)`)
    console.log(`   🔍 Token validation: ${ethers.isAddress(srcTokenAddress) ? 'Valid' : 'Invalid'} source, ${ethers.isAddress(dstTokenAddress) ? 'Valid' : 'Invalid'} destination`)

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
        console.log('   ⏱️  Request timestamp:', new Date().toISOString())
        console.log('   📋 Request payload:')
        console.log(JSON.stringify(quoteRequest, null, 4))
        
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
        console.log(`   ⏱️  Response timestamp: ${new Date().toISOString()}`)
        console.log(`   🆔 Quote ID: ${quote.quoteId}`)
        console.log(`   💰 Source Amount: ${quote.srcTokenAmount.toString()} wei`)
        console.log(`   💰 Destination Amount: ${quote.dstTokenAmount.toString()} wei`)
        console.log(`   📊 Exchange Rate: ${parseFloat(quote.dstTokenAmount.toString()) / parseFloat(quote.srcTokenAmount.toString())}`)
        console.log(`   📉 Slippage: ${((parseFloat(quote.srcTokenAmount.toString()) - parseFloat(quote.dstTokenAmount.toString())) / parseFloat(quote.srcTokenAmount.toString()) * 100).toFixed(2)}%`)
        console.log(`   ⚡ Recommended Preset: ${quote.recommendedPreset}`)
        console.log(`   🏭 Source Escrow Factory: ${quote.srcEscrowFactory}`)
        console.log(`   🏭 Destination Escrow Factory: ${quote.dstEscrowFactory}`)
        console.log(`   🔍 Quote object keys: ${Object.keys(quote).join(', ')}`)

        // Display presets
        console.log('\n📋 Available Presets:')
        
        // Handle BigInt serialization for logging
        const presetsForLogging = JSON.parse(JSON.stringify(quote.presets, (key, value) =>
            typeof value === 'bigint' ? value.toString() : value
        ))
        console.log('   📊 Presets object:', JSON.stringify(presetsForLogging, null, 2))
        
        Object.entries(quote.presets).forEach(([preset, data]) => {
            if (data && typeof data === 'object') {
                console.log(`   ${preset.toUpperCase()}:`)
                console.log(`     Auction Duration: ${data.auctionDuration || 'N/A'}s`)
                console.log(`     Initial Rate Bump: ${data.initialRateBump || 'N/A'}`)
                console.log(`     Secrets Count: ${data.secretsCount || 'N/A'}`)
                console.log(`     Cost in DST Token: ${data.costInDstToken || 'N/A'}`)
            } else {
                console.log(`   ${preset.toUpperCase()}: ${data}`)
            }
        })

        // Step 2: Choose preset and generate secrets
        console.log('\n🔐 Step 2: Generating secrets...')
        const preset = PresetEnum.fast
        console.log(`   ⚡ Selected preset: ${preset}`)
        console.log(`   📊 Preset details: ${JSON.stringify(quote.presets[preset], (key, value) => 
            typeof value === 'bigint' ? value.toString() : value, 2)}`)

        console.log(`   🔢 Required secrets count: ${quote.presets[preset].secretsCount}`)
        const secrets = Array.from({
            length: quote.presets[preset].secretsCount
        }).map((_, index) => {
            const secret = '0x' + randomBytes(32).toString('hex')
            console.log(`   🔑 Generated secret ${index + 1}: ${secret.substring(0, 10)}...${secret.substring(secret.length - 8)}`)
            return secret
        })

        console.log(`   ✅ Generated ${secrets.length} secrets successfully`)

        // Create hash lock
        console.log('   🔐 Creating hash lock...')
        const hashLock = secrets.length === 1
            ? HashLock.forSingleFill(secrets[0])
            : HashLock.forMultipleFills(HashLock.getMerkleLeaves(secrets))

        const secretHashes = secrets.map((s, index) => {
            const hash = HashLock.hashSecret(s)
            console.log(`   🔒 Secret hash ${index + 1}: ${hash.substring(0, 10)}...${hash.substring(hash.length - 8)}`)
            return hash
        })
        console.log(`   ✅ Created hash lock with ${secretHashes.length} secret hashes`)
        console.log(`   🔍 Hash lock type: ${secrets.length === 1 ? 'Single Fill' : 'Multiple Fills'}`)

        // Step 3: Create order
        console.log('\n📝 Step 3: Creating order...')
        console.log('   📋 Order creation parameters:')
        console.log(`      Wallet Address: ${walletAddress}`)
        console.log(`      Preset: ${preset}`)
        console.log(`      Source: ${source}`)
        console.log(`      Secret Hashes Count: ${secretHashes.length}`)
        console.log(`      Hash Lock Type: ${hashLock.constructor.name}`)
        
        const orderParams = {
            walletAddress,
            hashLock,
            preset,
            source,
            secretHashes
        }
        
        console.log('   🔄 Creating order with SDK...')
        const { hash, quoteId, order } = await sdk.createOrder(quote, orderParams)

        console.log('✅ Order created successfully:')
        console.log(`   🆔 Order Hash: ${hash}`)
        console.log(`   📋 Quote ID: ${quoteId}`)
        console.log(`   👤 Order Maker: ${order.maker}`)
        console.log(`   🧂 Order Salt: ${order.salt}`)
        console.log(`   📊 Order object keys: ${Object.keys(order).join(', ')}`)
        console.log(`   ⏱️  Creation timestamp: ${new Date().toISOString()}`)

        // Step 4: Submit order
        console.log('\n📤 Step 4: Submitting order...')
        console.log('   📋 Submission parameters:')
        console.log(`      Source Chain ID: ${quote.srcChainId}`)
        console.log(`      Order Hash: ${hash}`)
        console.log(`      Quote ID: ${quoteId}`)
        console.log(`      Secret Hashes Count: ${secretHashes.length}`)
        
        console.log('   🔄 Submitting order to blockchain...')
        const orderInfo = await sdk.submitOrder(
            quote.srcChainId,
            order,
            quoteId,
            secretHashes
        )

        console.log('✅ Order submitted successfully:')
        console.log(`   🆔 Order Hash: ${orderInfo.orderHash}`)
        console.log(`   ✍️  Signature: ${orderInfo.signature.substring(0, 20)}...${orderInfo.signature.substring(orderInfo.signature.length - 8)}`)
        console.log(`   📋 Quote ID: ${orderInfo.quoteId}`)
        console.log(`   📊 Order Info keys: ${Object.keys(orderInfo).join(', ')}`)
        console.log(`   ⏱️  Submission timestamp: ${new Date().toISOString()}`)

        // Step 5: Monitor and submit secrets
        console.log('\n⏳ Step 5: Monitoring order status and submitting secrets...')
        console.log('   📊 Monitoring parameters:')
        console.log(`      Order Hash: ${hash}`)
        console.log(`      Secrets Count: ${secrets.length}`)
        console.log(`      SDK Instance: ${sdk.constructor.name}`)
        
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
    console.log('   🚀 Starting monitoring loop...')
    console.log(`   📍 Order Hash: ${orderHash}`)
    console.log(`   🔑 Secrets Count: ${secrets.length}`)
    console.log(`   ⏱️  Start Time: ${new Date().toISOString()}`)
    
    let iteration = 0
    let totalSecretsSubmitted = 0
    let totalErrors = 0

    while (true) {
        iteration++
        console.log(`\n   📊 Monitoring iteration ${iteration}:`)
        console.log(`   ⏰ Iteration timestamp: ${new Date().toISOString()}`)

        try {
            // Check for secrets that need to be submitted
            console.log('     🔍 Checking for secrets to share...')
            const secretsToShare = await sdk.getReadyToAcceptSecretFills(orderHash)
            console.log(`     📊 Secrets to share: ${secretsToShare.fills.length}`)
            console.log(`     📋 Fills object: ${JSON.stringify(secretsToShare.fills, null, 2)}`)

            if (secretsToShare.fills.length) {
                for (const { idx } of secretsToShare.fills) {
                    console.log(`     📤 Submitting secret for fill ${idx}...`)
                    console.log(`     🔑 Secret: ${secrets[idx].substring(0, 10)}...${secrets[idx].substring(secrets[idx].length - 8)}`)
                    await sdk.submitSecret(orderHash, secrets[idx])
                    console.log(`     ✅ Secret ${idx} submitted successfully`)
                    totalSecretsSubmitted++
                }
            }

            // Check order status
            console.log('     📈 Checking order status...')
            const { status } = await sdk.getOrderStatus(orderHash)
            console.log(`     📊 Order status: ${status}`)
            console.log(`     🔢 Status enum value: ${Object.keys(OrderStatus).find(key => OrderStatus[key as keyof typeof OrderStatus] === status) || 'Unknown'}`)

            // Break if order is finished
            if (
                status === OrderStatus.Executed ||
                status === OrderStatus.Expired ||
                status === OrderStatus.Refunded
            ) {
                console.log(`     🏁 Order finished with status: ${status}`)
                console.log(`     📊 Total secrets submitted: ${totalSecretsSubmitted}`)
                console.log(`     ❌ Total errors encountered: ${totalErrors}`)
                break
            }

            // Wait before next check
            console.log('     ⏳ Waiting 2 seconds before next check...')
            await sleep(2000)

        } catch (error: any) {
            totalErrors++
            console.error(`     ❌ Error in monitoring iteration ${iteration}:`)
            console.error(`        📝 Error: ${error.message}`)
            console.error(`        🔢 Code: ${error.code || 'Unknown'}`)
            console.error(`        🏷️  Type: ${error.constructor.name}`)
            if (error.response) {
                console.error(`        🌐 Status: ${error.response.status}`)
                console.error(`        📋 Data: ${JSON.stringify(error.response.data, null, 2)}`)
            }
            console.error(`        📍 Stack trace: ${error.stack?.split('\n')[0]}`)
            await sleep(5000) // Wait longer on error
        }
    }

    console.log('\n   📋 Getting final order status...')
    const finalStatus = await sdk.getOrderStatus(orderHash)
    console.log('   📋 Final order status:')
    console.log(`     📊 Status: ${finalStatus.status}`)
    console.log(`     ⏱️  Final check time: ${new Date().toISOString()}`)
    console.log(`     📊 Final status object keys: ${Object.keys(finalStatus).join(', ')}`)
    
    if (finalStatus.fills) {
        console.log(`     📦 Fills: ${finalStatus.fills.length}`)
        finalStatus.fills.forEach((fill, index) => {
            console.log(`       📋 Fill ${index}: ${fill.txHash}`)
            console.log(`       📊 Fill object keys: ${Object.keys(fill).join(', ')}`)
        })
    }
    
    console.log(`   🎯 Monitoring completed after ${iteration} iterations`)
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
