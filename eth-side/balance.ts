import { ethers } from 'ethers';
import {
  ALICE_PRIVATE_KEY,
  CAROL_PRIVATE_KEY,
  NETWORK,
  getRpcUrl,
  getChainId,
  hasValidPrivateKeys,
} from './src/variables';

// Token addresses for the specific tokens you want to check
// Updated with official addresses from official-tokens.txt
const TOKEN_ADDRESSES = {
  POLYGON: {
    USDT: '0xc2132D05D31c914a87C6611C10748AEb04B58e8F', // Official USDT on Polygon
    USDC: '0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359', // Official native Circle USDC on Polygon
    WETH: '0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619',
    WMATIC: '0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270',
    BNL: '0x24d84aB1fd4159920084deB1D1B8F129AfF97505', // Official BNL on Polygon
  },
  ETH_MAINNET: {
    USDT: '0xdAC17F958D2ee523a2206206994597c13D831ec7', // Official USDT on Ethereum
    USDC: '0xA0b86991c6218b36c1d19d4a2e9Eb0cE3606eB48', // Official USDC on Ethereum
    WETH: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2',
  }
} as const;

// ERC-20 Token ABI (minimal for balance checking)
const ERC20_ABI = [
  'function name() view returns (string)',
  'function symbol() view returns (string)',
  'function decimals() view returns (uint8)',
  'function balanceOf(address owner) view returns (uint256)',
  'function totalSupply() view returns (uint256)'
];

// Retry configuration
const RETRY_CONFIG = {
  maxRetries: 3,
  baseDelay: 1000, // 1 second
  maxDelay: 10000, // 10 seconds
};

// Helper function to wait with exponential backoff
function wait(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Helper function to retry with exponential backoff
async function retryWithBackoff<T>(
  operation: () => Promise<T>,
  maxRetries: number = RETRY_CONFIG.maxRetries,
  baseDelay: number = RETRY_CONFIG.baseDelay
): Promise<T> {
  let lastError: Error;
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error as Error;
      
      // Check if it's a rate limit error
      const isRateLimitError = error instanceof Error && 
        (error.message.includes('Too Many Requests') || 
         error.message.includes('rate limit') ||
         error.message.includes('429'));
      
      if (!isRateLimitError || attempt === maxRetries) {
        throw error;
      }
      
      // Calculate delay with exponential backoff
      const delay = Math.min(baseDelay * Math.pow(2, attempt), RETRY_CONFIG.maxDelay);
      console.log(`⚠️  Rate limited, retrying in ${delay}ms... (attempt ${attempt + 1}/${maxRetries + 1})`);
      await wait(delay);
    }
  }
  
  throw lastError!;
}

