import { JsonRpcProvider, formatUnits, Wallet } from "ethers";
import * as dotenv from 'dotenv';
import { 
    checkTokenBalance, 
    checkTokenAllowance, 
    checkAllowance, 
    checkAndApproveTokens, 
    approveTokens,
    checkWalletStatus,
    checkNativeBalance
} from './helpers/token-helpers';

// Load environment variables
dotenv.config();

// Configuration from environment variables
const POLYGON_RPC_URL = process.env.POLYGON_RPC_URL || 'https://polygon-mainnet.infura.io/v3/YOUR_PROJECT_ID'
const ETHEREUM_RPC_URL = process.env.ETHEREUM_RPC_URL || 'https://mainnet.infura.io/v3/YOUR_PROJECT_ID'

// Type definitions
type NetworkName = 'polygon' | 'mainnet'

interface NetworkConfig {
    name: string
    chainId: number
    rpcUrl: string
    blockExplorer: string
    nativeToken: string
    nativeTokenDecimals: number
    router: string
}

interface ContractAddresses {
    router: string
    usdt: string
    usdc: string
    wmatic?: string
    weth?: string
}

// Network configuration for both networks
const NETWORK_CONFIG: Record<NetworkName, NetworkConfig> = {
    polygon: {
        name: 'Polygon',
        chainId: 137,
        rpcUrl: POLYGON_RPC_URL,
        blockExplorer: 'https://polygonscan.com',
        nativeToken: 'MATIC',
        nativeTokenDecimals: 18,
        router: '0x111111125421ca6dc452d289314280a0f8842a65'
    },
    mainnet: {
        name: 'Ethereum Mainnet',
        chainId: 1,
        rpcUrl: ETHEREUM_RPC_URL,
        blockExplorer: 'https://etherscan.io',
        nativeToken: 'ETH',
        nativeTokenDecimals: 18,
        router: '0x111111125421ca6dc452d289314280a0f8842a65'
    }
}

// Contract addresses for both networks - only essential tokens
const CONTRACT_ADDRESSES: Record<NetworkName, ContractAddresses> = {
    polygon: {
        router: '0x111111125421ca6dc452d289314280a0f8842a65',
        usdt: '0xc2132d05d31c914a87c6611c10748aeb04b58e8f',
        usdc: '0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359',
        wmatic: '0x0d500b1d8e8ef31e21c99d1db9a6444d3adf1270'
    },
    mainnet: {
        router: '0x111111125421ca6dc452d289314280a0f8842a65',
        usdt: '0xdac17f958d2ee523a2206206994597c13d831ec7',
        usdc: '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',
        weth: '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2'
    }
}

// Setup ethers provider for a specific network
function getProvider(network: NetworkName): JsonRpcProvider {
    const config = NETWORK_CONFIG[network]
    return new JsonRpcProvider(config.rpcUrl)
}

// Function to get network information using helper functions
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

// Function to log detailed network and contract information for a specific network
async function logNetworkAndContractInfo(provider: JsonRpcProvider, walletAddress: string, network: NetworkName) {
    const config = NETWORK_CONFIG[network]
    const contracts = CONTRACT_ADDRESSES[network]
    
    console.log(`\n🌐 ${config.name.toUpperCase()} NETWORK & CONTRACT INFORMATION`)
    console.log('='.repeat(50))
    
    // Get network information
    const networkInfo = await getNetworkInfo(provider)
    if (networkInfo) {
        console.log(`📍 Network: ${networkInfo.name} (Chain ID: ${networkInfo.chainId})`)
        console.log(`🔗 RPC URL: ${config.rpcUrl}`)
        console.log(`📊 Current Block: ${networkInfo.blockNumber}`)
        console.log(`⛽ Gas Price: ${networkInfo.gasPrice} Gwei`)
        console.log(`🔍 Block Explorer: ${config.blockExplorer}`)
    }
    
    console.log('\n📋 CONTRACT ADDRESSES:')
    console.log(`🔄 1inch Router: ${contracts.router}`)
    console.log(`💵 USDT Token: ${contracts.usdt}`)
    console.log(`💵 USDC Token: ${contracts.usdc}`)
    
    // Log wrapped native token based on network
    if (network === 'polygon') {
        console.log(`🌿 Wrapped MATIC: ${contracts.wmatic}`)
    } else if (network === 'mainnet') {
        console.log(`🌿 Wrapped ETH: ${contracts.weth}`)
    }
    
    console.log('\n🔗 CONTRACT LINKS:')
    console.log(`Router: ${config.blockExplorer}/address/${contracts.router}`)
    console.log(`USDT: ${config.blockExplorer}/address/${contracts.usdt}`)
    console.log(`USDC: ${config.blockExplorer}/address/${contracts.usdc}`)
    console.log(`Wallet: ${config.blockExplorer}/address/${walletAddress}`)
}

