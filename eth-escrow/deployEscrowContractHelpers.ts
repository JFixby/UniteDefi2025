import { ethers } from "ethers";
import { Contract, ContractFactory, Provider, Signer, Wallet, JsonRpcProvider } from "ethers";

export interface DeploymentConfig {
  networkName: string;
  rpcUrl?: string;
  privateKey?: string;
  gasPrice?: string;
  gasLimit?: number;
}

export interface DeploymentResult {
  contract: Contract;
  address: string;
  deployer: string;
  network: string;
  gasUsed: string;
  deploymentTx: string;
  timestamp: string;
}

/**
 * Deploy the Escrow contract with the provided configuration
 * @param config Deployment configuration
 * @returns Deployment result with contract instance and metadata
 */
export async function deployEscrowContract(config: DeploymentConfig): Promise<DeploymentResult> {
  console.log(`\n🚀 Deploying Escrow contract to ${config.networkName}...`);
  
  // Setup provider and signer
  let provider: Provider;
  let signer: Signer;
  
  if (config.rpcUrl && config.privateKey) {
    // Connect to external network
    provider = new JsonRpcProvider(config.rpcUrl);
    signer = new Wallet(config.privateKey, provider);
    console.log(`📡 Connected to ${config.networkName} via RPC`);
  } else {
    // For local development, require RPC URL and private key
    throw new Error("RPC URL and private key are required for deployment");
  }

  // Get deployer address
  const deployer = await signer.getAddress();
  console.log(`👤 Deployer address: ${deployer}`);

  // Load contract artifact
  const contractArtifact = require("./artifacts/contracts/escrow.sol/Escrow.json");
  const EscrowFactory = new ethers.ContractFactory(contractArtifact.abi, contractArtifact.bytecode, signer);
  
  // Prepare deployment overrides
  const deploymentOverrides: any = {
    gasLimit: config.gasLimit || 2000000,
  };

  // Add gas price if specified
  if (config.gasPrice) {
    deploymentOverrides.gasPrice = ethers.parseUnits(config.gasPrice, "gwei");
  }

  console.log(`⛽ Gas limit: ${deploymentOverrides.gasLimit}`);
  if (config.gasPrice) {
    console.log(`💰 Gas price: ${config.gasPrice} gwei`);
  }

  // Deploy contract
  console.log(`📦 Deploying contract...`);
  const escrow = await EscrowFactory.connect(signer).deploy(deploymentOverrides);
  
  // Wait for deployment
  console.log(`⏳ Waiting for deployment confirmation...`);
  await escrow.waitForDeployment();
  
  // Get contract address
  const address = await escrow.getAddress();
  
  // Get deployment transaction hash and gas used
  const deploymentTxResponse = escrow.deploymentTransaction();
  const deploymentTxHash = deploymentTxResponse?.hash || "unknown";
  
  // For gas used, we need to get the receipt
  let gasUsed = "unknown";
  if (deploymentTxResponse) {
    const receipt = await provider.getTransactionReceipt(deploymentTxResponse.hash);
    gasUsed = receipt?.gasUsed?.toString() || "unknown";
  }

  // Verify deployment
  const code = await provider.getCode(address);
  if (code === "0x") {
    throw new Error("❌ Contract deployment failed - no code at address");
  }

  console.log(`✅ Contract deployed successfully!`);
  console.log(`📍 Contract address: ${address}`);
  console.log(`🔗 Transaction hash: ${deploymentTxHash}`);
  console.log(`⛽ Gas used: ${gasUsed}`);

  const result: DeploymentResult = {
    contract: escrow as Contract,
    address: address,
    deployer: deployer,
    network: config.networkName,
    gasUsed: gasUsed,
    deploymentTx: deploymentTxHash,
    timestamp: new Date().toISOString()
  };

  return result;
}

/**
 * Verify contract deployment by checking contract code
 * @param address Contract address to verify
 * @param provider Ethers provider
 * @returns True if contract is deployed successfully
 */
export async function verifyContractDeployment(
  address: string, 
  provider: Provider
): Promise<boolean> {
  try {
    const code = await provider.getCode(address);
    return code !== "0x";
  } catch (error) {
    console.error("❌ Error verifying contract deployment:", error);
    return false;
  }
}

/**
 * Get contract instance at a specific address
 * @param address Contract address
 * @param signer Ethers signer
 * @returns Contract instance
 */
export async function getEscrowContract(
  address: string, 
  signer: Signer
): Promise<Contract> {
  const contractArtifact = require("./artifacts/contracts/escrow.sol/Escrow.json");
  return new ethers.Contract(address, contractArtifact.abi, signer);
}

/**
 * Save deployment information to a JSON file
 * @param result Deployment result
 * @param filename Optional filename (default: deployment-info.json)
 */
export function saveDeploymentInfo(result: DeploymentResult, filename: string = "deployment-info.json"): void {
  const fs = require("fs");
  const path = require("path");
  
  const deploymentInfo = {
    contractName: "Escrow",
    ...result,
    abi: require("./artifacts/contracts/escrow.sol/Escrow.json").abi
  };

  const filePath = path.join(__dirname, "..", filename);
  fs.writeFileSync(filePath, JSON.stringify(deploymentInfo, null, 2));
  
  console.log(`💾 Deployment info saved to: ${filePath}`);
}

/**
 * Load deployment information from a JSON file
 * @param filename Filename to load from (default: deployment-info.json)
 * @returns Deployment information
 */
export function loadDeploymentInfo(filename: string = "deployment-info.json"): any {
  const fs = require("fs");
  const path = require("path");
  
  const filePath = path.join(__dirname, "..", filename);
  
  if (!fs.existsSync(filePath)) {
    throw new Error(`Deployment info file not found: ${filePath}`);
  }
  
  const data = fs.readFileSync(filePath, "utf8");
  return JSON.parse(data);
}

/**
 * Display deployment information in a formatted way
 * @param result Deployment result
 */
export function displayDeploymentInfo(result: DeploymentResult): void {
  console.log("\n" + "=".repeat(60));
  console.log("🎉 ESCROW CONTRACT DEPLOYMENT SUCCESSFUL");
  console.log("=".repeat(60));
  console.log(`📋 Contract: Escrow`);
  console.log(`📍 Address: ${result.address}`);
  console.log(`🌐 Network: ${result.network}`);
  console.log(`👤 Deployer: ${result.deployer}`);
  console.log(`🔗 Transaction: ${result.deploymentTx}`);
  console.log(`⛽ Gas Used: ${result.gasUsed}`);
  console.log(`⏰ Timestamp: ${result.timestamp}`);
  console.log("=".repeat(60));
  console.log("\n📝 Next steps:");
  console.log("1. Verify the contract on the blockchain explorer");
  console.log("2. Test the contract functions");
  console.log("3. Update your application with the contract address");
  console.log("=".repeat(60) + "\n");
}



/**
 * Validate deployment configuration
 * @param config Deployment configuration
 * @throws Error if configuration is invalid
 */
export function validateDeploymentConfig(config: DeploymentConfig): void {
  if (!config.networkName) {
    throw new Error("Network name is required");
  }

  if (config.rpcUrl && !config.privateKey) {
    throw new Error("Private key is required when using custom RPC URL");
  }

  if (config.privateKey && !config.rpcUrl) {
    throw new Error("RPC URL is required when using private key");
  }

  if (config.gasPrice && isNaN(Number(config.gasPrice))) {
    throw new Error("Gas price must be a valid number");
  }

  if (config.gasLimit && config.gasLimit <= 0) {
    throw new Error("Gas limit must be greater than 0");
  }
} 