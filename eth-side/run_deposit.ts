import { ethers } from 'ethers';
import { EscrowDeposit, DepositParams, NetworkConfig } from './deposit';
import { 
  CAROL_PRIVATE_KEY, 
  NETWORK, 
  getRpcUrl, 
  getChainId, 
  hasValidCarolPrivateKey,
  getAliceAddress
} from './variables';

// Contract addresses from cross-chain-sdk deployments
// These are the actual deployed contract addresses
const CONTRACT_ADDRESSES = {
  POLYGON: {
    ESCROW_FACTORY: '0xa7bcb4eac8964306f9e3764f67db6a7af6ddf99a'
  },
  ETH_MAINNET: {
    ESCROW_FACTORY: '0xa7bcb4eac8964306f9e3764f67db6a7af6ddf99a'
  }
};

// Network explorer URLs
const EXPLORER_URLS = {
  POLYGON: 'https://polygonscan.com',
  ETH_MAINNET: 'https://etherscan.io'
};

// Get contract addresses for current network
const getContractAddresses = () => {
  return CONTRACT_ADDRESSES[NETWORK];
};

/**
 * Generate a random secret and its hash for testing
 */
function generateTestSecret(): { secret: string; hashedSecret: string } {
  const secret = ethers.randomBytes(32);
  const hashedSecret = ethers.keccak256(secret);
  
  return {
    secret: ethers.hexlify(secret),
    hashedSecret: hashedSecret
  };
}

/**
 * Create network configuration using variables.ts
 */
function createNetworkConfig(): NetworkConfig {
  return {
    rpcUrl: getRpcUrl(),
    chainId: getChainId(),
    networkName: NETWORK
  };
}

/**
 * Validate that Carol's private key is available
 */
function validateCarolPrivateKey(): void {
  if (!hasValidCarolPrivateKey()) {
    throw new Error('❌ CAROL_PRIVATE_KEY is not set or invalid. Please set it in your .env file.');
  }
}

/**
 * Carol creates escrow contract and deposits native tokens
 */
async function carolCreatesEscrowDeposit(secret?: string) {
  console.log('\n🔐 Carol Creates Escrow Deposit');
  console.log('================================');
  
  // Validate Carol's private key
  validateCarolPrivateKey();
  
  // Generate or use provided secret
  let secretData: { secret: string; hashedSecret: string };
  if (secret) {
    console.log(`🔑 Using provided secret: ${secret}`);
    const hashedSecret = ethers.keccak256(ethers.toUtf8Bytes(secret));
    secretData = {
      secret: secret,
      hashedSecret: hashedSecret
    };
  } else {
    console.log('🎲 Generating random secret...');
    secretData = generateTestSecret();
    console.log(`🔑 Generated secret: ${secretData.secret}`);
  }
  
  // Get network configuration
  const networkConfig = createNetworkConfig();
  const contracts = getContractAddresses();
  
  console.log(`👤 Using wallet: CAROL`);
  console.log(`🌐 Network: ${networkConfig.networkName}`);
  console.log(`🔗 RPC URL: ${networkConfig.rpcUrl}`);
  console.log(`⛓️  Chain ID: ${networkConfig.chainId}`);
  console.log(`🏭 Escrow Factory: ${contracts.ESCROW_FACTORY}`);
  console.log(`🔍 Explorer: ${EXPLORER_URLS[NETWORK]}`);
  
  // Create deposit parameters
  const depositParams: DepositParams = {
    hashedSecret: secretData.hashedSecret,
    amount: '0.01', // 0.01 native tokens (ETH/MATIC)
    takerAddress: '', // Example taker address - will be fixed
    timelock: {
      withdrawalPeriod: 3600, // 1 hour
      cancellationPeriod: 7200 // 2 hours
    },
    safetyDeposit: '0.001' // 0.001 native tokens safety deposit
  };
  
  // Use Alice's address as the taker
  try {
    depositParams.takerAddress = getAliceAddress();
    console.log(`👤 Using Alice's address as taker: ${depositParams.takerAddress}`);
  } catch (error) {
    throw new Error('❌ Failed to get Alice\'s address. Please ensure ALICE_PRIVATE_KEY is set in your .env file.');
  }
  
  console.log(`\n📋 Deposit Parameters:`);
  console.log(`   Amount: ${depositParams.amount} ${networkConfig.networkName === 'POLYGON' ? 'MATIC' : 'ETH'}`);
  console.log(`   Taker: ${depositParams.takerAddress}`);
  console.log(`   Withdrawal Period: ${depositParams.timelock.withdrawalPeriod} seconds`);
  console.log(`   Cancellation Period: ${depositParams.timelock.cancellationPeriod} seconds`);
  console.log(`   Safety Deposit: ${depositParams.safetyDeposit} ${networkConfig.networkName === 'POLYGON' ? 'MATIC' : 'ETH'}`);
  console.log(`   Hashed Secret: ${depositParams.hashedSecret}`);
  
  try {
    // Create escrow deposit instance
    const escrowDeposit = new EscrowDeposit(
      CAROL_PRIVATE_KEY,
      contracts.ESCROW_FACTORY,
      networkConfig
    );
    
    // Create the deposit
    const result = await escrowDeposit.createDeposit(depositParams);
    
    console.log(`\n✅ Escrow deposit created successfully!`);
    console.log(`🏠 Escrow Address: ${result.escrowAddress}`);
    console.log(`   🔍 View: ${EXPLORER_URLS[NETWORK]}/address/${result.escrowAddress}`);
    console.log(`📝 Transaction Hash: ${result.txHash}`);
    console.log(`   🔍 View: ${EXPLORER_URLS[NETWORK]}/tx/${result.txHash}`);
    console.log(`⏰ Block Timestamp: ${result.blockTimestamp}`);
    
    console.log(`\n🔍 Explorer Links:`);
    console.log(`=================`);
    console.log(`🏭 Factory Contract: ${EXPLORER_URLS[NETWORK]}/address/${contracts.ESCROW_FACTORY}`);
    console.log(`🏠 Escrow Contract: ${EXPLORER_URLS[NETWORK]}/address/${result.escrowAddress}`);
    console.log(`📝 Transaction: ${EXPLORER_URLS[NETWORK]}/tx/${result.txHash}`);
    
    console.log(`\n📋 Next Steps:`);
    console.log(`==============`);
    console.log(`1. Share escrow address with counterparty: ${result.escrowAddress}`);
    console.log(`2. Share secret with counterparty: ${secretData.secret}`);
    console.log(`3. Counterparty can withdraw using the secret`);
    console.log(`4. Or cancel after ${depositParams.timelock.cancellationPeriod} seconds`);
    
    return {
      ...result,
      secret: secretData.secret,
      hashedSecret: secretData.hashedSecret
    };
    
  } catch (error) {
    console.error(`❌ Failed to create escrow deposit:`, error);
    throw error;
  }
}

