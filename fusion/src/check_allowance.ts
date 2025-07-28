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

// Network configuration
const NETWORK_CONFIG = {
    polygon: {
        name: 'Polygon',
        chainId: 137,
        rpcUrl: NODE_URL,
        blockExplorer: 'https://polygonscan.com',
        nativeToken: 'MATIC',
        nativeTokenDecimals: 18
    }
}

// Contract addresses for different networks
const CONTRACT_ADDRESSES = {
    polygon: {
        router: '0x111111125421ca6dc452d289314280a0f8842a65',
        usdt: '0xc2132d05d31c914a87c6611c10748aeb04b58e8f',
        usdc: '0x2791bca1f2de4661ed88a30c99a7a9449aa84174',
        wmatic: '0x0d500b1d8e8ef31e21c99d1db9a6444d3adf1270'
    }
}

// Setup ethers provider
const ethersRpcProvider = new JsonRpcProvider(NODE_URL)

// Function to get network information
async function getNetworkInfo(provider: JsonRpcProvider) {
    try {
        const network = await provider.getNetwork()
        const blockNumber = await provider.getBlockNumber()
        const gasPrice = await provider.getFeeData()
        
        return {
            chainId: network.chainId,
            name: network.name,
            blockNumber,
            gasPrice: gasPrice.gasPrice ? formatUnits(gasPrice.gasPrice, 'gwei') : 'Unknown',
            lastBlock: blockNumber
        }
    } catch (error) {
        console.error('❌ Error getting network info:', error)
        return null
    }
}

// Function to log detailed network and contract information
async function logNetworkAndContractInfo(provider: JsonRpcProvider, walletAddress: string) {
    console.log('\n🌐 NETWORK & CONTRACT INFORMATION')
    console.log('==================================')
    
    // Get network information
    const networkInfo = await getNetworkInfo(provider)
    if (networkInfo) {
        console.log(`📍 Network: ${networkInfo.name} (Chain ID: ${networkInfo.chainId})`)
        console.log(`🔗 RPC URL: ${NODE_URL}`)
        console.log(`📊 Current Block: ${networkInfo.blockNumber}`)
        console.log(`⛽ Gas Price: ${networkInfo.gasPrice} Gwei`)
        console.log(`🔍 Block Explorer: ${NETWORK_CONFIG.polygon.blockExplorer}`)
    }
    
    console.log('\n📋 CONTRACT ADDRESSES:')
    console.log(`🔄 1inch Router: ${CONTRACT_ADDRESSES.polygon.router}`)
    console.log(`💵 USDT Token: ${CONTRACT_ADDRESSES.polygon.usdt}`)
    console.log(`💵 USDC Token: ${CONTRACT_ADDRESSES.polygon.usdc}`)
    console.log(`🌿 Wrapped MATIC: ${CONTRACT_ADDRESSES.polygon.wmatic}`)
    
    console.log('\n🔗 CONTRACT LINKS:')
    console.log(`Router: ${NETWORK_CONFIG.polygon.blockExplorer}/address/${CONTRACT_ADDRESSES.polygon.router}`)
    console.log(`USDT: ${NETWORK_CONFIG.polygon.blockExplorer}/address/${CONTRACT_ADDRESSES.polygon.usdt}`)
    console.log(`USDC: ${NETWORK_CONFIG.polygon.blockExplorer}/address/${CONTRACT_ADDRESSES.polygon.usdc}`)
    console.log(`Wallet: ${NETWORK_CONFIG.polygon.blockExplorer}/address/${walletAddress}`)
}

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
        
        // Log detailed network and contract information
        await logNetworkAndContractInfo(ethersRpcProvider, wallet.address)
        
        console.log('\n🔍 TOKEN ALLOWANCE CHECK')
        console.log('========================')
        
        // Check and approve USDT
        await checkAndApproveTokensWrapper(wallet, USDT_ADDRESS, 'USDT')
        
        // Check and approve USDC
        await checkAndApproveTokensWrapper(wallet, USDC_ADDRESS, 'USDC')
        
        // Check MATIC balance
        console.log(`\n🔍 MATIC:`)
        const maticBalance = await ethersRpcProvider.getBalance(wallet.address)
        console.log(`   Balance: ${formatUnits(maticBalance, 18)} MATIC (Native Token)`)
        
        // Additional network status check
        console.log('\n📊 NETWORK STATUS:')
        try {
            const latestBlock = await ethersRpcProvider.getBlock('latest')
            if (latestBlock) {
                console.log(`   Latest Block: ${latestBlock.number}`)
                console.log(`   Block Timestamp: ${new Date(Number(latestBlock.timestamp) * 1000).toISOString()}`)
                console.log(`   Block Hash: ${latestBlock.hash}`)
            }
        } catch (error) {
            console.log('   ❌ Could not fetch latest block info')
        }
        
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
    approveTokens,
    logNetworkAndContractInfo,
    getNetworkInfo
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