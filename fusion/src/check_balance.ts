import { 
    JsonRpcProvider,
    Contract,
    Wallet,
    formatUnits,
    parseUnits
} from "ethers";
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Configuration
const PRIVATE_KEY = process.env.PRIVATE_KEY || 'YOUR_PRIVATE_KEY'
const NODE_URL = process.env.POLYGON_RPC_URL || 'https://polygon-rpc.com'

// Token addresses on Polygon
const USDT_ADDRESS = '0xc2132D05D31c914a87C6611C10748AEb04B58e8F' // USDT on Polygon
const USDC_ADDRESS = '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174' // USDC on Polygon
const WMATIC_ADDRESS = '0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270' // Wrapped MATIC on Polygon
const BNL_ADDRESS = '0x24d84aB1fd4159920084deB1D1B8F129AfF97505' // BNL Coin on Polygon
const WETH_ADDRESS = '0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619' // Wrapped ETH on Polygon

// ERC20 ABI (minimal for balance and basic info)
const ERC20_ABI = [
    "function balanceOf(address owner) view returns (uint256)",
    "function decimals() view returns (uint8)",
    "function symbol() view returns (string)",
    "function name() view returns (string)"
];

// Token metadata cache to avoid repeated RPC calls
const tokenMetadataCache = new Map<string, { symbol: string; name: string; decimals: number }>();

interface TokenBalance {
    address: string;
    symbol: string;
    name: string;
    decimals: number;
    balance: string;
    balanceRaw: bigint;
}

// Debug timing utility
function logTiming(operation: string, startTime: number) {
    const duration = Date.now() - startTime;
    console.log(`⏱️  ${operation}: ${duration}ms`);
}

// Utility to add delay between requests
function delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function getTokenMetadata(contract: Contract): Promise<{ symbol: string; name: string; decimals: number }> {
    const startTime = Date.now();
    const address = contract.target as string;
    
    // Check cache first
    if (tokenMetadataCache.has(address)) {
        logTiming(`Cache hit for ${address}`, startTime);
        return tokenMetadataCache.get(address)!;
    }
    
    logTiming(`Fetching metadata for ${address}`, startTime);
    
    // Fetch metadata sequentially to avoid batch size issues
    const symbol = await contract.symbol();
    const name = await contract.name();
    const decimals = await contract.decimals();
    
    const metadata = { symbol, name, decimals };
    tokenMetadataCache.set(address, metadata);
    
    logTiming(`Metadata fetched for ${address}`, startTime);
    return metadata;
}

async function getTokenBalance(contract: Contract, walletAddress: string): Promise<TokenBalance> {
    const startTime = Date.now();
    const address = contract.target as string;
    
    console.log(`🔍 Fetching balance for ${address}...`);
    
    // Get balance and metadata sequentially to avoid batch size issues
    const balance = await contract.balanceOf(walletAddress);
    const metadata = await getTokenMetadata(contract);
    
    logTiming(`Balance fetched for ${address}`, startTime);
    
    return {
        address: contract.target as string,
        symbol: metadata.symbol,
        name: metadata.name,
        decimals: metadata.decimals,
        balance: formatUnits(balance, metadata.decimals),
        balanceRaw: balance
    };
}

async function checkWalletBalances() {
    const totalStartTime = Date.now();
    console.log('🔍 Checking wallet balances on Polygon network...');
    console.log('📋 Checking: ETH (WETH), USDT, USDC, BNL Coin, MATIC (WMATIC)');
    console.log(`🌐 Using RPC: ${NODE_URL}`);
    
    try {
        // Initialize provider and wallet
        const providerStartTime = Date.now();
        const provider = new JsonRpcProvider(NODE_URL);
        const privateKeyWithPrefix = PRIVATE_KEY.startsWith('0x') ? PRIVATE_KEY : `0x${PRIVATE_KEY}`;
        const wallet = new Wallet(privateKeyWithPrefix, provider);
        logTiming('Provider and wallet initialization', providerStartTime);
        
        console.log('\n📋 Wallet Information:');
        console.log(`Address: ${wallet.address}`);
        
        // Create contract instances for tokens
        const contractStartTime = Date.now();
        const usdtContract = new Contract(USDT_ADDRESS, ERC20_ABI, provider);
        const usdcContract = new Contract(USDC_ADDRESS, ERC20_ABI, provider);
        const wmaticContract = new Contract(WMATIC_ADDRESS, ERC20_ABI, provider);
        const bnlContract = new Contract(BNL_ADDRESS, ERC20_ABI, provider);
        const wethContract = new Contract(WETH_ADDRESS, ERC20_ABI, provider);
        logTiming('Contract instances creation', contractStartTime);
        
        // Get native MATIC balance first
        console.log('\n💰 Fetching native MATIC balance...');
        const maticStartTime = Date.now();
        const maticBalance = await provider.getBalance(wallet.address);
        const maticBalanceFormatted = formatUnits(maticBalance, 18);
        logTiming('Native MATIC balance fetched', maticStartTime);
        console.log(`💰 Native MATIC Balance: ${maticBalanceFormatted} MATIC`);
        
        // Get token balances sequentially with delays to avoid batch size issues
        console.log('\n🪙 Fetching token balances sequentially...');
        const balanceStartTime = Date.now();
        
        const usdtBalance = await getTokenBalance(usdtContract, wallet.address);
        await delay(100); // Small delay between requests
        
        const usdcBalance = await getTokenBalance(usdcContract, wallet.address);
        await delay(100);
        
        const wmaticBalance = await getTokenBalance(wmaticContract, wallet.address);
        await delay(100);
        
        const bnlBalance = await getTokenBalance(bnlContract, wallet.address);
        await delay(100);
        
        const wethBalance = await getTokenBalance(wethContract, wallet.address);
        
        logTiming('All token balances fetched', balanceStartTime);
        
        console.log('\n🪙 Token Balances:');
        console.log('='.repeat(60));
        
        // Display token balances
        const tokens = [usdtBalance, usdcBalance, wmaticBalance, bnlBalance, wethBalance];
        
        tokens.forEach(token => {
            const hasBalance = token.balanceRaw > 0n;
            const status = hasBalance ? '✅' : '❌';
            console.log(`${status} ${token.symbol} (${token.name}):`);
            console.log(`   Address: ${token.address}`);
            console.log(`   Balance: ${token.balance} ${token.symbol}`);
            console.log('');
        });
        
        // Summary
        console.log('📊 Summary:');
        console.log('='.repeat(60));
        const tokensWithBalance = tokens.filter(token => token.balanceRaw > 0n);
        
        if (tokensWithBalance.length === 0) {
            console.log('❌ No token balances found');
        } else {
            console.log(`✅ Found ${tokensWithBalance.length} tokens with balance:`);
            tokensWithBalance.forEach(token => {
                console.log(`   • ${token.balance} ${token.symbol}`);
            });
        }
        
        // Check if wallet has any value
        const totalValue = tokensWithBalance.length > 0 || maticBalance > 0n;
        console.log(`\n${totalValue ? '💎' : '💸'} Wallet Status: ${totalValue ? 'Has funds' : 'Empty wallet'}`);
        
        logTiming('Total execution time', totalStartTime);
        
    } catch (error) {
        console.error('❌ Error checking balances:', error);
        throw error;
    }
}

// Run the balance check
checkWalletBalances().catch(console.error); 