/**
 * Example with custom parameters
 */
async function carolCreatesCustomEscrowDeposit(
  amount: string,
  takerAddress: string,
  withdrawalPeriod: number,
  cancellationPeriod: number,
  secret?: string
) {
  console.log('\n⚙️  Carol Creates Custom Escrow Deposit');
  console.log('=======================================');
  
  // Validate Carol's private key
  validateCarolPrivateKey();
  
  // Generate or use provided secret
  let secretData: { secret: string; hashedSecret: string };
  if (secret) {
    console.log(`🔑 Using provided secret: ${secret}`);
    const hashedSecret = ethers.keccak256(ethers.toUtf8Bytes(secret));
    secretData = {
      secret: secret,
      hashedSecret: hashedSecret
    };
  } else {
    console.log('🎲 Generating random secret...');
    secretData = generateTestSecret();
    console.log(`🔑 Generated secret: ${secretData.secret}`);
  }
  
  // Get network configuration
  const networkConfig = createNetworkConfig();
  const contracts = getContractAddresses();
  
  // Create deposit parameters
  const depositParams: DepositParams = {
    hashedSecret: secretData.hashedSecret,
    amount: amount,
    takerAddress: takerAddress,
    timelock: {
      withdrawalPeriod: withdrawalPeriod,
      cancellationPeriod: cancellationPeriod
    },
    safetyDeposit: (parseFloat(amount) * 0.1).toString() // 10% of amount
  };
  
  console.log(`\n📋 Custom Deposit Parameters:`);
  console.log(`   Amount: ${depositParams.amount} ${networkConfig.networkName === 'POLYGON' ? 'MATIC' : 'ETH'}`);
  console.log(`   Taker: ${depositParams.takerAddress}`);
  console.log(`   Withdrawal Period: ${depositParams.timelock.withdrawalPeriod} seconds`);
  console.log(`   Cancellation Period: ${depositParams.timelock.cancellationPeriod} seconds`);
  console.log(`   Safety Deposit: ${depositParams.safetyDeposit} ${networkConfig.networkName === 'POLYGON' ? 'MATIC' : 'ETH'}`);
  
  try {
    // Create escrow deposit instance
    const escrowDeposit = new EscrowDeposit(
      CAROL_PRIVATE_KEY,
      contracts.ESCROW_FACTORY,
      networkConfig
    );
    
    // Create the deposit
    const result = await escrowDeposit.createDeposit(depositParams);
    
    console.log(`\n✅ Custom escrow deposit created successfully!`);
    console.log(`🏠 Escrow Address: ${result.escrowAddress}`);
    console.log(`   🔍 View: ${EXPLORER_URLS[NETWORK]}/address/${result.escrowAddress}`);
    console.log(`📝 Transaction Hash: ${result.txHash}`);
    console.log(`   🔍 View: ${EXPLORER_URLS[NETWORK]}/tx/${result.txHash}`);
    console.log(`⏰ Block Timestamp: ${result.blockTimestamp}`);
    
    console.log(`\n🔍 Explorer Links:`);
    console.log(`=================`);
    console.log(`🏭 Factory Contract: ${EXPLORER_URLS[NETWORK]}/address/${contracts.ESCROW_FACTORY}`);
    console.log(`🏠 Escrow Contract: ${EXPLORER_URLS[NETWORK]}/address/${result.escrowAddress}`);
    console.log(`📝 Transaction: ${EXPLORER_URLS[NETWORK]}/tx/${result.txHash}`);
    
    return {
      ...result,
      secret: secretData.secret,
      hashedSecret: secretData.hashedSecret
    };
    
  } catch (error) {
    console.error(`❌ Failed to create custom escrow deposit:`, error);
    throw error;
  }
}

