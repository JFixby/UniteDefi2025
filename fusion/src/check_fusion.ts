import { 
    FusionSDK, 
    NetworkEnum, 
    OrderStatus, 
    PrivateKeyProviderConnector, 
    Web3Like 
} from "@1inch/fusion-sdk";
import { computeAddress, formatUnits, JsonRpcProvider, parseUnits, Contract } from "ethers";
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Configuration from environment variables
const PRIVATE_KEY = process.env.PRIVATE_KEY ? `0x${process.env.PRIVATE_KEY}` : 'YOUR_PRIVATE_KEY'
const NODE_URL = process.env.POLYGON_RPC_URL || 'YOUR_WEB3_NODE_URL'
const DEV_PORTAL_API_TOKEN = process.env.DEV_PORTAL_API_TOKEN || 'YOUR_DEV_PORTAL_API_TOKEN'

// Example token addresses (USDT and USDC on Polygon)
const USDT_ADDRESS = '0xc2132d05d31c914a87c6611c10748aeb04b58e8f' // USDT on Polygon
const USDC_ADDRESS = '0x2791bca1f2de4661ed88a30c99a7a9449aa84174' // USDC on Polygon

        // 1inch Router addresses on Polygon (for allowance checking)
        const ONEINCH_ROUTER_ADDRESS = '0x1111111254eeb25477b68fb85ed929f73a960582'
        const ONEINCH_FUSION_SETTLEMENT = '0xcb8308fcb7bc2f84ed1bea2c016991d34de5cc77' // Fusion settlement contract

// Setup ethers provider
const ethersRpcProvider = new JsonRpcProvider(NODE_URL)

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
    network: NetworkEnum.POLYGON, // Using Polygon network
    blockchainProvider: connector,
    authKey: DEV_PORTAL_API_TOKEN
})

// ERC20 ABI for balance and allowance checks
const ERC20_ABI = [
    'function balanceOf(address owner) view returns (uint256)',
    'function allowance(address owner, address spender) view returns (uint256)',
    'function decimals() view returns (uint8)',
    'function symbol() view returns (string)'
]

// Function to check token balance
async function checkTokenBalance(tokenAddress: string, walletAddress: string): Promise<{ balance: string, formatted: string, decimals: number, symbol: string }> {
    try {
        const tokenContract = new Contract(tokenAddress, ERC20_ABI, ethersRpcProvider)
        
        const [balance, decimals, symbol] = await Promise.all([
            tokenContract.balanceOf(walletAddress),
            tokenContract.decimals(),
            tokenContract.symbol()
        ])
        
        const formattedBalance = formatUnits(balance, decimals)
        
        return {
            balance: balance.toString(),
            formatted: formattedBalance,
            decimals,
            symbol
        }
    } catch (error) {
        console.error(`Error checking balance for token ${tokenAddress}:`, error)
        return {
            balance: '0',
            formatted: '0',
            decimals: 18,
            symbol: 'UNKNOWN'
        }
    }
}

// Function to check token allowance
async function checkTokenAllowance(tokenAddress: string, walletAddress: string, spenderAddress: string): Promise<{ allowance: string, formatted: string, decimals: number }> {
    try {
        const tokenContract = new Contract(tokenAddress, ERC20_ABI, ethersRpcProvider)
        
        const [allowance, decimals] = await Promise.all([
            tokenContract.allowance(walletAddress, spenderAddress),
            tokenContract.decimals()
        ])
        
        const formattedAllowance = formatUnits(allowance, decimals)
        
        return {
            allowance: allowance.toString(),
            formatted: formattedAllowance,
            decimals
        }
    } catch (error) {
        console.error(`Error checking allowance for token ${tokenAddress}:`, error)
        return {
            allowance: '0',
            formatted: '0',
            decimals: 18
        }
    }
}

