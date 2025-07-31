import { ethers } from 'ethers';

// Interface for deposit parameters
interface DepositParams {
  hashedSecret: string;
  amount: string;
  takerAddress: string;
  timelock: {
    withdrawalPeriod: number;
    cancellationPeriod: number;
  };
  safetyDeposit: string;
}

// Interface for network configuration
interface NetworkConfig {
  rpcUrl: string;
  chainId: number;
  networkName: string;
}

// Mock escrow factory ABI for demonstration
const ESCROW_FACTORY_ABI = [
  'function deployDst(bytes calldata immutables, uint256 privateCancellation) external payable returns (address escrow, uint256 blockTimestamp)',
  'function getDstEscrowAddress(bytes calldata srcImmutables, bytes calldata complement, uint256 blockTime, address taker, address implementation) external view returns (address)',
  'function getDestinationImpl() external view returns (address)'
];

// Mock resolver ABI for demonstration
const RESOLVER_ABI = [
  'function deployDst(bytes calldata immutables, uint256 privateCancellation) external payable returns (address escrow, uint256 blockTimestamp)',
  'function withdraw(string calldata escrow, string calldata secret, bytes calldata immutables) external',
  'function cancel(string calldata escrow, bytes calldata immutables) external'
];

class EscrowDeposit {
  private provider: ethers.JsonRpcProvider;
  private signer: ethers.Wallet;
  private escrowFactory: ethers.Contract;
  private resolver: ethers.Contract;
  private networkConfig: NetworkConfig;

  constructor(
    privateKey: string,
    escrowFactoryAddress: string,
    resolverAddress: string,
    networkConfig: NetworkConfig
  ) {
    this.networkConfig = networkConfig;
    this.provider = new ethers.JsonRpcProvider(networkConfig.rpcUrl);
    this.signer = new ethers.Wallet(privateKey, this.provider);
    
    this.escrowFactory = new ethers.Contract(
      escrowFactoryAddress,
      ESCROW_FACTORY_ABI,
      this.signer
    );
    
    this.resolver = new ethers.Contract(
      resolverAddress,
      RESOLVER_ABI,
      this.signer
    );
  }

  /**
   * Create escrow deposit using hashed secret
   */
  async createDeposit(params: DepositParams): Promise<{
    escrowAddress: string;
    txHash: string;
    blockTimestamp: number;
  }> {
    console.log('🔐 Creating escrow deposit...');
    console.log(`🌐 Network: ${this.networkConfig.networkName}`);
    console.log(`🔗 RPC URL: ${this.networkConfig.rpcUrl}`);
    console.log(`⛓️  Chain ID: ${this.networkConfig.chainId}`);
    console.log('📋 Parameters:');
    console.log(`   Hashed Secret: ${params.hashedSecret}`);
    console.log(`   Amount: ${params.amount}`);
    console.log(`   Taker Address: ${params.takerAddress}`);
    console.log(`   Safety Deposit: ${params.safetyDeposit}`);
    console.log(`   Withdrawal Period: ${params.timelock.withdrawalPeriod} seconds`);
    console.log(`   Cancellation Period: ${params.timelock.cancellationPeriod} seconds`);

    try {
      // Create immutables structure (simplified for demonstration)
      const immutables = this.createImmutables(params);
      
      // Calculate private cancellation time
      const privateCancellation = BigInt(params.timelock.cancellationPeriod);
      
      // Get current gas price
      const feeData = await this.provider.getFeeData();
      const gasPrice = feeData.gasPrice || ethers.parseUnits('2', 'gwei');
      
      console.log(`⛽ Gas Price: ${ethers.formatUnits(gasPrice, 'gwei')} gwei`);
      
      // Deploy destination escrow
      const tx = await this.resolver.deployDst(
        immutables,
        privateCancellation,
        {
          value: ethers.parseEther(params.safetyDeposit),
          gasPrice: gasPrice
        }
      );
      
      console.log(`⏳ Transaction submitted: ${tx.hash}`);
      
      // Wait for confirmation
      const receipt = await tx.wait();
      
      if (!receipt) {
        throw new Error('Transaction failed');
      }
      
      // Get block timestamp
      const block = await this.provider.getBlock(receipt.blockNumber);
      const blockTimestamp = block?.timestamp || 0;
      
      // Calculate escrow address
      const implementation = await this.escrowFactory.getDestinationImpl();
      const escrowAddress = await this.escrowFactory.getDstEscrowAddress(
        immutables,
        immutables, // complement (simplified)
        BigInt(blockTimestamp),
        params.takerAddress,
        implementation
      );
      
      console.log('✅ Escrow deposit created successfully!');
      console.log(`🏠 Escrow Address: ${escrowAddress}`);
      console.log(`📝 Transaction Hash: ${tx.hash}`);
      console.log(`⏰ Block Timestamp: ${blockTimestamp}`);
      console.log(`⛽ Gas Used: ${receipt.gasUsed.toString()}`);
      
      return {
        escrowAddress,
        txHash: tx.hash,
        blockTimestamp
      };
      
    } catch (error) {
      console.error('❌ Failed to create escrow deposit:', error);
      throw error;
    }
  }

