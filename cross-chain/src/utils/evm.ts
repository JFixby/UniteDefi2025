import { ethers } from 'ethers';
import {
  ALICE_PRIVATE_KEY,
  CAROL_PRIVATE_KEY,
  getRpcUrl,
  getChainId,
  getEscrowContractAddress,
  hasValidAlicePrivateKey,
  hasValidCarolPrivateKey,
  getTransactionUrl
} from '../variables';

// Escrow contract ABI - simplified version for deposit function
const ESCROW_ABI = [
  "function deposit(address claimer, uint256 expirationTime, bytes32 hashlock) external payable",
  "function claim(bytes32 depositId, bytes memory secret) external",
  "function getDeposit(bytes32 depositId) external view returns (address depositor, address claimer, uint256 amount, uint256 expirationTime, bytes32 hashlock, bool claimed, bool cancelled)",
  "function isExpired(bytes32 depositId) external view returns (bool)",
  "function getBalance() external view returns (uint256)",
  "event DepositCreated(bytes32 indexed depositId, address indexed depositor, address indexed claimer, uint256 amount, uint256 expirationTime, bytes32 hashlock)",
  "event DepositClaimed(bytes32 indexed depositId, address indexed claimer, bytes secret)"
];

export interface DepositETHParams {
  amountEth: number;
  hashedSecret: string;
  expirationSeconds: number;
  depositorPrivateKey: string;
  claimerAddress: string;
}

export interface DepositETHResult {
  depositId: string;
  txHash: string;
  explorerUrl: string;
  escrowAddress: string;
  amountWei: string;
  expirationTime: number;
}

/**
 * Deposits ETH into the escrow contract using HTLC
 * @param params - Deposit parameters
 * @returns Promise<DepositETHResult> - Transaction details and deposit information
 */
export async function depositETH(params: DepositETHParams): Promise<DepositETHResult> {
  try {
    console.log(`💰 Depositing ${params.amountEth} ETH into escrow...`);
    
    // Validate private key
    if (!params.depositorPrivateKey || params.depositorPrivateKey.length === 0) {
      throw new Error('Depositor private key is required');
    }

    // Setup provider and signer
    const provider = new ethers.JsonRpcProvider(getRpcUrl());
    const depositorSigner = new ethers.Wallet(params.depositorPrivateKey, provider);
    
    // Get depositor address
    const depositorAddress = await depositorSigner.getAddress();
    
    // Validate claimer address
    if (!params.claimerAddress || params.claimerAddress.length === 0) {
      throw new Error('Claimer address is required');
    }
    
    // Convert ETH to Wei
    const amountWei = ethers.parseEther(params.amountEth.toString());
    
    // Calculate expiration time (current time + expiration seconds)
    const currentTime = Math.floor(Date.now() / 1000);
    const expirationTime = currentTime + params.expirationSeconds;
    
    // Convert hashed secret to bytes32
    const hashlockBytes32 = ethers.getBytes(params.hashedSecret);
    
    // Get escrow contract address
    const escrowAddress = getEscrowContractAddress();
    
    // Create contract instance
    const escrowContract = new ethers.Contract(escrowAddress, ESCROW_ABI, depositorSigner);
    
    console.log(`📋 Deposit Details:`);
    console.log(`   Amount: ${params.amountEth} ETH (${amountWei.toString()} Wei)`);
    console.log(`   Depositor: ${depositorAddress}`);
    console.log(`   Claimer: ${params.claimerAddress}`);
    console.log(`   Hashlock: ${params.hashedSecret}`);
    console.log(`   Expiration: ${new Date(expirationTime * 1000).toISOString()}`);
    console.log(`   Escrow Contract: ${escrowAddress}`);
    
    // Check depositor's balance
    const depositorBalance = await provider.getBalance(depositorAddress);
    if (depositorBalance < amountWei) {
      throw new Error(`Insufficient balance. Depositor has ${ethers.formatEther(depositorBalance)} ETH but needs ${params.amountEth} ETH`);
    }
    
    // Create deposit transaction
    const tx = await escrowContract.deposit(
      params.claimerAddress,
      expirationTime,
      hashlockBytes32,
      { value: amountWei }
    );
    
    console.log(`⏳ Waiting for transaction confirmation...`);
    console.log(`🔗 Transaction Hash: ${tx.hash}`);
    
    // Wait for transaction confirmation
    const receipt = await tx.wait();
    
    if (!receipt) {
      throw new Error('Transaction failed - no receipt received');
    }
    
    // Extract deposit ID from event
    let depositId = '';
    const depositCreatedEvent = receipt.logs.find((log: any) => {
      try {
        const parsed = escrowContract.interface.parseLog(log);
        return parsed?.name === 'DepositCreated';
      } catch {
        return false;
      }
    });
    
    if (depositCreatedEvent) {
      const parsed = escrowContract.interface.parseLog(depositCreatedEvent);
      depositId = parsed?.args?.[0] || '';
    }
    
    // Generate explorer URL
    const explorerUrl = getTransactionUrl(receipt.hash);
    
    console.log(`✅ ETH deposit successful!`);
    console.log(`🆔 Deposit ID: ${depositId}`);
    console.log(`🔗 Transaction: ${receipt.hash}`);
    console.log(`🌐 Explorer: ${explorerUrl}`);
    console.log(`⏰ Block Number: ${receipt.blockNumber}`);
    
    return {
      depositId,
      txHash: receipt.hash,
      explorerUrl,
      escrowAddress,
      amountWei: amountWei.toString(),
      expirationTime
    };
    
  } catch (error) {
    console.error('❌ Failed to deposit ETH:', error);
    throw error;
  }
}