// Function to check if wallet has sufficient balance and allowance
async function checkWalletStatus(walletAddress: string, tokenAddress: string, requiredAmount: string): Promise<{
    hasBalance: boolean,
    hasAllowance: boolean,
    balance: string,
    allowance: string,
    required: string,
    symbol: string
}> {
    console.log(`\n🔍 Checking wallet status for token: ${tokenAddress}`)
    console.log(`📋 Token Symbol: ${tokenAddress === USDT_ADDRESS ? 'USDT' : tokenAddress === USDC_ADDRESS ? 'USDC' : 'Unknown'}`)
    
    const balanceInfo = await checkTokenBalance(tokenAddress, walletAddress)
    const routerAllowanceInfo = await checkTokenAllowance(tokenAddress, walletAddress, ONEINCH_ROUTER_ADDRESS)
    const fusionAllowanceInfo = await checkTokenAllowance(tokenAddress, walletAddress, ONEINCH_FUSION_SETTLEMENT)
    
    const hasBalance = BigInt(balanceInfo.balance) >= BigInt(requiredAmount)
    const hasRouterAllowance = BigInt(routerAllowanceInfo.allowance) >= BigInt(requiredAmount)
    const hasFusionAllowance = BigInt(fusionAllowanceInfo.allowance) >= BigInt(requiredAmount)
    const hasAllowance = hasRouterAllowance || hasFusionAllowance
    
    console.log(`\n💰 BALANCE CHECK:`)
    console.log(`   Raw Balance: ${balanceInfo.balance} (${balanceInfo.decimals} decimals)`)
    console.log(`   Formatted Balance: ${balanceInfo.formatted} ${balanceInfo.symbol}`)
    console.log(`   Required Amount: ${formatUnits(requiredAmount, balanceInfo.decimals)} ${balanceInfo.symbol}`)
    console.log(`   Status: ${hasBalance ? '✅ Sufficient' : '❌ Insufficient'}`)
    
    console.log(`\n🔐 ALLOWANCE CHECK:`)
    console.log(`   Router (${ONEINCH_ROUTER_ADDRESS}):`)
    console.log(`     Raw Allowance: ${routerAllowanceInfo.allowance} (${routerAllowanceInfo.decimals} decimals)`)
    console.log(`     Formatted Allowance: ${routerAllowanceInfo.formatted} ${balanceInfo.symbol}`)
    console.log(`     Status: ${hasRouterAllowance ? '✅ Sufficient' : '❌ Insufficient'}`)
    
    console.log(`   Fusion Settlement (${ONEINCH_FUSION_SETTLEMENT}):`)
    console.log(`     Raw Allowance: ${fusionAllowanceInfo.allowance} (${fusionAllowanceInfo.decimals} decimals)`)
    console.log(`     Formatted Allowance: ${fusionAllowanceInfo.formatted} ${balanceInfo.symbol}`)
    console.log(`     Status: ${hasFusionAllowance ? '✅ Sufficient' : '❌ Insufficient'}`)
    
    console.log(`\n📊 SUMMARY:`)
    console.log(`   Has sufficient balance: ${hasBalance ? '✅ Yes' : '❌ No'}`)
    console.log(`   Has sufficient allowance: ${hasAllowance ? '✅ Yes' : '❌ No'}`)
    console.log(`   Can proceed with swap: ${hasBalance && hasAllowance ? '✅ Yes' : '❌ No'}`)
    
    if (!hasAllowance) {
        console.log(`\n💡 APPROVAL NEEDED:`)
        console.log(`   You need to approve one of these contracts to spend your ${balanceInfo.symbol}:`)
        console.log(`   - Router: ${ONEINCH_ROUTER_ADDRESS}`)
        console.log(`   - Fusion Settlement: ${ONEINCH_FUSION_SETTLEMENT}`)
    }
    
    return {
        hasBalance,
        hasAllowance,
        balance: balanceInfo.balance,
        allowance: hasRouterAllowance ? routerAllowanceInfo.allowance : fusionAllowanceInfo.allowance,
        required: requiredAmount,
        symbol: balanceInfo.symbol
    }
}

