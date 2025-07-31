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

// Escrow factory ABI - actual functions from the deployed contract
const ESCROW_FACTORY_ABI = [
  'function deployDst(bytes calldata immutables, uint256 privateCancellation) external payable returns (address escrow, uint256 blockTimestamp)',
  'function createDstEscrow(bytes calldata immutables, uint256 srcCancellationTimestamp) external payable returns (address escrow, uint256 blockTimestamp)',
  'function getDstEscrowAddress(bytes calldata srcImmutables, bytes calldata complement, uint256 blockTime, address taker, address implementation) external view returns (address)',
  'function getDestinationImpl() external view returns (address)',
  'function getSourceImpl() external view returns (address)'
];

// Escrow contract ABI - for withdrawal and cancellation
const ESCROW_ABI = [
  'function withdraw(bytes32 secret, bytes calldata immutables) external',
  'function cancel(bytes calldata immutables) external',
  'function publicWithdraw(bytes32 secret, bytes calldata immutables) external',
  'event EscrowWithdrawal(bytes32 secret)',
  'event EscrowCancelled()'
];

class EscrowDeposit {
  private provider: ethers.JsonRpcProvider;
  private signer: ethers.Wallet;
  private escrowFactory: ethers.Contract;
  private networkConfig: NetworkConfig;

  constructor(
    privateKey: string,
    escrowFactoryAddress: string,
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
      // Create immutables structure
      const immutables = this.createImmutables(params);
      
      // Calculate private cancellation time
      const privateCancellation = BigInt(params.timelock.cancellationPeriod);
      
      // Get current gas price
      const feeData = await this.provider.getFeeData();
      const gasPrice = feeData.gasPrice || ethers.parseUnits('2', 'gwei');
      
      console.log(`⛽ Gas Price: ${ethers.formatUnits(gasPrice, 'gwei')} gwei`);
      
      // Calculate total value to send (amount + safety deposit)
      const totalValue = ethers.parseEther(params.amount).add(ethers.parseEther(params.safetyDeposit));
      
      console.log(`💰 Total Value: ${ethers.formatEther(totalValue)} ${this.networkConfig.networkName === 'POLYGON' ? 'MATIC' : 'ETH'}`);
      
      // Deploy destination escrow using factory directly
      const tx = await this.escrowFactory.deployDst(
        immutables,
        privateCancellation,
        {
          value: totalValue,
          gasLimit: 500000
        }
      );
      
      console.log(`📝 Transaction sent: ${tx.hash}`);
      
      // Wait for transaction confirmation
      const receipt = await tx.wait();
      
      if (!receipt) {
        throw new Error('Transaction failed - no receipt received');
      }
      
      // Get the escrow address from the transaction receipt
      const escrowAddress = await this.getEscrowAddressFromReceipt(receipt, immutables);
      
      console.log(`✅ Escrow deployed successfully!`);
      console.log(`🏠 Escrow Address: ${escrowAddress}`);
      console.log(`📝 Transaction Hash: ${receipt.hash}`);
      console.log(`⏰ Block Number: ${receipt.blockNumber}`);
      
      // Get block timestamp
      const block = await this.provider.getBlock(receipt.blockNumber!);
      const blockTimestamp = block?.timestamp || 0;
      
      return {
        escrowAddress,
        txHash: receipt.hash,
        blockTimestamp
      };
      
    } catch (error) {
      console.error('❌ Failed to create escrow deposit:', error);
      throw error;
    }
  }

  /**
   * Get escrow address from transaction receipt
   */
  private async getEscrowAddressFromReceipt(receipt: ethers.TransactionReceipt, immutables: string): Promise<string> {
    try {
      // Try to get escrow address from logs
      for (const log of receipt.logs) {
        if (log.address.toLowerCase() === this.escrowFactory.target.toLowerCase()) {
          // Parse the log to get escrow address
          // This is a simplified approach - in practice you'd decode the specific event
          const escrowAddress = await this.escrowFactory.getDstEscrowAddress(
            immutables,
            '0x', // complement - simplified
            BigInt(Date.now() / 1000), // block time
            this.signer.address, // taker
            await this.escrowFactory.getDestinationImpl() // implementation
          );
          return escrowAddress;
        }
      }
      
      // Fallback: compute escrow address
      return await this.computeEscrowAddress(immutables);
      
    } catch (error) {
      console.warn('⚠️ Could not get escrow address from receipt, using fallback');
      return await this.computeEscrowAddress(immutables);
    }
  }

  /**
   * Compute escrow address
   */
  private async computeEscrowAddress(immutables: string): Promise<string> {
    try {
      const implementation = await this.escrowFactory.getDestinationImpl();
      const blockTime = BigInt(Math.floor(Date.now() / 1000));
      
      return await this.escrowFactory.getDstEscrowAddress(
        immutables,
        '0x', // complement - simplified
        blockTime,
        this.signer.address, // taker
        implementation
      );
    } catch (error) {
      console.error('❌ Failed to compute escrow address:', error);
      throw new Error('Could not determine escrow address');
    }
  }

  /**
   * Create immutables structure for escrow
   */
  private createImmutables(params: DepositParams): string {
    // This is a simplified immutables structure
    // In a real implementation, you'd need to match the exact format expected by the contract
    
    const orderHash = ethers.keccak256(ethers.toUtf8Bytes(`order_${Date.now()}`));
    const hashLock = params.hashedSecret;
    const maker = this.signer.address;
    const taker = params.takerAddress;
    const token = '0x0000000000000000000000000000000000000000'; // Native token
    const amount = ethers.parseEther(params.amount);
    const safetyDeposit = ethers.parseEther(params.safetyDeposit);
    
    // Create timelocks
    const currentTime = BigInt(Math.floor(Date.now() / 1000));
    const withdrawalTime = currentTime + BigInt(params.timelock.withdrawalPeriod);
    const cancellationTime = currentTime + BigInt(params.timelock.cancellationPeriod);
    
    // Encode immutables (simplified structure)
    const immutablesData = ethers.AbiCoder.defaultAbiCoder().encode(
      [
        'bytes32', // orderHash
        'bytes32', // hashLock
        'address', // maker
        'address', // taker
        'address', // token
        'uint256', // amount
        'uint256', // safetyDeposit
        'uint256', // withdrawalTime
        'uint256'  // cancellationTime
      ],
      [
        orderHash,
        hashLock,
        maker,
        taker,
        token,
        amount,
        safetyDeposit,
        withdrawalTime,
        cancellationTime
      ]
    );
    
    return immutablesData;
  }

  /**
   * Withdraw from escrow using secret
   */
  async withdrawFromEscrow(
    escrowAddress: string,
    secret: string,
    immutables: string
  ): Promise<string> {
    console.log(`💰 Withdrawing from escrow: ${escrowAddress}`);
    console.log(`🔑 Secret: ${secret}`);
    
    try {
      const escrowContract = new ethers.Contract(
        escrowAddress,
        ESCROW_ABI,
        this.signer
      );
      
      // Convert secret to bytes32
      const secretBytes32 = ethers.keccak256(ethers.toUtf8Bytes(secret));
      
      const tx = await escrowContract.withdraw(secretBytes32, immutables);
      console.log(`📝 Withdrawal transaction sent: ${tx.hash}`);
      
      const receipt = await tx.wait();
      console.log(`✅ Withdrawal successful! Transaction: ${receipt.hash}`);
      
      return receipt.hash;
      
    } catch (error) {
      console.error('❌ Failed to withdraw from escrow:', error);
      throw error;
    }
  }

  /**
   * Cancel escrow
   */
  async cancelEscrow(
    escrowAddress: string,
    immutables: string
  ): Promise<string> {
    console.log(`❌ Cancelling escrow: ${escrowAddress}`);
    
    try {
      const escrowContract = new ethers.Contract(
        escrowAddress,
        ESCROW_ABI,
        this.signer
      );
      
      const tx = await escrowContract.cancel(immutables);
      console.log(`📝 Cancellation transaction sent: ${tx.hash}`);
      
      const receipt = await tx.wait();
      console.log(`✅ Escrow cancelled successfully! Transaction: ${receipt.hash}`);
      
      return receipt.hash;
      
    } catch (error) {
      console.error('❌ Failed to cancel escrow:', error);
      throw error;
    }
  }

  /**
   * Get escrow factory address
   */
  getEscrowFactoryAddress(): string {
    return this.escrowFactory.target as string;
  }

  /**
   * Get signer address
   */
  getSignerAddress(): string {
    return this.signer.address;
  }
}

