import { ethers } from "hardhat";
import { Contract, Signer, Provider, Wallet, JsonRpcProvider } from "ethers";
import {
  getEscrowContract,
  loadDeploymentInfo
} from "./deployEscrowContractHelpers";

export interface DepositParams {
  claimer: string;
  expirationTime: number;
  hashlock: string;
  amount: string;
}

export interface ClaimParams {
  depositId: string;
  secret: string;
}

export interface DepositInfo {
  depositor: string;
  claimer: string;
  amount: string;
  expirationTime: number;
  hashlock: string;
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
   * @param escrowAddress Optional contract address, will load from deployment info if not provided
   */
  async initialize(escrowAddress?: string): Promise<void> {
    // Validate private keys
    if (!this.aliceSigner) {
      throw new Error("Alice signer is not initialized");
    }
    
    if (!this.carolSigner) {
      throw new Error("Carol signer is not initialized");
    }

    this.aliceAddress = await this.aliceSigner.getAddress();
    this.carolAddress = await this.carolSigner.getAddress();

    // Load contract address if not provided
    if (!escrowAddress) {
      try {
        const deploymentInfo = loadDeploymentInfo();
        escrowAddress = deploymentInfo.address;
      } catch (error) {
        throw new Error("No deployment info found. Please deploy the contract first.");
      }
    }

    if (!escrowAddress) {
      throw new Error("Escrow address is required");
    }

    this.contract = await getEscrowContract(escrowAddress, this.aliceSigner);
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
   * Get the contract address
   */
  getContractAddress(): string {
    return this.contract.target as string;
  }

  /**
   * Create a new deposit
   */
  async createDeposit(params: DepositParams): Promise<{ txHash: string; depositId: string }> {
    const amount = ethers.parseEther(params.amount);
    
    const tx = await (this.contract as any).connect(this.aliceSigner).deposit(
      params.claimer,
      params.expirationTime,
      params.hashlock,
      { value: amount }
    );

    console.log(`📦 Creating deposit...`);
    console.log(`🔗 Transaction hash: ${tx.hash}`);
    
    const receipt = await tx.wait();
    
    // Find the DepositCreated event
    const depositEvent = receipt?.logs.find((log: any) => {
      try {
        const parsedLog = this.contract.interface.parseLog(log);
        return parsedLog?.name === "DepositCreated";
      } catch {
        return false;
      }
    });

    if (!depositEvent) {
      throw new Error("DepositCreated event not found in transaction receipt");
    }

    const parsedEvent = this.contract.interface.parseLog(depositEvent);
    const depositId = parsedEvent?.args?.[0];

    console.log(`✅ Deposit created successfully!`);
    console.log(`🆔 Deposit ID: ${depositId}`);
    
    return {
      txHash: tx.hash,
      depositId: depositId
    };
  }

  /**
   * Claim a deposit using the secret
   */
  async claimDeposit(params: ClaimParams): Promise<{ txHash: string }> {
    const tx = await (this.contract as any).connect(this.carolSigner).claim(
      params.depositId,
      params.secret
    );

    console.log(`🔓 Claiming deposit...`);
    console.log(`🔗 Transaction hash: ${tx.hash}`);
    
    await tx.wait();
    
    console.log(`✅ Deposit claimed successfully!`);
    
    return {
      txHash: tx.hash
    };
  }

  /**
   * Cancel a deposit (only by depositor after expiration)
   */
  async cancelDeposit(depositId: string): Promise<{ txHash: string }> {
    const tx = await (this.contract as any).connect(this.aliceSigner).cancelDeposit(depositId);
    
    console.log(`❌ Cancelling deposit...`);
    console.log(`🔗 Transaction hash: ${tx.hash}`);
    
    await tx.wait();
    
    console.log(`✅ Deposit cancelled successfully!`);
    
    return {
      txHash: tx.hash
    };
  }

  /**
   * Get deposit information
   * @param depositId Deposit ID
   * @returns Deposit information
   */
  async getDepositInfo(depositId: string): Promise<DepositInfo> {
    const deposit = await this.contract.getDeposit(depositId);
    
    return {
      depositor: deposit.depositor,
      claimer: deposit.claimer,
      amount: deposit.amount.toString(),
      expirationTime: deposit.expirationTime,
      hashlock: deposit.hashlock,
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
    return await this.contract.isExpired(depositId);
  }

  /**
   * Get contract balance
   * @returns Contract balance in wei
   */
  async getContractBalance(): Promise<string> {
    const balance = await this.contract.getBalance();
    return balance.toString();
  }

  /**
   * Get contract balance formatted in native tokens
   * @returns Contract balance formatted
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
export async function createEscrowManager(config: EscrowManagerConfig, escrowAddress?: string): Promise<EscrowContractManager> {
  const manager = new EscrowContractManager(config);
  await manager.initialize(escrowAddress);
  return manager;
} 