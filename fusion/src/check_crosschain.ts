import { 
    SDK, 
    NetworkEnum, 
    OrderStatus, 
    PresetEnum, 
    PrivateKeyProviderConnector, 
    HashLock,
    getRandomBytes32
} from "@1inch/cross-chain-sdk";
import { computeAddress, formatUnits, JsonRpcProvider, parseUnits } from "ethers";
import * as dotenv from 'dotenv';
import { 
    checkTokenBalance, 
    checkTokenAllowance, 
    checkWalletStatus, 
    checkNativeBalance 
} from './helpers/token-helpers';

// Load environment variables
dotenv.config();

// Configuration from environment variables
const PRIVATE_KEY = process.env.PRIVATE_KEY ? `0x${process.env.PRIVATE_KEY}` : 'YOUR_PRIVATE_KEY'
const DEV_PORTAL_API_TOKEN = process.env.DEV_PORTAL_API_TOKEN || 'YOUR_DEV_PORTAL_API_TOKEN'

// Validate required environment variables
if (!process.env.PRIVATE_KEY || process.env.PRIVATE_KEY === 'your_private_key_here_without_0x_prefix') {
    throw new Error('❌ PRIVATE_KEY not set in .env file. Please copy env.template to .env and fill in your private key.')
}

if (!process.env.DEV_PORTAL_API_TOKEN || process.env.DEV_PORTAL_API_TOKEN === 'your_1inch_api_token_here') {
    throw new Error('❌ DEV_PORTAL_API_TOKEN not set in .env file. Please get your API token from https://portal.1inch.dev/')
}

// Network configurations for cross-chain swaps
const NETWORKS = {
    POLYGON: {
        name: 'Polygon',
        chainId: 137,
        rpcUrl: process.env.POLYGON_RPC_URL || 'https://polygon-rpc.com',
        networkEnum: NetworkEnum.POLYGON,
        tokens: {
            USDT: '0xc2132d05d31c914a87c6611c10748aeb04b58e8f',
            USDC: '0x2791bca1f2de4661ed88a30c99a7a9449aa84174',
            WETH: '0x7ceb23fd6bc0add59e62ac25578270cff1b9f619'
        }
    },
    BINANCE: {
        name: 'Binance Smart Chain',
        chainId: 56,
        rpcUrl: process.env.BSC_RPC_URL || 'https://bsc-dataseed.binance.org',
        networkEnum: NetworkEnum.BINANCE,
        tokens: {
            USDT: '0x55d398326f99059ff775485246999027b3197955',
            USDC: '0x8ac76a51cc950d9822d68b83fe1ad97b32cd580d',
            BNB: '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee'
        }
    },
    ETHEREUM: {
        name: 'Ethereum Mainnet',
        chainId: 1,
        rpcUrl: process.env.ETHEREUM_RPC_URL || 'https://eth.llamarpc.com',
        networkEnum: NetworkEnum.ETHEREUM,
        tokens: {
            USDT: '0xdac17f958d2ee523a2206206994597c13d831ec7',
            USDC: '0xa0b86a33e6441b8c4c8c0b8c4c8c0b8c4c8c0b8c',
            WETH: '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2'
        }
    },
    ARBITRUM: {
        name: 'Arbitrum One',
        chainId: 42161,
        rpcUrl: process.env.ARBITRUM_RPC_URL || 'https://arb1.arbitrum.io/rpc',
        networkEnum: NetworkEnum.ARBITRUM,
        tokens: {
            USDT: '0xfd086bc7cd5c481dcc9c85ebe478a1c0b69fcbb9',
            USDC: '0xff970a61a04b1ca14834a43f5de4533ebddb5cc8',
            WETH: '0x82af49447d8a07e3bd95bd0d56f35241523fbab1'
        }
    }
}

// Default networks for cross-chain swap - Mainnet to Polygon
const SOURCE_NETWORK = process.env.SOURCE_NETWORK || 'ETHEREUM'
const DESTINATION_NETWORK = process.env.DESTINATION_NETWORK || 'POLYGON'

