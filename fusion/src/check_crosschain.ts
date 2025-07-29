import {
    HashLock,
    NetworkEnum,
    OrderStatus,
    PresetEnum,
    PrivateKeyProviderConnector,
    SDK
} from '@1inch/cross-chain-sdk'
import { ethers } from 'ethers'
import { randomBytes } from 'node:crypto'
import { checkAndApproveTokens } from './helpers/token-helpers'
import * as dotenv from 'dotenv'

// Load environment variables
dotenv.config()

// Configuration
const privateKey = process.env.PRIVATE_KEY || '0x' // Set your private key in environment
const rpc = process.env.ETHEREUM_RPC_URL || process.env.ETH_RPC || 'https://ethereum-rpc.publicnode.com'
const authKey = process.env.DEV_PORTAL_API_TOKEN || process.env.INCH_AUTH_KEY || 'auth-key' // Get from https://portal.1inch.dev
const source = 'fusion-example'

// Token addresses
const USDC_ETHEREUM = '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48' // USDC on Ethereum
const USDT_POLYGON = '0xc2132D05D31c914a87C6611C10748AEb04B58e8F' // USDT on Polygon

// Limit Order Protocol address (Router V6)
const LIMIT_ORDER_PROTOCOL = '0x111111125421ca6dc452d289314280a0f8842a65'

// Amount: 10 USDC (6 decimals) - increased to meet minimum requirements
const AMOUNT_USDC = '10000000' // 10 * 10^6

async function sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms))
}

