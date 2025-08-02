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
  console.log(`🔍 Checking existing deposits on ${NETWORK}...`);
  
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

    // The deposit ID from the previous test
    const existingDepositId = "0x0417ec9067da0f31ad3440e2ee53ce5823720bcc1190aa6fd8cf5beae4b1e70c";
    const secret = "mysecret123"; // The secret used in the previous test

    console.log("\n" + "=".repeat(60));
    console.log("🔍 CLAIMING EXISTING DEPOSIT");
    console.log("=".repeat(60));
    console.log(`🆔 Deposit ID: ${existingDepositId}`);
    console.log(`🔐 Secret: ${secret}`);
    console.log("=".repeat(60));

    // Check deposit status before claiming
    console.log("\n📋 Checking deposit status...");
    await escrowManager.displayDepositInfo(existingDepositId);

    // Get initial balances
    console.log("\n💰 Checking initial balances...");
    const aliceInitialBalance = await escrowManager.getAccountBalance(escrowManager.getAliceAddress());
    const carolInitialBalance = await escrowManager.getAccountBalance(escrowManager.getCarolAddress());
    
    console.log(`👤 Alice initial balance: ${ethers.formatEther(aliceInitialBalance)} native tokens`);
    console.log(`👤 Carol initial balance: ${ethers.formatEther(carolInitialBalance)} native tokens`);

    // Claim the existing deposit
    console.log("\n📤 Claiming existing deposit...");
    
    const claimResult = await escrowManager.claimDeposit({
      depositId: existingDepositId,
      secret: secret
    });

    // Check balances after claim
    console.log("\n💰 Checking balances after claim...");
    const aliceAfterClaim = await escrowManager.getAccountBalance(escrowManager.getAliceAddress());
    const carolAfterClaim = await escrowManager.getAccountBalance(escrowManager.getCarolAddress());
    
    const aliceClaimDiff = aliceAfterClaim - aliceInitialBalance;
    const carolClaimDiff = carolAfterClaim - carolInitialBalance;
    
    console.log(`👤 Alice balance after claim: ${ethers.formatEther(aliceAfterClaim)} native tokens (${aliceClaimDiff >= 0n ? '+' : ''}${ethers.formatEther(aliceClaimDiff)})`);
    console.log(`👤 Carol balance after claim: ${ethers.formatEther(carolAfterClaim)} native tokens (${carolClaimDiff >= 0n ? '+' : ''}${ethers.formatEther(carolClaimDiff)})`);

    // Verify final state
    console.log("\n🔍 Verifying final state...");
    await escrowManager.displayDepositInfo(existingDepositId);
    
    const contractBalance = await escrowManager.getContractBalanceFormatted();
    console.log(`💰 Contract balance: ${contractBalance} native tokens`);

    console.log("\n" + "=".repeat(60));
    console.log("🎉 EXISTING DEPOSIT CLAIMED SUCCESSFULLY!");
    console.log("=".repeat(60));
    console.log(`🔗 Claim transaction: ${escrowManager.getExplorerLink(claimResult.txHash)}`);
    console.log("\n💰 BALANCE SUMMARY:");
    console.log(`👤 Alice total change: ${aliceClaimDiff >= 0n ? '+' : ''}${ethers.formatEther(aliceClaimDiff)} native tokens`);
    console.log(`👤 Carol total change: ${carolClaimDiff >= 0n ? '+' : ''}${ethers.formatEther(carolClaimDiff)} native tokens`);
    console.log("=".repeat(60));

  } catch (error) {
    console.error("❌ Claim failed:", error instanceof Error ? error.message : String(error));
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

export { main as claimExistingDeposit }; 