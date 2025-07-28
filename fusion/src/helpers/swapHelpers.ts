import { 
    FusionSDK, 
    NetworkEnum, 
    OrderStatus, 
    PrivateKeyProviderConnector, 
    Web3Like 
} from "@1inch/fusion-sdk";
import { JsonRpcProvider, formatUnits } from "ethers";
import { getTokenSymbol } from "./tokenHelpers";

export interface SwapParams {
    fromTokenAddress: string;
    toTokenAddress: string;
    amount: string;
    walletAddress: string;
    source: string;
}

export interface SwapResult {
    success: boolean;
    orderHash?: string;
    executionTime: number;
    fills?: any[];
    error?: string;
    status?: OrderStatus;
}

export function createWeb3Provider(ethersRpcProvider: JsonRpcProvider): Web3Like {
    return {
        eth: {
            call(transactionConfig): Promise<string> {
                return ethersRpcProvider.call(transactionConfig);
            }
        },
        extend(): void {}
    };
}

export function createFusionSDK(
    privateKey: string,
    provider: Web3Like,
    network: NetworkEnum,
    authKey: string
): FusionSDK {
    const connector = new PrivateKeyProviderConnector(privateKey, provider);
    
    return new FusionSDK({
        url: 'https://api.1inch.dev/fusion',
        network: network,
        blockchainProvider: connector,
        authKey: authKey
    });
}

export async function executeSwap(
    sdk: FusionSDK,
    params: SwapParams,
    swapNumber: number
): Promise<SwapResult> {
    const fromSymbol = getTokenSymbol(params.fromTokenAddress);
    const toSymbol = getTokenSymbol(params.toTokenAddress);
    
    console.log(`\n=== SWAP ${swapNumber}: ${fromSymbol} → ${toSymbol} ===`);
    console.log(`Amount: ${params.amount} ${fromSymbol}`);

    const start = Date.now();
    
    try {
        console.log('Getting quote...');
        
        // Get quote
        const quote = await sdk.getQuote(params);
        
        const recommendedPreset = quote.recommendedPreset;
        const preset = quote.presets[recommendedPreset];
        
        if (!preset) {
            throw new Error('No preset found for the recommended preset');
        }
        
        console.log('Quote received:');
        console.log('- Auction start amount:', formatUnits(preset.auctionStartAmount, 6), toSymbol);
        console.log('- Auction end amount:', formatUnits(preset.auctionEndAmount, 6), toSymbol);
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
        const statusStart = Date.now();

        while (true) {
            try {
                const data = await sdk.getOrderStatus(orderInfo.orderHash);

                if (data.status === OrderStatus.Filled) {
                    console.log('✅ Order Filled Successfully!');
                    console.log('Fills:', data.fills);
                    
                    const executionTime = (Date.now() - start) / 1000;
                    console.log(`Order execution completed in ${executionTime} seconds`);
                    
                    return {
                        success: true,
                        orderHash: orderInfo.orderHash,
                        executionTime,
                        fills: data.fills,
                        status: data.status
                    };
                }

                if (data.status === OrderStatus.Expired) {
                    console.log('❌ Order Expired');
                    const executionTime = (Date.now() - start) / 1000;
                    return {
                        success: false,
                        orderHash: orderInfo.orderHash,
                        executionTime,
                        error: 'Order expired',
                        status: data.status
                    };
                }
                
                if (data.status === OrderStatus.Cancelled) {
                    console.log('❌ Order Cancelled');
                    const executionTime = (Date.now() - start) / 1000;
                    return {
                        success: false,
                        orderHash: orderInfo.orderHash,
                        executionTime,
                        error: 'Order cancelled',
                        status: data.status
                    };
                }

                // Check for timeout (5 minutes)
                if (Date.now() - statusStart > 5 * 60 * 1000) {
                    console.log('❌ Order monitoring timeout');
                    const executionTime = (Date.now() - start) / 1000;
                    return {
                        success: false,
                        orderHash: orderInfo.orderHash,
                        executionTime,
                        error: 'Order monitoring timeout',
                        status: data.status
                    };
                }

                // Wait 2 seconds before checking again
                await new Promise(resolve => setTimeout(resolve, 2000));
                console.log('Order status:', data.status, '- Waiting...');

            } catch (error) {
                console.error('Error checking order status:', error);
                await new Promise(resolve => setTimeout(resolve, 2000));
            }
        }

    } catch (error) {
        const executionTime = (Date.now() - start) / 1000;
        console.error(`❌ Swap ${swapNumber} failed:`, error);
        
        return {
            success: false,
            executionTime,
            error: error instanceof Error ? error.message : 'Unknown error'
        };
    }
}

export async function waitForTransaction(seconds: number = 10): Promise<void> {
    console.log(`\n⏳ Waiting ${seconds} seconds for transaction to be processed...`);
    await new Promise(resolve => setTimeout(resolve, seconds * 1000));
}

export function calculateProfitLoss(
    initialBalance: string,
    finalBalance: string,
    tokenSymbol: string
): { profitLoss: number; percentage: number } {
    const initial = parseFloat(initialBalance);
    const final = parseFloat(finalBalance);
    const profitLoss = final - initial;
    const percentage = initial > 0 ? (profitLoss / initial) * 100 : 0;
    
    return { profitLoss, percentage };
}

export function formatSwapSummary(
    swap1Result: SwapResult,
    swap2Result: SwapResult,
    initialBalance: string,
    finalBalance: string,
    tokenSymbol: string
): void {
    console.log('\n💰 SWAP SUMMARY:');
    console.log(`Initial ${tokenSymbol}: ${initialBalance}`);
    console.log(`Final ${tokenSymbol}: ${finalBalance}`);
    
    if (swap1Result.success && swap2Result.success) {
        const { profitLoss, percentage } = calculateProfitLoss(initialBalance, finalBalance, tokenSymbol);
        console.log(`Profit/Loss: ${profitLoss.toFixed(6)} ${tokenSymbol}`);
        console.log(`Percentage: ${percentage.toFixed(4)}%`);
        
        if (profitLoss > 0) {
            console.log('✅ Profitable round-trip!');
        } else if (profitLoss < 0) {
            console.log('❌ Loss on round-trip (due to fees and slippage)');
        } else {
            console.log('➖ Break-even round-trip');
        }
    } else {
        console.log('❌ Round-trip incomplete due to swap failures');
    }
    
    console.log(`Swap 1: ${swap1Result.success ? '✅ Success' : '❌ Failed'} - Hash: ${swap1Result.orderHash || 'N/A'}`);
    if (!swap1Result.success && swap1Result.error) {
        console.log(`  Error: ${swap1Result.error}`);
    }
    
    console.log(`Swap 2: ${swap2Result.success ? '✅ Success' : '❌ Failed'} - Hash: ${swap2Result.orderHash || 'N/A'}`);
    if (!swap2Result.success && swap2Result.error) {
        console.log(`  Error: ${swap2Result.error}`);
    }
} 