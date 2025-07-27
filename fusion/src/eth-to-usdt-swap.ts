import 'dotenv/config';
import {
    FusionSDK,
    NetworkEnum,
    OrderStatus,
    PrivateKeyProviderConnector,
    Web3Like,
} from "@1inch/fusion-sdk";
import { computeAddress, formatUnits, JsonRpcProvider } from "ethers";
import { spawn } from 'child_process';
import { promisify } from 'util';

// Function to read secrets from SECRETS.py
async function readSecretsFromPython(): Promise<Record<string, string>> {
    return new Promise((resolve, reject) => {
        const pythonProcess = spawn('python3', ['read_secrets.py'], { cwd: __dirname });
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

// Load secrets
let secrets: Record<string, string> = {};

// Configuration - Will be loaded from SECRETS.py or environment variables
let PRIVATE_KEY = process.env.PRIVATE_KEY || 'YOUR_PRIVATE_KEY'
let NODE_URL = process.env.NODE_URL || 'YOUR_WEB3_NODE_URL'
let DEV_PORTAL_API_TOKEN = process.env.DEV_PORTAL_API_TOKEN || 'YOUR_DEV_PORTAL_API_TOKEN'

// Token addresses for Ethereum Mainnet
const ETH_ADDRESS = '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee'
const USDT_ADDRESS = '0xdac17f958d2ee523a2206206994597c13d831ec7'

// Amount to swap (0.01 ETH in wei)
const SWAP_AMOUNT = '10000000000000000' // 0.01 ETH

async function main() {
    console.log('🚀 Starting ETH to USDT swap with 1inch Fusion...')
    
    try {
        // Try to load secrets from SECRETS.py first
        console.log('📖 Loading secrets from SECRETS.py...')
        secrets = await readSecretsFromPython();
        
        // Update configuration with secrets from SECRETS.py
        if (secrets.PRIVATE_KEY) PRIVATE_KEY = secrets.PRIVATE_KEY;
        if (secrets.NODE_URL) NODE_URL = secrets.NODE_URL;
        if (secrets.DEV_PORTAL_API_TOKEN) DEV_PORTAL_API_TOKEN = secrets.DEV_PORTAL_API_TOKEN;
        
        console.log('✅ Secrets loaded successfully from SECRETS.py');
    } catch (error) {
        console.log('⚠️ Could not load secrets from SECRETS.py, using environment variables...');
        console.log('Error:', error);
    }
    
    // Validate configuration
    const missingSecrets = [];
    if (PRIVATE_KEY === 'YOUR_PRIVATE_KEY') missingSecrets.push('PRIVATE_KEY');
    if (NODE_URL === 'YOUR_WEB3_NODE_URL') missingSecrets.push('NODE_URL');
    if (DEV_PORTAL_API_TOKEN === 'YOUR_DEV_PORTAL_API_TOKEN') missingSecrets.push('DEV_PORTAL_API_TOKEN');
    
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

    try {
        // Setup Ethereum provider
        const ethersRpcProvider = new JsonRpcProvider(NODE_URL)
        
        const ethersProviderConnector: Web3Like = {
            eth: {
                call(transactionConfig): Promise<string> {
                    return ethersRpcProvider.call(transactionConfig)
                }
            },
            extend(): void {}
        }

        // Setup connector with private key
        const connector = new PrivateKeyProviderConnector(
            PRIVATE_KEY,
            ethersProviderConnector
        )

        // Initialize Fusion SDK
        const sdk = new FusionSDK({
            url: 'https://api.1inch.dev/fusion',
            network: NetworkEnum.ETHEREUM, // Using Ethereum mainnet
            blockchainProvider: connector,
            authKey: DEV_PORTAL_API_TOKEN
        })

        const walletAddress = computeAddress(PRIVATE_KEY)
        console.log(`📱 Wallet address: ${walletAddress}`)
        console.log(`💰 Swap amount: ${formatUnits(SWAP_AMOUNT, 18)} ETH`)

        // Prepare swap parameters
        const params = {
            fromTokenAddress: ETH_ADDRESS, // ETH
            toTokenAddress: USDT_ADDRESS,  // USDT
            amount: SWAP_AMOUNT,
            walletAddress: walletAddress,
            source: 'fusion-example'
        }

        console.log('🔍 Getting quote...')
        
        // Get quote
        const quote = await sdk.getQuote(params)
        
        const recommendedPreset = quote.recommendedPreset
        const preset = quote.presets[recommendedPreset]
        
        if (!preset) {
            throw new Error('No preset found for recommended preset')
        }
        
        console.log('📊 Quote received:')
        console.log(`   Auction start amount: ${formatUnits(preset.auctionStartAmount, 6)} USDT`)
        console.log(`   Auction end amount: ${formatUnits(preset.auctionEndAmount, 6)} USDT`)
        console.log(`   Recommended preset: ${recommendedPreset}`)

        console.log('📝 Creating order...')
        
        // Create order
        const preparedOrder = await sdk.createOrder(params)

        console.log('📤 Submitting order...')
        
        // Submit order
        const info = await sdk.submitOrder(preparedOrder.order, preparedOrder.quoteId)

        console.log(`✅ Order submitted! Order hash: ${info.orderHash}`)
        console.log('⏳ Monitoring order status...')

        const start = Date.now()

        // Monitor order status
        while (true) {
            try {
                const data = await sdk.getOrderStatus(info.orderHash)

                console.log(`📈 Status: ${data.status}`)

                if (data.status === OrderStatus.Filled) {
                    console.log('🎉 Order filled successfully!')
                    if (data.fills && data.fills.length > 0) {
                        console.log('📋 Fill details:')
                        data.fills.forEach((fill, index) => {
                            console.log(`   Fill ${index + 1}: ${JSON.stringify(fill)}`)
                        })
                    }
                    break
                }

                if (data.status === OrderStatus.Expired) {
                    console.log('⏰ Order expired')
                    break
                }
                
                if (data.status === OrderStatus.Cancelled) {
                    console.log('❌ Order cancelled')
                    break
                }

                // Wait 2 seconds before next check
                await new Promise(resolve => setTimeout(resolve, 2000))

            } catch (e) {
                console.log('⚠️ Error checking order status:', e)
                await new Promise(resolve => setTimeout(resolve, 2000))
            }
        }

        const executionTime = (Date.now() - start) / 1000
        console.log(`⏱️ Order execution time: ${executionTime} seconds`)

    } catch (error) {
        console.error('❌ Error during swap:', error)
        process.exit(1)
    }
}

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason)
    process.exit(1)
})

main() 