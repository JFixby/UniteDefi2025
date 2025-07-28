import { computeAddress, JsonRpcProvider, parseUnits } from "ethers";
import { 
    USDT_ADDRESS, 
    USDC_ADDRESS, 
    USDT_DECIMALS,
    validateTokenBalance,
    checkTokenBalance
} from "./helpers/tokenHelpers";
import { 
    createWeb3Provider,
    createFusionSDK,
    executeSwap,
    waitForTransaction,
    formatSwapSummary,
    SwapResult
} from "./helpers/swapHelpers";
import { getConfig, logConfig } from "./helpers/configHelpers";

async function performTwoSwaps() {
    console.log('🚀 Starting two subsequent swaps on Polygon...');
    console.log('1. USDT → USDC (1.44 USDT)');
    console.log('2. USDC → USDT (resulting USDC amount)');
    
    try {
        // Get configuration
        const config = getConfig();
        logConfig(config);
        
        // Initialize provider for Polygon
        const ethersRpcProvider = new JsonRpcProvider(config.nodeUrl);
        
        // Get wallet address from private key
        const walletAddress = computeAddress(config.privateKey);
        console.log('Wallet address:', walletAddress);
        
        // Validate initial USDT balance only
        const initialUSDTBalance = await validateTokenBalance(
            ethersRpcProvider, 
            walletAddress, 
            USDT_ADDRESS, 
            config.swapAmount
        );
        
        // Create Web3 provider and Fusion SDK
        const web3Provider = createWeb3Provider(ethersRpcProvider);
        const sdk = createFusionSDK(
            config.privateKey,
            web3Provider,
            config.network,
            config.devPortalApiToken
        );

        console.log('✅ Fusion SDK initialized for Polygon network');

        // Convert amount to wei (USDT has 6 decimals)
        const amountInWei = parseUnits(config.swapAmount, USDT_DECIMALS).toString();

        // SWAP 1: USDT → USDC
        console.log('\n🚀 Starting SWAP 1: USDT → USDC');
        const swap1Params = {
            fromTokenAddress: USDT_ADDRESS,
            toTokenAddress: USDC_ADDRESS,
            amount: amountInWei,
            walletAddress: walletAddress,
            source: 'fusion-check-script-swap-1'
        };
        
        const swap1Result = await executeSwap(sdk, swap1Params, 1);
        
        // Check if first swap failed
        if (!swap1Result.success) {
            console.log('\n❌ SWAP 1 FAILED - Stopping execution');
            console.log(`Error: ${swap1Result.error}`);
            console.log(`Execution time: ${swap1Result.executionTime} seconds`);
            
            // Create a dummy result for swap 2 to show it wasn't executed
            const swap2Result: SwapResult = {
                success: false,
                executionTime: 0,
                error: 'Not executed - previous swap failed'
            };
            
            // Show summary with failure
            formatSwapSummary(
                swap1Result,
                swap2Result,
                initialUSDTBalance.balance,
                initialUSDTBalance.balance, // No change since swap failed
                'USDT'
            );
            
            return;
        }
        
        console.log('✅ SWAP 1 completed successfully');
        
        // Wait for transaction to be processed
        await waitForTransaction(config.transactionWaitTime / 1000);
        
        // Check USDC balance after first swap
        console.log('\n📊 Checking USDC balance after first swap...');
        const usdcBalanceAfterSwap1 = await checkTokenBalance(ethersRpcProvider, walletAddress, USDC_ADDRESS);
        
        // SWAP 2: USDC → USDT (using all received USDC)
        console.log('\n🚀 Starting SWAP 2: USDC → USDT');
        const swap2Params = {
            fromTokenAddress: USDC_ADDRESS,
            toTokenAddress: USDT_ADDRESS,
            amount: usdcBalanceAfterSwap1.balanceInWei,
            walletAddress: walletAddress,
            source: 'fusion-check-script-swap-2'
        };
        
        const swap2Result = await executeSwap(sdk, swap2Params, 2);
        
        // Check if second swap failed
        if (!swap2Result.success) {
            console.log('\n❌ SWAP 2 FAILED');
            console.log(`Error: ${swap2Result.error}`);
            console.log(`Execution time: ${swap2Result.executionTime} seconds`);
            console.log('⚠️  You now have USDC from the first swap that needs to be handled manually');
        } else {
            console.log('✅ SWAP 2 completed successfully');
            
            // Wait for second transaction to be processed
            await waitForTransaction(config.transactionWaitTime / 1000);
        }
        
        // Check final balances
        console.log('\n📊 Final Balance Check:');
        const finalUSDTBalance = await checkTokenBalance(ethersRpcProvider, walletAddress, USDT_ADDRESS);
        const finalUSDCBalance = await checkTokenBalance(ethersRpcProvider, walletAddress, USDC_ADDRESS);
        
        // Format and display summary
        formatSwapSummary(
            swap1Result,
            swap2Result,
            initialUSDTBalance.balance,
            finalUSDTBalance.balance,
            'USDT'
        );

    } catch (error) {
        console.error('❌ Error during swaps:', error);
        throw error;
    }
}

// Run the two swaps
performTwoSwaps().catch(console.error); 