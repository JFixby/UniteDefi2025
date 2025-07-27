import 'dotenv/config';
import { 
    createFusionSDK,
    executeSwap,
    getWalletAddress,
    validateConfig,
    parseTokenAmount,
    readSecretsFromPython,
    getEthInfo
} from './helpers.js';
import { NetworkEnum } from "@1inch/fusion-sdk";
import { 
    getTokenAddress, 
    getTokenDecimals,
    isValidAddress,
    getSupportedNetworks, 
    getNetworkInfo,
    isTokenSupported,
    getSupportedTokens 
} from './tokens.js';

// Main fusion swap function
async function fusionSwap(
    fromToken: string,
    toToken: string,
    amount: string,
    network: NetworkEnum = NetworkEnum.ETHEREUM
) {
    console.log(`\n🔄 Starting ${fromToken} → ${toToken} swap...`);
    console.log(`💰 Amount: ${amount} ${fromToken}`);
    console.log(`🌐 Network: ${network === NetworkEnum.ETHEREUM ? 'Ethereum Mainnet' : 
                               network === NetworkEnum.POLYGON ? 'Polygon' : 
                               network === NetworkEnum.BINANCE ? 'Binance Smart Chain' :
                               network === NetworkEnum.ARBITRUM ? 'Arbitrum' :
                               network === NetworkEnum.AVALANCHE ? 'Avalanche' :
                               network === NetworkEnum.OPTIMISM ? 'Optimism' :
                               network === NetworkEnum.FANTOM ? 'Fantom' :
                               network === NetworkEnum.GNOSIS ? 'Gnosis' :
                               network === NetworkEnum.COINBASE ? 'Coinbase' :
                               network === NetworkEnum.LINEA ? 'Linea' :
                               network === NetworkEnum.ZKSYNC ? 'zkSync' :
                               network === NetworkEnum.SONIC ? 'Sonic' :
                               network === NetworkEnum.UNICHAIN ? 'Unichain' : 'Unknown'}`);
    
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
            error: error instanceof Error ? error.message : String(error),
            fromToken,
            toToken,
            amount
        };
    }
}

// Configuration for test swaps
const TEST_CONFIG = {
    defaultAmount: '1.44',
    defaultNetwork: NetworkEnum.POLYGON,
    testPairs: [
        { from: 'USDT', to: 'USDC' },
        { from: 'USDC', to: 'USDT' }
    ],
    delayBetweenSwaps: 5000 // 5 seconds
};

// Function to validate test configuration
function validateTestConfig() {
    console.log('🔍 Validating test configuration...');
    
    const network = TEST_CONFIG.defaultNetwork;
    const networkInfo = getNetworkInfo(network);
    console.log(`✅ Network: ${networkInfo.name} (Chain ID: ${networkInfo.chainId})`);
    
    // Validate test pairs
    TEST_CONFIG.testPairs.forEach((pair, index) => {
        if (!isTokenSupported(pair.from, network)) {
            throw new Error(`Token ${pair.from} not supported on ${networkInfo.name}`);
        }
        if (!isTokenSupported(pair.to, network)) {
            throw new Error(`Token ${pair.to} not supported on ${networkInfo.name}`);
        }
        console.log(`✅ Test ${index + 1}: ${pair.from} → ${pair.to}`);
    });
    
    console.log('✅ All test pairs validated successfully');
}

// Function to display network information
function displayNetworkInfo(network: NetworkEnum) {
    const networkInfo = getNetworkInfo(network);
    const supportedTokens = getSupportedTokens(network);
    
    console.log(`\n🌐 Network Information:`);
    console.log(`   Name: ${networkInfo.name}`);
    console.log(`   Chain ID: ${networkInfo.chainId}`);
    console.log(`   Supported Tokens: ${supportedTokens.length}`);
    console.log(`   Tokens: ${supportedTokens.slice(0, 5).join(', ')}${supportedTokens.length > 5 ? '...' : ''}`);
}

// Function to run a single test swap
async function runTestSwap(
    fromToken: string, 
    toToken: string, 
    amount: string, 
    network: NetworkEnum,
    testNumber: number
) {
    console.log(`\n📊 Test ${testNumber}: ${fromToken} → ${toToken}`);
    console.log('=====================================');
    
    try {
        const result = await fusionSwap(fromToken, toToken, amount, network);
        return { ...result, testNumber };
    } catch (error) {
        console.error(`❌ Test ${testNumber} failed:`, error);
        return {
            success: false,
            error: error instanceof Error ? error.message : String(error),
            fromToken,
            toToken,
            amount,
            testNumber
        };
    }
}

