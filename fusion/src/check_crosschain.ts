import { 
    SDK, 
    NetworkEnum, 
    OrderStatus, 
    PresetEnum, 
    PrivateKeyProviderConnector, 
    HashLock,
    SupportedChain
} from "@1inch/cross-chain-sdk";
import { randomBytes } from "crypto";
import { computeAddress, formatUnits, JsonRpcProvider, parseUnits } from "ethers";
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Configuration
const PRIVATE_KEY = process.env.PRIVATE_KEY ? `0x${process.env.PRIVATE_KEY}` : '';
const DEV_PORTAL_API_TOKEN = process.env.DEV_PORTAL_API_TOKEN || '';

// Validate environment variables
if (!PRIVATE_KEY || PRIVATE_KEY === '0x') {
    throw new Error('❌ PRIVATE_KEY not set in .env file');
}

if (!DEV_PORTAL_API_TOKEN || DEV_PORTAL_API_TOKEN === '') {
    throw new Error('❌ DEV_PORTAL_API_TOKEN not set in .env file');
}

// Network configurations
const ETHEREUM = {
    name: 'Ethereum Mainnet',
    chainId: 1,
    rpcUrl: process.env.ETHEREUM_RPC_URL || 'https://eth.llamarpc.com',
    networkEnum: NetworkEnum.ETHEREUM,
    tokens: {
        USDT: '0xdac17f958d2ee523a2206206994597c13d831ec7'
    }
};

const POLYGON = {
    name: 'Polygon',
    chainId: 137,
    rpcUrl: process.env.POLYGON_RPC_URL || 'https://polygon-rpc.com',
    networkEnum: NetworkEnum.POLYGON,
    tokens: {
        USDC: '0x2791bca1f2de4661ed88a30c99a7a9449aa84174'
    }
};

// Setup providers
const ethereumProvider = new JsonRpcProvider(ETHEREUM.rpcUrl);
const polygonProvider = new JsonRpcProvider(POLYGON.rpcUrl);

// Create blockchain connector
const connector = new PrivateKeyProviderConnector(
    PRIVATE_KEY,
    {
        eth: {
            call(transactionConfig: any): Promise<string> {
                return ethereumProvider.call(transactionConfig);
            }
        },
        extend(): void {}
    }
);

// Initialize Cross-Chain SDK
const sdk = new SDK({
    url: 'https://api.1inch.dev/fusion-plus',
    authKey: DEV_PORTAL_API_TOKEN,
    blockchainProvider: connector
});

// Helper function to check token balance
async function checkTokenBalance(tokenAddress: string, walletAddress: string, provider: JsonRpcProvider): Promise<{ balance: string, formatted: string, symbol: string }> {
    const tokenAbi = [
        'function balanceOf(address owner) view returns (uint256)',
        'function symbol() view returns (string)',
        'function decimals() view returns (uint8)'
    ];
    
    const tokenContract = new (await import('ethers')).Contract(tokenAddress, tokenAbi, provider);
    
    const [balance, symbol, decimals] = await Promise.all([
        tokenContract.balanceOf(walletAddress),
        tokenContract.symbol(),
        tokenContract.decimals()
    ]);
    
    return {
        balance: balance.toString(),
        formatted: formatUnits(balance, decimals),
        symbol
    };
}

// Helper function to check allowance
async function checkAllowance(tokenAddress: string, walletAddress: string, spenderAddress: string, provider: JsonRpcProvider): Promise<{ allowance: string, formatted: string }> {
    const tokenAbi = [
        'function allowance(address owner, address spender) view returns (uint256)',
        'function decimals() view returns (uint8)'
    ];
    
    const tokenContract = new (await import('ethers')).Contract(tokenAddress, tokenAbi, provider);
    
    const [allowance, decimals] = await Promise.all([
        tokenContract.allowance(walletAddress, spenderAddress),
        tokenContract.decimals()
    ]);
    
    return {
        allowance: allowance.toString(),
        formatted: formatUnits(allowance, decimals)
    };
}

// Function to approve tokens
async function approveTokens(tokenAddress: string, spenderAddress: string, amount: string): Promise<boolean> {
    try {
        const tokenAbi = [
            'function approve(address spender, uint256 amount) returns (bool)',
            'function decimals() view returns (uint8)'
        ];
        
        const tokenContract = new (await import('ethers')).Contract(tokenAddress, tokenAbi, ethereumProvider);
        const decimals = await tokenContract.decimals();
        const parsedAmount = parseUnits(amount, decimals);
        
        console.log(`📝 Approving ${amount} tokens...`);
        const tx = await tokenContract.approve(spenderAddress, parsedAmount);
        await tx.wait();
        console.log(`✅ Approval successful: ${tx.hash}`);
        return true;
    } catch (error) {
        console.error('❌ Approval failed:', error);
        return false;
    }
}

