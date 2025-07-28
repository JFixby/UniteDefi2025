import { JsonRpcProvider, formatUnits, Contract, getAddress, Wallet } from "ethers";
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Configuration from environment variables
const NODE_URL = process.env.POLYGON_RPC_URL || 'YOUR_WEB3_NODE_URL'

// 1inch Router address on Polygon
const ONEINCH_ROUTER_ADDRESS = '0x111111125421ca6dc452d289314280a0f8842a65'

// Example token addresses (USDT and USDC on Polygon)
const USDT_ADDRESS = '0xc2132d05d31c914a87c6611c10748aeb04b58e8f' // USDT on Polygon
const USDC_ADDRESS = '0x2791bca1f2de4661ed88a30c99a7a9449aa84174' // USDC on Polygon

// Setup ethers provider
const ethersRpcProvider = new JsonRpcProvider(NODE_URL)

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

// Function to check allowance for a specific wallet and token
async function checkAllowance(walletAddress: string, tokenAddress: string, spenderAddress: string, tokenName?: string): Promise<void> {
    console.log(`\n🔍 Checking allowance for ${tokenName || 'token'}: ${tokenAddress}`)
    console.log(`👛 Wallet: ${walletAddress}`)
    console.log(`🔐 Spender: ${spenderAddress}`)
    
    const balanceInfo = await checkTokenBalance(tokenAddress, walletAddress)
    const allowanceInfo = await checkTokenAllowance(tokenAddress, walletAddress, spenderAddress)
    
    console.log(`\n💰 BALANCE:`)
    console.log(`   Raw: ${balanceInfo.balance} (${balanceInfo.decimals} decimals)`)
    console.log(`   Formatted: ${balanceInfo.formatted} ${balanceInfo.symbol}`)
    
    console.log(`\n🔐 ALLOWANCE:`)
    console.log(`   Raw: ${allowanceInfo.allowance} (${allowanceInfo.decimals} decimals)`)
    console.log(`   Formatted: ${allowanceInfo.formatted} ${balanceInfo.symbol}`)
    
    const hasAllowance = BigInt(allowanceInfo.allowance) > BigInt(0)
    console.log(`   Status: ${hasAllowance ? '✅ Approved' : '❌ Not Approved'}`)
    
    if (hasAllowance) {
        const allowanceRatio = (BigInt(allowanceInfo.allowance) * BigInt(100)) / BigInt(balanceInfo.balance)
        console.log(`   Allowance Ratio: ${allowanceRatio}% of balance`)
    }
}

// Function to check multiple tokens for a wallet
async function checkMultipleTokens(walletAddress: string): Promise<void> {
    console.log('🚀 Starting allowance check for multiple tokens...')
    console.log('📍 Network: Polygon (Chain ID: 137)')
    console.log('🔗 RPC URL:', NODE_URL)
    console.log('🔄 1inch Router Address:', ONEINCH_ROUTER_ADDRESS)
    console.log('👛 Wallet Address:', walletAddress)
    
    // Check USDT allowance
    await checkAllowance(walletAddress, USDT_ADDRESS, ONEINCH_ROUTER_ADDRESS, 'USDT')
    
    // Check USDC allowance
    await checkAllowance(walletAddress, USDC_ADDRESS, ONEINCH_ROUTER_ADDRESS, 'USDC')
    
    // Check MATIC balance (native token)
    console.log(`\n🔍 Checking MATIC balance...`)
    try {
        const maticBalance = await ethersRpcProvider.getBalance(walletAddress)
        console.log(`   MATIC Balance: ${formatUnits(maticBalance, 18)} MATIC`)
    } catch (error) {
        console.error('Error checking MATIC balance:', error)
    }
}

// Function to check allowance for custom token and spender
async function checkCustomAllowance(walletAddress: string, tokenAddress: string, spenderAddress: string, tokenName?: string): Promise<void> {
    console.log(`\n🎯 Custom Allowance Check`)
    await checkAllowance(walletAddress, tokenAddress, spenderAddress, tokenName)
}

// Main function
async function main() {
    try {
        // Get wallet address from environment variables
        let walletAddress: string;
        
        if (process.env.PRIVATE_KEY) {
            // Derive wallet address from private key
            const wallet = new Wallet(process.env.PRIVATE_KEY);
            walletAddress = wallet.address;
            console.log('🔑 Wallet address derived from PRIVATE_KEY');
        } else {
            // No private key provided
            throw new Error('❌ No PRIVATE_KEY found in .env file. Please provide your wallet private key.');
        }
        
        console.log('🔍 1inch Token Allowance Checker')
        console.log('================================')
        
        // Check multiple tokens for the wallet
        await checkMultipleTokens(walletAddress)
        
        // Example of checking custom allowance
        console.log('\n' + '='.repeat(50))
        console.log('🎯 Custom Allowance Examples')
        console.log('='.repeat(50))
        
        // Example: Check USDT allowance for a different spender
        const customSpender = '0xcb8308fcb7bc2f84ed1bea2c016991d34de5cc77' // Example spender
        await checkCustomAllowance(walletAddress, USDT_ADDRESS, customSpender, 'USDT (Custom Spender)')
        
    } catch (error) {
        console.error('❌ Error:', error)
    }
}

// Export functions for use in other modules
export { 
    checkAllowance, 
    checkMultipleTokens, 
    checkCustomAllowance,
    checkTokenBalance,
    checkTokenAllowance
}

// Run the main function if this file is executed directly
if (require.main === module) {
    main()
        .then(() => {
            console.log('\n✨ Allowance check completed!')
            process.exit(0)
        })
        .catch((error) => {
            console.error('💥 Allowance check failed:', error)
            process.exit(1)
        })
} 