// Main function for command line usage
async function main() {
  const args = process.argv.slice(2);
  
  if (args.length < 6) {
    console.error('Usage: npx ts-node deposit.ts <private_key> <rpc_url> <chain_id> <network_name> <escrow_factory_address> <hashed_secret> [amount] [taker_address] [withdrawal_period] [cancellation_period] [safety_deposit]');
    console.error('');
    console.error('Example:');
    console.error('npx ts-node deposit.ts 0x1234... https://polygon-rpc.com 137 POLYGON 0xa7bcb4eac8964306f9e3764f67db6a7af6ddf99a 0xabcd... 0.01 0x742d35Cc6634C0532925a3b8D4C9db96C4b4d8b6 3600 7200 0.001');
    process.exit(1);
  }
  
  const [
    privateKey,
    rpcUrl,
    chainId,
    networkName,
    escrowFactoryAddress,
    hashedSecret,
    amount = '0.01',
    takerAddress = '0x742d35Cc6634C0532925a3b8D4C9db96C4b4d8b6',
    withdrawalPeriod = '3600',
    cancellationPeriod = '7200',
    safetyDeposit = '0.001'
  ] = args;
  
  // Validate addresses
  if (!/^0x[a-fA-F0-9]{40}$/.test(escrowFactoryAddress)) {
    console.error('❌ Invalid escrow factory address');
    process.exit(1);
  }
  
  if (!/^0x[a-fA-F0-9]{40}$/.test(takerAddress)) {
    console.error('❌ Invalid taker address');
    process.exit(1);
  }
  
  const networkConfig: NetworkConfig = {
    rpcUrl,
    chainId: parseInt(chainId),
    networkName
  };
  
  const depositParams: DepositParams = {
    hashedSecret,
    amount,
    takerAddress,
    timelock: {
      withdrawalPeriod: parseInt(withdrawalPeriod),
      cancellationPeriod: parseInt(cancellationPeriod)
    },
    safetyDeposit
  };
  
  try {
    console.log('🚀 Initializing EscrowDeposit...');
    console.log(`🔧 Escrow Factory: ${escrowFactoryAddress}`);
    console.log(`🔧 Resolver: Not needed - using factory directly`);
    
    const escrowDeposit = new EscrowDeposit(
      privateKey,
      escrowFactoryAddress,
      networkConfig
    );
    
    const result = await escrowDeposit.createDeposit(depositParams);
    
    console.log('\n🎉 Deposit created successfully!');
    console.log(`🏠 Escrow Address: ${result.escrowAddress}`);
    console.log(`📝 Transaction Hash: ${result.txHash}`);
    console.log(`⏰ Block Timestamp: ${result.blockTimestamp}`);
    
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
  EscrowDeposit, 
  DepositParams, 
  NetworkConfig 
}; 