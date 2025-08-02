const hre = require("hardhat");

async function main() {
  console.log("🏭 Deploying TestEscrowFactory...");

  const TestEscrowFactory = await hre.ethers.getContractFactory("TestEscrowFactory");
  
  // Constructor parameters from cross-chain-resolver-example
  const limitOrderProtocol = "0x111111125421ca6dc452d289314280a0f8842a65"; // 1inch LOP
  const feeToken = "0x0000000000000000000000000000000000000000"; // ETH
  const accessToken = "0x0000000000000000000000000000000000000000"; // No access token
  const [deployer] = await hre.ethers.getSigners();
  const owner = deployer.address;
  const rescueDelaySrc = 1800; // 30 minutes
  const rescueDelayDst = 1800; // 30 minutes
  
  const factory = await TestEscrowFactory.deploy(
    limitOrderProtocol,
    feeToken,
    accessToken,
    owner,
    rescueDelaySrc,
    rescueDelayDst
  );

  await factory.waitForDeployment();

  const factoryAddress = await factory.getAddress();
  console.log("✅ TestEscrowFactory deployed to:", factoryAddress);

  // Get network info
  const network = await hre.ethers.provider.getNetwork();
  const chainId = network.chainId;
  
  let explorerUrl;
  if (chainId === 137) {
    explorerUrl = "https://polygonscan.com";
  } else if (chainId === 1) {
    explorerUrl = "https://etherscan.io";
  } else {
    explorerUrl = "https://etherscan.io";
  }

  console.log(`🔍 Explorer: ${explorerUrl}/address/${factoryAddress}`);
  
  // Verify the contract (optional)
  if (chainId !== 31337) { // Skip verification for local network
    console.log("🔍 Verifying contract...");
    try {
      await hre.run("verify:verify", {
        address: factoryAddress,
        constructorArguments: [],
      });
      console.log("✅ Contract verified!");
    } catch (error) {
      console.log("⚠️ Verification failed:", error.message);
    }
  }

  console.log("\n📋 Deployment Summary:");
  console.log("=======================");
  console.log(`Contract: TestEscrowFactory`);
  console.log(`Address: ${factoryAddress}`);
  console.log(`Network: ${chainId === 137 ? 'Polygon' : chainId === 1 ? 'Ethereum' : 'Unknown'}`);
  console.log(`Explorer: ${explorerUrl}/address/${factoryAddress}`);
  
  console.log("\n💡 Next Steps:");
  console.log("==============");
  console.log("1. Update your .env file with the factory address");
  console.log("2. Run: npm run deposit");
  console.log("3. Or run: npm run deposit:custom");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  }); 