  /**
   * Create immutables structure for escrow
   */
  private createImmutables(params: DepositParams): string {
    // This is a simplified version - in a real implementation,
    // you would use the proper SDK classes to create immutables
    const immutablesData = {
      hashedSecret: params.hashedSecret,
      amount: ethers.parseEther(params.amount),
      taker: params.takerAddress,
      timelock: {
        withdrawalPeriod: BigInt(params.timelock.withdrawalPeriod),
        cancellationPeriod: BigInt(params.timelock.cancellationPeriod)
      },
      safetyDeposit: ethers.parseEther(params.safetyDeposit)
    };
    
    // For demonstration, we'll encode this as a simple structure
    // In reality, you'd use the proper SDK encoding
    return ethers.AbiCoder.defaultAbiCoder().encode(
      ['tuple(bytes32,uint256,address,tuple(uint256,uint256),uint256)'],
      [[
        params.hashedSecret,
        immutablesData.amount,
        params.takerAddress,
        [immutablesData.timelock.withdrawalPeriod, immutablesData.timelock.cancellationPeriod],
        immutablesData.safetyDeposit
      ]]
    );
  }

  /**
   * Withdraw funds from escrow using secret
   */
  async withdrawFromEscrow(
    escrowAddress: string,
    secret: string,
    immutables: string
  ): Promise<string> {
    console.log('💰 Withdrawing funds from escrow...');
    console.log(`🏠 Escrow Address: ${escrowAddress}`);
    console.log(`🔑 Secret: ${secret}`);
    
    try {
      const tx = await this.resolver.withdraw(
        escrowAddress,
        secret,
        immutables
      );
      
      console.log(`⏳ Withdrawal transaction submitted: ${tx.hash}`);
      const receipt = await tx.wait();
      
      console.log('✅ Withdrawal successful!');
      console.log(`📝 Transaction Hash: ${tx.hash}`);
      console.log(`⛽ Gas Used: ${receipt?.gasUsed.toString()}`);
      
      return tx.hash;
      
    } catch (error) {
      console.error('❌ Failed to withdraw from escrow:', error);
      throw error;
    }
  }

  /**
   * Cancel escrow and refund
   */
  async cancelEscrow(
    escrowAddress: string,
    immutables: string
  ): Promise<string> {
    console.log('❌ Cancelling escrow...');
    console.log(`🏠 Escrow Address: ${escrowAddress}`);
    
    try {
      const tx = await this.resolver.cancel(
        escrowAddress,
        immutables
      );
      
      console.log(`⏳ Cancellation transaction submitted: ${tx.hash}`);
      const receipt = await tx.wait();
      
      console.log('✅ Escrow cancelled successfully!');
      console.log(`📝 Transaction Hash: ${tx.hash}`);
      console.log(`⛽ Gas Used: ${receipt?.gasUsed.toString()}`);
      
      return tx.hash;
      
    } catch (error) {
      console.error('❌ Failed to cancel escrow:', error);
      throw error;
    }
  }
}

/**
 * Main function to handle deposit creation
 * Now accepts all parameters as arguments
 */
