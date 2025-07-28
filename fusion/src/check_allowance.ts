import { JsonRpcProvider, formatUnits, Wallet } from "ethers";
import * as dotenv from 'dotenv';
import { 
    checkTokenBalance, 
    checkTokenAllowance, 
    checkAllowance, 
    checkAndApproveTokens, 
    approveTokens 
} from './helpers/token-helpers';

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

// Wrapper function to check allowance using the imported helpers
async function checkAllowanceWrapper(walletAddress: string, tokenAddress: string, spenderAddress: string, tokenName?: string): Promise<{ balance: string, allowance: string, symbol: string, decimals: number, needsApproval: boolean }> {
    return await checkAllowance(walletAddress, tokenAddress, spenderAddress, ethersRpcProvider, tokenName)
}

// Wrapper function to check and approve tokens using the imported helpers
async function checkAndApproveTokensWrapper(wallet: Wallet, tokenAddress: string, tokenName: string): Promise<void> {
    return await checkAndApproveTokens(wallet, tokenAddress, tokenName, ONEINCH_ROUTER_ADDRESS)
}

// Function to check allowance for custom token and spender
async function checkCustomAllowance(walletAddress: string, tokenAddress: string, spenderAddress: string, tokenName?: string): Promise<void> {
    console.log(`\n🎯 Custom Allowance Check`)
    await checkAllowance(walletAddress, tokenAddress, spenderAddress, ethersRpcProvider, tokenName)
}

// Main function
async function main() {
    try {
        let wallet: Wallet;
        
        if (process.env.PRIVATE_KEY) {
            wallet = new Wallet(process.env.PRIVATE_KEY, ethersRpcProvider);
            console.log('🔑 Wallet address derived from PRIVATE_KEY');
        } else {
            throw new Error('❌ No PRIVATE_KEY found in .env file. Please provide your wallet private key.');
        }
        
        console.log('🔍 1inch Token Allowance Checker & Approver')
        console.log('==========================================')
        console.log(`👛 Wallet: ${wallet.address}`)
        console.log(`📍 Network: Polygon`)
        console.log(`🔄 Router: ${ONEINCH_ROUTER_ADDRESS}`)
        
        // Check and approve USDT
        await checkAndApproveTokensWrapper(wallet, USDT_ADDRESS, 'USDT')
        
        // Add delay between token checks
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        // Check and approve USDC
        await checkAndApproveTokensWrapper(wallet, USDC_ADDRESS, 'USDC')
        
        // Add delay before checking MATIC
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // Check MATIC balance
        console.log(`\n🔍 MATIC:`)
        const maticBalance = await ethersRpcProvider.getBalance(wallet.address)
        console.log(`   Balance: ${formatUnits(maticBalance, 18)} MATIC (Native Token)`)
        
    } catch (error) {
        console.error('❌ Error:', error)
    }
}

// Export functions for use in other modules
export { 
    checkAllowanceWrapper as checkAllowance, 
    checkAndApproveTokensWrapper as checkAndApproveTokens,
    checkTokenBalance,
    checkTokenAllowance,
    approveTokens
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