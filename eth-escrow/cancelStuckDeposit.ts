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

async function main() {
  console.log(`❌ Canceling stuck deposit on ${NETWORK}...`);
  
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

    // The stuck deposit ID from the previous test
    const stuckDepositId = "0xecb98900299c2134578dfe2eb4e6ddc1f0e2004596cadf34592e77e324ed2525";

    console.log("\n" + "=".repeat(60));
    console.log("❌ CANCELING STUCK DEPOSIT");
    console.log("=".repeat(60));
    console.log(`🆔 Deposit ID: ${stuckDepositId}`);
    console.log("=".repeat(60));

    // Check deposit status before cancellation
    console.log("\n📋 Checking deposit status...");
    await escrowManager.displayDepositInfo(stuckDepositId);

    // Check if deposit is expired
    console.log("\n🔍 Checking if deposit is expired...");
    const isExpired = await escrowManager.isDepositExpired(stuckDepositId);
    console.log(`⏰ Deposit expired: ${isExpired ? 'Yes' : 'No'}`);

    if (!isExpired) {
      console.log("❌ Deposit is not expired yet. Cannot cancel.");
      console.log("⏳ Waiting for expiration...");
      process.exit(1);
    }

    // Get initial balances
    console.log("\n💰 Checking initial balances...");
    const aliceInitialBalance = await escrowManager.getAccountBalance(escrowManager.getAliceAddress());
    const carolInitialBalance = await escrowManager.getAccountBalance(escrowManager.getCarolAddress());
    
    console.log(`👤 Alice initial balance: ${ethers.formatEther(aliceInitialBalance)} native tokens`);
    console.log(`👤 Carol initial balance: ${ethers.formatEther(carolInitialBalance)} native tokens`);

    // Cancel the stuck deposit
    console.log("\n❌ Canceling stuck deposit...");
    
    const cancelResult = await escrowManager.cancelDeposit(stuckDepositId);

    // Check balances after cancellation
    console.log("\n💰 Checking balances after cancellation...");
    const aliceAfterCancel = await escrowManager.getAccountBalance(escrowManager.getAliceAddress());
    const carolAfterCancel = await escrowManager.getAccountBalance(escrowManager.getCarolAddress());
    
    const aliceCancelDiff = aliceAfterCancel - aliceInitialBalance;
    const carolCancelDiff = carolAfterCancel - carolInitialBalance;
    
    console.log(`👤 Alice balance after cancel: ${ethers.formatEther(aliceAfterCancel)} native tokens (${aliceCancelDiff >= 0n ? '+' : ''}${ethers.formatEther(aliceCancelDiff)})`);
    console.log(`👤 Carol balance after cancel: ${ethers.formatEther(carolAfterCancel)} native tokens (${carolCancelDiff >= 0n ? '+' : ''}${ethers.formatEther(carolCancelDiff)})`);

    // Verify final state
    console.log("\n🔍 Verifying final state...");
    await escrowManager.displayDepositInfo(stuckDepositId);
    
    const contractBalance = await escrowManager.getContractBalanceFormatted();
    console.log(`💰 Contract balance: ${contractBalance} native tokens`);

    console.log("\n" + "=".repeat(60));
    console.log("🎉 STUCK DEPOSIT CANCELLED SUCCESSFULLY!");
    console.log("=".repeat(60));
    console.log(`🔗 Cancel transaction: ${escrowManager.getExplorerLink(cancelResult.txHash)}`);
    console.log("\n💰 BALANCE SUMMARY:");
    console.log(`👤 Alice total change: ${aliceCancelDiff >= 0n ? '+' : ''}${ethers.formatEther(aliceCancelDiff)} native tokens`);
    console.log(`👤 Carol total change: ${carolCancelDiff >= 0n ? '+' : ''}${ethers.formatEther(carolCancelDiff)} native tokens`);
    console.log("=".repeat(60));

  } catch (error) {
    console.error("❌ Cancel failed:", error instanceof Error ? error.message : String(error));
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

export { main as cancelStuckDeposit }; 