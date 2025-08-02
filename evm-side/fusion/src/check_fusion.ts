import { 
    FusionSDK, 
    NetworkEnum, 
    OrderStatus, 
    PrivateKeyProviderConnector, 
    Web3Like 
} from "@1inch/fusion-sdk";
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

// Network configurations
const NETWORKS = {
    POLYGON: {
        name: 'Polygon',
        chainId: 137,
        rpcUrl: process.env.POLYGON_RPC_URL || 'https://polygon-rpc.com',
        networkEnum: NetworkEnum.POLYGON,
        tokens: {
            USDT: '0xc2132d05d31c914a87c6611c10748aeb04b58e8f',
            USDC: '0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359'
        },
        router: '0x111111125421ca6dc452d289314280a0f8842a65'
    },
    ETHEREUM: {
        name: 'Ethereum Mainnet',
        chainId: 1,
        rpcUrl: process.env.ETHEREUM_RPC_URL || 'https://eth.llamarpc.com',
        networkEnum: NetworkEnum.ETHEREUM,
        tokens: {
            USDT: '0xdac17f958d2ee523a2206206994597c13d831ec7',
            USDC: '0xa0b86a33e6441b8c4c8c0b8c4c8c0b8c4c8c0b8c'
        },
        router: '0x111111125421ca6dc452d289314280a0f8842a65'
    },
    POLYGON_TESTNET: {
        name: 'Polygon Mumbai Testnet',
        chainId: 80001,
        rpcUrl: process.env.POLYGON_TESTNET_RPC_URL || 'https://rpc-mumbai.maticvigil.com',
        networkEnum: NetworkEnum.POLYGON, // Using Polygon enum for testnet
        tokens: {
            USDT: '0xa02f6adc7926efeebd5d6af4cf418684dd0d1a86',
            USDC: '0xe6b8a5cf854791412c1f6efc7caf629f5df1c747'
        },
        router: '0x111111125421ca6dc452d289314280a0f8842a65'
    },
    ETHEREUM_TESTNET: {
        name: 'Ethereum Sepolia Testnet',
        chainId: 11155111,
        rpcUrl: process.env.ETHEREUM_TESTNET_RPC_URL || 'https://rpc.sepolia.org',
        networkEnum: NetworkEnum.ETHEREUM, // Using Ethereum enum for testnet
        tokens: {
            USDT: '0x7169d38820dfd117c3b1b8b8b8b8b8b8b8b8b8b8',
            USDC: '0x1c7d4b196cb0c7b01d743fbc6116a902379c7238'
        },
        router: '0x111111125421ca6dc452d289314280a0f8842a65'
    }
}

// Default network (can be changed via environment variable)
const DEFAULT_NETWORK = process.env.DEFAULT_NETWORK || 'POLYGON'
const currentNetwork = NETWORKS[DEFAULT_NETWORK as keyof typeof NETWORKS] || NETWORKS.POLYGON

// Setup ethers provider
const ethersRpcProvider = new JsonRpcProvider(currentNetwork.rpcUrl)

// Create Web3-like interface for the connector
const ethersProviderConnector: Web3Like = {
    eth: {
        call(transactionConfig): Promise<string> {
            return ethersRpcProvider.call(transactionConfig)
        }
    },
    extend(): void {}
}

// Create blockchain connector
const connector = new PrivateKeyProviderConnector(
    PRIVATE_KEY,
    ethersProviderConnector
)

// Initialize Fusion SDK
const sdk = new FusionSDK({
    url: 'https://api.1inch.dev/fusion',
    network: currentNetwork.networkEnum,
    blockchainProvider: connector,
    authKey: DEV_PORTAL_API_TOKEN
})

// Helper function to check wallet status using the imported helpers
async function checkWalletStatusForSwap(walletAddress: string, tokenAddress: string, requiredAmount: string, routerAddress: string): Promise<{
    hasBalance: boolean,
    hasAllowance: boolean,
    balance: string,
    allowance: string,
    required: string,
    symbol: string
}> {
    const walletStatus = await checkWalletStatus(walletAddress, tokenAddress, requiredAmount, routerAddress, ethersRpcProvider)
    
    return {
        hasBalance: walletStatus.hasBalance,
        hasAllowance: walletStatus.hasAllowance,
        balance: walletStatus.balance,
        allowance: walletStatus.allowance,
        required: requiredAmount,
        symbol: walletStatus.symbol
    }
}

