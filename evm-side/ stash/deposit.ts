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

// BTCEscrowFactory ABI - our custom factory contract
const BTCEscrowFactory_ABI = [
  'function createSrcEscrow(tuple(bytes32 orderHash, bytes32 hashlock, uint256 maker, uint256 taker, uint256 token, uint256 amount, uint256 safetyDeposit, uint256 timelocks) immutables) external payable returns (address escrow, uint256 blockTimestamp)',
  'function createDstEscrow(tuple(bytes32 orderHash, bytes32 hashlock, uint256 maker, uint256 taker, uint256 token, uint256 amount, uint256 safetyDeposit, uint256 timelocks) immutables, uint256 srcCancellationTimestamp) external payable returns (address escrow, uint256 blockTimestamp)',
  'function addressOfEscrowSrc(tuple(bytes32 orderHash, bytes32 hashlock, uint256 maker, uint256 taker, uint256 token, uint256 amount, uint256 safetyDeposit, uint256 timelocks) immutables) external view returns (address)',
  'function addressOfEscrowDst(tuple(bytes32 orderHash, bytes32 hashlock, uint256 maker, uint256 taker, uint256 token, uint256 amount, uint256 safetyDeposit, uint256 timelocks) immutables) external view returns (address)',
  'function withdraw(address escrowAddress, bytes32 secret, tuple(bytes32 orderHash, bytes32 hashlock, uint256 maker, uint256 taker, uint256 token, uint256 amount, uint256 safetyDeposit, uint256 timelocks) immutables) external',
  'function cancel(address escrowAddress, tuple(bytes32 orderHash, bytes32 hashlock, uint256 maker, uint256 taker, uint256 token, uint256 amount, uint256 safetyDeposit, uint256 timelocks) immutables) external',
  'function getCreationFee() external view returns (uint256)',
  'function creationFee() external view returns (uint256)',
  'event EscrowCreated(address indexed escrow, bytes32 indexed orderHash, address indexed maker, address taker, uint256 amount, bytes32 hashlock)',
  'event EscrowWithdrawn(address indexed escrow, bytes32 indexed secret, address indexed taker)',
  'event EscrowCancelled(address indexed escrow, address indexed maker)'
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
  private static factoryAddress: string | null = null;

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
      BTCEscrowFactory_ABI,
      this.signer
    );
  }

  /**
   * Deploy TestEscrowFactory contract
   */
  static async deployFactory(
    privateKey: string,
    networkConfig: NetworkConfig
  ): Promise<string> {
    if (EscrowDeposit.factoryAddress) {
      console.log(`🏭 Using existing factory: ${EscrowDeposit.factoryAddress}`);
      return EscrowDeposit.factoryAddress;
    }

    console.log('🏭 Deploying TestEscrowFactory contract...');
    
    const provider = new ethers.JsonRpcProvider(networkConfig.rpcUrl);
    const signer = new ethers.Wallet(privateKey, provider);
    
    // TestEscrowFactory bytecode (you'll need to compile this)
    const TestEscrowFactory_Bytecode = "0x..."; // This will be filled after compilation
    
    try {
      // Deploy the contract with constructor parameters matching cross-chain-resolver-example
      const factory = new ethers.ContractFactory(
        BTCEscrowFactory_ABI,
        TestEscrowFactory_Bytecode,
        signer
      );
      
      // Constructor parameters from cross-chain-resolver-example
      const limitOrderProtocol = "0x111111125421ca6dc452d289314280a0f8842a65"; // 1inch LOP
      const feeToken = "0x0000000000000000000000000000000000000000"; // ETH
      const accessToken = "0x0000000000000000000000000000000000000000"; // No access token
      const owner = signer.address;
      const rescueDelaySrc = 1800; // 30 minutes
      const rescueDelayDst = 1800; // 30 minutes
      
      const deployedFactory = await factory.deploy(
        limitOrderProtocol,
        feeToken,
        accessToken,
        owner,
        rescueDelaySrc,
        rescueDelayDst
      );
      await deployedFactory.waitForDeployment();
      
      const factoryAddress = await deployedFactory.getAddress();
      EscrowDeposit.factoryAddress = factoryAddress;
      
      console.log(`✅ TestEscrowFactory deployed to: ${factoryAddress}`);
      console.log(`🔍 Explorer: ${networkConfig.networkName === 'POLYGON' ? 'https://polygonscan.com' : 'https://etherscan.io'}/address/${factoryAddress}`);
      
      return factoryAddress;
      
    } catch (error) {
      console.error('❌ Failed to deploy TestEscrowFactory:', error);
      throw error;
    }
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
    console.log(`🏭 Escrow Factory Contract: ${this.escrowFactory.target}`);
    console.log(`🔧 Contract Type: 1inch EscrowFactory`);
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
      const totalValue = ethers.parseEther(params.amount) + ethers.parseEther(params.safetyDeposit);
      
      console.log(`💰 Total Value: ${ethers.formatEther(totalValue)} ${this.networkConfig.networkName === 'POLYGON' ? 'MATIC' : 'ETH'}`);
      
      // Deploy destination escrow using factory directly
      console.log(`🔧 Immutables data: ${immutables}`);
      console.log(`⏰ Private cancellation: ${privateCancellation}`);
      console.log(`💰 Total value: ${totalValue}`);
      
      // Try to get the escrow address first to validate our immutables
      try {
        const escrowAddress = await this.escrowFactory.addressOfEscrowSrc(immutables);
        console.log(`🏠 Calculated escrow address: ${escrowAddress}`);
      } catch (error) {
        console.log(`⚠️ Could not calculate escrow address: ${error}`);
      }
      
      console.log(`🔧 Calling function: createSrcEscrow`);
      console.log(`📦 Immutables structure:`);
      console.log(`   Order Hash: ${immutables.orderHash}`);
      console.log(`   Hashlock: ${immutables.hashlock}`);
      console.log(`   Maker (uint256): ${immutables.maker.toString()}`);
      console.log(`   Taker (uint256): ${immutables.taker.toString()}`);
      console.log(`   Token (uint256): ${immutables.token.toString()}`);
      console.log(`   Amount: ${immutables.amount.toString()}`);
      console.log(`   Safety Deposit: ${immutables.safetyDeposit.toString()}`);
      console.log(`   Timelocks: ${immutables.timelocks.toString()}`);
      
      const tx = await this.escrowFactory.createSrcEscrow(
        immutables,
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
        if (log.address.toLowerCase() === this.escrowFactory.target.toString().toLowerCase()) {
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
  private createImmutables(params: DepositParams): any {
    // Create order hash
    const orderHash = ethers.keccak256(ethers.toUtf8Bytes(`order_${Date.now()}`));
    
    // Pack timelocks according to the contract format
    const now = BigInt(Math.floor(Date.now() / 1000));
    const withdrawalPeriod = BigInt(params.timelock.withdrawalPeriod);
    const publicWithdrawal = withdrawalPeriod * 2n; // Public withdrawal is 2x withdrawal period
    const cancellationPeriod = BigInt(params.timelock.cancellationPeriod);
    
    // Pack timelocks: (now << 224) | (cancellation << 64) | (publicWithdrawal << 32) | withdrawal
    const timelocks = (now << 224n) |
                     (cancellationPeriod << 64n) |
                     (publicWithdrawal << 32n) |
                     withdrawalPeriod;
    
    // Create immutables object matching the contract structure
    const immutables = {
      orderHash: orderHash,
      hashlock: params.hashedSecret,
      maker: BigInt(this.signer.address),      // Convert address to uint256
      taker: BigInt(params.takerAddress),      // Convert address to uint256
      token: BigInt(ethers.ZeroAddress),       // Native token (ETH/MATIC)
      amount: ethers.parseEther(params.amount),
      safetyDeposit: ethers.parseEther(params.safetyDeposit),
      timelocks: timelocks
    };
    
    return immutables;
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