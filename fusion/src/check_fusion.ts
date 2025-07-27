import 'dotenv/config';
import { spawn } from 'child_process';
import * as path from 'path';
import {
    createFusionSDK,
    executeSwap,
    getWalletAddress,
    validateConfig,
    parseTokenAmount,
    formatTokenAmount
} from './helpers.js';
import { NetworkEnum } from "@1inch/fusion-sdk";

// Function to read secrets from SECRETS.py
async function readSecretsFromPython(): Promise<Record<string, string>> {
    return new Promise((resolve, reject) => {
        const pythonProcess = spawn('python3', ['read_secrets.py'], { cwd: path.join(__dirname, '..') });
        let output = '';
        let error = '';

        pythonProcess.stdout.on('data', (data) => {
            output += data.toString();
        });

        pythonProcess.stderr.on('data', (data) => {
            error += data.toString();
        });

        pythonProcess.on('close', (code) => {
            if (code === 0) {
                const secrets: Record<string, string> = {};
                output.trim().split('\n').forEach(line => {
                    const [key, value] = line.split('=', 2);
                    if (key && value) {
                        secrets[key] = value;
                    }
                });
                resolve(secrets);
            } else {
                reject(new Error(`Python script failed: ${error}`));
            }
        });
    });
}

// Function to get ETH balance and estimate gas fees
async function getEthInfo(sdk: any, walletAddress: string) {
    try {
        // This would require additional implementation to get actual gas estimates
        // For now, we'll use a rough estimate
        const estimatedGasPrice = 20; // gwei
        const estimatedGasLimit = 200000; // typical swap gas limit
        const estimatedFee = (estimatedGasPrice * estimatedGasLimit) / 1e9; // Convert to ETH
        
        return {
            estimatedGasPrice,
            estimatedGasLimit,
            estimatedFee
        };
    } catch (error) {
        console.log('⚠️ Could not estimate gas fees:', error);
        return {
            estimatedGasPrice: 20,
            estimatedGasLimit: 200000,
            estimatedFee: 0.004 // Default estimate
        };
    }
}

// Main fusion swap function
async function fusion_swap(
    fromToken: string,
    toToken: string,
    amount: string,
    network: NetworkEnum = NetworkEnum.ETHEREUM
) {
    console.log(`\n🔄 Starting ${fromToken} → ${toToken} swap...`);
    console.log(`💰 Amount: ${amount} ${fromToken}`);
    console.log(`🌐 Network: ${network === NetworkEnum.ETHEREUM ? 'Ethereum Mainnet' : 
                               network === NetworkEnum.POLYGON ? 'Polygon' : 
                               network === NetworkEnum.ETHEREUM_TESTNET ? 'Ethereum Testnet' : 'Unknown'}`);
    
    // Load secrets
    let secrets: Record<string, string> = {};
    
    try {
        secrets = await readSecretsFromPython();
    } catch (error) {
        console.log('⚠️ Could not load secrets from SECRETS.py, using environment variables...');
    }
    
    // Get configuration
    let PRIVATE_KEY = process.env.PRIVATE_KEY || secrets.PRIVATE_KEY || 'YOUR_PRIVATE_KEY';
    let NODE_URL = process.env.NODE_URL || secrets.NODE_URL || 'YOUR_WEB3_NODE_URL';
    let DEV_PORTAL_API_TOKEN = process.env.DEV_PORTAL_API_TOKEN || secrets.DEV_PORTAL_API_TOKEN || 'YOUR_DEV_PORTAL_API_TOKEN';
    
    // Update configuration with secrets from SECRETS.py
    if (secrets.PRIVATE_KEY) PRIVATE_KEY = secrets.PRIVATE_KEY.startsWith('0x') ? secrets.PRIVATE_KEY : `0x${secrets.PRIVATE_KEY}`;
    if (secrets.NODE_URL) NODE_URL = secrets.NODE_URL;
    if (secrets.DEV_PORTAL_API_TOKEN) DEV_PORTAL_API_TOKEN = secrets.DEV_PORTAL_API_TOKEN;
    
    // Validate configuration
    validateConfig(PRIVATE_KEY, NODE_URL, DEV_PORTAL_API_TOKEN);
    
    try {
        // Get wallet address
        const walletAddress = getWalletAddress(PRIVATE_KEY);
        console.log(`📱 Wallet address: ${walletAddress}`);
        
        // Create Fusion SDK
        const sdk = createFusionSDK(PRIVATE_KEY, NODE_URL, DEV_PORTAL_API_TOKEN, network);
        
        // Get ETH info and gas estimates
        const ethInfo = await getEthInfo(sdk, walletAddress);
        console.log(`⛽ Estimated gas price: ${ethInfo.estimatedGasPrice} gwei`);
        console.log(`⛽ Estimated gas limit: ${ethInfo.estimatedGasLimit}`);
        console.log(`⛽ Estimated ETH fee: ${ethInfo.estimatedFee} ETH`);
        
        // Convert amount to smallest unit
        const amountInSmallestUnit = parseTokenAmount(amount, fromToken);
        console.log(`📊 Amount in smallest unit: ${amountInSmallestUnit}`);
        
        const startTime = Date.now();
        
        // Execute the swap
        const result = await executeSwap(
            sdk,
            fromToken,
            toToken,
            amountInSmallestUnit,
            walletAddress,
            network,
            'check-fusion'
        );
        
        const endTime = Date.now();
        const totalTime = (endTime - startTime) / 1000;
        
        console.log(`✅ Swap completed successfully!`);
        console.log(`📋 Order Hash: ${result.orderHash}`);
        console.log(`⏱️ Execution Time: ${result.executionTime} seconds`);
        console.log(`⏱️ Total Time: ${totalTime} seconds`);
        console.log(`⛽ Estimated ETH Fee: ${ethInfo.estimatedFee} ETH`);
        
        return {
            success: true,
            orderHash: result.orderHash,
            executionTime: result.executionTime,
            totalTime,
            estimatedEthFee: ethInfo.estimatedFee,
            fromToken,
            toToken,
            amount
        };
        
    } catch (error) {
        console.error(`❌ Error during ${fromToken} → ${toToken} swap:`, error);
        return {
            success: false,
            error: error.message,
            fromToken,
            toToken,
            amount
        };
    }
}

