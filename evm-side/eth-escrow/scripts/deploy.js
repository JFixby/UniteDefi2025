const { ethers } = require("hardhat");

async function main() {
  console.log("Deploying Escrow contract...");

  // Get the contract factory
  const Escrow = await ethers.getContractFactory("Escrow");

  // Deploy the contract
  const escrow = await Escrow.deploy();
  await escrow.waitForDeployment();

  const address = await escrow.getAddress();
  console.log("Escrow contract deployed to:", address);

  // Verify deployment
  const code = await ethers.provider.getCode(address);
  if (code === "0x") {
    console.error("Contract deployment failed - no code at address");
    process.exit(1);
  }

  console.log("Contract deployment successful!");
  console.log("Contract address:", address);
  console.log("Network:", network.name);
  
  // Save deployment info
  const deploymentInfo = {
    contract: "Escrow",
    address: address,
    network: network.name,
    deployer: (await ethers.getSigners())[0].address,
    timestamp: new Date().toISOString()
  };

  console.log("\nDeployment Info:");
  console.log(JSON.stringify(deploymentInfo, null, 2));
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("Deployment failed:", error);
    process.exit(1);
  }); 