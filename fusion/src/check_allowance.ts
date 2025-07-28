import 'dotenv/config';
import axios from 'axios';
import { NetworkEnum } from "@1inch/fusion-sdk";
import { getTokenAddress, getTokenDecimals } from './tokens';

// 1inch API configuration
const INCH_API_BASE = 'https://api.1inch.dev';
const INCH_API_KEY = process.env.DEV_PORTAL_API_TOKEN || 'YOUR_DEV_PORTAL_API_TOKEN';

// Network chain IDs
const CHAIN_IDS = {
    [NetworkEnum.ETHEREUM]: 1,
    [NetworkEnum.POLYGON]: 137,
    [NetworkEnum.BINANCE]: 56,
    [NetworkEnum.ARBITRUM]: 42161,
    [NetworkEnum.OPTIMISM]: 10,
    [NetworkEnum.AVALANCHE]: 43114,
    [NetworkEnum.FANTOM]: 250,
    [NetworkEnum.GNOSIS]: 100,
    [NetworkEnum.COINBASE]: 8453,
    [NetworkEnum.LINEA]: 59144,
    [NetworkEnum.ZKSYNC]: 324,
    [NetworkEnum.SONIC]: 1001,
    [NetworkEnum.UNICHAIN]: 1002
};

async function checkAllowance(
    tokenAddress: string,
    walletAddress: string,
    amount: string,
    network: NetworkEnum,
    apiKey: string
) {
    try {
        const chainId = CHAIN_IDS[network];
        const url = `${INCH_API_BASE}/swap/v5.2/${chainId}/approve/allowance`;
        
        const response = await axios.get(url, {
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Accept': 'application/json'
            },
            params: {
                tokenAddress,
                walletAddress,
                amount
            }
        });
        
        return response.data;
    } catch (error) {
        console.error(`❌ Error checking allowance:`, error);
        return null;
    }
}

async function getApprovalTransaction(
    tokenAddress: string,
    walletAddress: string,
    network: NetworkEnum,
    apiKey: string
) {
    try {
        const chainId = CHAIN_IDS[network];
        const url = `${INCH_API_BASE}/swap/v5.2/${chainId}/approve/transaction`;
        
        const response = await axios.get(url, {
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Accept': 'application/json'
            },
            params: {
                tokenAddress,
                walletAddress
            }
        });
        
        return response.data;
    } catch (error) {
        console.error(`❌ Error getting approval transaction:`, error);
        return null;
    }
}

