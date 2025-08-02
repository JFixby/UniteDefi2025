import { ethers } from "ethers";
import { Contract, Signer, Provider, Wallet, JsonRpcProvider } from "ethers";

// Load contract ABI directly from artifacts
const ESCROW_ABI = require("./artifacts/contracts/escrow.sol/Escrow.json").abi;



export interface DepositParams {
  claimer: string;
  expirationTime: number;
  hashlock: string; // Will be converted to bytes32
  amount: string;
}

export interface ClaimParams {
  depositId: string;
  secret: string | Uint8Array;
}

export interface DepositInfo {
  depositor: string;
  claimer: string;
  amount: string;
  expirationTime: number;
  hashlock: string; // Will be converted from bytes32
  claimed: boolean;
  cancelled: boolean;
}

export interface EscrowManagerConfig {
  rpcUrl: string;
  alicePrivateKey: string;
  carolPrivateKey: string;
  escrowAddress?: string;
  networkName?: string;
  chainId?: number;
}

export class EscrowContractManager {
  private contract!: Contract;
  private aliceSigner: Signer;
  private carolSigner: Signer;
  private provider: Provider;
  private aliceAddress!: string;
  private carolAddress!: string;
  private networkName: string;
  private chainId: number;

  constructor(config: EscrowManagerConfig) {
    this.provider = new JsonRpcProvider(config.rpcUrl);
    this.aliceSigner = new Wallet(config.alicePrivateKey, this.provider);
    this.carolSigner = new Wallet(config.carolPrivateKey, this.provider);
    this.networkName = config.networkName || "unknown";
    this.chainId = config.chainId || 1;
  }

  /**
   * Initialize the contract manager
   * @param escrowAddress Contract address
   */
  async initialize(escrowAddress: string): Promise<void> {
    // Validate private keys
    if (!this.aliceSigner) {
      throw new Error("Alice signer is not initialized");
    }
    
    if (!this.carolSigner) {
      throw new Error("Carol signer is not initialized");
    }

    this.aliceAddress = await this.aliceSigner.getAddress();
    this.carolAddress = await this.carolSigner.getAddress();

    if (!escrowAddress) {
      throw new Error("Escrow address is required");
    }

    // Create contract instance using ABI
    this.contract = new Contract(escrowAddress, ESCROW_ABI, this.aliceSigner);
  }

  /**
   * Get Alice's address
   */
  getAliceAddress(): string {
    return this.aliceAddress;
  }

  /**
   * Get Carol's address
   */
  getCarolAddress(): string {
    return this.carolAddress;
  }

  /**
   * Get contract address
   */
  getContractAddress(): string {
    return this.contract.target as string;
  }

  /**
   * Create a deposit
   * @param params Deposit parameters
   * @returns Transaction hash and deposit ID
   */
  async createDeposit(params: DepositParams): Promise<{ txHash: string; depositId: string }> {
    console.log(`📥 Creating deposit for ${ethers.formatEther(params.amount)} native tokens...`);
    
    // Convert hashlock string to bytes32
    const hashlockBytes32 = ethers.getBytes(params.hashlock);
    
    const tx = await this.contract.deposit(
      params.claimer,
      params.expirationTime,
      hashlockBytes32,
      { value: params.amount }
    );
    
    console.log(`⏳ Waiting for transaction confirmation...`);
    const receipt = await tx.wait();
    
    // Extract deposit ID from event
    const depositCreatedEvent = receipt?.logs.find((log: any) => {
      try {
        const parsed = this.contract.interface.parseLog(log);
        return parsed?.name === 'DepositCreated';
      } catch {
        return false;
      }
    });
    
    let depositId = '';
    if (depositCreatedEvent) {
      const parsed = this.contract.interface.parseLog(depositCreatedEvent);
      depositId = parsed?.args?.[0] || '';
    }
    
    console.log(`✅ Deposit created successfully!`);
    console.log(`🔗 Transaction: ${receipt?.hash}`);
    console.log(`🆔 Deposit ID: ${depositId}`);
    
    return {
      txHash: receipt?.hash || '',
      depositId: depositId
    };
  }

  /**
   * Claim a deposit
   * @param params Claim parameters
   * @returns Transaction hash
   */
  async claimDeposit(params: ClaimParams): Promise<{ txHash: string }> {
    console.log(`📤 Claiming deposit ${params.depositId}...`);
    
    // Convert secret to bytes if it's a string
    const secretBytes = typeof params.secret === 'string' 
      ? ethers.toUtf8Bytes(params.secret)
      : params.secret;
    
    // Use Carol's signer for claiming
    const contractWithCarolSigner = this.contract.connect(this.carolSigner) as any;
    const tx = await contractWithCarolSigner.claim(params.depositId, secretBytes);
    
    console.log(`⏳ Waiting for transaction confirmation...`);
    const receipt = await tx.wait();
    
    console.log(`✅ Deposit claimed successfully!`);
    console.log(`🔗 Transaction: ${receipt?.hash}`);
    
    return {
      txHash: receipt?.hash || ''
    };
  }