const sourceNetwork = NETWORKS[SOURCE_NETWORK as keyof typeof NETWORKS] || NETWORKS.ETHEREUM
const destNetwork = NETWORKS[DESTINATION_NETWORK as keyof typeof NETWORKS] || NETWORKS.POLYGON

// Validate network configuration
if (!NETWORKS[SOURCE_NETWORK as keyof typeof NETWORKS]) {
    throw new Error(`❌ Invalid SOURCE_NETWORK: ${SOURCE_NETWORK}. Valid options: ${Object.keys(NETWORKS).join(', ')}`)
}

if (!NETWORKS[DESTINATION_NETWORK as keyof typeof NETWORKS]) {
    throw new Error(`❌ Invalid DESTINATION_NETWORK: ${DESTINATION_NETWORK}. Valid options: ${Object.keys(NETWORKS).join(', ')}`)
}

// Setup ethers provider for source network
const sourceProvider = new JsonRpcProvider(sourceNetwork.rpcUrl)

// Create Web3-like interface for the connector
const ethersProviderConnector = {
    eth: {
        call(transactionConfig: any): Promise<string> {
            return sourceProvider.call(transactionConfig)
        }
    },
    extend(): void {}
}

// Create blockchain connector
const connector = new PrivateKeyProviderConnector(
    PRIVATE_KEY,
    ethersProviderConnector
)

// Initialize Cross-Chain SDK
const sdk = new SDK({
    url: 'https://api.1inch.dev/fusion-plus',
    authKey: DEV_PORTAL_API_TOKEN,
    blockchainProvider: connector
})

// Helper function to check wallet status for cross-chain swap
async function checkWalletStatusForCrossChainSwap(
    walletAddress: string, 
    tokenAddress: string, 
    requiredAmount: string, 
    network: any
): Promise<{
    hasBalance: boolean,
    hasAllowance: boolean,
    balance: string,
    allowance: string,
    required: string,
    symbol: string
}> {
    const provider = new JsonRpcProvider(network.rpcUrl)
    const walletStatus = await checkWalletStatus(walletAddress, tokenAddress, requiredAmount, network.router || '0x111111125421ca6dc452d289314280a0f8842a65', provider)
    
    return {
        hasBalance: walletStatus.hasBalance,
        hasAllowance: walletStatus.hasAllowance,
        balance: walletStatus.balance,
        allowance: walletStatus.allowance,
        required: requiredAmount,
        symbol: walletStatus.symbol
    }
}

