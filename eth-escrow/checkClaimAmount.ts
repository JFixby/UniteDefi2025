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
  console.log(`🔍 Checking claim amount details on ${NETWORK}...`);
  
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
    
    // The deposit ID from the successful test
    const depositId = "0x452a8692742fb23dc4285c309fa015362ea3afa49a2e8a9163c206b6f4223876";

    console.log("\n" + "=".repeat(60));
    console.log("🔍 CLAIM AMOUNT VERIFICATION");
    console.log("=".repeat(60));
    console.log(`🆔 Deposit ID: ${depositId}`);
    console.log("=".repeat(60));

    // Get deposit details
    console.log("\n📋 Deposit Details:");
    const depositInfo = await escrowManager.getDepositInfo(depositId);
    console.log(`💰 Deposit Amount: ${ethers.formatEther(depositInfo.amount)} native tokens`);
    console.log(`✅ Claimed: ${depositInfo.claimed}`);
    console.log(`❌ Cancelled: ${depositInfo.cancelled}`);

    // Get current balances
    console.log("\n💰 Current Balances:");
    const aliceBalance = await escrowManager.getAccountBalance(escrowManager.getAliceAddress());
    const carolBalance = await escrowManager.getAccountBalance(escrowManager.getCarolAddress());
    const contractBalance = await escrowManager.getContractBalance();
    
    console.log(`👤 Alice balance: ${ethers.formatEther(aliceBalance)} native tokens`);
    console.log(`👤 Carol balance: ${ethers.formatEther(carolBalance)} native tokens`);
    console.log(`📦 Contract balance: ${ethers.formatEther(contractBalance)} native tokens`);

    // Calculate expected amounts
    const depositAmountWei = ethers.parseEther("0.0033");
    console.log(`\n📊 Expected amounts:`);
    console.log(`💰 Deposit amount (wei): ${depositAmountWei.toString()}`);
    console.log(`💰 Deposit amount (ether): ${ethers.formatEther(depositAmountWei)} native tokens`);

    // Check if Carol received the full amount
    const expectedCarolBalance = ethers.parseEther("5.02958318028863784") + depositAmountWei;
    console.log(`\n🎯 Expected Carol balance after claim: ${ethers.formatEther(expectedCarolBalance)} native tokens`);
    console.log(`🎯 Actual Carol balance: ${ethers.formatEther(carolBalance)} native tokens`);
    
    const difference = carolBalance - expectedCarolBalance;
    console.log(`📈 Difference: ${ethers.formatEther(difference)} native tokens`);

    if (difference === 0n) {
      console.log("✅ Carol received the exact expected amount!");
    } else if (difference > 0n) {
      console.log("✅ Carol received more than expected (possibly from other transactions)");
    } else {
      console.log("❌ Carol received less than expected");
    }

    // Check transaction details
    console.log("\n🔗 Transaction Details:");
    console.log(`Claim TX: 0x61b64a29d2d6e91712f12bfa995af1bbcdcbedde8bc5d0f1f40e3694018bd476`);
    console.log(`Explorer: https://polygonscan.com/tx/0x61b64a29d2d6e91712f12bfa995af1bbcdcbedde8bc5d0f1f40e3694018bd476`);

  } catch (error) {
    console.error("❌ Check failed:", error instanceof Error ? error.message : String(error));
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

export { main as checkClaimAmount }; 