/**
 * Validates if the escrow contract is accessible
 * @returns Promise<boolean> - True if contract is accessible
 */
export async function validateEscrowContract(): Promise<boolean> {
  try {
    const provider = new ethers.JsonRpcProvider(getRpcUrl());
    const escrowAddress = getEscrowContractAddress();
    
    // Try to get contract code
    const code = await provider.getCode(escrowAddress);
    
    if (code === '0x') {
      console.error(`❌ No contract found at address: ${escrowAddress}`);
      return false;
    }
    
    console.log(`✅ Escrow contract is accessible at: ${escrowAddress}`);
    return true;
  } catch (error) {
    console.error('❌ Failed to validate escrow contract:', error);
    return false;
  }
}

export interface CheckDepositResult {
  exists: boolean;
  amount: string;
  depositor: string;
  claimer: string;
  claimed: boolean;
  cancelled: boolean;
  expired: boolean;
}

/**
 * Checks if a deposit exists in the escrow contract with the specified amount
 * @param hashedSecret - The hashlock used as deposit ID
 * @param expectedAmountEth - Expected ETH amount (optional, for validation)
 * @returns Promise<CheckDepositResult> - Deposit details and status
 */
export async function checkDepositEVM(hashedSecret: string, expectedAmountEth?: number): Promise<CheckDepositResult> {
  try {
    console.log(`🔍 Checking escrow deposit...`);
    console.log(`   Deposit ID (hashed secret): ${hashedSecret}`);
    
    // Setup provider (read-only, no signer needed)
    const provider = new ethers.JsonRpcProvider(getRpcUrl());
    const escrowAddress = getEscrowContractAddress();
    
    // Create contract instance (read-only)
    const escrowContract = new ethers.Contract(escrowAddress, ESCROW_ABI, provider);
    
    // Convert hashed secret to bytes32
    const hashlockBytes32 = ethers.getBytes(hashedSecret);
    
    // Call getDeposit function
    const [depositor, claimer, amount, expirationTime, hashlock, claimed, cancelled] = 
      await escrowContract.getDeposit(hashlockBytes32);
    
    // Check if deposit exists (depositor is not zero address)
    const exists = depositor !== ethers.ZeroAddress;
    
    if (!exists) {
      //console.log(`❌ No deposit found for hashlock: ${hashedSecret}`);
      return {
        exists: false,
        amount: '0',
        depositor: ethers.ZeroAddress,
        claimer: ethers.ZeroAddress,
        claimed: false,
        cancelled: false,
        expired: false
      };
    }
    
    // Check if deposit is expired
    const isExpired = await escrowContract.isExpired(hashlockBytes32);
    
    // Convert amount from Wei to ETH for display
    const amountEth = ethers.formatEther(amount);
    
    console.log(`✅ Deposit found!`);
    console.log(`   Amount: ${amountEth} ETH (${amount.toString()} Wei)`);
    console.log(`   Depositor: ${depositor}`);
    console.log(`   Claimer: ${claimer}`);
    console.log(`   Claimed: ${claimed}`);
    console.log(`   Cancelled: ${cancelled}`);
    console.log(`   Expired: ${isExpired}`);
    console.log(`   Expiration: ${new Date(Number(expirationTime) * 1000).toISOString()}`);
    
    // Validate amount if expected amount is provided
    if (expectedAmountEth !== undefined) {
      const expectedAmountWei = ethers.parseEther(expectedAmountEth.toString());
      const amountMatches = amount === expectedAmountWei;
      
      if (!amountMatches) {
        console.log(`⚠️  Amount mismatch! Expected: ${expectedAmountEth} ETH, Found: ${amountEth} ETH`);
      } else {
        console.log(`✅ Amount matches expected: ${expectedAmountEth} ETH`);
      }
    }
    
    return {
      exists: true,
      amount: amountEth,
      depositor,
      claimer,
      claimed,
      cancelled,
      expired: isExpired
    };
    
  } catch (error) {
    console.error('❌ Failed to check deposit:', error);
    throw error;
  }
} 

