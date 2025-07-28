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

// ERC20 ABI for balance, allowance checks and approvals
const ERC20_ABI = [
    'function balanceOf(address owner) view returns (uint256)',
    'function allowance(address owner, address spender) view returns (uint256)',
    'function decimals() view returns (uint8)',
    'function symbol() view returns (string)',
    'function approve(address spender, uint256 amount) returns (bool)'
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

// Function to approve tokens
async function approveTokens(tokenAddress: string, spenderAddress: string, amount: string, wallet: Wallet): Promise<boolean> {
    try {
        const tokenContract = new Contract(tokenAddress, ERC20_ABI, wallet)
        console.log(`🔄 Approving ${amount} tokens...`)
        
        const tx = await tokenContract.approve(spenderAddress, amount)
        console.log(`📝 Transaction hash: ${tx.hash}`)
        
        const receipt = await tx.wait()
        console.log(`✅ Approval confirmed in block ${receipt.blockNumber}`)
        
        return true
    } catch (error) {
        console.error(`❌ Approval failed:`, error)
        return false
    }
}

// Function to check allowance for a specific wallet and token
async function checkAllowance(walletAddress: string, tokenAddress: string, spenderAddress: string, tokenName?: string): Promise<{ balance: string, allowance: string, symbol: string, decimals: number, needsApproval: boolean }> {
    const balanceInfo = await checkTokenBalance(tokenAddress, walletAddress)
    const allowanceInfo = await checkTokenAllowance(tokenAddress, walletAddress, spenderAddress)
    
    const hasAllowance = BigInt(allowanceInfo.allowance) > BigInt(0)
    
    return {
        balance: balanceInfo.formatted,
        allowance: allowanceInfo.formatted,
        symbol: balanceInfo.symbol,
        decimals: balanceInfo.decimals,
        needsApproval: !hasAllowance
    }
}

// Function to check and approve tokens
async function checkAndApproveTokens(wallet: Wallet, tokenAddress: string, tokenName: string): Promise<void> {
    const walletAddress = wallet.address
    
    // Initial check
    console.log(`\n🔍 ${tokenName}:`)
    const initialCheck = await checkAllowance(walletAddress, tokenAddress, ONEINCH_ROUTER_ADDRESS, tokenName)
    console.log(`   Balance: ${initialCheck.balance} ${initialCheck.symbol}`)
    console.log(`   Allowance: ${initialCheck.allowance} ${initialCheck.symbol} ${initialCheck.needsApproval ? '❌' : '✅'}`)
    
    // If approval needed, approve 1M tokens (regardless of balance)
    if (initialCheck.needsApproval) {
        const approvalAmount = BigInt(10) ** BigInt(initialCheck.decimals) * BigInt(1000000) // 1M tokens
        console.log(`   ⚡ Approving 1M ${initialCheck.symbol}...`)
        
        const approved = await approveTokens(tokenAddress, ONEINCH_ROUTER_ADDRESS, approvalAmount.toString(), wallet)
        
        if (approved) {
            // Check again after approval
            console.log(`   🔄 Re-checking allowance...`)
            const finalCheck = await checkAllowance(walletAddress, tokenAddress, ONEINCH_ROUTER_ADDRESS, tokenName)
            console.log(`   ✅ New Allowance: ${finalCheck.allowance} ${initialCheck.symbol}`)
        }
    } else {
        console.log(`   ✅ Already approved`)
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
        await checkAndApproveTokens(wallet, USDT_ADDRESS, 'USDT')
        
        // Check and approve USDC
        await checkAndApproveTokens(wallet, USDC_ADDRESS, 'USDC')
        
        // Check MATIC balance
        console.log(`\n🔍 MATIC:`)
        const maticBalance = await ethersRpcProvider.getBalance(wallet.address)
        console.log(`   Balance: ${formatUnits(maticBalance, 18)} MATIC`)
        
    } catch (error) {
        console.error('❌ Error:', error)
    }
}

// Export functions for use in other modules
export { 
    checkAllowance, 
    checkAndApproveTokens,
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