async function main() {
    try {
        console.log('🚀 Starting 1inch Fusion SDK Example on Polygon Network...')
        console.log('📍 Network: Polygon (Chain ID: 137)')
        console.log('🔗 RPC URL:', NODE_URL)
        console.log('🔄 1inch Router Address:', ONEINCH_ROUTER_ADDRESS)
        console.log('🏗️ Fusion Settlement Address:', ONEINCH_FUSION_SETTLEMENT)
        
        const walletAddress = computeAddress(PRIVATE_KEY)
        console.log('👛 Wallet Address:', walletAddress)
        
        // Check wallet balance and allowance before proceeding
        const swapAmount = '1440000' // 1.44 USDT (6 decimals)
        const walletStatus = await checkWalletStatus(walletAddress, USDT_ADDRESS, swapAmount)
        
        if (!walletStatus.hasBalance) {
            console.log('\n❌ Insufficient USDT balance. Cannot proceed with swap.')
            console.log('💡 To test with real tokens, you need to:')
            console.log('   1. Have USDT tokens in your wallet')
            console.log('   2. Approve the 1inch router to spend your USDT')
            console.log('   3. Ensure you have enough MATIC for gas fees')
            return
        }
        
        if (!walletStatus.hasAllowance) {
            console.log('\n⚠️  Insufficient allowance. You need to approve the 1inch router.')
            console.log('💡 To approve, you would need to call the approve() function on the USDT contract.')
            console.log('   This requires a separate transaction with gas fees.')
            console.log('   Continuing with quote and order creation for demonstration...')
        }
        
        // Example 1: Get a quote for swapping USDT to USDC
        console.log('\n📊 Getting quote for USDT -> USDC swap...')
        const quoteParams = {
            fromTokenAddress: USDT_ADDRESS, // USDT
            toTokenAddress: USDC_ADDRESS,   // USDC
            amount: '1440000', // 1.44 USDT (6 decimals)
            walletAddress: walletAddress,
            source: 'fusion-sdk-example'
        }

        const quote = await sdk.getQuote(quoteParams)
        
        console.log('Quote received:')
        console.log('- Recommended preset:', quote.recommendedPreset)
        console.log('- Available presets:', Object.keys(quote.presets))
        
        const recommendedPreset = quote.presets[quote.recommendedPreset]
        if (recommendedPreset) {
            console.log('- Auction start amount:', formatUnits(recommendedPreset.auctionStartAmount, 6), 'USDC')
            console.log('- Auction end amount:', formatUnits(recommendedPreset.auctionEndAmount, 6), 'USDC')
            console.log('- Auction duration:', recommendedPreset.auctionDuration, 'seconds')
        }

        // Example 2: Create an order (but don't submit it)
        console.log('\n📝 Creating order...')
        const orderParams = {
            fromTokenAddress: USDT_ADDRESS,
            toTokenAddress: USDC_ADDRESS,
            amount: '1440000', // 1.44 USDT
            walletAddress: walletAddress,
            source: 'fusion-sdk-example'
        }

        const preparedOrder = await sdk.createOrder(orderParams)
        console.log('Order created successfully!')
        console.log('- Quote ID:', preparedOrder.quoteId)
        console.log('- Order hash:', preparedOrder.order.getOrderHash(1))

        // Example 3: Submit the order
        console.log('\n📤 Submitting order...')
        console.log('📋 Order Details:')
        console.log(`   From Token: ${USDT_ADDRESS} (USDT)`)
        console.log(`   To Token: ${USDC_ADDRESS} (USDC)`)
        console.log(`   Amount: ${formatUnits('1440000', 6)} USDT`)
        console.log(`   Wallet: ${walletAddress}`)
        console.log(`   Quote ID: ${preparedOrder.quoteId}`)
        console.log(`   Order Hash: ${preparedOrder.order.getOrderHash(1)}`)
        
        // Double-check balance and allowance right before submission
        console.log('\n🔍 Final Balance/Allowance Check (before submission):')
        const finalBalanceCheck = await checkTokenBalance(USDT_ADDRESS, walletAddress)
        const finalRouterAllowance = await checkTokenAllowance(USDT_ADDRESS, walletAddress, ONEINCH_ROUTER_ADDRESS)
        const finalFusionAllowance = await checkTokenAllowance(USDT_ADDRESS, walletAddress, ONEINCH_FUSION_SETTLEMENT)
        
        console.log(`   Current Balance: ${finalBalanceCheck.formatted} ${finalBalanceCheck.symbol}`)
        console.log(`   Router Allowance: ${finalRouterAllowance.formatted} ${finalBalanceCheck.symbol}`)
        console.log(`   Fusion Allowance: ${finalFusionAllowance.formatted} ${finalBalanceCheck.symbol}`)
        
        // Check MATIC balance for gas fees
        const maticBalance = await ethersRpcProvider.getBalance(walletAddress)
        console.log(`   MATIC Balance: ${formatUnits(maticBalance, 18)} MATIC`)
        
        const hasEnoughMatic = maticBalance > parseUnits('0.01', 18) // At least 0.01 MATIC
        console.log(`   Has enough MATIC for gas: ${hasEnoughMatic ? '✅ Yes' : '❌ No'}`)
        
        let orderInfo: any = undefined
        try {
            orderInfo = await sdk.submitOrder(preparedOrder.order, preparedOrder.quoteId)
            console.log('✅ Order submitted successfully!')
            console.log('- Order hash:', orderInfo.orderHash)
        } catch (error: any) {
            console.log('\n❌ ORDER SUBMISSION FAILED')
            console.log('🔍 Error Analysis:')
            
            // Extract error details
            const errorMessage = error.message || 'Unknown error'
            const errorDescription = error.response?.data?.description || 'No description available'
            const errorCode = error.response?.data?.errorCode || 'No error code'
            const errorStatus = error.response?.status || 'No status code'
            
            console.log(`   Error Message: ${errorMessage}`)
            console.log(`   Error Description: ${errorDescription}`)
            console.log(`   Error Code: ${errorCode}`)
            console.log(`   HTTP Status: ${errorStatus}`)
            
            // Network and API details
            console.log('\n🌐 NETWORK & API DETAILS:')
            console.log(`   Network: Polygon (Chain ID: 137)`)
            console.log(`   RPC URL: ${NODE_URL}`)
            console.log(`   API Endpoint: ${error.config?.url || 'Unknown'}`)
            console.log(`   API Method: ${error.config?.method || 'Unknown'}`)
            console.log(`   API Headers: ${JSON.stringify(error.config?.headers, null, 2)}`)
            console.log(`   Request Data Size: ${error.config?.data?.length || 'Unknown'} bytes`)
            
            // Check if it's a balance/allowance issue
            if (errorMessage.includes('NotEnoughBalanceOrAllowance') || errorDescription.includes('NotEnoughBalanceOrAllowance')) {
                console.log('\n💰 BALANCE/ALLOWANCE ANALYSIS:')
                console.log(`   Current USDT Balance: ${walletStatus.balance} (${formatUnits(walletStatus.balance, 6)} USDT)`)
                console.log(`   Required Amount: ${walletStatus.required} (${formatUnits(walletStatus.required, 6)} USDT)`)
                console.log(`   Router Allowance: ${walletStatus.allowance} (${formatUnits(walletStatus.allowance, 6)} USDT)`)
                console.log(`   Has Sufficient Balance: ${walletStatus.hasBalance ? '✅ Yes' : '❌ No'}`)
                console.log(`   Has Sufficient Allowance: ${walletStatus.hasAllowance ? '✅ Yes' : '❌ No'}`)
                
                if (!walletStatus.hasBalance) {
                    console.log('\n💡 SOLUTION: Insufficient USDT balance')
                    console.log('   You need to add USDT tokens to your wallet')
                    console.log(`   Required: ${formatUnits(walletStatus.required, 6)} USDT`)
                    console.log(`   Current: ${formatUnits(walletStatus.balance, 6)} USDT`)
                }
                
                if (!walletStatus.hasAllowance) {
                    console.log('\n💡 SOLUTION: Insufficient allowance')
                    console.log('   You need to approve the 1inch router to spend your USDT')
                    console.log(`   Router Address: ${ONEINCH_ROUTER_ADDRESS}`)
                    console.log(`   Required Allowance: ${formatUnits(walletStatus.required, 6)} USDT`)
                }
            }
            
            // Check for other common errors
            if (errorMessage.includes('gas') || errorDescription.includes('gas')) {
                console.log('\n⛽ GAS FEE ISSUE:')
                console.log('   You may not have enough MATIC for gas fees')
                console.log('   Check your MATIC balance on Polygon network')
            }
            
            if (errorMessage.includes('network') || errorDescription.includes('network')) {
                console.log('\n🌐 NETWORK ISSUE:')
                console.log('   There might be a network connectivity issue')
                console.log(`   Current RPC URL: ${NODE_URL}`)
            }
            
            console.log('\n📋 Full Error Object:')
            console.log(JSON.stringify(error, null, 2))
            
            console.log('\n🔄 Continuing with other examples...')
        }

        // Example 4: Track order status (only if order was submitted successfully)
        if (typeof orderInfo !== 'undefined') {
            console.log('\n⏳ Tracking order status...')
            const start = Date.now()

            while (true) {
                try {
                    const data = await sdk.getOrderStatus(orderInfo.orderHash)
                    console.log(`Status: ${data.status}`)

                    if (data.status === OrderStatus.Filled) {
                        console.log('✅ Order filled successfully!')
                        console.log('Fills:', data.fills)
                        break
                    }

                    if (data.status === OrderStatus.Expired) {
                        console.log('❌ Order expired')
                        break
                    }
                    
                    if (data.status === OrderStatus.Cancelled) {
                        console.log('❌ Order cancelled')
                        break
                    }

                    // Wait 2 seconds before checking again
                    await new Promise(resolve => setTimeout(resolve, 2000))
                } catch (e) {
                    console.log('Error checking order status:', e)
                    await new Promise(resolve => setTimeout(resolve, 2000))
                }
            }

            const executionTime = (Date.now() - start) / 1000
            console.log(`Order executed in ${executionTime} seconds`)
        } else {
            console.log('\n⏳ Skipping order status tracking (order not submitted)')
        }

        // Example 5: Get active orders
        console.log('\n📋 Getting active orders...')
        const activeOrders = await sdk.getActiveOrders({ page: 1, limit: 5 })
        console.log(`Found ${activeOrders.items.length} active orders`)

        // Example 6: Get orders by maker
        console.log('\n👤 Getting orders by maker...')
        const makerOrders = await sdk.getOrdersByMaker({
            address: walletAddress,
            page: 1,
            limit: 5
        })
        console.log(`Found ${makerOrders.items.length} orders for this wallet`)

    } catch (error) {
        console.error('❌ Error:', error)
    }
}

// Example function for getting quotes with custom presets
async function getCustomQuote() {
    console.log('\n🎛️ Getting quote with custom preset...')
    
    const quoteParams = {
        fromTokenAddress: USDT_ADDRESS,
        toTokenAddress: USDC_ADDRESS,
        amount: '1440000', // 1.44 USDT
        walletAddress: computeAddress(PRIVATE_KEY),
        source: 'fusion-sdk-example'
    }

    const customPresetBody = {
        customPreset: {
            auctionDuration: 180, // 3 minutes
            auctionStartAmount: '1440000', // 1.44 USDC
            auctionEndAmount: '720000', // 0.72 USDC
            // Custom non-linear curve
            points: [
                { toTokenAmount: '1296000', delay: 20 }, // 1.296 USDC at 20s
                { toTokenAmount: '1008000', delay: 40 }  // 1.008 USDC at 40s
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
    
    const orderParams = {
        fromTokenAddress: USDT_ADDRESS,
        toTokenAddress: USDC_ADDRESS,
        amount: '1440000', // 1.44 USDT
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