  /**
   * Cancel a deposit
   * @param depositId Deposit ID
   * @returns Transaction hash
   */
  async cancelDeposit(depositId: string): Promise<{ txHash: string }> {
    console.log(`❌ Cancelling deposit ${depositId}...`);
    
    // Use Alice's signer for cancelling (depositor)
    const contractWithAliceSigner = this.contract.connect(this.aliceSigner) as any;
    const tx = await contractWithAliceSigner.cancelDeposit(depositId);
    
    console.log(`⏳ Waiting for transaction confirmation...`);
    const receipt = await tx.wait();
    
    console.log(`✅ Deposit cancelled successfully!`);
    console.log(`🔗 Transaction: ${receipt?.hash}`);
    
    return {
      txHash: receipt?.hash || ''
    };
  }

  /**
   * Get deposit information
   * @param depositId Deposit ID
   * @returns Deposit information
   */
  async getDepositInfo(depositId: string): Promise<DepositInfo> {
    const deposit = await this.contract.deposits(depositId);
    
    return {
      depositor: deposit.depositor,
      claimer: deposit.claimer,
      amount: deposit.amount.toString(),
      expirationTime: Number(deposit.expirationTime),
      hashlock: ethers.hexlify(deposit.hashlock), // Convert bytes32 to hex string
      claimed: deposit.claimed,
      cancelled: deposit.cancelled
    };
  }

  /**
   * Check if deposit is expired
   * @param depositId Deposit ID
   * @returns True if expired
   */
  async isDepositExpired(depositId: string): Promise<boolean> {
    const deposit = await this.getDepositInfo(depositId);
    return Date.now() / 1000 > deposit.expirationTime;
  }

  /**
   * Get contract balance
   * @returns Balance in wei
   */
  async getContractBalance(): Promise<string> {
    return (await this.provider.getBalance(this.getContractAddress())).toString();
  }

  /**
   * Get contract balance formatted
   * @returns Balance formatted in native tokens
   */
  async getContractBalanceFormatted(): Promise<string> {
    const balance = await this.getContractBalance();
    return ethers.formatEther(balance);
  }

  /**
   * Get account balance
   * @param address Account address
   * @returns Balance in wei
   */
  async getAccountBalance(address: string): Promise<bigint> {
    return await this.provider.getBalance(address);
  }

  /**
   * Get account balance formatted
   * @param address Account address
   * @returns Balance formatted in native tokens
   */
  async getAccountBalanceFormatted(address: string): Promise<string> {
    const balance = await this.getAccountBalance(address);
    return ethers.formatEther(balance);
  }

  /**
   * Get provider instance
   * @returns Ethers provider
   */
  getProvider(): Provider {
    return this.provider;
  }

  /**
   * Get explorer link for transaction
   * @param txHash Transaction hash
   * @returns Explorer URL
   */
  getExplorerLink(txHash: string): string {
    const baseUrl = this.chainId === 137 ? "https://polygonscan.com" : 
                    this.chainId === 1 ? "https://etherscan.io" : 
                    "https://explorer.example.com";
    return `${baseUrl}/tx/${txHash}`;
  }

  /**
   * Get explorer link for contract
   * @returns Contract explorer URL
   */
  getContractExplorerLink(): string {
    const baseUrl = this.chainId === 137 ? "https://polygonscan.com" : 
                    this.chainId === 1 ? "https://etherscan.io" : 
                    "https://explorer.example.com";
    return `${baseUrl}/address/${this.getContractAddress()}`;
  }

  /**
   * Display contract information
   */
  async displayContractInfo(): Promise<void> {
    console.log("\n" + "=".repeat(60));
    console.log("📋 ESCROW CONTRACT INFORMATION");
    console.log("=".repeat(60));
    console.log(`🌐 Network: ${this.networkName}`);
    console.log(`📍 Contract: ${this.getContractAddress()}`);
    console.log(`🔗 Explorer: ${this.getContractExplorerLink()}`);
    console.log(`👤 Alice: ${this.getAliceAddress()}`);
    console.log(`👤 Carol: ${this.getCarolAddress()}`);
    console.log(`💰 Balance: ${await this.getContractBalanceFormatted()} native tokens`);
    console.log("=".repeat(60));
  }

  /**
   * Display deposit information
   * @param depositId Deposit ID
   */
  async displayDepositInfo(depositId: string): Promise<void> {
    const deposit = await this.getDepositInfo(depositId);
    const isExpired = await this.isDepositExpired(depositId);

    console.log("\n" + "=".repeat(60));
    console.log("📋 DEPOSIT INFORMATION");
    console.log("=".repeat(60));
    console.log(`🆔 Deposit ID: ${depositId}`);
    console.log(`👤 Depositor: ${deposit.depositor}`);
    console.log(`👤 Claimer: ${deposit.claimer}`);
    console.log(`💰 Amount: ${ethers.formatEther(deposit.amount)} native tokens`);
    console.log(`⏰ Expiration: ${new Date(deposit.expirationTime * 1000).toISOString()}`);
    console.log(`🔐 Hashlock: ${deposit.hashlock}`);
    console.log(`✅ Claimed: ${deposit.claimed ? "Yes" : "No"}`);
    console.log(`❌ Cancelled: ${deposit.cancelled ? "Yes" : "No"}`);
    console.log(`⏰ Expired: ${isExpired ? "Yes" : "No"}`);
    console.log("=".repeat(60));
  }
}

// Export a factory function for easy usage
export async function createEscrowManager(config: EscrowManagerConfig, escrowAddress: string): Promise<EscrowContractManager> {
  const manager = new EscrowContractManager(config);
  await manager.initialize(escrowAddress);
  return manager;
} 