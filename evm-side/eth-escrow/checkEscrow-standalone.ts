import { ethers } from "ethers";
import {
  createEscrowManager,
  EscrowContractManager,
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

async function main() {
  console.log(`🧪 Testing Escrow contract on ${NETWORK}...`);
  
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

    // Get initial balances
    console.log("\n💰 Checking initial balances...");
    const aliceInitialBalance = await escrowManager.getAccountBalance(escrowManager.getAliceAddress());
    const carolInitialBalance = await escrowManager.getAccountBalance(escrowManager.getCarolAddress());
    
    console.log(`👤 Alice initial balance: ${ethers.formatEther(aliceInitialBalance)} native tokens`);
    console.log(`👤 Carol initial balance: ${ethers.formatEther(carolInitialBalance)} native tokens`);

    // Test configuration
    const depositAmount = ethers.parseEther("0.0033").toString();
    const expirationTime = Math.floor(Date.now() / 1000) + 10; // 10 seconds from now
    const secret = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15); // Random secret
    const hashlock = ethers.sha256(ethers.toUtf8Bytes(secret)); // Generate SHA256 hashlock from secret (Lightning compatible)

    console.log("\n" + "=".repeat(60));
    console.log("🧪 ESCROW CONTRACT TEST");
    console.log("=".repeat(60));
    console.log(`💰 Deposit amount: ${ethers.formatEther(depositAmount)} native tokens`);
    console.log(`⏰ Expiration time: ${new Date(expirationTime * 1000).toISOString()}`);
    console.log(`🔐 Hashlock: ${hashlock}`);
    console.log("=".repeat(60));

    // Step 1: Alice deposits 0.03 native tokens
    console.log("\n📥 Step 1: Alice creating deposit...");
    
    const depositResult = await escrowManager.createDeposit({
      claimer: escrowManager.getCarolAddress(),
      expirationTime: expirationTime,
      hashlock: hashlock,
      amount: depositAmount
    });

    // Display deposit information
    await escrowManager.displayDepositInfo(depositResult.depositId);

    // Verify deposit ID matches hashlock
    console.log("\n🔍 VERIFYING DEPOSIT ID MATCHES HASHLOCK:");
    console.log(`📋 Submitted hashlock: ${hashlock}`);
    console.log(`🆔 Returned deposit ID: ${depositResult.depositId}`);
    
    if (depositResult.depositId.toLowerCase() === hashlock.toLowerCase()) {
      console.log("✅ SUCCESS: Deposit ID matches hashlock!");
    } else {
      console.log("❌ ERROR: Deposit ID does NOT match hashlock!");
      console.log("This indicates the contract is not using hashlock as deposit ID.");
      throw new Error("Deposit ID mismatch with hashlock");
    }

    // Check balances after deposit
    console.log("\n💰 Checking balances after deposit...");
    const aliceAfterDeposit = await escrowManager.getAccountBalance(escrowManager.getAliceAddress());
    const carolAfterDeposit = await escrowManager.getAccountBalance(escrowManager.getCarolAddress());
    
    const aliceDepositDiff = aliceAfterDeposit - aliceInitialBalance;
    const carolDepositDiff = carolAfterDeposit - carolInitialBalance;
    
    console.log(`👤 Alice balance after deposit: ${ethers.formatEther(aliceAfterDeposit)} native tokens (${aliceDepositDiff >= 0n ? '+' : ''}${ethers.formatEther(aliceDepositDiff)})`);
    console.log(`👤 Carol balance after deposit: ${ethers.formatEther(carolAfterDeposit)} native tokens (${carolDepositDiff >= 0n ? '+' : ''}${ethers.formatEther(carolDepositDiff)})`);

    // Step 2: Wait for user confirmation
    console.log("\n⏸️  Pausing for user confirmation...");
    console.log("Press Enter to continue with Carol's claim...");
    
    // Wait for user input
    await waitForUserInput();

    // Step 3: Carol claims the deposit
    console.log("\n📤 Step 2: Carol claiming deposit...");
    
    const claimResult = await escrowManager.claimDeposit({
      depositId: depositResult.depositId,
      secret: secret
    });

    // Check balances after claim
    console.log("\n💰 Checking balances after claim...");
    const aliceAfterClaim = await escrowManager.getAccountBalance(escrowManager.getAliceAddress());
    const carolAfterClaim = await escrowManager.getAccountBalance(escrowManager.getCarolAddress());
    
    const aliceClaimDiff = aliceAfterClaim - aliceAfterDeposit;
    const carolClaimDiff = carolAfterClaim - carolAfterDeposit;
    
    console.log(`👤 Alice balance after claim: ${ethers.formatEther(aliceAfterClaim)} native tokens (${aliceClaimDiff >= 0n ? '+' : ''}${ethers.formatEther(aliceClaimDiff)})`);
    console.log(`👤 Carol balance after claim: ${ethers.formatEther(carolAfterClaim)} native tokens (${carolClaimDiff >= 0n ? '+' : ''}${ethers.formatEther(carolClaimDiff)})`);

    // Step 4: Verify final state
    console.log("\n🔍 Verifying final state...");
    
    await escrowManager.displayDepositInfo(depositResult.depositId);
    
    const contractBalance = await escrowManager.getContractBalanceFormatted();
    console.log(`💰 Contract balance: ${contractBalance} native tokens`);

    // Calculate total changes
    const aliceTotalDiff = aliceAfterClaim - aliceInitialBalance;
    const carolTotalDiff = carolAfterClaim - carolInitialBalance;
    
    console.log("\n" + "=".repeat(60));
    console.log("🎉 ESCROW TEST COMPLETED SUCCESSFULLY!");
    console.log("=".repeat(60));
    console.log(`📥 Alice deposited: ${ethers.formatEther(depositAmount)} native tokens`);
    console.log(`📤 Carol claimed: ${ethers.formatEther(depositAmount)} native tokens`);
    console.log(`🔗 Deposit transaction: ${escrowManager.getExplorerLink(depositResult.txHash)}`);
    console.log(`🔗 Claim transaction: ${escrowManager.getExplorerLink(claimResult.txHash)}`);
    console.log("\n💰 BALANCE SUMMARY:");
    console.log(`👤 Alice total change: ${aliceTotalDiff >= 0n ? '+' : ''}${ethers.formatEther(aliceTotalDiff)} native tokens`);
    console.log(`👤 Carol total change: ${carolTotalDiff >= 0n ? '+' : ''}${ethers.formatEther(carolTotalDiff)} native tokens`);
    console.log(`📊 Net transfer: ${ethers.formatEther(carolTotalDiff - aliceTotalDiff)} native tokens`);
    console.log("=".repeat(60));

  } catch (error) {
    console.error("❌ Test failed:", error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}

/**
 * Wait for user input (simple implementation)
 * Note: In a real implementation, you might want to use a proper input library
 */
async function waitForUserInput(): Promise<void> {
  return new Promise((resolve) => {
    process.stdin.once('data', () => {
      resolve();
    });
  });
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

export { main as checkEscrow }; 