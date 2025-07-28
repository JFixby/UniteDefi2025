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

// Configuration
const privateKey = process.env.PRIVATE_KEY || '0x' // Set your private key in environment
const rpc = process.env.ETH_RPC || 'https://ethereum-rpc.publicnode.com'
const authKey = process.env.INCH_AUTH_KEY || 'auth-key' // Get from https://portal.1inch.dev
const source = 'fusion-example'

// Token addresses
const USDT_ETHEREUM = '0xdAC17F958D2ee523a2206206994597C13D831ec7' // USDT on Ethereum
const USDC_POLYGON = '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174' // USDC on Polygon

// Limit Order Protocol address (Router V6)
const LIMIT_ORDER_PROTOCOL = '0x111111125421ca6dc452d289314280a0f8842a65'

// Amount: 1.33 USDT (6 decimals)
const AMOUNT_USDT = '1330000' // 1.33 * 10^6

async function sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms))
}

async function main(): Promise<void> {
    try {
        console.log('🚀 Starting cross-chain swap: USDT (Ethereum) → USDC (Polygon)')
        console.log(`💰 Amount: 1.33 USDT`)
        
        // Initialize Web3 and get wallet address
        const web3 = new (require('web3'))(rpc)
        const walletAddress = web3.eth.accounts.privateKeyToAccount(privateKey).address
        console.log(`👛 Wallet: ${walletAddress}`)

        // Check and approve USDT allowance
        console.log('\n🔍 Checking USDT allowance...')
        const ethersProvider = new ethers.JsonRpcProvider(rpc)
        const wallet = new ethers.Wallet(privateKey, ethersProvider)
        await checkAndApproveTokens(wallet, USDT_ETHEREUM, 'USDT', LIMIT_ORDER_PROTOCOL)

        // Initialize SDK
        const sdk = new SDK({
            url: 'https://api.1inch.dev/fusion-plus',
            authKey,
            blockchainProvider: new PrivateKeyProviderConnector(privateKey, web3)
        })
        console.log('✅ SDK initialized')

        // Step 1: Get quote
        console.log('\n📊 Getting quote...')
        const quote = await sdk.getQuote({
            amount: AMOUNT_USDT,
            srcChainId: NetworkEnum.ETHEREUM,
            dstChainId: NetworkEnum.POLYGON,
            enableEstimate: true,
            srcTokenAddress: USDT_ETHEREUM,
            dstTokenAddress: USDC_POLYGON,
            walletAddress
        })

        console.log(`📈 Quote received:`)
        console.log(`   Source: USDT on ${quote.srcChainId}`)
        console.log(`   Destination: USDC on ${quote.dstChainId}`)
        console.log(`   Expected output: ${quote.dstTokenAmount} USDC`)
        console.log(`   Available presets: ${Object.keys(quote.presets).join(', ')}`)

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

        // Step 3: Create order
        console.log('\n📝 Creating order...')
        const { hash, quoteId, order } = await sdk.createOrder(quote, {
            walletAddress,
            hashLock,
            preset,
            source,
            secretHashes
        })
        console.log(`✅ Order created with hash: ${hash}`)

        // Step 4: Submit order
        console.log('\n📤 Submitting order...')
        const orderInfo = await sdk.submitOrder(
            quote.srcChainId,
            order,
            quoteId,
            secretHashes
        )
        console.log(`✅ Order submitted`)

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
            console.log(`📊 Order status: ${status}`)

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
            console.log(`💰 You received USDC on Polygon`)
            console.log(`📊 Order details: ${JSON.stringify(finalStatus, null, 2)}`)
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