// Function to generate comprehensive report
function generateReport(results: any[], network: NetworkEnum) {
    const networkInfo = getNetworkInfo(network);
    
    console.log('\n📋 Comprehensive Test Report');
    console.log('=====================================');
    console.log(`🌐 Network: ${networkInfo.name}`);
    console.log(`📅 Test Date: ${new Date().toISOString()}`);
    console.log(`🔢 Total Tests: ${results.length}`);
    
    // Success statistics
    const successfulTests = results.filter(r => r.success);
    const failedTests = results.filter(r => !r.success);
    const successRate = (successfulTests.length / results.length) * 100;
    
    console.log(`\n📊 Success Statistics:`);
    console.log(`   ✅ Successful: ${successfulTests.length}`);
    console.log(`   ❌ Failed: ${failedTests.length}`);
    console.log(`   📈 Success Rate: ${successRate.toFixed(1)}%`);
    
    // Detailed results
    console.log(`\n📋 Detailed Results:`);
    results.forEach((result) => {
        console.log(`\nTest ${result.testNumber}: ${result.fromToken} → ${result.toToken}`);
        if (result.success) {
            console.log(`   ✅ Status: Success`);
            console.log(`   📋 Order Hash: ${result.orderHash}`);
            console.log(`   ⏱️ Execution Time: ${result.executionTime}s`);
            console.log(`   ⏱️ Total Time: ${result.totalTime}s`);
            console.log(`   ⛽ Estimated ETH Fee: ${result.estimatedEthFee} ETH`);
        } else {
            console.log(`   ❌ Status: Failed`);
            console.log(`   ❌ Error: ${result.error}`);
        }
    });
    
    // Cost analysis
    const totalEthFees = successfulTests.reduce((sum, r) => sum + (r.estimatedEthFee || 0), 0);
    const avgExecutionTime = successfulTests.length > 0 
        ? successfulTests.reduce((sum, r) => sum + r.executionTime, 0) / successfulTests.length 
        : 0;
    
    console.log(`\n💰 Cost Analysis:`);
    console.log(`   💸 Total Estimated ETH Fees: ${totalEthFees.toFixed(6)} ETH`);
    console.log(`   ⏱️ Average Execution Time: ${avgExecutionTime.toFixed(2)}s`);
    
    // Performance insights
    if (successfulTests.length > 0) {
        const fastestTest = successfulTests.reduce((fastest, current) => 
            current.executionTime < fastest.executionTime ? current : fastest
        );
        const slowestTest = successfulTests.reduce((slowest, current) => 
            current.executionTime > slowest.executionTime ? current : slowest
        );
        
        console.log(`\n⚡ Performance Insights:`);
        console.log(`   🏃 Fastest: Test ${fastestTest.testNumber} (${fastestTest.executionTime}s)`);
        console.log(`   🐌 Slowest: Test ${slowestTest.testNumber} (${slowestTest.executionTime}s)`);
    }
    
    return {
        network: networkInfo.name,
        totalTests: results.length,
        successfulTests: successfulTests.length,
        failedTests: failedTests.length,
        successRate,
        totalEthFees,
        avgExecutionTime
    };
}

// Main function to run comprehensive fusion swap tests
async function main() {
    console.log('🚀 Starting Comprehensive Fusion Swap Tests');
    console.log('=====================================');
    
    try {
        // Validate configuration
        validateTestConfig();
        
        // Display network information
        displayNetworkInfo(TEST_CONFIG.defaultNetwork);
        
        const results = [];
        
        // Run all test swaps
        for (let i = 0; i < TEST_CONFIG.testPairs.length; i++) {
            const pair = TEST_CONFIG.testPairs[i];
            const result = await runTestSwap(
                pair.from, 
                pair.to, 
                TEST_CONFIG.defaultAmount, 
                TEST_CONFIG.defaultNetwork,
                i + 1
            );
            results.push(result);
            
            // If this swap failed, stop execution since subsequent swaps depend on it
            if (!result.success) {
                console.log(`\n❌ Test ${i + 1} failed. Stopping execution since subsequent swaps depend on this one.`);
                break;
            }
            
            // Wait between swaps (except for the last one)
            if (i < TEST_CONFIG.testPairs.length - 1) {
                console.log(`\n⏳ Waiting ${TEST_CONFIG.delayBetweenSwaps / 1000} seconds before next swap...`);
                await new Promise(resolve => setTimeout(resolve, TEST_CONFIG.delayBetweenSwaps));
            }
        }
        
        // Generate comprehensive report
        const report = generateReport(results, TEST_CONFIG.defaultNetwork);
        
        // Final summary
        console.log('\n🎯 Final Summary');
        console.log('=====================================');
        console.log(`✅ Tests completed on ${report.network}`);
        console.log(`📊 Success Rate: ${report.successRate.toFixed(1)}%`);
        console.log(`💰 Total Estimated Cost: ${report.totalEthFees.toFixed(6)} ETH`);
        console.log(`⏱️ Average Performance: ${report.avgExecutionTime.toFixed(2)}s`);
        
        if (report.successRate === 100) {
            console.log('🎉 All tests passed successfully!');
        } else {
            console.log(`⚠️ ${report.failedTests} test(s) failed. Check the detailed report above.`);
        }
        
    } catch (error) {
        console.error('❌ Test suite failed:', error);
        process.exit(1);
    }
}

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
    process.exit(1);
});

// Run the comprehensive tests
main().catch(console.error); 