async function checkBalances() {
  console.log('=== Full Token Balance Check for ALICE and CAROL ===\n');

  // Validate that we have the required private keys
  if (!hasValidPrivateKeys()) {
    console.error('❌ Error: Missing or invalid private keys for ALICE and/or CAROL');
    console.log('Please check your .env file and ensure both ALICE_PRIVATE_KEY and CAROL_PRIVATE_KEY are set correctly.');
    return;
  }

  try {
    // Get network configuration
    const rpcUrl = getRpcUrl();
    const chainId = getChainId();
    
    console.log(`Network: ${NETWORK} (Chain ID: ${chainId})`);
    console.log(`RPC URL: ${rpcUrl}`);
    console.log();

    // Create provider
    const provider = new ethers.JsonRpcProvider(rpcUrl);

    // Get addresses from private keys
    const aliceWallet = new ethers.Wallet(ALICE_PRIVATE_KEY, provider);
    const carolWallet = new ethers.Wallet(CAROL_PRIVATE_KEY, provider);

    const aliceAddress = aliceWallet.address;
    const carolAddress = carolWallet.address;

    console.log('Wallet Addresses:');
    console.log(`ALICE: ${aliceAddress}`);
    console.log(`CAROL: ${carolAddress}`);
    console.log();

    // Check native token balances
    console.log('🔍 Checking native token balances...\n');

    const aliceNativeBalance = await provider.getBalance(aliceAddress);
    const carolNativeBalance = await provider.getBalance(carolAddress);

    const nativeTokenName = NETWORK === 'POLYGON' ? 'MATIC' : 'ETH';
    const aliceNativeFormatted = ethers.formatEther(aliceNativeBalance);
    const carolNativeFormatted = ethers.formatEther(carolNativeBalance);

    console.log(`💰 Native Token (${nativeTokenName}) Balances:`);
    console.log(`ALICE: ${aliceNativeFormatted} ${nativeTokenName}`);
    console.log(`CAROL: ${carolNativeFormatted} ${nativeTokenName}`);
    console.log();

    // Check ERC-20 token balances
    console.log('🔍 Checking ERC-20 token balances...\n');

    const networkTokens = TOKEN_ADDRESSES[NETWORK];
    const tokenResults = {
      alice: {} as Record<string, { balance: string; symbol: string; decimals: number }>,
      carol: {} as Record<string, { balance: string; symbol: string; decimals: number }>
    };

    // Define the order of tokens to display
    const tokenOrder = ['USDT', 'USDC', 'BNL'] as const;

    for (const tokenName of tokenOrder) {
      const tokenAddress = networkTokens[tokenName as keyof typeof networkTokens];
      
      if (!tokenAddress) {
        console.log(`${tokenName}: ⚠️  Token address not configured`);
        continue;
      }

      try {
        const tokenContract = new ethers.Contract(tokenAddress, ERC20_ABI, provider);
        
        // Get token info with retry
        const [symbol, decimals] = await Promise.all([
          retryWithBackoff(() => tokenContract.symbol()),
          retryWithBackoff(() => tokenContract.decimals())
        ]);

        // Get balances with retry
        const [aliceTokenBalance, carolTokenBalance] = await Promise.all([
          retryWithBackoff(() => tokenContract.balanceOf(aliceAddress)),
          retryWithBackoff(() => tokenContract.balanceOf(carolAddress))
        ]);

        // Format balances
        const aliceFormatted = ethers.formatUnits(aliceTokenBalance, decimals);
        const carolFormatted = ethers.formatUnits(carolTokenBalance, decimals);

        // Store results
        tokenResults.alice[tokenName] = { balance: aliceFormatted, symbol, decimals };
        tokenResults.carol[tokenName] = { balance: carolFormatted, symbol, decimals };

        console.log(`${tokenName} (${symbol}):`);
        console.log(`  ALICE: ${aliceFormatted} ${symbol}`);
        console.log(`  CAROL: ${carolFormatted} ${symbol}`);

      } catch (error) {
        console.log(`${tokenName}: ❌ Error checking balance - ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }

    console.log();

    // Summary
    console.log('📊 Summary:');
    console.log(`Network: ${NETWORK} (${chainId})`);
    console.log(`Native Token: ${nativeTokenName}`);
    console.log(`Total Native Balance: ${ethers.formatEther(aliceNativeBalance + carolNativeBalance)} ${nativeTokenName}`);
    console.log(`Tokens Checked: ETH/MATIC, USDT, USDC, BNL`);

    // Check for low balances
    const minNativeBalance = ethers.parseEther('0.01');
    if (aliceNativeBalance < minNativeBalance) {
      console.log(`⚠️  Warning: ALICE has low native balance (${aliceNativeFormatted} ${nativeTokenName})`);
    }
    if (carolNativeBalance < minNativeBalance) {
      console.log(`⚠️  Warning: CAROL has low native balance (${carolNativeFormatted} ${nativeTokenName})`);
    }

  } catch (error) {
    console.error('❌ Error checking balances:', error);
    console.log('\nTroubleshooting tips:');
    console.log('1. Check your RPC URL is correct and accessible');
    console.log('2. Verify your private keys are valid');
    console.log('3. Ensure you have internet connection');
    console.log('4. Check if the network is experiencing issues');
  }
}

// Run the balance check
checkBalances().catch(console.error); 