async function main(): Promise<void> {
    try {
        // Check environment variables
        if (!process.env.PRIVATE_KEY || process.env.PRIVATE_KEY === '0x' || process.env.PRIVATE_KEY === 'your_private_key_here') {
            console.error('❌ PRIVATE_KEY environment variable is not set or invalid')
            console.error('   Please set your private key in the .env file or environment')
            console.error('   Example: PRIVATE_KEY=1234567890abcdef...')
            process.exit(1)
        }

        if (!process.env.DEV_PORTAL_API_TOKEN || process.env.DEV_PORTAL_API_TOKEN === 'auth-key' || process.env.DEV_PORTAL_API_TOKEN === 'your_1inch_api_token_here') {
            console.error('❌ DEV_PORTAL_API_TOKEN environment variable is not set or invalid')
            console.error('   Please get your API key from https://portal.1inch.dev/')
            console.error('   Example: DEV_PORTAL_API_TOKEN=your_api_key_here')
            process.exit(1)
        }

        console.log('🚀 Starting cross-chain swap: USDC (Ethereum) → USDT (Polygon)')
        console.log(`💰 Amount: ${parseInt(AMOUNT_USDC) / 1000000} USDC`)
        
        // Initialize Web3 and get wallet address
        const { Web3 } = require('web3')
        const web3 = new Web3(rpc)
        const privateKeyWithPrefix = privateKey.startsWith('0x') ? privateKey : `0x${privateKey}`
        const walletAddress = web3.eth.accounts.privateKeyToAccount(privateKeyWithPrefix).address
        
        // Display detailed configuration information
        console.log('\n📋 Configuration Details:')
        console.log(`👛 Wallet Address: ${walletAddress}`)
        console.log(`🌐 Source Network: Ethereum Mainnet`)
        console.log(`🌐 Destination Network: Polygon`)
        console.log(`🔗 RPC Endpoint: ${rpc}`)
        console.log(`🔑 Auth Key: ${authKey.substring(0, 8)}...${authKey.substring(authKey.length - 4)}`)
        console.log(`📝 Source: ${source}`)
        
        // Display token addresses
        console.log('\n🪙 Token Addresses:')
        console.log(`   USDC (Ethereum): ${USDC_ETHEREUM}`)
        console.log(`   USDT (Polygon): ${USDT_POLYGON}`)
        
        // Display contract addresses
        console.log('\n📜 Contract Addresses:')
        console.log(`   Limit Order Protocol (Router V6): ${LIMIT_ORDER_PROTOCOL}`)
        
        // Display amount details
        console.log('\n💰 Amount Details:')
        console.log(`   Raw Amount: ${AMOUNT_USDC} (6 decimals)`)
        console.log(`   Human Readable: ${parseInt(AMOUNT_USDC) / 1000000} USDC`)

        // Initialize SDK first
        const sdk = new SDK({
            url: 'https://api.1inch.dev/fusion-plus',
            authKey,
            blockchainProvider: new PrivateKeyProviderConnector(privateKeyWithPrefix, web3)
        })
        console.log('✅ SDK initialized')

        // Check and approve USDC allowance
        console.log('\n🔍 Checking USDC allowance...')
        const ethersProvider = new ethers.JsonRpcProvider(rpc)
        const wallet = new ethers.Wallet(privateKeyWithPrefix, ethersProvider)
        
        // Approve USDC for both Limit Order Protocol and Escrow Factory
        const largeAllowanceAmount = '1000000000' // 1000 USDC (6 decimals)
        console.log(`   Approving ${parseInt(largeAllowanceAmount) / 1000000} USDC allowance...`)
        
        // Check current allowance first
        const { approveTokens } = await import('./helpers/token-helpers')
        
        // Approve for Limit Order Protocol
        console.log(`   Approving for Limit Order Protocol: ${LIMIT_ORDER_PROTOCOL}`)
        const limitOrderApproval = await approveTokens(USDC_ETHEREUM, LIMIT_ORDER_PROTOCOL, largeAllowanceAmount, wallet)
        if (!limitOrderApproval) {
            console.error('❌ Limit Order Protocol approval failed. Cannot proceed.')
            process.exit(1)
        }
        
        // Approve for Escrow Factory (required for cross-chain swaps)
        const escrowFactoryAddress = '0xa7bcb4eac8964306f9e3764f67db6a7af6ddf99a'
        console.log(`   Approving for Escrow Factory: ${escrowFactoryAddress}`)
        const escrowApproval = await approveTokens(USDC_ETHEREUM, escrowFactoryAddress, largeAllowanceAmount, wallet)
        if (!escrowApproval) {
            console.error('❌ Escrow Factory approval failed. Cannot proceed.')
            process.exit(1)
        }

        // Verify allowances before proceeding
        console.log('\n🔍 Verifying allowances...')
        const { checkTokenAllowance } = await import('./helpers/token-helpers')
        
        const limitOrderAllowance = await checkTokenAllowance(USDC_ETHEREUM, walletAddress, LIMIT_ORDER_PROTOCOL, ethersProvider)
        const escrowAllowance = await checkTokenAllowance(USDC_ETHEREUM, walletAddress, escrowFactoryAddress, ethersProvider)
        
        console.log(`   Limit Order Protocol Allowance: ${limitOrderAllowance.formatted} USDC`)
        console.log(`   Escrow Factory Allowance: ${escrowAllowance.formatted} USDC`)
        
        if (BigInt(limitOrderAllowance.allowance) < BigInt(AMOUNT_USDC) || BigInt(escrowAllowance.allowance) < BigInt(AMOUNT_USDC)) {
            console.error('❌ Insufficient allowance after approval. Cannot proceed.')
            process.exit(1)
        }
        
        console.log('✅ All allowances verified successfully')



        // Step 1: Get quote
        console.log('\n📊 Getting quote...')
        let quote
        try {
            quote = await sdk.getQuote({
                amount: AMOUNT_USDC,
                srcChainId: NetworkEnum.ETHEREUM,
                dstChainId: NetworkEnum.POLYGON,
                enableEstimate: true,
                srcTokenAddress: USDC_ETHEREUM,
                dstTokenAddress: USDT_POLYGON,
                walletAddress
            })
            console.log('✅ Quote retrieved successfully')
        } catch (quoteError: any) {
            console.error(`❌ Quote retrieval failed:`)
            console.error(`   Error Type: ${quoteError?.constructor?.name || 'Unknown'}`)
            console.error(`   Error Message: ${quoteError?.message || 'Unknown error'}`)
            if (quoteError?.response) {
                console.error(`   HTTP Status: ${quoteError.response.status}`)
                console.error(`   Response Data: ${JSON.stringify(quoteError.response.data, null, 2)}`)
            }
            throw quoteError
        }

        console.log(`📈 Quote received:`)
        console.log(`   Source Token: ${USDC_ETHEREUM} (USDC)`)
        console.log(`   Destination Token: ${USDT_POLYGON} (USDT)`)
        console.log(`   Input Amount: ${quote.srcTokenAmount} USDC`)
        console.log(`   Expected Output: ${quote.dstTokenAmount} USDT`)
        console.log(`   Available Presets: ${Object.keys(quote.presets).join(', ')}`)
        console.log(`   Quote ID: ${quote.quoteId}`)
        console.log(`   Source Chain: ${quote.srcChainId}`)
        console.log(`   Destination Chain: ${quote.dstChainId}`)
        console.log(`   Source Escrow Factory: ${quote.srcEscrowFactory}`)
        console.log(`   Destination Escrow Factory: ${quote.dstEscrowFactory}`)
        console.log(`   Source Safety Deposit: ${quote.srcSafetyDeposit}`)
        console.log(`   Destination Safety Deposit: ${quote.dstSafetyDeposit}`)
        console.log(`   Time Locks: ${JSON.stringify(quote.timeLocks, null, 2)}`)

        // Step 2: Select preset and generate secrets
        const preset = PresetEnum.fast
        console.log(`\n🔐 Using preset: ${preset}`)

        const secrets = Array.from({
            length: quote.presets[preset].secretsCount
        }).map(() => '0x' + randomBytes(32).toString('hex'))

        const hashLock = secrets.length === 1
            ? HashLock.forSingleFill(secrets[0])
            : HashLock.forMultipleFills(HashLock.getMerkleLeaves(secrets))

        const secretHashes = secrets.map((s) => HashLock.hashSecret(s))
        console.log(`🔑 Generated ${secrets.length} secrets`)
        console.log(`   Secret Hashes: ${secretHashes.join(', ')}`)
        console.log(`   Hash Lock Type: ${secrets.length === 1 ? 'Single Fill' : 'Multiple Fills'}`)

        // Step 3: Create order
        console.log('\n📝 Creating order...')
        let hash, quoteId, order
        try {
            const orderResult = await sdk.createOrder(quote, {
                walletAddress,
                hashLock,
                preset,
                source,
                secretHashes
            })
            hash = orderResult.hash
            quoteId = orderResult.quoteId
            order = orderResult.order
            console.log('✅ Order created successfully')
        } catch (orderError: any) {
            console.error(`❌ Order creation failed:`)
            console.error(`   Error Type: ${orderError?.constructor?.name || 'Unknown'}`)
            console.error(`   Error Message: ${orderError?.message || 'Unknown error'}`)
            if (orderError?.response) {
                console.error(`   HTTP Status: ${orderError.response.status}`)
                console.error(`   Response Data: ${JSON.stringify(orderError.response.data, null, 2)}`)
            }
            throw orderError
        }
        console.log(`✅ Order created:`)
        console.log(`   Order Hash: ${hash}`)
        console.log(`   Quote ID: ${quoteId}`)
        console.log(`   Order Details: ${JSON.stringify(order, (key, value) => 
            typeof value === 'bigint' ? value.toString() : value, 2)}`)

        // Step 4: Submit order
        console.log('\n📤 Submitting order...')
        console.log(`   Source Chain ID: ${quote.srcChainId}`)
        console.log(`   Quote ID: ${quoteId}`)
        console.log(`   Secret Hashes Count: ${secretHashes.length}`)
        console.log(`   Order Type: ${typeof order}`)
        
        // Check if quote is still valid (not expired)
        const currentTime = Math.floor(Date.now() / 1000)
        console.log(`   Current Timestamp: ${currentTime}`)
        console.log(`   Quote Timestamp: ${quote.quoteId ? 'Available' : 'Not available'}`)
        
        try {
            await sdk.submitOrder(
                quote.srcChainId,
                order,
                quoteId,
                secretHashes
            )
            console.log(`✅ Order submitted successfully`)
        } catch (submitError: any) {
            console.error(`❌ Order submission failed:`)
            console.error(`   Error Type: ${submitError?.constructor?.name || 'Unknown'}`)
            console.error(`   Error Message: ${submitError?.message || 'Unknown error'}`)
            
            if (submitError?.response) {
                console.error(`   HTTP Status: ${submitError.response.status}`)
                console.error(`   Response Data: ${JSON.stringify(submitError.response.data, null, 2)}`)
                console.error(`   Request URL: ${submitError.config?.url}`)
                console.error(`   Request Method: ${submitError.config?.method}`)
            }
            
            throw submitError
        }

        // Step 5: Monitor and submit secrets
        console.log('\n⏳ Monitoring order execution...')
        let attempts = 0
        const maxAttempts = 300 // 5 minutes max

        while (attempts < maxAttempts) {
            const secretsToShare = await sdk.getReadyToAcceptSecretFills(hash)

            if (secretsToShare.fills.length) {
                console.log(`🔓 Found ${secretsToShare.fills.length} escrows ready for secrets`)
                for (const { idx } of secretsToShare.fills) {
                    await sdk.submitSecret(hash, secrets[idx])
                    console.log(`   ✅ Submitted secret ${idx}`)
                }
            }

            // Check order status
            const { status } = await sdk.getOrderStatus(hash)
            console.log(`📊 Order status: ${status} (Attempt ${attempts + 1}/${maxAttempts})`)

            if (
                status === OrderStatus.Executed ||
                status === OrderStatus.Expired ||
                status === OrderStatus.Refunded
            ) {
                console.log(`\n🎉 Order ${status.toLowerCase()}!`)
                break
            }

            attempts++
            await sleep(1000) // Wait 1 second before next check
        }

        // Final status check
        const finalStatus = await sdk.getOrderStatus(hash)
        console.log('\n📋 Final order details:')
        console.log(JSON.stringify(finalStatus, null, 2))

        if (finalStatus.status === OrderStatus.Executed) {
            console.log('\n🎉 Swap completed successfully!')
            console.log(`💰 You received USDT on Polygon`)
        } else {
            console.log('\n❌ Swap did not complete successfully')
            console.log(`📊 Final status: ${finalStatus.status}`)
        }

    } catch (error) {
        console.error('❌ Error during swap:', error)
        throw error
    }
}

// Run the example
if (require.main === module) {
    main()
        .then(() => {
            console.log('\n✅ Example completed')
            process.exit(0)
        })
        .catch((error) => {
            console.error('\n❌ Example failed:', error)
            process.exit(1)
        })
}

export { main }
