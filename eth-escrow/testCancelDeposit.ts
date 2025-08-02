import { ethers } from "ethers";
import SHA256 from "crypto-js/sha256";
import Hex from "crypto-js/enc-hex";
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
  console.log(`🧪 Testing Cancel Deposit functionality on ${NETWORK}...`);
  
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

    // Test configuration - short expiration time for testing
    const depositAmount = ethers.parseEther("0.002").toString();
    const expirationTime = Math.floor(Date.now() / 1000) + 5; // 5 seconds from now
    const secret = "cancelTestSecret123";
    const hashlock = "0x" + SHA256(secret).toString(Hex);

    console.log("\n" + "=".repeat(60));
    console.log("🧪 CANCEL DEPOSIT TEST");
    console.log("=".repeat(60));
    console.log(`💰 Deposit amount: ${ethers.formatEther(depositAmount)} native tokens`);
    console.log(`⏰ Expiration time: ${new Date(expirationTime * 1000).toISOString()}`);
    console.log(`🔐 Hashlock: ${hashlock}`);
    console.log("=".repeat(60));

    // Step 1: Alice creates a deposit with short expiration
    console.log("\n📥 Step 1: Alice creating deposit with short expiration...");
    
    const depositResult = await escrowManager.createDeposit({
      claimer: escrowManager.getCarolAddress(),
      expirationTime: expirationTime,
      hashlock: hashlock,
      amount: depositAmount
    });

    // Display deposit information
    await escrowManager.displayDepositInfo(depositResult.depositId);

    // Check balances after deposit
    console.log("\n💰 Checking balances after deposit...");
    const aliceAfterDeposit = await escrowManager.getAccountBalance(escrowManager.getAliceAddress());
    const carolAfterDeposit = await escrowManager.getAccountBalance(escrowManager.getCarolAddress());
    
    const aliceDepositDiff = aliceAfterDeposit - aliceInitialBalance;
    const carolDepositDiff = carolAfterDeposit - carolInitialBalance;
    
    console.log(`👤 Alice balance after deposit: ${ethers.formatEther(aliceAfterDeposit)} native tokens (${aliceDepositDiff >= 0n ? '+' : ''}${ethers.formatEther(aliceDepositDiff)})`);
    console.log(`👤 Carol balance after deposit: ${ethers.formatEther(carolAfterDeposit)} native tokens (${carolDepositDiff >= 0n ? '+' : ''}${ethers.formatEther(carolDepositDiff)})`);

    // Step 2: Wait for expiration
    console.log("\n⏰ Step 2: Waiting for deposit to expire...");
    const waitTime = 6; // Wait 6 seconds to ensure expiration
    console.log(`⏳ Waiting ${waitTime} seconds for expiration...`);
    
    await new Promise(resolve => setTimeout(resolve, waitTime * 1000));
    
    console.log("✅ Deposit should now be expired");

    // Step 3: Check if deposit is expired
    console.log("\n🔍 Step 3: Checking if deposit is expired...");
    const isExpired = await escrowManager.isDepositExpired(depositResult.depositId);
    console.log(`⏰ Deposit expired: ${isExpired ? 'Yes' : 'No'}`);

    if (!isExpired) {
      console.log("⚠️  Deposit not yet expired, waiting a bit more...");
      await new Promise(resolve => setTimeout(resolve, 2000));
    }

    // Step 4: Alice cancels the expired deposit
    console.log("\n❌ Step 4: Alice canceling expired deposit...");
    
    const cancelResult = await escrowManager.cancelDeposit(depositResult.depositId);

    // Check balances after cancellation
    console.log("\n💰 Checking balances after cancellation...");
    const aliceAfterCancel = await escrowManager.getAccountBalance(escrowManager.getAliceAddress());
    const carolAfterCancel = await escrowManager.getAccountBalance(escrowManager.getCarolAddress());
    
    const aliceCancelDiff = aliceAfterCancel - aliceAfterDeposit;
    const carolCancelDiff = carolAfterCancel - carolAfterDeposit;
    
    console.log(`👤 Alice balance after cancel: ${ethers.formatEther(aliceAfterCancel)} native tokens (${aliceCancelDiff >= 0n ? '+' : ''}${ethers.formatEther(aliceCancelDiff)})`);
    console.log(`👤 Carol balance after cancel: ${ethers.formatEther(carolAfterCancel)} native tokens (${carolCancelDiff >= 0n ? '+' : ''}${ethers.formatEther(carolCancelDiff)})`);

    // Step 5: Verify final state
    console.log("\n🔍 Step 5: Verifying final state...");
    await escrowManager.displayDepositInfo(depositResult.depositId);
    
    const contractBalance = await escrowManager.getContractBalanceFormatted();
    console.log(`💰 Contract balance: ${contractBalance} native tokens`);

    // Calculate total changes
    const aliceTotalDiff = aliceAfterCancel - aliceInitialBalance;
    const carolTotalDiff = carolAfterCancel - carolInitialBalance;
    
    console.log("\n" + "=".repeat(60));
    console.log("🎉 CANCEL DEPOSIT TEST COMPLETED SUCCESSFULLY!");
    console.log("=".repeat(60));
    console.log(`📥 Alice deposited: ${ethers.formatEther(depositAmount)} native tokens`);
    console.log(`❌ Alice cancelled: ${ethers.formatEther(depositAmount)} native tokens`);
    console.log(`🔗 Deposit transaction: ${escrowManager.getExplorerLink(depositResult.txHash)}`);
    console.log(`🔗 Cancel transaction: ${escrowManager.getExplorerLink(cancelResult.txHash)}`);
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

export { main as testCancelDeposit }; 