// Function to perform a single swap
async function performSwap(
    fromTokenAddress: string,
    toTokenAddress: string,
    amount: string,
    walletAddress: string,
    routerAddress: string,
    swapNumber: number
): Promise<{ success: boolean, receivedAmount?: string, orderHash?: string }> {
    // Determine token symbols for display
    const { USDT: usdtAddress, USDC: usdcAddress } = currentNetwork.tokens
    const fromSymbol = fromTokenAddress === usdtAddress ? 'USDT' : 'USDC'
    const toSymbol = toTokenAddress === usdcAddress ? 'USDC' : 'USDT'
    
    console.log(`\n🔄 SWAP ${swapNumber}: ${formatUnits(amount, 6)} ${fromSymbol} → ${toSymbol}`)
    console.log(`   From: ${fromTokenAddress} (${fromSymbol})`)
    console.log(`   To: ${toTokenAddress} (${toSymbol})`)
    console.log(`   Amount: ${formatUnits(amount, 6)} ${fromSymbol}`)
    
    // Check wallet status before swap
    const walletStatus = await checkWalletStatusForSwap(walletAddress, fromTokenAddress, amount, routerAddress)
    
    if (!walletStatus.hasBalance) {
        console.log(`\n❌ Swap ${swapNumber} failed: Insufficient ${walletStatus.symbol} balance`)
        return { success: false }
    }
    
    if (!walletStatus.hasAllowance) {
        console.log(`\n⚠️  Swap ${swapNumber}: Insufficient allowance. You need to approve the router.`)
        console.log('💡 Continuing with quote and order creation for demonstration...')
    }
    
    try {
        // Get quote
        console.log(`\n📊 Getting quote for swap ${swapNumber}...`)
        const quoteParams = {
            fromTokenAddress,
            toTokenAddress,
            amount,
            walletAddress,
            source: 'fusion-sdk-example'
        }

        const quote = await sdk.getQuote(quoteParams)
        console.log(`Quote received for swap ${swapNumber}:`)
        console.log('- Recommended preset:', quote.recommendedPreset)
        
        const recommendedPreset = quote.presets[quote.recommendedPreset]
        if (recommendedPreset) {
            console.log('- Expected USDC amount:', formatUnits(recommendedPreset.auctionStartAmount, 6), 'USDC')
            console.log('- Auction duration:', recommendedPreset.auctionDuration, 'seconds')
        }

        // Create order
        console.log(`\n📝 Creating order for swap ${swapNumber}...`)
        const orderParams = {
            fromTokenAddress,
            toTokenAddress,
            amount,
            walletAddress,
            source: 'fusion-sdk-example'
        }

        const preparedOrder = await sdk.createOrder(orderParams)
        console.log(`Order created for swap ${swapNumber}:`)
        console.log('- Quote ID:', preparedOrder.quoteId)
        console.log('- Order hash:', preparedOrder.order.getOrderHash(1))

        // Submit order
        console.log(`\n📤 Submitting order for swap ${swapNumber}...`)
        
        // Check MATIC balance for gas fees
        const maticBalance = await ethersRpcProvider.getBalance(walletAddress)
        console.log(`   MATIC Balance: ${formatUnits(maticBalance, 18)} MATIC`)
        
        const hasEnoughMatic = maticBalance > parseUnits('0.01', 18)
        console.log(`   Has enough MATIC for gas: ${hasEnoughMatic ? '✅ Yes' : '❌ No'}`)
        
        if (!hasEnoughMatic) {
            console.log(`\n❌ Swap ${swapNumber} failed: Insufficient MATIC for gas fees`)
            return { success: false }
        }
        
        const orderInfo = await sdk.submitOrder(preparedOrder.order, preparedOrder.quoteId)
        console.log(`✅ Swap ${swapNumber} order submitted successfully!`)
        console.log('- Order hash:', orderInfo.orderHash)

        // Track order status
        console.log(`\n⏳ Tracking order status for swap ${swapNumber}...`)
        const start = Date.now()

        while (true) {
            try {
                const data = await sdk.getOrderStatus(orderInfo.orderHash)
                console.log(`Swap ${swapNumber} Status: ${data.status}`)

                if (data.status === OrderStatus.Filled) {
                    console.log(`✅ Swap ${swapNumber} filled successfully!`)
                    console.log('Fills:', data.fills)
                    
                    // Calculate received amount from fills
                    let totalReceived = BigInt(0)
                    if (data.fills && data.fills.length > 0) {
                        totalReceived = data.fills.reduce((sum: bigint, fill: any) => {
                            return sum + BigInt(fill.filledAuctionTakerAmount || fill.toTokenAmount || '0')
                        }, BigInt(0))
                    }
                    
                    const executionTime = (Date.now() - start) / 1000
                    console.log(`Swap ${swapNumber} executed in ${executionTime} seconds`)
                    console.log(`Received: ${formatUnits(totalReceived.toString(), 6)} USDC`)
                    
                    return { 
                        success: true, 
                        receivedAmount: totalReceived.toString(),
                        orderHash: orderInfo.orderHash
                    }
                }

                if (data.status === OrderStatus.Expired) {
                    console.log(`❌ Swap ${swapNumber} expired`)
                    return { success: false }
                }
                
                if (data.status === OrderStatus.Cancelled) {
                    console.log(`❌ Swap ${swapNumber} cancelled`)
                    return { success: false }
                }

                // Wait 2 seconds before checking again
                await new Promise(resolve => setTimeout(resolve, 2000))
            } catch (e) {
                console.log(`Error checking swap ${swapNumber} status:`, e)
                await new Promise(resolve => setTimeout(resolve, 2000))
            }
        }
        
    } catch (error: any) {
        console.log(`\n❌ SWAP ${swapNumber} FAILED`)
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
        console.log('🚀 Starting 1inch Fusion SDK Example with Two Subsequent Swaps...')
        console.log(`📍 Network: ${currentNetwork.name} (Chain ID: ${currentNetwork.chainId})`)
        console.log(`🔗 RPC URL: ${currentNetwork.rpcUrl}`)
        console.log(`🔄 1inch Router Address: ${currentNetwork.router}`)
        
        const walletAddress = computeAddress(PRIVATE_KEY)
        console.log('👛 Wallet Address:', walletAddress)
        
        // Swap configuration
        const firstSwapAmount = '1560000' // 1.56 USDT (6 decimals)
        const { USDT: usdtAddress, USDC: usdcAddress } = currentNetwork.tokens
        
        console.log('\n📋 SWAP PLAN:')
        console.log(`   1. ${formatUnits(firstSwapAmount, 6)} USDT → USDC`)
        console.log(`   2. Resulting USDC → USDT (if first swap succeeds)`)
        
        // Print initial balance for verification
        console.log('\n💰 INITIAL BALANCE:')
        const initialUsdtBalance = await checkTokenBalance(usdtAddress, walletAddress, ethersRpcProvider)
        const initialUsdcBalance = await checkTokenBalance(usdcAddress, walletAddress, ethersRpcProvider)
        const initialMaticBalance = await ethersRpcProvider.getBalance(walletAddress)
        
        console.log(`   USDT Balance: ${initialUsdtBalance.formatted} USDT (${usdtAddress})`)
        console.log(`   USDC Balance: ${initialUsdcBalance.formatted} USDC (${usdcAddress})`)
        console.log(`   MATIC Balance: ${formatUnits(initialMaticBalance, 18)} MATIC (Native Token)`)
        
        // Perform first swap: USDT → USDC
        console.log('\n' + '='.repeat(60))
        console.log('🔄 EXECUTING SWAP 1: USDT → USDC')
        console.log('='.repeat(60))
        
        const firstSwapResult = await performSwap(
            usdtAddress,
            usdcAddress,
            firstSwapAmount,
            walletAddress,
            currentNetwork.router,
            1
        )
        
        if (!firstSwapResult.success) {
            console.log('\n❌ First swap failed. Cannot proceed with second swap.')
            return
        }
        
        // Print balance after first swap for verification
        console.log('\n💰 BALANCE AFTER SWAP 1:')
        const afterFirstSwapUsdtBalance = await checkTokenBalance(usdtAddress, walletAddress, ethersRpcProvider)
        const afterFirstSwapUsdcBalance = await checkTokenBalance(usdcAddress, walletAddress, ethersRpcProvider)
        const afterFirstSwapMaticBalance = await ethersRpcProvider.getBalance(walletAddress)
        
        console.log(`   USDT Balance: ${afterFirstSwapUsdtBalance.formatted} USDT (${usdtAddress})`)
        console.log(`   USDC Balance: ${afterFirstSwapUsdcBalance.formatted} USDC (${usdcAddress})`)
        console.log(`   MATIC Balance: ${formatUnits(afterFirstSwapMaticBalance, 18)} MATIC (Native Token)`)
        
        // Wait a bit before second swap
        console.log('\n⏳ Waiting 5 seconds before second swap...')
        await new Promise(resolve => setTimeout(resolve, 5000))
        
        // Perform second swap: USDC → USDT (using received amount)
        console.log('\n' + '='.repeat(60))
        console.log('🔄 EXECUTING SWAP 2: USDC → USDT')
        console.log('='.repeat(60))
        
        // Use the received amount from first swap (with some buffer for fees)
        const receivedAmount = firstSwapResult.receivedAmount || '0'
        const secondSwapAmount = BigInt(receivedAmount) * BigInt(95) / BigInt(100) // Use 95% of received amount
        
        console.log(`📊 Second swap amount: ${formatUnits(secondSwapAmount.toString(), 6)} USDC`)
        
        const secondSwapResult = await performSwap(
            usdcAddress,
            usdtAddress,
            secondSwapAmount.toString(),
            walletAddress,
            currentNetwork.router,
            2
        )
        
        // Summary
        console.log('\n' + '='.repeat(60))
        console.log('📊 SWAP SUMMARY')
        console.log('='.repeat(60))
        console.log(`Swap 1 (USDT → USDC): ${firstSwapResult.success ? '✅ Success' : '❌ Failed'}`)
        if (firstSwapResult.success) {
            console.log(`   Sent: ${formatUnits(firstSwapAmount, 6)} USDT`)
            console.log(`   Received: ${formatUnits(receivedAmount, 6)} USDC`)
            console.log(`   Order Hash: ${firstSwapResult.orderHash}`)
        }
        
        console.log(`Swap 2 (USDC → USDT): ${secondSwapResult.success ? '✅ Success' : '❌ Failed'}`)
        if (secondSwapResult.success) {
            console.log(`   Sent: ${formatUnits(secondSwapAmount.toString(), 6)} USDC`)
            console.log(`   Order Hash: ${secondSwapResult.orderHash}`)
        }
        
        // Print balance after second swap for verification
        console.log('\n💰 BALANCE AFTER SWAP 2:')
        const afterSecondSwapUsdtBalance = await checkTokenBalance(usdtAddress, walletAddress, ethersRpcProvider)
        const afterSecondSwapUsdcBalance = await checkTokenBalance(usdcAddress, walletAddress, ethersRpcProvider)
        const afterSecondSwapMaticBalance = await ethersRpcProvider.getBalance(walletAddress)
        
        console.log(`   USDT Balance: ${afterSecondSwapUsdtBalance.formatted} USDT (${usdtAddress})`)
        console.log(`   USDC Balance: ${afterSecondSwapUsdcBalance.formatted} USDC (${usdcAddress})`)
        console.log(`   MATIC Balance: ${formatUnits(afterSecondSwapMaticBalance, 18)} MATIC (Native Token)`)
        
        // Final balance check
        console.log('\n💰 FINAL BALANCE CHECK:')
        const finalUsdtBalance = await checkTokenBalance(usdtAddress, walletAddress, ethersRpcProvider)
        const finalUsdcBalance = await checkTokenBalance(usdcAddress, walletAddress, ethersRpcProvider)
        
        console.log(`   Final USDT Balance: ${finalUsdtBalance.formatted} USDT (${usdtAddress})`)
        console.log(`   Final USDC Balance: ${finalUsdcBalance.formatted} USDC (${usdcAddress})`)
        
        // Balance change summary
        console.log('\n📈 BALANCE CHANGE SUMMARY:')
        const usdtChange = BigInt(finalUsdtBalance.balance) - BigInt(initialUsdtBalance.balance)
        const usdcChange = BigInt(finalUsdcBalance.balance) - BigInt(initialUsdcBalance.balance)
        const maticChange = afterSecondSwapMaticBalance - initialMaticBalance
        
        console.log(`   USDT Change: ${formatUnits(usdtChange.toString(), 6)} USDT (${usdtChange >= 0 ? '+' : ''}${formatUnits(usdtChange.toString(), 6)})`)
        console.log(`   USDC Change: ${formatUnits(usdcChange.toString(), 6)} USDC (${usdcChange >= 0 ? '+' : ''}${formatUnits(usdcChange.toString(), 6)})`)
        console.log(`   MATIC Change: ${formatUnits(maticChange.toString(), 18)} MATIC (${maticChange >= 0 ? '+' : ''}${formatUnits(maticChange.toString(), 18)})`)

    } catch (error) {
        console.error('❌ Error:', error)
    }
}

