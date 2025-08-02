import { ethers } from "ethers";
import {
  deployEscrowContract,
  DeploymentConfig,
  DeploymentResult,
  saveDeploymentInfo,
  displayDeploymentInfo,
  validateDeploymentConfig
} from "./deployEscrowContractHelpers";
import {
  ALICE_PRIVATE_KEY,
  NETWORK,
  getRpcUrl,
  getChainId,
  hasValidAlicePrivateKey
} from "./variables";
import * as fs from "fs";

async function main() {
  console.log(`🚀 Starting Escrow contract deployment to ${NETWORK}...`);
  
  // Configuration for Alice's deployment using variables.ts
  const deploymentConfig: DeploymentConfig = {
    networkName: NETWORK.toLowerCase(),
    rpcUrl: getRpcUrl(),
    privateKey: ALICE_PRIVATE_KEY,
    gasPrice: process.env.GAS_PRICE || "30", // 30 gwei
    gasLimit: parseInt(process.env.GAS_LIMIT || "2000000")
  };

  // Validate configuration
  try {
    validateDeploymentConfig(deploymentConfig);
  } catch (error) {
    console.error("❌ Configuration validation failed:", error instanceof Error ? error.message : String(error));
    process.exit(1);
  }

  // Check if Alice's private key is valid
  if (!hasValidAlicePrivateKey()) {
    console.error("❌ ALICE_PRIVATE_KEY is not set or invalid");
    console.log("\n📝 Setup instructions:");
    console.log("1. Create a .env file in the project root");
    console.log("2. Add your private key: ALICE_PRIVATE_KEY=your_private_key_here");
    console.log("3. Set network: NETWORK=POLYGON or NETWORK=ETH_MAINNET");
    console.log("4. Optionally add: GAS_PRICE=30 (in gwei)");
    console.log("5. Optionally add: GAS_LIMIT=2000000");
    process.exit(1);
  }

  // Display network information
  console.log(`🌐 Network: ${NETWORK} (Chain ID: ${getChainId()})`);

  try {
    // Deploy the contract
    const result: DeploymentResult = await deployEscrowContract(deploymentConfig);

    // Display deployment information
    displayDeploymentInfo(result);

    // Save deployment information
    const filename = `deployment-${NETWORK.toLowerCase()}-${Date.now()}.json`;
    saveDeploymentInfo(result, filename);

    // Additional verification
    console.log("🔍 Performing additional verification...");
    
    // Get contract instance
    const provider = new ethers.JsonRpcProvider(deploymentConfig.rpcUrl);
    const signer = new ethers.Wallet(ALICE_PRIVATE_KEY, provider);
    const contract = new ethers.Contract(result.address, result.contract.interface, signer);

    // Test basic contract functions
    console.log("🧪 Testing contract functions...");
    
    // Test getBalance function
    const balance = await contract.getBalance();
    console.log(`💰 Contract balance: ${ethers.formatEther(balance)} ETH`);

    // Test that contract is working
    console.log("✅ Contract verification completed successfully!");

    // Save contract address for easy access
    const addressFile = `${NETWORK.toLowerCase()}-escrow-address.txt`;
    fs.writeFileSync(addressFile, result.address);
    console.log(`📍 Contract address saved to: ${addressFile}`);

    console.log("\n🎉 Deployment completed successfully!");
    console.log(`📋 Contract is ready for use on ${NETWORK} network`);

  } catch (error) {
    console.error("❌ Deployment failed:", error);
    process.exit(1);
  }
}

// Handle script execution
if (require.main === module) {
  main()
    .then(() => {
      console.log("✅ Script completed successfully");
      process.exit(0);
    })
    .catch((error) => {
      console.error("❌ Script failed:", error);
      process.exit(1);
    });
}

export { main as deployEscrowPolygon }; 