// Main cross-chain swap function
async function performCrossChainSwap(): Promise<void> {
    try {
        console.log('🚀 Starting USDT (Ethereum) → USDC (Polygon) Cross-Chain Swap');
        
        const walletAddress = computeAddress(PRIVATE_KEY);
        console.log('👛 Wallet Address:', walletAddress);
        
        // Swap configuration
        const swapAmount = '1000000'; // 1 USDT (6 decimals)
        const sourceTokenAddress = ETHEREUM.tokens.USDT;
        const destTokenAddress = POLYGON.tokens.USDC;
        
        console.log(`\n📋 Swap Plan: ${formatUnits(swapAmount, 6)} USDT (Ethereum) → USDC (Polygon)`);
        
        // Check initial balances
        console.log('\n💰 INITIAL BALANCES:');
        console.log('='.repeat(50));
        const initialEthUsdt = await checkTokenBalance(sourceTokenAddress, walletAddress, ethereumProvider);
        const initialPolygonUsdc = await checkTokenBalance(destTokenAddress, walletAddress, polygonProvider);
        const initialEthBalance = await ethereumProvider.getBalance(walletAddress);
        const initialPolygonBalance = await polygonProvider.getBalance(walletAddress);
        
        console.log(`📊 Ethereum Network:`);
        console.log(`   USDT: ${initialEthUsdt.formatted} USDT`);
        console.log(`   ETH:  ${formatUnits(initialEthBalance, 18)} ETH`);
        console.log(`📊 Polygon Network:`);
        console.log(`   USDC: ${initialPolygonUsdc.formatted} USDC`);
        console.log(`   MATIC: ${formatUnits(initialPolygonBalance, 18)} MATIC`);
        console.log('='.repeat(50));
        
        // Check if we have enough USDT
        if (BigInt(initialEthUsdt.balance) < BigInt(swapAmount)) {
            throw new Error(`❌ Insufficient USDT balance. Have: ${initialEthUsdt.formatted}, Need: ${formatUnits(swapAmount, 6)}`);
        }
        
        // Check ETH balance for gas
        if (initialEthBalance < parseUnits('0.01', 18)) {
            throw new Error('❌ Insufficient ETH for gas fees');
        }
        
        // Check allowance
        const routerAddress = '0x111111125421ca6dc452d289314280a0f8842a65'; // 1inch router
        const allowance = await checkAllowance(sourceTokenAddress, walletAddress, routerAddress, ethereumProvider);
        
        if (BigInt(allowance.allowance) < BigInt(swapAmount)) {
            console.log(`\n⚠️  Insufficient allowance. Current: ${allowance.formatted}, Need: ${formatUnits(swapAmount, 6)}`);
            const approved = await approveTokens(sourceTokenAddress, routerAddress, formatUnits(swapAmount, 6));
            if (!approved) {
                throw new Error('❌ Token approval failed');
            }
        }
        
        // Get cross-chain quote
        console.log('\n📊 Getting cross-chain quote...');
        const quoteParams = {
            srcChainId: ETHEREUM.networkEnum as SupportedChain,
            dstChainId: POLYGON.networkEnum as SupportedChain,
            srcTokenAddress: sourceTokenAddress,
            dstTokenAddress: destTokenAddress,
            amount: swapAmount,
            walletAddress: walletAddress,
            enableEstimate: true,
            source: 'cross-chain-swap-example'
        };
        
        const quote = await sdk.getQuote(quoteParams);
        console.log('✅ Quote received');
        console.log('- Available presets:', Object.keys(quote.presets));
        
        const fastPreset = quote.presets[PresetEnum.fast];
        if (fastPreset) {
            console.log('- Fast preset details:');
            console.log(`  * Secrets count: ${fastPreset.secretsCount}`);
            console.log(`  * Auction duration: ${fastPreset.auctionDuration}s`);
            console.log(`  * Expected amount: ${formatUnits(fastPreset.auctionStartAmount, 6)} USDC`);
        }
        
        // Generate secrets for atomic swap
        console.log('\n🔐 Generating secrets for atomic swap...');
        const secretsCount = fastPreset.secretsCount;
        const secrets = Array.from({length: secretsCount}).map(() => '0x' + randomBytes(32).toString('hex'));
        const secretHashes = secrets.map((s) => HashLock.hashSecret(s));
        
        console.log(`Generated ${secretsCount} secrets`);
        
        // Create hash-lock
        const hashLock = secretsCount === 1
            ? HashLock.forSingleFill(secrets[0])
            : HashLock.forMultipleFills(HashLock.getMerkleLeaves(secrets));
        
        // Create order
        console.log('\n📝 Creating cross-chain order...');
        const orderParams = {
            walletAddress: walletAddress,
            hashLock: hashLock,
            preset: PresetEnum.fast,
            source: 'cross-chain-swap-example',
            secretHashes: secretHashes
        };
        
        const {hash, quoteId, order} = await sdk.createOrder(quote, orderParams);
        console.log('✅ Order created');
        console.log('- Order hash:', hash);
        console.log('- Quote ID:', quoteId);
        
        // Submit order
        console.log('\n📤 Submitting order...');
        const orderInfo = await sdk.submitOrder(
            ETHEREUM.networkEnum as SupportedChain,
            order,
            quoteId,
            secretHashes
        );
        console.log('✅ Order submitted');
        console.log('- Order hash:', orderInfo.orderHash);
        
        // Track order status
        console.log('\n⏳ Tracking order status...');
        const startTime = Date.now();
        
        while (true) {
            try {
                const data = await sdk.getOrderStatus(orderInfo.orderHash);
                console.log(`Status: ${data.status}`);
                
                // Check for secrets that need to be shared
                const secretsToShare = await sdk.getReadyToAcceptSecretFills(orderInfo.orderHash);
                if (secretsToShare.fills.length > 0) {
                    console.log(`🔓 Sharing ${secretsToShare.fills.length} secrets...`);
                    for (const {idx} of secretsToShare.fills) {
                        await sdk.submitSecret(orderInfo.orderHash, secrets[idx]);
                        console.log(`   Shared secret ${idx + 1}/${secretsToShare.fills.length}`);
                    }
                }
                
                if (data.status === OrderStatus.Executed) {
                    console.log('✅ Cross-chain swap executed successfully!');
                    
                    // Calculate received amount
                    let totalReceived = BigInt(0);
                    if (data.fills && data.fills.length > 0) {
                        totalReceived = data.fills.reduce((sum: bigint, fill: any) => {
                            return sum + BigInt(fill.filledAuctionTakerAmount || fill.toTokenAmount || '0');
                        }, BigInt(0));
                    }
                    
                    const executionTime = (Date.now() - startTime) / 1000;
                    console.log(`\n📊 Swap Summary:`);
                    console.log(`   Execution time: ${executionTime}s`);
                    console.log(`   Sent: ${formatUnits(swapAmount, 6)} USDT (Ethereum)`);
                    console.log(`   Received: ${formatUnits(totalReceived.toString(), 6)} USDC (Polygon)`);
                    console.log(`   Order hash: ${orderInfo.orderHash}`);
                    
                    // Check final balances
                    console.log('\n💰 FINAL BALANCES:');
                    console.log('='.repeat(50));
                    const finalEthUsdt = await checkTokenBalance(sourceTokenAddress, walletAddress, ethereumProvider);
                    const finalPolygonUsdc = await checkTokenBalance(destTokenAddress, walletAddress, polygonProvider);
                    const finalEthBalance = await ethereumProvider.getBalance(walletAddress);
                    const finalPolygonBalance = await polygonProvider.getBalance(walletAddress);
                    
                    console.log(`📊 Ethereum Network:`);
                    console.log(`   USDT: ${finalEthUsdt.formatted} USDT`);
                    console.log(`   ETH:  ${formatUnits(finalEthBalance, 18)} ETH`);
                    console.log(`📊 Polygon Network:`);
                    console.log(`   USDC: ${finalPolygonUsdc.formatted} USDC`);
                    console.log(`   MATIC: ${formatUnits(finalPolygonBalance, 18)} MATIC`);
                    console.log('='.repeat(50));
                    
                    // Balance changes
                    console.log('\n📈 BALANCE CHANGES:');
                    console.log('='.repeat(50));
                    const usdtChange = BigInt(finalEthUsdt.balance) - BigInt(initialEthUsdt.balance);
                    const usdcChange = BigInt(finalPolygonUsdc.balance) - BigInt(initialPolygonUsdc.balance);
                    const ethChange = finalEthBalance - initialEthBalance;
                    const maticChange = finalPolygonBalance - initialPolygonBalance;
                    
                    console.log(`📊 Ethereum Network:`);
                    console.log(`   USDT: ${formatUnits(usdtChange.toString(), 6)} USDT (${usdtChange >= 0 ? '+' : ''}${formatUnits(usdtChange.toString(), 6)})`);
                    console.log(`   ETH:  ${formatUnits(ethChange.toString(), 18)} ETH (${ethChange >= 0 ? '+' : ''}${formatUnits(ethChange.toString(), 18)})`);
                    console.log(`📊 Polygon Network:`);
                    console.log(`   USDC: ${formatUnits(usdcChange.toString(), 6)} USDC (${usdcChange >= 0 ? '+' : ''}${formatUnits(usdcChange.toString(), 6)})`);
                    console.log(`   MATIC: ${formatUnits(maticChange.toString(), 18)} MATIC (${maticChange >= 0 ? '+' : ''}${formatUnits(maticChange.toString(), 18)})`);
                    console.log('='.repeat(50));
                    
                    break;
                }
                
                if (data.status === OrderStatus.Expired) {
                    console.log('❌ Order expired');
                    break;
                }
                
                if (data.status === OrderStatus.Cancelled) {
                    console.log('❌ Order cancelled');
                    break;
                }
                
                // Wait before checking again
                await new Promise(resolve => setTimeout(resolve, 3000));
                
            } catch (error) {
                console.log('Error checking order status:', error);
                await new Promise(resolve => setTimeout(resolve, 3000));
            }
        }
        
    } catch (error) {
        console.error('❌ Cross-chain swap failed:', error);
        throw error;
    }
}

// Run the swap
if (require.main === module) {
    performCrossChainSwap()
        .then(() => {
            console.log('\n✨ Cross-chain swap completed!');
            process.exit(0);
        })
        .catch((error) => {
            console.error('💥 Cross-chain swap failed:', error);
            process.exit(1);
        });
}

export { performCrossChainSwap }; 