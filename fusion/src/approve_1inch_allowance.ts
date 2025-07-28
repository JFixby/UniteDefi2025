import 'dotenv/config';
import { ethers } from 'ethers';
import axios from 'axios';
import { NetworkEnum } from "@1inch/fusion-sdk";
import { 
    getTokenAddress, 
    getTokenDecimals, 
    isTokenSupported, 
    getSupportedTokens, 
    getNetworkInfo,
    isValidAddress 
} from './tokens';

// 1inch API configuration
const INCH_API_BASE = 'https://api.1inch.dev';

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

// ERC20 ABI for approval
const ERC20_ABI = [
    'function approve(address spender, uint256 amount) returns (bool)',
    'function allowance(address owner, address spender) view returns (uint256)',
    'function balanceOf(address owner) view returns (uint256)'
];

// 1inch Router address (same for all networks)
const ROUTER_ADDRESS = '0x1111111254EEB25477B68fb85Ed929f73A960582';

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

async function checkCurrentAllowance(
    tokenContract: ethers.Contract,
    walletAddress: string,
    spenderAddress: string,
    tokenDecimals: number
) {
    try {
        const allowance = await tokenContract.allowance(walletAddress, spenderAddress);
        return {
            allowance: ethers.formatUnits(allowance, tokenDecimals),
            allowanceRaw: allowance
        };
    } catch (error) {
        console.error(`❌ Error checking allowance:`, error);
        return { allowance: '0', allowanceRaw: ethers.parseUnits('0', tokenDecimals) };
    }
}

async function approveToken(
    tokenSymbol: string,
    wallet: ethers.Wallet,
    network: NetworkEnum,
    apiKey: string,
    approvalAmount: string = '40'
) {
    try {
        const tokenAddress = getTokenAddress(tokenSymbol, network);
        const tokenDecimals = getTokenDecimals(tokenSymbol);
        const walletAddress = wallet.address;
        
        console.log(`\n🔍 Approving ${tokenSymbol}:`);
        console.log(`   Token: ${tokenAddress}`);
        console.log(`   Wallet: ${walletAddress}`);
        console.log(`   Router: ${ROUTER_ADDRESS}`);
        console.log(`   Amount: ${approvalAmount} ${tokenSymbol}`);
        
        // Create contract instance
        const tokenContract = new ethers.Contract(tokenAddress, ERC20_ABI, wallet);
        
        // Check current allowance
        const currentAllowance = await checkCurrentAllowance(tokenContract, walletAddress, ROUTER_ADDRESS, tokenDecimals);
        console.log(`   Current Allowance: ${currentAllowance.allowance} ${tokenSymbol}`);
        
        // Check if approval is needed
        const requiredAmount = ethers.parseUnits(approvalAmount, tokenDecimals);
        const hasEnoughAllowance = currentAllowance.allowanceRaw >= requiredAmount;
        
        if (hasEnoughAllowance) {
            console.log(`   ✅ Already has sufficient allowance (${currentAllowance.allowance} >= ${approvalAmount})`);
            return {
                tokenSymbol,
                success: true,
                message: 'Already approved',
                currentAllowance: currentAllowance.allowance
            };
        }
        
        console.log(`   ❌ Insufficient allowance, need to approve...`);
        
        // Get approval transaction from 1inch API
        const approvalTxData = await getApprovalTransaction(tokenAddress, walletAddress, network, apiKey);
        
        if (!approvalTxData || !approvalTxData.tx) {
            console.log(`   ❌ Could not get approval transaction from 1inch API`);
            console.log(`   Response:`, approvalTxData);
            
            // Fallback: direct contract approval
            console.log(`   🔄 Trying direct contract approval...`);
            const tx = await tokenContract.approve(ROUTER_ADDRESS, requiredAmount);
            console.log(`   📝 Approval transaction sent: ${tx.hash}`);
            
            const receipt = await tx.wait();
            console.log(`   ✅ Approval confirmed in block ${receipt.blockNumber}`);
            
            return {
                tokenSymbol,
                success: true,
                message: 'Direct approval successful',
                txHash: tx.hash,
                blockNumber: receipt.blockNumber
            };
        }
        
        // Execute approval transaction from 1inch API
        console.log(`   📝 Executing 1inch approval transaction...`);
        console.log(`   To: ${approvalTxData.tx.to}`);
        console.log(`   Data: ${approvalTxData.tx.data}`);
        
        const tx = await wallet.sendTransaction({
            to: approvalTxData.tx.to,
            data: approvalTxData.tx.data,
            gasLimit: approvalTxData.tx.gas || 100000,
            gasPrice: approvalTxData.tx.gasPrice ? ethers.parseUnits(approvalTxData.tx.gasPrice, 'wei') : undefined
        });
        
        console.log(`   📝 Approval transaction sent: ${tx.hash}`);
        
        const receipt = await tx.wait();
        if (receipt) {
            console.log(`   ✅ Approval confirmed in block ${receipt.blockNumber}`);
        }
        
        // Verify new allowance
        const newAllowance = await checkCurrentAllowance(tokenContract, walletAddress, ROUTER_ADDRESS, tokenDecimals);
        console.log(`   New Allowance: ${newAllowance.allowance} ${tokenSymbol}`);
        
        return {
            tokenSymbol,
            success: true,
            message: 'Approval successful',
            txHash: tx.hash,
            blockNumber: receipt?.blockNumber,
            newAllowance: newAllowance.allowance
        };
        
    } catch (error) {
        console.error(`❌ Error approving ${tokenSymbol}:`, error);
        return {
            tokenSymbol,
            success: false,
            error: error instanceof Error ? error.message : String(error)
        };
    }
}