// Function to perform a cross-chain swap
async function performCrossChainSwap(
    fromTokenAddress: string,
    toTokenAddress: string,
    amount: string,
    walletAddress: string,
    swapNumber: number
): Promise<{ success: boolean, orderHash?: string, receivedAmount?: string }> {
    
    console.log(`\n🌉 CROSS-CHAIN SWAP ${swapNumber}: ${sourceNetwork.name} → ${destNetwork.name}`)
    console.log(`   From: ${fromTokenAddress} (${sourceNetwork.name})`)
    console.log(`   To: ${toTokenAddress} (${destNetwork.name})`)
    console.log(`   Amount: ${formatUnits(amount, 6)} tokens`)
    
    // Check wallet status before swap
    const walletStatus = await checkWalletStatusForCrossChainSwap(
        walletAddress, 
        fromTokenAddress, 
        amount, 
        sourceNetwork
    )
    
    if (!walletStatus.hasBalance) {
        console.log(`\n❌ Cross-chain swap ${swapNumber} failed: Insufficient ${walletStatus.symbol} balance`)
        return { success: false }
    }
    
    if (!walletStatus.hasAllowance) {
        console.log(`\n⚠️  Cross-chain swap ${swapNumber}: Insufficient allowance. You need to approve the router.`)
        console.log('💡 Continuing with quote and order creation for demonstration...')
    }
    
    try {
        // Get quote for cross-chain swap
        console.log(`\n📊 Getting cross-chain quote for swap ${swapNumber}...`)
        const quoteParams = {
            srcChainId: sourceNetwork.networkEnum,
            dstChainId: destNetwork.networkEnum,
            srcTokenAddress: fromTokenAddress,
            dstTokenAddress: toTokenAddress,
            amount: amount,
            walletAddress: walletAddress,
            enableEstimate: true,
            source: 'cross-chain-sdk-example'
        }

        const quote = await sdk.getQuote(quoteParams)
        console.log(`Cross-chain quote received for swap ${swapNumber}:`)
        console.log('- Source Chain:', sourceNetwork.name)
        console.log('- Destination Chain:', destNetwork.name)
        console.log('- Available Presets:', Object.keys(quote.presets))
        
        const fastPreset = quote.presets[PresetEnum.fast]
        if (fastPreset) {
            console.log('- Fast Preset Details:')
            console.log('  * Secrets Count:', fastPreset.secretsCount)
            console.log('  * Auction Duration:', fastPreset.auctionDuration, 'seconds')
            console.log('  * Expected Amount:', formatUnits(fastPreset.auctionStartAmount, 6), 'tokens')
        }

        // Generate secrets for hash-lock
        console.log(`\n🔐 Generating secrets for swap ${swapNumber}...`)
        const secretsCount = fastPreset.secretsCount
        const secrets = Array.from({length: secretsCount}).map(() => getRandomBytes32())
        const secretHashes = secrets.map((s) => HashLock.hashSecret(s))

        console.log(`Generated ${secretsCount} secrets for atomic swap`)

        // Create hash-lock
        const hashLock = secretsCount === 1
            ? HashLock.forSingleFill(secrets[0])
            : HashLock.forMultipleFills(HashLock.getMerkleLeaves(secrets))

        // Create order
        console.log(`\n📝 Creating cross-chain order for swap ${swapNumber}...`)
        const orderParams = {
            walletAddress: walletAddress,
            hashLock: hashLock,
            preset: PresetEnum.fast,
            source: 'cross-chain-sdk-example',
            secretHashes: secretHashes
        }

        const {hash, quoteId, order} = await sdk.createOrder(quote, orderParams)
        console.log(`Cross-chain order created for swap ${swapNumber}:`)
        console.log('- Order Hash:', hash)
        console.log('- Quote ID:', quoteId)
        console.log('- Order Hash (Chain):', order.getOrderHash(sourceNetwork.chainId))

        // Submit order
        console.log(`\n📤 Submitting cross-chain order for swap ${swapNumber}...`)
        
        // Check native token balance for gas fees
        const nativeBalance = await sourceProvider.getBalance(walletAddress)
        const nativeSymbol = sourceNetwork.name === 'Polygon' ? 'MATIC' : 
                           sourceNetwork.name === 'Binance Smart Chain' ? 'BNB' : 'ETH'
        
        console.log(`   ${nativeSymbol} Balance: ${formatUnits(nativeBalance, 18)} ${nativeSymbol}`)
        
        const hasEnoughNative = nativeBalance > parseUnits('0.01', 18)
        console.log(`   Has enough ${nativeSymbol} for gas: ${hasEnoughNative ? '✅ Yes' : '❌ No'}`)
        
        if (!hasEnoughNative) {
            console.log(`\n❌ Cross-chain swap ${swapNumber} failed: Insufficient ${nativeSymbol} for gas fees`)
            return { success: false }
        }
        
        const orderInfo = await sdk.submitOrder(
            sourceNetwork.networkEnum,
            order,
            quoteId,
            secretHashes
        )
        console.log(`✅ Cross-chain swap ${swapNumber} order submitted successfully!`)
        console.log('- Order Hash:', orderInfo.orderHash)

        // Track order status and handle secret submission
        console.log(`\n⏳ Tracking cross-chain order status for swap ${swapNumber}...`)
        const start = Date.now()

        while (true) {
            try {
                const data = await sdk.getOrderStatus(orderInfo.orderHash)
                console.log(`Cross-chain Swap ${swapNumber} Status: ${data.status}`)

                // Check for secrets that need to be shared
                const secretsToShare = await sdk.getReadyToAcceptSecretFills(orderInfo.orderHash)
                if (secretsToShare.fills.length) {
                    console.log(`🔓 Sharing ${secretsToShare.fills.length} secrets for swap ${swapNumber}...`)
                    for (const {idx} of secretsToShare.fills) {
                        await sdk.submitSecret(orderInfo.orderHash, secrets[idx])
                        console.log(`   Shared secret ${idx + 1}/${secretsToShare.fills.length}`)
                    }
                }

                if (data.status === OrderStatus.Executed) {
                    console.log(`✅ Cross-chain swap ${swapNumber} executed successfully!`)
                    
                    // Calculate received amount from fills
                    let totalReceived = BigInt(0)
                    if (data.fills && data.fills.length > 0) {
                        totalReceived = data.fills.reduce((sum: bigint, fill: any) => {
                            return sum + BigInt(fill.filledAuctionTakerAmount || fill.toTokenAmount || '0')
                        }, BigInt(0))
                    }
                    
                    const executionTime = (Date.now() - start) / 1000
                    console.log(`Cross-chain swap ${swapNumber} executed in ${executionTime} seconds`)
                    console.log(`Received: ${formatUnits(totalReceived.toString(), 6)} tokens on ${destNetwork.name}`)
                    
                    return { 
                        success: true, 
                        receivedAmount: totalReceived.toString(),
                        orderHash: orderInfo.orderHash
                    }
                }

                if (data.status === OrderStatus.Expired) {
                    console.log(`❌ Cross-chain swap ${swapNumber} expired`)
                    return { success: false }
                }
                
                if (data.status === OrderStatus.Cancelled) {
                    console.log(`❌ Cross-chain swap ${swapNumber} cancelled`)
                    return { success: false }
                }

                // Wait 3 seconds before checking again
                await new Promise(resolve => setTimeout(resolve, 3000))
            } catch (e) {
                console.log(`Error checking cross-chain swap ${swapNumber} status:`, e)
                await new Promise(resolve => setTimeout(resolve, 3000))
            }
        }
        
    } catch (error: any) {
        console.log(`\n❌ CROSS-CHAIN SWAP ${swapNumber} FAILED`)
        console.log('🔍 Error Analysis:')
        
        const errorMessage = error.message || 'Unknown error'
        const errorDescription = error.response?.data?.description || 'No description available'
        
        console.log(`   Error Message: ${errorMessage}`)
        console.log(`   Error Description: ${errorDescription}`)
        
        return { success: false }
    }
}