export interface ClaimETHParams {
  depositId: string;
  secret: string;
  claimerPrivateKey: string;
}

export interface ClaimETHResult {
  txHash: string;
  explorerUrl: string;
  secret: string;
}

/**
 * Claims ETH from the escrow contract using the secret
 * @param params - Claim parameters
 * @returns Promise<ClaimETHResult> - Transaction details
 */
export async function claimETH(params: ClaimETHParams): Promise<ClaimETHResult> {
  try {
    console.log(`📤 Claiming ETH deposit...`);
    console.log(`   Deposit ID: ${params.depositId}`);
    
    // Validate private key
    if (!params.claimerPrivateKey || params.claimerPrivateKey.length === 0) {
      throw new Error('Claimer private key is required');
    }

    // Validate secret
    if (!params.secret || params.secret.length === 0) {
      throw new Error('Secret is required');
    }

    // Setup provider and signer
    const provider = new ethers.JsonRpcProvider(getRpcUrl());
    const claimerSigner = new ethers.Wallet(params.claimerPrivateKey, provider);
    
    // Get claimer address
    const claimerAddress = await claimerSigner.getAddress();
    
    // Convert deposit ID to bytes32
    const depositIdBytes32 = ethers.getBytes(params.depositId);
    
    // Convert secret to bytes
    const secretBytes = ethers.toUtf8Bytes(params.secret);
    
    // Get escrow contract address
    const escrowAddress = getEscrowContractAddress();
    
    // Create contract instance with claimer signer
    const escrowContract = new ethers.Contract(escrowAddress, ESCROW_ABI, claimerSigner);
    
    console.log(`📋 Claim Details:`);
    console.log(`   Deposit ID: ${params.depositId}`);
    console.log(`   Claimer: ${claimerAddress}`);
    console.log(`   Secret: ${params.secret}`);
    console.log(`   Escrow Contract: ${escrowAddress}`);
    
    // First check if deposit exists and is claimable
    const depositCheck = await checkDepositEVM(params.depositId);
    
    if (!depositCheck.exists) {
      throw new Error(`No deposit found with ID: ${params.depositId}`);
    }
    
    if (depositCheck.claimed) {
      console.log(`Deposit ${params.depositId} has already been claimed`);
    }
    
    if (depositCheck.cancelled) {
      throw new Error(`Deposit ${params.depositId} has been cancelled`);
    }
 
    // Verify the claimer address matches
    if (depositCheck.claimer.toLowerCase() !== claimerAddress.toLowerCase()) {
      throw new Error(`Only the designated claimer (${depositCheck.claimer}) can claim this deposit. Current signer: ${claimerAddress}`);
    }
    
    console.log(`✅ Deposit validation passed. Proceeding with claim...`);
    
    // Create claim transaction
    const tx = await escrowContract.claim(depositIdBytes32, secretBytes);
    
    console.log(`⏳ Waiting for transaction confirmation...`);
    console.log(`🔗 Transaction Hash: ${tx.hash}`);
    
    // Wait for transaction confirmation
    const receipt = await tx.wait();
    
    if (!receipt) {
      throw new Error('Transaction failed - no receipt received');
    }
    
    // Generate explorer URL
    const explorerUrl = getTransactionUrl(receipt.hash);
    
    console.log(`✅ ETH claim successful!`);
    console.log(`🔗 Transaction: ${receipt.hash}`);
    console.log(`🌐 Explorer: ${explorerUrl}`);
    console.log(`⏰ Block Number: ${receipt.blockNumber}`);
    console.log(`💰 Amount claimed: ${depositCheck.amount} ETH`);
    
    return {
      txHash: receipt.hash,
      explorerUrl,
      secret: params.secret
    };
    
  } catch (error) {
    console.error('❌ Failed to claim ETH:', error);
    throw error;
  }
} 