/**
 * Main function to run Carol's escrow deposit
 */
async function main() {
  console.log('🚀 Carol\'s ETH-Side Escrow Deposit');
  console.log('===================================');
  
  // Check command line arguments
  const command = process.argv[2]?.toLowerCase();
  
  try {
    switch (command) {
      case 'deposit':
        // Basic deposit with optional secret
        const secret = process.argv[3]; // Optional secret as third argument
        await carolCreatesEscrowDeposit(secret);
        break;
        
      case 'custom':
        // Custom deposit with all parameters
        const amount = process.argv[3] || '0.01';
        // Use Alice's address as default taker if not provided
        let takerAddress = process.argv[4];
        if (!takerAddress) {
          try {
            takerAddress = getAliceAddress();
            console.log(`👤 Using Alice's address as default taker: ${takerAddress}`);
          } catch (error) {
            throw new Error('❌ Failed to get Alice\'s address. Please ensure ALICE_PRIVATE_KEY is set in your .env file or provide a taker address.');
          }
        }
        const withdrawalPeriod = parseInt(process.argv[5]) || 3600;
        const cancellationPeriod = parseInt(process.argv[6]) || 7200;
        const customSecret = process.argv[7]; // Optional secret
        
        await carolCreatesCustomEscrowDeposit(
          amount,
          takerAddress,
          withdrawalPeriod,
          cancellationPeriod,
          customSecret
        );
        break;
        
      default:
        console.log('\n📖 Usage:');
        console.log('=========');
        console.log('npx ts-node run_deposit.ts deposit [secret]                    - Create escrow deposit with optional secret');
        console.log('npx ts-node run_deposit.ts custom <amount> <taker> <withdrawal> <cancellation> [secret] - Custom deposit');
        console.log('\n📝 Examples:');
        console.log('npx ts-node run_deposit.ts deposit');
        console.log('npx ts-node run_deposit.ts deposit mysecret123');
        console.log('npx ts-node run_deposit.ts custom 0.05 0x742d35Cc6634C0532925a3b8D4C9db96C4b4d8b6 3600 7200');
        console.log('npx ts-node run_deposit.ts custom 0.1 0x742d35Cc6634C0532925a3b8D4C9db96C4b4d8b6 1800 3600 mysecret123');
        console.log('\n⚠️  Note: Make sure CAROL_PRIVATE_KEY is set in your .env file');
        console.log(`🌐 Current network: ${NETWORK}`);
        break;
    }
  } catch (error) {
    console.error('❌ Script failed:', error);
    process.exit(1);
  }
}

// Run the script if called directly
if (require.main === module) {
  main().catch((error) => {
    console.error('❌ Script failed:', error);
    process.exit(1);
  });
}

export { 
  carolCreatesEscrowDeposit, 
  carolCreatesCustomEscrowDeposit,
  generateTestSecret,
  createNetworkConfig,
  getContractAddresses
}; 