async function main() {
    try {
        console.log('🚀 Starting 1inch Cross-Chain SDK Example...')
        console.log(`🌉 Cross-Chain Route: ${sourceNetwork.name} → ${destNetwork.name}`)
        console.log(`🔗 Source RPC: ${sourceNetwork.rpcUrl}`)
        console.log(`🔗 Destination RPC: ${destNetwork.rpcUrl}`)
        
        const walletAddress = computeAddress(PRIVATE_KEY)
        console.log('👛 Wallet Address:', walletAddress)
        
        // Cross-chain swap configuration - 1.33 USDT on Mainnet to USDC on Polygon
        const swapAmount = process.env.SWAP_AMOUNT || '1330000' // 1.33 USDT (6 decimals)
        const { USDT: sourceUsdtAddress } = sourceNetwork.tokens
        const { USDC: destUsdcAddress } = destNetwork.tokens
        
        console.log('\n📋 CROSS-CHAIN SWAP PLAN:')
        console.log(`   ${formatUnits(swapAmount, 6)} USDT (${sourceNetwork.name}) → USDC (${destNetwork.name})`)
        
        // Print initial balance for verification
        console.log('\n💰 INITIAL BALANCE:')
        const sourceProvider = new JsonRpcProvider(sourceNetwork.rpcUrl)
        const destProvider = new JsonRpcProvider(destNetwork.rpcUrl)
        
        const initialSourceUsdtBalance = await checkTokenBalance(sourceUsdtAddress, walletAddress, sourceProvider)
        const initialDestUsdcBalance = await checkTokenBalance(destUsdcAddress, walletAddress, destProvider)
        const initialSourceNativeBalance = await sourceProvider.getBalance(walletAddress)
        const initialDestNativeBalance = await destProvider.getBalance(walletAddress)
        
        console.log(`   ${sourceNetwork.name} USDT: ${initialSourceUsdtBalance.formatted} USDT`)
        console.log(`   ${destNetwork.name} USDC: ${initialDestUsdcBalance.formatted} USDC`)
        console.log(`   ${sourceNetwork.name} ETH: ${formatUnits(initialSourceNativeBalance, 18)} ETH`)
        console.log(`   ${destNetwork.name} MATIC: ${formatUnits(initialDestNativeBalance, 18)} MATIC`)
        
        // Perform cross-chain swap
        console.log('\n' + '='.repeat(60))
        console.log('🌉 EXECUTING CROSS-CHAIN SWAP')
        console.log('='.repeat(60))
        
        const swapResult = await performCrossChainSwap(
            sourceUsdtAddress,
            destUsdcAddress,
            swapAmount,
            walletAddress,
            1
        )
        
        // Summary
        console.log('\n' + '='.repeat(60))
        console.log('📊 CROSS-CHAIN SWAP SUMMARY')
        console.log('='.repeat(60))
        console.log(`Cross-Chain Swap (${sourceNetwork.name} → ${destNetwork.name}): ${swapResult.success ? '✅ Success' : '❌ Failed'}`)
        if (swapResult.success) {
            console.log(`   Sent: ${formatUnits(swapAmount, 6)} USDT from ${sourceNetwork.name}`)
            console.log(`   Received: ${formatUnits(swapResult.receivedAmount || '0', 6)} USDC on ${destNetwork.name}`)
            console.log(`   Order Hash: ${swapResult.orderHash}`)
        }
        
        // Print final balance for verification
        console.log('\n💰 FINAL BALANCE:')
        const finalSourceUsdtBalance = await checkTokenBalance(sourceUsdtAddress, walletAddress, sourceProvider)
        const finalDestUsdcBalance = await checkTokenBalance(destUsdcAddress, walletAddress, destProvider)
        const finalSourceNativeBalance = await sourceProvider.getBalance(walletAddress)
        const finalDestNativeBalance = await destProvider.getBalance(walletAddress)
        
        console.log(`   ${sourceNetwork.name} USDT: ${finalSourceUsdtBalance.formatted} USDT`)
        console.log(`   ${destNetwork.name} USDC: ${finalDestUsdcBalance.formatted} USDC`)
        console.log(`   ${sourceNetwork.name} ETH: ${formatUnits(finalSourceNativeBalance, 18)} ETH`)
        console.log(`   ${destNetwork.name} MATIC: ${formatUnits(finalDestNativeBalance, 18)} MATIC`)
        
        // Balance change summary
        console.log('\n📈 BALANCE CHANGE SUMMARY:')
        const sourceUsdtChange = BigInt(finalSourceUsdtBalance.balance) - BigInt(initialSourceUsdtBalance.balance)
        const destUsdcChange = BigInt(finalDestUsdcBalance.balance) - BigInt(initialDestUsdcBalance.balance)
        const sourceNativeChange = finalSourceNativeBalance - initialSourceNativeBalance
        const destNativeChange = finalDestNativeBalance - initialDestNativeBalance
        
        console.log(`   ${sourceNetwork.name} USDT Change: ${formatUnits(sourceUsdtChange.toString(), 6)} USDT (${sourceUsdtChange >= 0 ? '+' : ''}${formatUnits(sourceUsdtChange.toString(), 6)})`)
        console.log(`   ${destNetwork.name} USDC Change: ${formatUnits(destUsdcChange.toString(), 6)} USDC (${destUsdcChange >= 0 ? '+' : ''}${formatUnits(destUsdcChange.toString(), 6)})`)
        console.log(`   ${sourceNetwork.name} ETH Change: ${formatUnits(sourceNativeChange.toString(), 18)} ETH (${sourceNativeChange >= 0 ? '+' : ''}${formatUnits(sourceNativeChange.toString(), 18)})`)
        console.log(`   ${destNetwork.name} MATIC Change: ${formatUnits(destNativeChange.toString(), 18)} MATIC (${destNativeChange >= 0 ? '+' : ''}${formatUnits(destNativeChange.toString(), 18)})`)

    } catch (error) {
        console.error('❌ Error:', error)
    }
}