// Example function for getting quotes with custom presets
async function getCustomQuote() {
    console.log('\n🎛️ Getting quote with custom preset...')
    
    const { USDT: usdtAddress, USDC: usdcAddress } = currentNetwork.tokens
    
    const quoteParams = {
        fromTokenAddress: usdtAddress,
        toTokenAddress: usdcAddress,
        amount: '1560000', // 1.56 USDT
        walletAddress: computeAddress(PRIVATE_KEY),
        source: 'fusion-sdk-example'
    }

    const customPresetBody = {
        customPreset: {
            auctionDuration: 180, // 3 minutes
            auctionStartAmount: '1560000', // 1.56 USDC
            auctionEndAmount: '780000', // 0.78 USDC
            // Custom non-linear curve
            points: [
                { toTokenAmount: '1404000', delay: 20 }, // 1.404 USDC at 20s
                { toTokenAmount: '1092000', delay: 40 }  // 1.092 USDC at 40s
            ]
        }
    }

    try {
        const quote = await sdk.getQuoteWithCustomPreset(quoteParams, customPresetBody)
        console.log('Custom quote received:', quote)
    } catch (error) {
        console.error('Error getting custom quote:', error)
    }
}

// Example function for placing an order with fees
async function placeOrderWithFees() {
    console.log('\n💰 Placing order with fees...')
    
    const { USDT: usdtAddress, USDC: usdcAddress } = currentNetwork.tokens
    
    const orderParams = {
        fromTokenAddress: usdtAddress,
        toTokenAddress: usdcAddress,
        amount: '1560000', // 1.56 USDT
        walletAddress: computeAddress(PRIVATE_KEY),
        fee: {
            takingFeeBps: 100, // 1% fee (100 basis points)
            takingFeeReceiver: '0x0000000000000000000000000000000000000000' // Fee receiver
        },
        source: 'fusion-sdk-example'
    }

    try {
        const orderInfo = await sdk.placeOrder(orderParams)
        console.log('Order placed with fees:', orderInfo)
    } catch (error) {
        console.error('Error placing order with fees:', error)
    }
}

// Run the main example
if (require.main === module) {
    main()
        .then(() => {
            console.log('\n✨ Fusion SDK example completed!')
            process.exit(0)
        })
        .catch((error) => {
            console.error('💥 Example failed:', error)
            process.exit(1)
        })
}

export { main, getCustomQuote, placeOrderWithFees }