// Main function to run both swaps
async function main() {
    console.log('🚀 Starting Fusion Swap Tests');
    console.log('=====================================');
    
    const results = [];
    
    // Test 1: USDT to USDC
    console.log('\n📊 Test 1: USDT → USDC');
    console.log('=====================================');
    const result1 = await fusion_swap('USDT', 'USDC', '1.44', NetworkEnum.ETHEREUM);
    results.push(result1);
    
    // Wait a bit between swaps
    console.log('\n⏳ Waiting 5 seconds before next swap...');
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    // Test 2: USDC to USDT
    console.log('\n📊 Test 2: USDC → USDT');
    console.log('=====================================');
    const result2 = await fusion_swap('USDC', 'USDT', '1.44', NetworkEnum.ETHEREUM);
    results.push(result2);
    
    // Summary
    console.log('\n📋 Summary Report');
    console.log('=====================================');
    
    results.forEach((result, index) => {
        console.log(`\nTest ${index + 1}: ${result.fromToken} → ${result.toToken}`);
        if (result.success) {
            console.log(`✅ Status: Success`);
            console.log(`📋 Order Hash: ${result.orderHash}`);
            console.log(`⏱️ Execution Time: ${result.executionTime}s`);
            console.log(`⏱️ Total Time: ${result.totalTime}s`);
            console.log(`⛽ Estimated ETH Fee: ${result.estimatedEthFee} ETH`);
        } else {
            console.log(`❌ Status: Failed`);
            console.log(`❌ Error: ${result.error}`);
        }
    });
    
    // Calculate total ETH fees
    const totalEthFees = results
        .filter(r => r.success)
        .reduce((sum, r) => sum + (r.estimatedEthFee || 0), 0);
    
    console.log(`\n💰 Total Estimated ETH Fees: ${totalEthFees} ETH`);
    
    // Success rate
    const successCount = results.filter(r => r.success).length;
    const successRate = (successCount / results.length) * 100;
    console.log(`📊 Success Rate: ${successCount}/${results.length} (${successRate.toFixed(1)}%)`);
}

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
    process.exit(1);
});

// Run the tests
main().catch(console.error); 