// Example function for getting cross-chain quotes with custom presets
async function getCustomCrossChainQuote() {
    console.log('\n🎛️ Getting cross-chain quote with custom preset...')
    
    const { USDT: sourceUsdtAddress } = sourceNetwork.tokens
    const { USDC: destUsdcAddress } = destNetwork.tokens
    
    const quoteParams = {
        srcChainId: sourceNetwork.networkEnum,
        dstChainId: destNetwork.networkEnum,
        srcTokenAddress: sourceUsdtAddress,
        dstTokenAddress: destUsdcAddress,
        amount: '1330000', // 1.33 USDT
        walletAddress: computeAddress(PRIVATE_KEY),
        enableEstimate: true,
        source: 'cross-chain-sdk-example'
    }

    const customPresetBody = {
        customPreset: {
            auctionDuration: 300, // 5 minutes
            auctionStartAmount: '1560000', // 1.56 USDT
            auctionEndAmount: '780000', // 0.78 USDT
            // Custom non-linear curve
            points: [
                { toTokenAmount: '1404000', delay: 30 }, // 1.404 USDT at 30s
                { toTokenAmount: '1092000', delay: 60 }  // 1.092 USDT at 60s
            ]
        }
    }

    try {
        const quote = await sdk.getQuoteWithCustomPreset(quoteParams, customPresetBody)
        console.log('Custom cross-chain quote received:', quote)
    } catch (error) {
        console.error('Error getting custom cross-chain quote:', error)
    }
}