async function checkTokenStatus(
    tokenSymbol: string,
    walletAddress: string,
    network: NetworkEnum,
    apiKey: string,
    amount: string = '1440000' // 1.44 USDT in smallest unit
) {
    try {
        const tokenAddress = getTokenAddress(tokenSymbol, network);
        const tokenDecimals = getTokenDecimals(tokenSymbol);
        
        console.log(`\n🔍 Checking ${tokenSymbol}:`);
        console.log(`   Token: ${tokenAddress}`);
        console.log(`   Wallet: ${walletAddress}`);
        const { ethers } = await import('ethers');
        console.log(`   Amount: ${ethers.formatUnits(amount, tokenDecimals)} ${tokenSymbol}`);
        
        // Check allowance using 1inch API
        const allowanceData = await checkAllowance(tokenAddress, walletAddress, amount, network, apiKey);
        
        if (!allowanceData) {
            console.log(`   ❌ Could not check allowance`);
            return {
                tokenSymbol,
                hasAllowance: false,
                needsApproval: true,
                canSwap: false
            };
        }
        
        const hasAllowance = allowanceData.allowance >= amount;
        
        console.log(`\n📊 Allowance Status:`);
        console.log(`   Current Allowance: ${ethers.formatUnits(allowanceData.allowance, tokenDecimals)} ${tokenSymbol}`);
        console.log(`   Required Amount: ${ethers.formatUnits(amount, tokenDecimals)} ${tokenSymbol}`);
        console.log(`   Has Sufficient Allowance: ${hasAllowance ? '✅' : '❌'}`);
        
        if (!hasAllowance) {
            console.log(`   ❌ Need to approve ${tokenSymbol} spending`);
            
            // Get approval transaction
            const approvalTx = await getApprovalTransaction(tokenAddress, walletAddress, network, apiKey);
            if (approvalTx) {
                console.log(`   📝 Approval transaction ready: ${approvalTx.tx.to}`);
            }
        }
        
        return {
            tokenSymbol,
            hasAllowance,
            needsApproval: !hasAllowance,
            canSwap: hasAllowance,
            allowanceData,
            approvalTx: !hasAllowance ? await getApprovalTransaction(tokenAddress, walletAddress, network, apiKey) : null
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
    console.log('🔍 Checking Token Allowances (1inch API)');
    console.log('=====================================');
    
    // Load configuration
    let secrets: Record<string, string> = {};
    
    try {
        const { readSecretsFromPython } = await import('./helpers');
        secrets = await readSecretsFromPython();
        console.log('✅ Successfully loaded secrets from SECRETS.py');
        console.log('Secrets loaded:', Object.keys(secrets));
    } catch (error) {
        console.log('⚠️ Could not load secrets from SECRETS.py, using environment variables...');
        console.log('Error details:', error);
    }
    
    const PRIVATE_KEY = process.env.PRIVATE_KEY || secrets.PRIVATE_KEY || 'YOUR_PRIVATE_KEY';
    const DEV_PORTAL_API_TOKEN = process.env.DEV_PORTAL_API_TOKEN || secrets.DEV_PORTAL_API_TOKEN || 'YOUR_DEV_PORTAL_API_TOKEN';
    const network = NetworkEnum.POLYGON;
    
    console.log('🔍 Debug - Values being used:');
    console.log('PRIVATE_KEY:', PRIVATE_KEY.substring(0, 10) + '...');
    console.log('DEV_PORTAL_API_TOKEN:', DEV_PORTAL_API_TOKEN.substring(0, 10) + '...');
    console.log('NODE_URL:', process.env.NODE_URL || secrets.NODE_URL);
    
    if (PRIVATE_KEY === 'YOUR_PRIVATE_KEY' || DEV_PORTAL_API_TOKEN === 'YOUR_DEV_PORTAL_API_TOKEN') {
        console.error('❌ Please set PRIVATE_KEY and DEV_PORTAL_API_TOKEN in environment variables or SECRETS.py');
        return;
    }
    
    try {
        // Get wallet address
        const { ethers } = await import('ethers');
        const provider = new ethers.JsonRpcProvider(process.env.NODE_URL || secrets.NODE_URL);
        const wallet = new ethers.Wallet(PRIVATE_KEY, provider);
        const walletAddress = wallet.address;
        
        console.log(`📱 Wallet: ${walletAddress}`);
        console.log(`🌐 Network: ${network}`);
        
        // Check tokens
        const tokensToCheck = ['USDT', 'USDC'];
        const results = [];
        
        for (const tokenSymbol of tokensToCheck) {
            const result = await checkTokenStatus(tokenSymbol, walletAddress, network, DEV_PORTAL_API_TOKEN);
            results.push(result);
        }
        
        // Summary
        console.log('\n📋 Summary');
        console.log('=====================================');
        
        const canSwapUSDT = results.find(r => r.tokenSymbol === 'USDT')?.canSwap || false;
        const canSwapUSDC = results.find(r => r.tokenSymbol === 'USDC')?.canSwap || false;
        
        console.log(`USDT → USDC: ${canSwapUSDT ? '✅ Ready' : '❌ Needs Approval'}`);
        console.log(`USDC → USDT: ${canSwapUSDC ? '✅ Ready' : '❌ Needs Approval'}`);
        
        if (!canSwapUSDT || !canSwapUSDC) {
            console.log('\n🔧 To fix the issues:');
            console.log('1. Execute approval transactions for tokens that need approval');
            console.log('2. Make sure you have enough tokens in your wallet');
            console.log('3. Ensure you have enough MATIC for gas fees');
        }
        
    } catch (error) {
        console.error('❌ Error:', error);
    }
}

// Run the check
main().catch(console.error); 