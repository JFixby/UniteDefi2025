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

interface TokenBalance {
    address: string;
    symbol: string;
    name: string;
    decimals: number;
    balance: string;
    balanceRaw: bigint;
}

async function getTokenBalance(contract: Contract, walletAddress: string): Promise<TokenBalance> {
    const [balance, symbol, name, decimals] = await Promise.all([
        contract.balanceOf(walletAddress),
        contract.symbol(),
        contract.name(),
        contract.decimals()
    ]);
    
    return {
        address: contract.target as string,
        symbol,
        name,
        decimals,
        balance: formatUnits(balance, decimals),
        balanceRaw: balance
    };
}

async function checkWalletBalances() {
    console.log('🔍 Checking wallet balances on Polygon network...');
    console.log('📋 Checking: ETH (WETH), USDT, USDC, BNL Coin, MATIC (WMATIC)');
    
    try {
        // Initialize provider and wallet
        const provider = new JsonRpcProvider(NODE_URL);
        const privateKeyWithPrefix = PRIVATE_KEY.startsWith('0x') ? PRIVATE_KEY : `0x${PRIVATE_KEY}`;
        const wallet = new Wallet(privateKeyWithPrefix, provider);
        
        console.log('\n📋 Wallet Information:');
        console.log(`Address: ${wallet.address}`);
        
        // Get native MATIC balance
        const maticBalance = await provider.getBalance(wallet.address);
        const maticBalanceFormatted = formatUnits(maticBalance, 18);
        
        console.log(`\n💰 Native MATIC Balance: ${maticBalanceFormatted} MATIC`);
        
        // Create contract instances for tokens
        const usdtContract = new Contract(USDT_ADDRESS, ERC20_ABI, provider);
        const usdcContract = new Contract(USDC_ADDRESS, ERC20_ABI, provider);
        const wmaticContract = new Contract(WMATIC_ADDRESS, ERC20_ABI, provider);
        const bnlContract = new Contract(BNL_ADDRESS, ERC20_ABI, provider);
        const wethContract = new Contract(WETH_ADDRESS, ERC20_ABI, provider);
        
        console.log('\n🪙 Token Balances:');
        console.log('='.repeat(60));
        
        // Get all token balances
        const [usdtBalance, usdcBalance, wmaticBalance, bnlBalance, wethBalance] = await Promise.all([
            getTokenBalance(usdtContract, wallet.address),
            getTokenBalance(usdcContract, wallet.address),
            getTokenBalance(wmaticContract, wallet.address),
            getTokenBalance(bnlContract, wallet.address),
            getTokenBalance(wethContract, wallet.address)
        ]);
        
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
        
    } catch (error) {
        console.error('❌ Error checking balances:', error);
        throw error;
    }
}

// Run the balance check
checkWalletBalances().catch(console.error); 