// Example function for placing a cross-chain order with fees
async function placeCrossChainOrderWithFees() {
    console.log('\n💰 Placing cross-chain order with fees...')
    
    const { USDT: sourceUsdtAddress } = sourceNetwork.tokens
    const { USDC: destUsdcAddress } = destNetwork.tokens
    
    const quoteParams = {
        srcChainId: sourceNetwork.networkEnum,
        dstChainId: destNetwork.networkEnum,
        srcTokenAddress: sourceUsdtAddress,
        dstTokenAddress: destUsdcAddress,
        amount: '1330000', // 1.33 USDT
        walletAddress: computeAddress(PRIVATE_KEY),
        enableEstimate: true,
        source: 'cross-chain-sdk-example'
    }

    try {
        const quote = await sdk.getQuote(quoteParams)
        
        const secretsCount = quote.presets[PresetEnum.fast].secretsCount
        const secrets = Array.from({length: secretsCount}).map(() => getRandomBytes32())
        const secretHashes = secrets.map((s) => HashLock.hashSecret(s))

        const hashLock = secretsCount === 1
            ? HashLock.forSingleFill(secrets[0])
            : HashLock.forMultipleFills(HashLock.getMerkleLeaves(secrets))

        const orderParams = {
            walletAddress: computeAddress(PRIVATE_KEY),
            hashLock: hashLock,
            preset: PresetEnum.fast,
            source: 'cross-chain-sdk-example',
            secretHashes: secretHashes,
            fee: {
                takingFeeBps: 100, // 1% fee (100 basis points)
                takingFeeReceiver: '0x0000000000000000000000000000000000000000' // Fee receiver
            }
        }

        const orderInfo = await sdk.placeOrder(quote, orderParams)
        console.log('Cross-chain order placed with fees:', orderInfo)
    } catch (error) {
        console.error('Error placing cross-chain order with fees:', error)
    }
}

// Run the main example
if (require.main === module) {
    main()
        .then(() => {
            console.log('\n✨ Cross-Chain SDK example completed!')
            process.exit(0)
        })
        .catch((error) => {
            console.error('💥 Cross-chain example failed:', error)
            process.exit(1)
        })
}

export { main, getCustomCrossChainQuote, placeCrossChainOrderWithFees } 