async function main() {
  console.log('🚀 ETH-Side Escrow Deposit Script');
  console.log('==================================');
  
  // Get all parameters from command line arguments
  const args = process.argv.slice(2);
  
  if (args.length < 8) {
    console.error('❌ Insufficient arguments provided');
    console.error('Usage: npx ts-node deposit.ts <private_key> <rpc_url> <chain_id> <network_name> <escrow_factory_address> <resolver_address> <hashed_secret> [amount] [taker_address] [withdrawal_period] [cancellation_period] [safety_deposit]');
    console.error('\nExample:');
    console.error('npx ts-node deposit.ts 0x123... https://polygon-rpc.com 137 POLYGON 0xabc... 0xdef... 0x456... 0.1 0x742d35Cc6634C0532925a3b8D4C9db96C4b4d8b6 3600 7200 0.01');
    process.exit(1);
  }
  
  const [
    privateKey,
    rpcUrl,
    chainIdStr,
    networkName,
    escrowFactoryAddress,
    resolverAddress,
    hashedSecret,
    amount = '0.1',
    takerAddress = '0x742d35Cc6634C0532925a3b8D4C9db96C4b4d8b6',
    withdrawalPeriodStr = '3600',
    cancellationPeriodStr = '7200',
    safetyDeposit = '0.01'
  ] = args;
  
  // Validate hashed secret format (should be 32 bytes = 64 hex chars)
  if (!/^0x[a-fA-F0-9]{64}$/.test(hashedSecret)) {
    console.error('❌ Invalid hashed secret format');
    console.error('Expected format: 0x followed by 64 hexadecimal characters');
    process.exit(1);
  }
  
  // Validate private key format
  if (!/^0x[a-fA-F0-9]{64}$/.test(privateKey)) {
    console.error('❌ Invalid private key format');
    console.error('Expected format: 0x followed by 64 hexadecimal characters');
    process.exit(1);
  }
  
  // Validate contract addresses
  if (!/^0x[a-fA-F0-9]{40}$/.test(escrowFactoryAddress) || !/^0x[a-fA-F0-9]{40}$/.test(resolverAddress)) {
    console.error('❌ Invalid contract address format');
    console.error('Expected format: 0x followed by 40 hexadecimal characters');
    process.exit(1);
  }
  
  // Parse numeric values
  const chainId = parseInt(chainIdStr);
  const withdrawalPeriod = parseInt(withdrawalPeriodStr);
  const cancellationPeriod = parseInt(cancellationPeriodStr);
  
  if (isNaN(chainId) || isNaN(withdrawalPeriod) || isNaN(cancellationPeriod)) {
    console.error('❌ Invalid numeric values provided');
    process.exit(1);
  }
  
  // Create network configuration
  const networkConfig: NetworkConfig = {
    rpcUrl,
    chainId,
    networkName
  };
  
  console.log(`👤 Using provided private key`);
  console.log(`🌐 Network: ${networkName}`);
  console.log(`🔗 RPC URL: ${rpcUrl}`);
  console.log(`⛓️  Chain ID: ${chainId}`);
  console.log(`🏭 Escrow Factory: ${escrowFactoryAddress}`);
  console.log(`🔧 Resolver: ${resolverAddress}`);
  
  // Create escrow deposit instance
  const escrowDeposit = new EscrowDeposit(
    privateKey,
    escrowFactoryAddress,
    resolverAddress,
    networkConfig
  );
  
  // Create deposit parameters
  const depositParams: DepositParams = {
    hashedSecret: hashedSecret,
    amount: amount,
    takerAddress: takerAddress,
    timelock: {
      withdrawalPeriod: withdrawalPeriod,
      cancellationPeriod: cancellationPeriod
    },
    safetyDeposit: safetyDeposit
  };
  
  try {
    // Create the deposit
    const result = await escrowDeposit.createDeposit(depositParams);
    
    console.log('\n🎉 Deposit created successfully!');
    console.log('===============================');
    console.log(`🏠 Escrow Address: ${result.escrowAddress}`);
    console.log(`📝 Transaction Hash: ${result.txHash}`);
    console.log(`⏰ Block Timestamp: ${result.blockTimestamp}`);
    console.log(`🔐 Hashed Secret: ${hashedSecret}`);
    
    console.log('\n📋 Next Steps:');
    console.log('==============');
    console.log('1. Share the escrow address with the counterparty');
    console.log('2. Wait for the counterparty to fund their side');
    console.log('3. Use the secret to withdraw funds when ready');
    console.log('4. Or cancel the escrow if needed');
    
  } catch (error) {
    console.error('❌ Failed to create deposit:', error);
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

export { EscrowDeposit, DepositParams, NetworkConfig }; 