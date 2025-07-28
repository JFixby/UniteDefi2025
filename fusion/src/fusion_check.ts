import { 
    FusionSDK, 
    NetworkEnum, 
    OrderStatus, 
    PrivateKeyProviderConnector, 
    Web3Like 
} from "@1inch/fusion-sdk";
import { 
    computeAddress, 
    formatUnits, 
    JsonRpcProvider,
    parseUnits 
} from "ethers";
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Configuration
const PRIVATE_KEY = process.env.PRIVATE_KEY || 'YOUR_PRIVATE_KEY'
const NODE_URL = process.env.POLYGON_RPC_URL || 'https://polygon-rpc.com'
const DEV_PORTAL_API_TOKEN = process.env.DEV_PORTAL_API_TOKEN || 'YOUR_DEV_PORTAL_API_TOKEN'

// Token addresses on Polygon
const USDT_ADDRESS = '0xc2132D05D31c914a87C6611C10748AEb04B58e8F' // USDT on Polygon
const USDC_ADDRESS = '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174' // USDC on Polygon

// Amount to swap: 1.44 USDT (USDT has 6 decimals)
const USDT_AMOUNT = '1.44'
const USDT_DECIMALS = 6

async function swapUSDTtoUSDC() {
    console.log('Starting USDT to USDC swap on Polygon...');
    console.log(`Amount: ${USDT_AMOUNT} USDT`);
    
    try {
        // Initialize provider for Polygon
        const ethersRpcProvider = new JsonRpcProvider(NODE_URL);
        
        // Create Web3-like connector
        const ethersProviderConnector: Web3Like = {
            eth: {
                call(transactionConfig): Promise<string> {
                    return ethersRpcProvider.call(transactionConfig);
                }
            },
            extend(): void {}
        };

        // Create connector with private key
        const connector = new PrivateKeyProviderConnector(
            PRIVATE_KEY,
            ethersProviderConnector
        );

        // Initialize Fusion SDK for Polygon
        const sdk = new FusionSDK({
            url: 'https://api.1inch.dev/fusion',
            network: NetworkEnum.POLYGON, // Polygon network
            blockchainProvider: connector,
            authKey: DEV_PORTAL_API_TOKEN
        });

        console.log('Fusion SDK initialized for Polygon network');

        // Get wallet address from private key
        const walletAddress = computeAddress(PRIVATE_KEY);
        console.log('Wallet address:', walletAddress);

        // Convert amount to wei (USDT has 6 decimals)
        const amountInWei = parseUnits(USDT_AMOUNT, USDT_DECIMALS).toString();

        // Prepare swap parameters
        const params = {
            fromTokenAddress: USDT_ADDRESS, // USDT
            toTokenAddress: USDC_ADDRESS,   // USDC
            amount: amountInWei,
            walletAddress: walletAddress,
            source: 'fusion-check-script'
        };

        console.log('Getting quote...');
        
        // Get quote
        const quote = await sdk.getQuote(params);
        
        const recommendedPreset = quote.recommendedPreset;
        const preset = quote.presets[recommendedPreset];
        
        if (!preset) {
            throw new Error('No preset found for the recommended preset');
        }
        
        console.log('Quote received:');
        console.log('- Auction start amount:', formatUnits(preset.auctionStartAmount, 6), 'USDC');
        console.log('- Auction end amount:', formatUnits(preset.auctionEndAmount, 6), 'USDC');
        console.log('- Recommended preset:', recommendedPreset);

        // Create order
        console.log('Creating order...');
        const preparedOrder = await sdk.createOrder(params);

        // Submit order
        console.log('Submitting order...');
        const orderInfo = await sdk.submitOrder(preparedOrder.order, preparedOrder.quoteId);

        console.log('Order submitted successfully!');
        console.log('Order Hash:', orderInfo.orderHash);

        // Monitor order status
        console.log('Monitoring order status...');
        const start = Date.now();

        while (true) {
            try {
                const data = await sdk.getOrderStatus(orderInfo.orderHash);

                if (data.status === OrderStatus.Filled) {
                    console.log('✅ Order Filled Successfully!');
                    console.log('Fills:', data.fills);
                    break;
                }

                if (data.status === OrderStatus.Expired) {
                    console.log('❌ Order Expired');
                    break;
                }
                
                if (data.status === OrderStatus.Cancelled) {
                    console.log('❌ Order Cancelled');
                    break;
                }

                // Wait 2 seconds before checking again
                await new Promise(resolve => setTimeout(resolve, 2000));
                console.log('Order status:', data.status, '- Waiting...');

            } catch (error) {
                console.error('Error checking order status:', error);
                await new Promise(resolve => setTimeout(resolve, 2000));
            }
        }

        const executionTime = (Date.now() - start) / 1000;
        console.log(`Order execution completed in ${executionTime} seconds`);

    } catch (error) {
        console.error('Error during swap:', error);
        throw error;
    }
}

// Run the swap
swapUSDTtoUSDC().catch(console.error); 