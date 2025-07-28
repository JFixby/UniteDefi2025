import {
    FusionSDK,
    NetworkEnum,
    OrderStatus,
    PrivateKeyProviderConnector,
    Web3Like,
} from "@1inch/fusion-sdk";
import { computeAddress, formatUnits, JsonRpcProvider } from "ethers";
import { getTokenAddress, getTokenDecimals, NETWORK_CONFIG } from './tokens';
import { spawn } from 'child_process';
import * as path from 'path';

// Helper function to format amount with proper decimals
export function formatTokenAmount(amount: string, tokenSymbol: string): string {
    const decimals = getTokenDecimals(tokenSymbol);
    return formatUnits(amount, decimals);
}

// Helper function to convert human amount to wei/smallest unit
export function parseTokenAmount(amount: string, tokenSymbol: string): string {
    const decimals = getTokenDecimals(tokenSymbol);
    return (parseFloat(amount) * Math.pow(10, decimals)).toString();
}

// Helper function to create Fusion SDK instance
export function createFusionSDK(
    privateKey: string,
    nodeUrl: string,
    apiToken: string,
    network: NetworkEnum
): FusionSDK {
    const ethersRpcProvider = new JsonRpcProvider(nodeUrl);
    
    const ethersProviderConnector: Web3Like = {
        eth: {
            call(transactionConfig): Promise<string> {
                return ethersRpcProvider.call(transactionConfig);
            }
        },
        extend(): void {}
    };

    const connector = new PrivateKeyProviderConnector(
        privateKey,
        ethersProviderConnector
    );

    return new FusionSDK({
        url: 'https://api.1inch.dev/fusion',
        network: network,
        blockchainProvider: connector,
        authKey: apiToken
    });
}

// Helper function to execute a swap
export async function executeSwap(
    sdk: FusionSDK,
    fromToken: string,
    toToken: string,
    amount: string,
    walletAddress: string,
    network: NetworkEnum = NetworkEnum.ETHEREUM,
    source: string = 'fusion-helper'
): Promise<{ orderHash: string; executionTime: number }> {
    console.log(`🔍 Getting quote for ${formatTokenAmount(amount, fromToken)} ${fromToken} → ${toToken}...`);
    
    // Get quote
    const quote = await sdk.getQuote({
        fromTokenAddress: getTokenAddress(fromToken, network),
        toTokenAddress: getTokenAddress(toToken, network),
        amount: amount,
        walletAddress: walletAddress,
        source: source
    });
    
    const recommendedPreset = quote.recommendedPreset;
    const preset = quote.presets[recommendedPreset];
    
    if (!preset) {
        throw new Error('No preset found for recommended preset');
    }
    
    console.log('📊 Quote received:');
    console.log(`   Auction start amount: ${formatTokenAmount(preset.auctionStartAmount.toString(), toToken)} ${toToken}`);
    console.log(`   Auction end amount: ${formatTokenAmount(preset.auctionEndAmount.toString(), toToken)} ${toToken}`);
    console.log(`   Recommended preset: ${recommendedPreset}`);

    console.log('📝 Creating order...');
    
    // Create order
    const preparedOrder = await sdk.createOrder({
        fromTokenAddress: getTokenAddress(fromToken, network),
        toTokenAddress: getTokenAddress(toToken, network),
        amount: amount,
        walletAddress: walletAddress,
        source: source
    });

    console.log('📤 Submitting order...');
    
    // Submit order
    const info = await sdk.submitOrder(preparedOrder.order, preparedOrder.quoteId);

    console.log(`✅ Order submitted! Order hash: ${info.orderHash}`);
    console.log('⏳ Monitoring order status...');

    const start = Date.now();

    // Monitor order status
    while (true) {
        try {
            const data = await sdk.getOrderStatus(info.orderHash);

            console.log(`📈 Status: ${data.status}`);

            if (data.status === OrderStatus.Filled) {
                console.log('🎉 Order filled successfully!');
                if (data.fills && data.fills.length > 0) {
                    console.log('📋 Fill details:');
                    data.fills.forEach((fill, index) => {
                        console.log(`   Fill ${index + 1}: ${JSON.stringify(fill)}`);
                    });
                }
                break;
            }

            if (data.status === OrderStatus.Expired) {
                console.log('⏰ Order expired');
                break;
            }
            
            if (data.status === OrderStatus.Cancelled) {
                console.log('❌ Order cancelled');
                break;
            }

            // Wait 2 seconds before next check
            await new Promise(resolve => setTimeout(resolve, 2000));

        } catch (e) {
            console.log('⚠️ Error checking order status:', e);
            await new Promise(resolve => setTimeout(resolve, 2000));
        }
    }

    const executionTime = (Date.now() - start) / 1000;
    console.log(`⏱️ Order execution time: ${executionTime} seconds`);
    
    return { orderHash: info.orderHash, executionTime };
}

// Helper function to get wallet address from private key
export function getWalletAddress(privateKey: string): string {
    return computeAddress(privateKey);
}

// Helper function to validate configuration
export function validateConfig(privateKey: string, nodeUrl: string, apiToken: string): void {
    const missingSecrets = [];
    if (privateKey === 'YOUR_PRIVATE_KEY') missingSecrets.push('PRIVATE_KEY');
    if (nodeUrl === 'YOUR_WEB3_NODE_URL') missingSecrets.push('NODE_URL');
    if (apiToken === 'YOUR_DEV_PORTAL_API_TOKEN') missingSecrets.push('DEV_PORTAL_API_TOKEN');
    
    if (missingSecrets.length > 0) {
        console.error('❌ Missing required secrets:');
        missingSecrets.forEach(secret => {
            console.error(`   - ${secret}`);
        });
        console.error('');
        console.error('Please ensure SECRETS.py contains:');
        console.error('   - WALLET_SEED (for PRIVATE_KEY)');
        console.error('   - YOUR_INFURA_PROJECT_ID (for NODE_URL)');
        console.error('   - YOUR_DEV_PORTAL_API_TOKEN');
        process.exit(1);
    }
}

// Function to read secrets from SECRETS.py
export async function readSecretsFromPython(): Promise<Record<string, string>> {
    return new Promise((resolve, reject) => {
        const pythonProcess = spawn('python3', ['fusion/read_secrets.py'], { cwd: path.join(__dirname, '../..') });
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
export async function getEthInfo(sdk: any, walletAddress: string) {
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

 