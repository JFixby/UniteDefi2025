import { ethers } from "ethers";
import {
  createEscrowManager,
  EscrowManagerConfig
} from "./deposit-standalone";
import {
  ALICE_PRIVATE_KEY,
  CAROL_PRIVATE_KEY,
  NETWORK,
  getRpcUrl,
  getChainId,
  hasValidAlicePrivateKey,
  hasValidCarolPrivateKey,
  getEscrowContractAddress
} from "./variables";

interface DepositEvent {
  depositId: string;
  depositor: string;
  claimer: string;
  amount: string;
  expirationTime: number;
  hashlock: string;
}

async function main() {
  console.log(`❌ Canceling all stuck deposits on ${NETWORK}...`);
  
  // Validate required private keys
  if (!hasValidAlicePrivateKey()) {
    console.error("❌ ALICE_PRIVATE_KEY is not set or invalid");
    process.exit(1);
  }
  
  if (!hasValidCarolPrivateKey()) {
    console.error("❌ CAROL_PRIVATE_KEY is not set or invalid");
    process.exit(1);
  }

  try {
    // Create escrow manager configuration
    const config: EscrowManagerConfig = {
      rpcUrl: getRpcUrl(),
      alicePrivateKey: ALICE_PRIVATE_KEY,
      carolPrivateKey: CAROL_PRIVATE_KEY,
      networkName: NETWORK,
      chainId: getChainId()
    };

    // Create escrow manager
    const escrowManager = await createEscrowManager(config, getEscrowContractAddress());
    
    // Display contract information
    await escrowManager.displayContractInfo();

    console.log("\n" + "=".repeat(60));
    console.log("🔍 FINDING ALL DEPOSITS");
    console.log("=".repeat(60));

    // Get all deposits by querying events
    const allDeposits = await getAllDeposits(escrowManager);
    
    if (allDeposits.length === 0) {
      console.log("📭 No deposits found in the contract");
      return;
    }

    console.log(`📋 Found ${allDeposits.length} total deposits`);

    // Filter for expired deposits that can be cancelled
    const expiredDeposits = await filterExpiredDeposits(escrowManager, allDeposits);
    
    if (expiredDeposits.length === 0) {
      console.log("✅ No expired deposits found that need cancellation");
      return;
    }

    console.log(`⏰ Found ${expiredDeposits.length} expired deposits to cancel`);

    // Get initial balances
    console.log("\n💰 Checking initial balances...");
    const aliceInitialBalance = await escrowManager.getAccountBalance(escrowManager.getAliceAddress());
    const carolInitialBalance = await escrowManager.getAccountBalance(escrowManager.getCarolAddress());
    
    console.log(`👤 Alice initial balance: ${ethers.formatEther(aliceInitialBalance)} native tokens`);
    console.log(`👤 Carol initial balance: ${ethers.formatEther(carolInitialBalance)} native tokens`);

    // Cancel each expired deposit
    console.log("\n" + "=".repeat(60));
    console.log("❌ CANCELLING EXPIRED DEPOSITS");
    console.log("=".repeat(60));

    let successCount = 0;
    let failCount = 0;
    const cancelledDeposits: string[] = [];

    for (let i = 0; i < expiredDeposits.length; i++) {
      const deposit = expiredDeposits[i];
      console.log(`\n🔄 Processing deposit ${i + 1}/${expiredDeposits.length}: ${deposit.depositId}`);
      
      try {
        // Check if deposit is already cancelled
        const depositInfo = await escrowManager.getDepositInfo(deposit.depositId);
        if (depositInfo.cancelled) {
          console.log(`⏭️  Deposit already cancelled, skipping...`);
          continue;
        }

        // Cancel the deposit
        const cancelResult = await escrowManager.cancelDeposit(deposit.depositId);
        console.log(`✅ Successfully cancelled deposit`);
        console.log(`🔗 Transaction: ${escrowManager.getExplorerLink(cancelResult.txHash)}`);
        
        successCount++;
        cancelledDeposits.push(deposit.depositId);

        // Add a small delay between transactions
        if (i < expiredDeposits.length - 1) {
          console.log("⏳ Waiting 2 seconds before next transaction...");
          await new Promise(resolve => setTimeout(resolve, 2000));
        }

      } catch (error) {
        console.error(`❌ Failed to cancel deposit ${deposit.depositId}:`, error instanceof Error ? error.message : String(error));
        failCount++;
      }
    }

    // Check final balances
    console.log("\n💰 Checking final balances...");
    const aliceFinalBalance = await escrowManager.getAccountBalance(escrowManager.getAliceAddress());
    const carolFinalBalance = await escrowManager.getAccountBalance(escrowManager.getCarolAddress());
    
    const aliceTotalDiff = aliceFinalBalance - aliceInitialBalance;
    const carolTotalDiff = carolFinalBalance - carolInitialBalance;
    
    console.log(`👤 Alice final balance: ${ethers.formatEther(aliceFinalBalance)} native tokens (${aliceTotalDiff >= 0n ? '+' : ''}${ethers.formatEther(aliceTotalDiff)})`);
    console.log(`👤 Carol final balance: ${ethers.formatEther(carolFinalBalance)} native tokens (${carolTotalDiff >= 0n ? '+' : ''}${ethers.formatEther(carolTotalDiff)})`);

    // Final summary
    console.log("\n" + "=".repeat(60));
    console.log("🎉 CANCELLATION SUMMARY");
    console.log("=".repeat(60));
    console.log(`📊 Total deposits found: ${allDeposits.length}`);
    console.log(`⏰ Expired deposits: ${expiredDeposits.length}`);
    console.log(`✅ Successfully cancelled: ${successCount}`);
    console.log(`❌ Failed to cancel: ${failCount}`);
    console.log(`💰 Contract balance: ${await escrowManager.getContractBalanceFormatted()} native tokens`);
    
    if (cancelledDeposits.length > 0) {
      console.log("\n📋 Cancelled deposit IDs:");
      cancelledDeposits.forEach((id, index) => {
        console.log(`  ${index + 1}. ${id}`);
      });
    }
    
    console.log("\n💰 BALANCE SUMMARY:");
    console.log(`👤 Alice total change: ${aliceTotalDiff >= 0n ? '+' : ''}${ethers.formatEther(aliceTotalDiff)} native tokens`);
    console.log(`👤 Carol total change: ${carolTotalDiff >= 0n ? '+' : ''}${ethers.formatEther(carolTotalDiff)} native tokens`);
    console.log("=".repeat(60));

  } catch (error) {
    console.error("❌ Script failed:", error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}

/**
 * Get all deposits by querying DepositCreated events
 */
async function getAllDeposits(escrowManager: any): Promise<DepositEvent[]> {
  const provider = escrowManager.getProvider();
  const contractAddress = escrowManager.getContractAddress();
  
  // Get the contract instance to query events
  const contract = new ethers.Contract(
    contractAddress,
    [
      "event DepositCreated(bytes32 indexed depositId, address indexed depositor, address indexed claimer, uint256 amount, uint256 expirationTime, bytes32 hashlock)"
    ],
    provider
  );

  // Query all DepositCreated events from the beginning
  const events = await contract.queryFilter("DepositCreated", 0, "latest");
  
  return events.map(event => {
    // Cast to EventLog to access args
    const eventLog = event as ethers.EventLog;
    return {
      depositId: eventLog.args[0],
      depositor: eventLog.args[1],
      claimer: eventLog.args[2],
      amount: eventLog.args[3].toString(),
      expirationTime: Number(eventLog.args[4]),
      hashlock: eventLog.args[5]
    };
  });
}

/**
 * Filter deposits to only include expired ones that can be cancelled
 */
async function filterExpiredDeposits(escrowManager: any, deposits: DepositEvent[]): Promise<DepositEvent[]> {
  const expiredDeposits: DepositEvent[] = [];
  const currentTime = Math.floor(Date.now() / 1000);

  for (const deposit of deposits) {
    // Check if deposit is expired
    if (deposit.expirationTime < currentTime) {
      // Check if deposit is not already claimed or cancelled
      try {
        const depositInfo = await escrowManager.getDepositInfo(deposit.depositId);
        if (!depositInfo.claimed && !depositInfo.cancelled) {
          expiredDeposits.push(deposit);
        }
      } catch (error) {
        console.warn(`⚠️  Could not get info for deposit ${deposit.depositId}:`, error instanceof Error ? error.message : String(error));
      }
    }
  }

  return expiredDeposits;
}

// Handle script execution
if (require.main === module) {
  main()
    .then(() => {
      console.log("\n✅ Script completed successfully");
      process.exit(0);
    })
    .catch((error) => {
      console.error("\n❌ Script failed:", error);
      process.exit(1);
    });
}

export { main as cancelAllStuckDeposits }; 