// Function to check token status using helper functions for a specific network
async function checkTokenStatus(wallet: Wallet, tokenAddress: string, tokenName: string, network: NetworkName) {
    const contracts = CONTRACT_ADDRESSES[network]
    
    // Use the comprehensive checkWalletStatus helper
    const status = await checkWalletStatus(
        wallet.address,
        tokenAddress,
        '0', // We're not checking for a specific amount, just general status
        contracts.router,
        wallet.provider as JsonRpcProvider
    )
    
    // Define 1M tokens in the token's decimals
    const oneMillionTokens = BigInt(10) ** BigInt(status.decimals) * BigInt(1000000)
    const currentAllowance = BigInt(status.allowance)
    
    console.log(`\n🔍 ${tokenName} Allowance Check:`)
    console.log(`   Current Allowance: ${status.allowance} (${formatUnits(status.allowance, status.decimals)} ${status.symbol})`)
    console.log(`   Target Allowance: 1,000,000 ${status.symbol}`)
    
    // Check if current allowance is less than 1M tokens
    if (currentAllowance < oneMillionTokens) {
        console.log(`   ⚡ Current allowance is less than 1M ${status.symbol}`)
        console.log(`   🔄 Updating allowance to 1M ${status.symbol}...`)
        
        const approved = await approveTokens(tokenAddress, contracts.router, oneMillionTokens.toString(), wallet)
        
        if (approved) {
            // Check again after approval
            console.log(`   🔄 Re-checking allowance...`)
            const finalStatus = await checkWalletStatus(
                wallet.address,
                tokenAddress,
                '0',
                contracts.router,
                wallet.provider as JsonRpcProvider
            )
            console.log(`   ✅ New Allowance: ${formatUnits(finalStatus.allowance, finalStatus.decimals)} ${status.symbol}`)
        }
    } else {
        console.log(`   ✅ Allowance is already 1M+ ${status.symbol} (no update needed)`)
    }
    
    return status
}

// Function to check native token balance using helper for a specific network
async function checkNativeTokenBalance(wallet: Wallet, network: NetworkName) {
    const config = NETWORK_CONFIG[network]
    const balanceInfo = await checkNativeBalance(
        wallet.address,
        wallet.provider as JsonRpcProvider,
        config.nativeToken
    )
    
    console.log(`\n🔍 ${config.nativeToken}:`)
    console.log(`   Balance: ${balanceInfo.formatted} ${config.nativeToken} (Native Token)`)
    
    return balanceInfo
}

// Function to check all tokens for a specific network
async function checkAllTokensForNetwork(wallet: Wallet, network: NetworkName) {
    const contracts = CONTRACT_ADDRESSES[network]
    const config = NETWORK_CONFIG[network]
    
    console.log(`\n🔍 ${config.name.toUpperCase()} TOKEN ALLOWANCE CHECK`)
    console.log('='.repeat(40))
    
    // Check and approve only essential tokens using helper functions
    await checkTokenStatus(wallet, contracts.usdt, 'USDT', network)
    await checkTokenStatus(wallet, contracts.usdc, 'USDC', network)
    
    // Check native token balance using helper
    await checkNativeTokenBalance(wallet, network)
}

// Function to get network status using provider
async function getNetworkStatus(provider: JsonRpcProvider, network: NetworkName) {
    const config = NETWORK_CONFIG[network]
    console.log(`\n📊 ${config.name.toUpperCase()} NETWORK STATUS:`)
    try {
        const latestBlock = await provider.getBlock('latest')
        if (latestBlock) {
            console.log(`   Latest Block: ${latestBlock.number}`)
            console.log(`   Block Timestamp: ${new Date(Number(latestBlock.timestamp) * 1000).toISOString()}`)
            console.log(`   Block Hash: ${latestBlock.hash}`)
        }
    } catch (error) {
        console.log('   ❌ Could not fetch latest block info')
    }
}

// Function to check both networks
async function checkBothNetworks(privateKey: string) {
    const networks: NetworkName[] = ['polygon', 'mainnet']
    
    for (const network of networks) {
        try {
            console.log(`\n🚀 CHECKING ${network.toUpperCase()} NETWORK`)
            console.log('='.repeat(50))
            
            const provider = getProvider(network)
            const wallet = new Wallet(privateKey, provider)
            
            // Log detailed network and contract information
            await logNetworkAndContractInfo(provider, wallet.address, network)
            
            // Check all tokens for this network
            await checkAllTokensForNetwork(wallet, network)
            
            // Get network status
            await getNetworkStatus(provider, network)
            
        } catch (error) {
            console.error(`❌ Error checking ${network} network:`, error)
        }
    }
}

// Main function using helper functions
async function main() {
    try {
        if (!process.env.PRIVATE_KEY) {
            throw new Error('❌ No PRIVATE_KEY found in .env file. Please provide your wallet private key.');
        }
        
        console.log('🔍 1inch Multi-Network Token Allowance Checker & Approver')
        console.log('========================================================')
        console.log(`👛 Wallet: ${new Wallet(process.env.PRIVATE_KEY).address}`)
        console.log(`🌐 Networks: Polygon + Ethereum Mainnet`)
        
        // Check both networks
        await checkBothNetworks(process.env.PRIVATE_KEY)
        
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
    approveTokens,
    logNetworkAndContractInfo,
    getNetworkInfo,
    getProvider,
    checkTokenStatus,
    checkNativeTokenBalance,
    checkAllTokensForNetwork,
    getNetworkStatus,
    checkBothNetworks
}

// Run the main function if this file is executed directly
if (require.main === module) {
    main()
        .then(() => {
            console.log('\n✨ Multi-network allowance check completed!')
            process.exit(0)
        })
        .catch((error) => {
            console.error('💥 Multi-network allowance check failed:', error)
            process.exit(1)
        })
} 