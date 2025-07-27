import 'dotenv/config';
import { ethers } from 'ethers';
import { NetworkEnum } from "@1inch/fusion-sdk";
import { getTokenAddress, getTokenDecimals } from './tokens.js';

// ERC20 ABI for balance and allowance checks
const ERC20_ABI = [
    'function balanceOf(address owner) view returns (uint256)',
    'function allowance(address owner, address spender) view returns (uint256)',
    'function decimals() view returns (uint8)',
    'function symbol() view returns (string)'
];

// 1inch Router addresses for different networks
const ROUTER_ADDRESSES = {
    [NetworkEnum.ETHEREUM]: '0x1111111254EEB25477B68fb85Ed929f73A960582',
    [NetworkEnum.POLYGON]: '0x1111111254EEB25477B68fb85Ed929f73A960582',
    [NetworkEnum.BINANCE]: '0x1111111254EEB25477B68fb85Ed929f73A960582',
    [NetworkEnum.ARBITRUM]: '0x1111111254EEB25477B68fb85Ed929f73A960582',
    [NetworkEnum.OPTIMISM]: '0x1111111254EEB25477B68fb85Ed929f73A960582',
    [NetworkEnum.AVALANCHE]: '0x1111111254EEB25477B68fb85Ed929f73A960582',
    [NetworkEnum.FANTOM]: '0x1111111254EEB25477B68fb85Ed929f73A960582',
    [NetworkEnum.GNOSIS]: '0x1111111254EEB25477B68fb85Ed929f73A960582',
    [NetworkEnum.COINBASE]: '0x1111111254EEB25477B68fb85Ed929f73A960582',
    [NetworkEnum.LINEA]: '0x1111111254EEB25477B68fb85Ed929f73A960582',
    [NetworkEnum.ZKSYNC]: '0x1111111254EEB25477B68fb85Ed929f73A960582',
    [NetworkEnum.SONIC]: '0x1111111254EEB25477B68fb85Ed929f73A960582',
    [NetworkEnum.UNICHAIN]: '0x1111111254EEB25477B68fb85Ed929f73A960582'
};

async function checkTokenStatus(
    tokenSymbol: string,
    walletAddress: string,
    network: NetworkEnum,
    provider: ethers.Provider
) {
    try {
        const tokenAddress = getTokenAddress(tokenSymbol, network);
        const tokenDecimals = getTokenDecimals(tokenSymbol);
        const routerAddress = ROUTER_ADDRESSES[network];
        
        console.log(`\n🔍 Checking ${tokenSymbol} on ${network}:`);
        console.log(`   Token Address: ${tokenAddress}`);
        console.log(`   Router Address: ${routerAddress}`);
        console.log(`   Wallet Address: ${walletAddress}`);
        
        // Create contract instance
        const tokenContract = new ethers.Contract(tokenAddress, ERC20_ABI, provider);
        
        // Check balance
        const balance = await tokenContract.balanceOf(walletAddress);
        const balanceFormatted = ethers.formatUnits(balance, tokenDecimals);
        
        // Check allowance
        const allowance = await tokenContract.allowance(walletAddress, routerAddress);
        const allowanceFormatted = ethers.formatUnits(allowance, tokenDecimals);
        
        // Check if balance is sufficient for 1.44 tokens
        const requiredAmount = ethers.parseUnits('1.44', tokenDecimals);
        const hasEnoughBalance = balance >= requiredAmount;
        const hasEnoughAllowance = allowance >= requiredAmount;
        
        console.log(`\n📊 Token Status:`);
        console.log(`   Balance: ${balanceFormatted} ${tokenSymbol}`);
        console.log(`   Allowance: ${allowanceFormatted} ${tokenSymbol}`);
        console.log(`   Required: 1.44 ${tokenSymbol}`);
        console.log(`   Has Enough Balance: ${hasEnoughBalance ? '✅' : '❌'}`);
        console.log(`   Has Enough Allowance: ${hasEnoughAllowance ? '✅' : '❌'}`);
        
        if (!hasEnoughBalance) {
            console.log(`   ❌ INSUFFICIENT BALANCE: Need at least 1.44 ${tokenSymbol}`);
        }
        
        if (!hasEnoughAllowance) {
            console.log(`   ❌ INSUFFICIENT ALLOWANCE: Need to approve router to spend ${tokenSymbol}`);
        }
        
        return {
            tokenSymbol,
            balance: balanceFormatted,
            allowance: allowanceFormatted,
            hasEnoughBalance,
            hasEnoughAllowance,
            canSwap: hasEnoughBalance && hasEnoughAllowance
        };
        
    } catch (error) {
        console.error(`❌ Error checking ${tokenSymbol}:`, error);
        return {
            tokenSymbol,
            error: error instanceof Error ? error.message : String(error),
            canSwap: false
        };
    }
}

async function main() {
    console.log('🔍 Checking Token Balances and Allowances');
    console.log('=====================================');
    
    // Load configuration
    let secrets: Record<string, string> = {};
    
    try {
        const { readSecretsFromPython } = await import('./helpers.js');
        secrets = await readSecretsFromPython();
    } catch (error) {
        console.log('⚠️ Could not load secrets from SECRETS.py, using environment variables...');
    }
    
    const PRIVATE_KEY = process.env.PRIVATE_KEY || secrets.PRIVATE_KEY || 'YOUR_PRIVATE_KEY';
    const NODE_URL = process.env.NODE_URL || secrets.NODE_URL || 'YOUR_WEB3_NODE_URL';
    const network = NetworkEnum.POLYGON; // Change this to test different networks
    
    if (PRIVATE_KEY === 'YOUR_PRIVATE_KEY' || NODE_URL === 'YOUR_WEB3_NODE_URL') {
        console.error('❌ Please set PRIVATE_KEY and NODE_URL in environment variables or SECRETS.py');
        return;
    }
    
    try {
        // Create provider and wallet
        const provider = new ethers.JsonRpcProvider(NODE_URL);
        const wallet = new ethers.Wallet(PRIVATE_KEY, provider);
        const walletAddress = wallet.address;
        
        console.log(`📱 Wallet: ${walletAddress}`);
        console.log(`🌐 Network: ${network}`);
        
        // Check tokens for the test
        const tokensToCheck = ['USDT', 'USDC'];
        const results = [];
        
        for (const tokenSymbol of tokensToCheck) {
            const result = await checkTokenStatus(tokenSymbol, walletAddress, network, provider);
            results.push(result);
        }
        
        // Summary
        console.log('\n📋 Summary');
        console.log('=====================================');
        
        const canSwapUSDT = results.find(r => r.tokenSymbol === 'USDT')?.canSwap || false;
        const canSwapUSDC = results.find(r => r.tokenSymbol === 'USDC')?.canSwap || false;
        
        console.log(`USDT → USDC: ${canSwapUSDT ? '✅ Ready' : '❌ Not Ready'}`);
        console.log(`USDC → USDT: ${canSwapUSDC ? '✅ Ready' : '❌ Not Ready'}`);
        
        if (!canSwapUSDT && !canSwapUSDC) {
            console.log('\n🔧 To fix the issues:');
            console.log('1. Add more tokens to your wallet');
            console.log('2. Approve the 1inch router to spend your tokens');
            console.log('3. Check if you have enough MATIC for gas fees');
        }
        
    } catch (error) {
        console.error('❌ Error:', error);
    }
}

// Run the check
main().catch(console.error); 