async function main() {
    console.log('🔐 Approving 1inch Token Allowances');
    console.log('=====================================');
    
    // Load configuration using helpers
    let secrets: Record<string, string> = {};
    
    try {
        const { readSecretsFromPython, validateConfig } = await import('./helpers');
        secrets = await readSecretsFromPython();
    } catch (error) {
        console.log('⚠️ Could not load secrets from SECRETS.py, using environment variables...');
    }
    
    const PRIVATE_KEY = process.env.PRIVATE_KEY || secrets.PRIVATE_KEY || 'YOUR_PRIVATE_KEY';
    const NODE_URL = process.env.NODE_URL || secrets.NODE_URL || 'YOUR_WEB3_NODE_URL';
    const DEV_PORTAL_API_TOKEN = process.env.DEV_PORTAL_API_TOKEN || secrets.DEV_PORTAL_API_TOKEN || 'YOUR_DEV_PORTAL_API_TOKEN';
    const network = NetworkEnum.POLYGON;
    
    // Validate configuration using helpers
    try {
        const { validateConfig } = await import('./helpers');
        validateConfig(PRIVATE_KEY, NODE_URL, DEV_PORTAL_API_TOKEN);
    } catch (error) {
        console.error('❌ Configuration validation failed:', error);
        return;
    }
    
    try {
        // Create provider and wallet
        const provider = new ethers.JsonRpcProvider(NODE_URL);
        const wallet = new ethers.Wallet(PRIVATE_KEY, provider);
        const walletAddress = wallet.address;
        
        console.log(`📱 Wallet: ${walletAddress}`);
        console.log(`🌐 Network: ${getNetworkInfo(network).name} (${network})`);
        console.log(`🔑 API Key: ${DEV_PORTAL_API_TOKEN === 'YOUR_DEV_PORTAL_API_TOKEN' ? '❌ Not set' : '✅ Set'}`);
        
        // Validate wallet address
        if (!isValidAddress(walletAddress)) {
            console.error('❌ Invalid wallet address');
            return;
        }
        
        // Check wallet balance
        try {
            const balance = await provider.getBalance(walletAddress);
            const balanceFormatted = ethers.formatEther(balance);
            console.log(`💰 Wallet Balance: ${balanceFormatted} MATIC`);
            
            if (parseFloat(balanceFormatted) < 0.01) {
                console.log(`⚠️ Warning: Low MATIC balance for gas fees`);
                console.log(`   You need at least 0.01 MATIC for gas fees`);
                console.log(`   Current balance: ${balanceFormatted} MATIC`);
            }
        } catch (error) {
            console.error(`❌ Error checking wallet balance:`, error);
            console.log(`   This might indicate network connectivity issues`);
        }

        // STEP 1: Check initial allowance
        console.log('\n🔍 STEP 1: Checking Initial Allowances');
        console.log('=====================================');
        
        const tokensToCheck = ['USDT', 'USDC'];
        const initialResults: Array<{tokenSymbol: string, allowance: string, allowanceRaw: bigint}> = [];
        
        // Validate tokens are supported on the network
        console.log('\n🔍 Validating tokens on network...');
        const supportedTokens = getSupportedTokens(network);
        console.log(`Supported tokens on ${getNetworkInfo(network).name}: ${supportedTokens.join(', ')}`);
        
        for (const tokenSymbol of tokensToCheck) {
            if (!isTokenSupported(tokenSymbol, network)) {
                console.error(`❌ Token ${tokenSymbol} is not supported on ${getNetworkInfo(network).name}`);
                continue;
            }
            
            const tokenAddress = getTokenAddress(tokenSymbol, network);
            const tokenDecimals = getTokenDecimals(tokenSymbol);
            const tokenContract = new ethers.Contract(tokenAddress, ERC20_ABI, wallet);
            
            const currentAllowance = await checkCurrentAllowance(tokenContract, walletAddress, ROUTER_ADDRESS, tokenDecimals);
            console.log(`${tokenSymbol}: ${currentAllowance.allowance} ${tokenSymbol}`);
            
            initialResults.push({
                tokenSymbol,
                allowance: currentAllowance.allowance,
                allowanceRaw: currentAllowance.allowanceRaw
            });
        }

        // STEP 2: Approve tokens for $50
        console.log('\n🔐 STEP 2: Approving Tokens for $50');
        console.log('=====================================');
        
        const approvalAmount = '50'; // $50 worth
        const results = [];
        
        for (const tokenSymbol of tokensToCheck) {
            if (!isTokenSupported(tokenSymbol, network)) {
                console.error(`❌ Skipping ${tokenSymbol} - not supported on ${getNetworkInfo(network).name}`);
                continue;
            }
            
            const result = await approveToken(tokenSymbol, wallet, network, DEV_PORTAL_API_TOKEN, approvalAmount);
            results.push(result);
        }
        
        // STEP 3: Check allowance again
        console.log('\n🔍 STEP 3: Checking Allowances After Approval');
        console.log('=====================================');
        
        const finalResults: Array<{tokenSymbol: string, allowance: string, allowanceRaw: bigint}> = [];
        
        for (const tokenSymbol of tokensToCheck) {
            if (!isTokenSupported(tokenSymbol, network)) {
                console.error(`❌ Skipping ${tokenSymbol} - not supported on ${getNetworkInfo(network).name}`);
                continue;
            }
            
            const tokenAddress = getTokenAddress(tokenSymbol, network);
            const tokenDecimals = getTokenDecimals(tokenSymbol);
            const tokenContract = new ethers.Contract(tokenAddress, ERC20_ABI, wallet);
            
            const currentAllowance = await checkCurrentAllowance(tokenContract, walletAddress, ROUTER_ADDRESS, tokenDecimals);
            console.log(`${tokenSymbol}: ${currentAllowance.allowance} ${tokenSymbol}`);
            
            finalResults.push({
                tokenSymbol,
                allowance: currentAllowance.allowance,
                allowanceRaw: currentAllowance.allowanceRaw
            });
        }
        
        // Summary
        console.log('\n📋 Approval Summary');
        console.log('=====================================');
        
        results.forEach(result => {
            if (result.success) {
                console.log(`✅ ${result.tokenSymbol}: ${result.message}`);
                if (result.txHash) {
                    console.log(`   Transaction: ${result.txHash}`);
                }
                if (result.newAllowance) {
                    console.log(`   New Allowance: ${result.newAllowance} ${result.tokenSymbol}`);
                }
            } else {
                console.log(`❌ ${result.tokenSymbol}: ${result.error}`);
            }
        });

        // Comparison
        console.log('\n📊 Allowance Comparison');
        console.log('=====================================');
        
        tokensToCheck.forEach(tokenSymbol => {
            const initial = initialResults.find(r => r.tokenSymbol === tokenSymbol);
            const final = finalResults.find(r => r.tokenSymbol === tokenSymbol);
            
            if (initial && final) {
                console.log(`${tokenSymbol}:`);
                console.log(`   Before: ${initial.allowance} ${tokenSymbol}`);
                console.log(`   After:  ${final.allowance} ${tokenSymbol}`);
                console.log(`   Change: ${parseFloat(final.allowance) - parseFloat(initial.allowance)} ${tokenSymbol}`);
            }
        });
        
        const allSuccessful = results.every(r => r.success);
        
        if (allSuccessful) {
            console.log('\n🎉 All approvals completed successfully!');
            console.log('You can now execute fusion swaps with these tokens.');
        } else {
            console.log('\n⚠️ Some approvals failed. Check the errors above.');
        }
        
    } catch (error) {
        console.error('❌ Error:', error);
    }
}

// Run the approval
main().catch(console.error); 