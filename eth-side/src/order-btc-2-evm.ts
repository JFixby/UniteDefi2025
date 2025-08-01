#!/usr/bin/env node

import { ethers } from "ethers";
import * as fs from "fs";
import * as path from "path";
import * as crypto from "crypto";
import { getRpcUrl, getChainId, getAliceAddress, ALICE_PRIVATE_KEY } from "./variables";

// Order types based on the documentation
type OrderType = 
  | "SINGLE_FILL"           // Simple atomic swap with single execution
  | "MULTIPLE_FILL_100"     // Order that can be filled multiple times, filled completely
  | "MULTIPLE_FILL_50"      // Order that can be filled multiple times, filled partially
  | "ETH_TO_BTC"           // Reverse direction swap from Ethereum to Bitcoin
  | "CANCELLATION";         // Order designed for cancellation testing

interface OrderBTC2EVM {
  orderId: string;
  timestamp: number;
  network: string;
  chainId: number;
  orderType: OrderType;
  
  BTCSeller: {
    EVMAddress: string;
    provides: {
      asset: "BTC" | "ETH";
      amount: string;
    };
    wants: {
      asset: "ETH" | "BTC";
      amount: string;
      token?: string;
    };
  };
  
  timelock: {
    withdrawalPeriod: number;
    cancellationPeriod: number;
    publicWithdrawalPeriod: number;
    publicCancellationPeriod: number;
  };
  
  fillOptions: {
    allowPartialFills: boolean;
    allowMultipleFills: boolean;
    fillPercentage?: number; // For partial fills
  };
  
  status: "CREATED" | "FILLED" | "COMPLETED" | "CANCELLED";
  
  contracts: {
    btcEscrowFactory: string;
    accessToken: string;
  };
  
  // Cross-chain specific fields
  crossChain?: {
    srcChainId: number;
    dstChainId: number;
    srcSafetyDeposit: string;
    dstSafetyDeposit: string;
    hashLock: {
      type: "SINGLE" | "MULTIPLE";
      secret?: string;
      secrets?: string[];
      merkleLeaves?: string[];
    };
  };
}

function printHeader(title: string) {
  console.log(`\n${title}`);
  console.log("=".repeat(title.length));
}

function printSection(title: string) {
  console.log(`\n${title}`);
  console.log("-".repeat(title.length));
}

function printKeyValue(key: string, value: string | number) {
  console.log(`${key}: ${value}`);
}

function printUsage() {
  console.log(`
🔄 BTC to EVM Cross-Chain Order Creator CLI

Usage:
  npm run order:btc2evm [orderType] [options]

Order Types:
  single-fill          Create a single fill order (100% fill)
  multiple-fill-100    Create a multiple fill order (100% fill)
  multiple-fill-50     Create a multiple fill order (50% partial fill)
  eth-to-btc          Create an ETH to BTC reverse order
  cancellation        Create a cancellation test order
  all                 Create all order types

Options:
  --help, -h          Show this help message
  --amount <value>    Specify BTC amount (default: 0.002)
  --eth-amount <value> Specify ETH amount (default: 0.02)
  --output <path>     Specify output directory (default: ../orders)

Examples:
  npm run order:btc2evm single-fill
  npm run order:btc2evm multiple-fill-50 --amount 0.001 --eth-amount 0.01
  npm run order:btc2evm all --output ./my-orders
  npm run order:btc2evm --help
`);
}

// Parse command line arguments
function parseArgs(): {
  orderType: string;
  btcAmount: string;
  ethAmount: string;
  outputDir: string;
  help: boolean;
} {
  const args = process.argv.slice(2);
  let orderType = "single-fill";
  let btcAmount = "0.002";
  let ethAmount = "0.02";
  let outputDir = "../orders";
  let help = false;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    
    switch (arg) {
      case "--help":
      case "-h":
        help = true;
        break;
      case "--amount":
        btcAmount = args[++i] || "0.002";
        break;
      case "--eth-amount":
        ethAmount = args[++i] || "0.02";
        break;
      case "--output":
        outputDir = args[++i] || "../orders";
        break;
      default:
        if (!arg.startsWith("--")) {
          orderType = arg;
        }
        break;
    }
  }

  return { orderType, btcAmount, ethAmount, outputDir, help };
}

// Generate random secret for hash locks
function generateSecret(): string {
  return crypto.randomBytes(32).toString('hex');
}

// Generate multiple secrets for multiple fill orders
function generateMultipleSecrets(count: number): string[] {
  return Array.from({ length: count }, () => generateSecret());
}

// Create order based on type
function createOrderByType(
  orderType: OrderType,
  BTCSeller: ethers.Wallet,
  chainId: number,
  networkName: string,
  factoryAddress: string,
  accessTokenAddress: string,
  btcAmount: string,
  ethAmount: string
): OrderBTC2EVM {
  const orderId = `order-${orderType.toLowerCase()}-${Date.now()}`;
  const timestamp = Date.now();
  
  // Base order structure
  const baseOrder: Partial<OrderBTC2EVM> = {
    orderId,
    timestamp,
    network: networkName,
    chainId,
    orderType,
    status: "CREATED",
    contracts: {
      btcEscrowFactory: factoryAddress,
      accessToken: accessTokenAddress
    }
  };

  switch (orderType) {
    case "SINGLE_FILL":
      return {
        ...baseOrder,
        BTCSeller: {
          EVMAddress: BTCSeller.address,
          provides: {
            asset: "BTC",
            amount: btcAmount
          },
          wants: {
            asset: "ETH",
            amount: ethers.parseEther(ethAmount).toString()
          }
        },
        timelock: {
          withdrawalPeriod: 10,        // 10s finality lock
          cancellationPeriod: 121,     // 1s after public withdrawal
          publicWithdrawalPeriod: 120, // 2m for private withdrawal
          publicCancellationPeriod: 122 // 1s after private cancellation
        },
        fillOptions: {
          allowPartialFills: false,
          allowMultipleFills: false
        },
        crossChain: {
          srcChainId: chainId,
          dstChainId: 1, // Bitcoin mainnet
          srcSafetyDeposit: ethers.parseEther("0.001").toString(),
          dstSafetyDeposit: ethers.parseEther("0.001").toString(),
          hashLock: {
            type: "SINGLE",
            secret: generateSecret()
          }
        }
      } as OrderBTC2EVM;

    case "MULTIPLE_FILL_100":
      const secrets100 = generateMultipleSecrets(11);
      return {
        ...baseOrder,
        BTCSeller: {
          EVMAddress: BTCSeller.address,
          provides: {
            asset: "BTC",
            amount: btcAmount
          },
          wants: {
            asset: "ETH",
            amount: ethers.parseEther(ethAmount).toString()
          }
        },
        timelock: {
          withdrawalPeriod: 10,        // 10s finality lock
          cancellationPeriod: 121,     // 1s after public withdrawal
          publicWithdrawalPeriod: 120, // 2m for private withdrawal
          publicCancellationPeriod: 122 // 1s after private cancellation
        },
        fillOptions: {
          allowPartialFills: true,
          allowMultipleFills: true,
          fillPercentage: 100
        },
        crossChain: {
          srcChainId: chainId,
          dstChainId: 1, // Bitcoin mainnet
          srcSafetyDeposit: ethers.parseEther("0.001").toString(),
          dstSafetyDeposit: ethers.parseEther("0.001").toString(),
          hashLock: {
            type: "MULTIPLE",
            secrets: secrets100,
            merkleLeaves: secrets100.map(s => crypto.createHash('sha256').update(s).digest('hex'))
          }
        }
      } as OrderBTC2EVM;

    case "MULTIPLE_FILL_50":
      const secrets50 = generateMultipleSecrets(11);
      return {
        ...baseOrder,
        BTCSeller: {
          EVMAddress: BTCSeller.address,
          provides: {
            asset: "BTC",
            amount: btcAmount
          },
          wants: {
            asset: "ETH",
            amount: ethers.parseEther(ethAmount).toString()
          }
        },
        timelock: {
          withdrawalPeriod: 10,        // 10s finality lock
          cancellationPeriod: 121,     // 1s after public withdrawal
          publicWithdrawalPeriod: 120, // 2m for private withdrawal
          publicCancellationPeriod: 122 // 1s after private cancellation
        },
        fillOptions: {
          allowPartialFills: true,
          allowMultipleFills: true,
          fillPercentage: 50
        },
        crossChain: {
          srcChainId: chainId,
          dstChainId: 1, // Bitcoin mainnet
          srcSafetyDeposit: ethers.parseEther("0.001").toString(),
          dstSafetyDeposit: ethers.parseEther("0.001").toString(),
          hashLock: {
            type: "MULTIPLE",
            secrets: secrets50,
            merkleLeaves: secrets50.map(s => crypto.createHash('sha256').update(s).digest('hex'))
          }
        }
      } as OrderBTC2EVM;

    case "ETH_TO_BTC":
      return {
        ...baseOrder,
        BTCSeller: {
          EVMAddress: BTCSeller.address,
          provides: {
            asset: "ETH",
            amount: ethers.parseEther(ethAmount).toString()
          },
          wants: {
            asset: "BTC",
            amount: btcAmount
          }
        },
        timelock: {
          withdrawalPeriod: 10,        // 10s finality lock
          cancellationPeriod: 121,     // 1s after public withdrawal
          publicWithdrawalPeriod: 120, // 2m for private withdrawal
          publicCancellationPeriod: 122 // 1s after private cancellation
        },
        fillOptions: {
          allowPartialFills: false,
          allowMultipleFills: false
        },
        crossChain: {
          srcChainId: chainId,
          dstChainId: 1, // Bitcoin mainnet
          srcSafetyDeposit: ethers.parseEther("0.001").toString(),
          dstSafetyDeposit: ethers.parseEther("0.001").toString(),
          hashLock: {
            type: "SINGLE",
            secret: generateSecret()
          }
        }
      } as OrderBTC2EVM;

    case "CANCELLATION":
      return {
        ...baseOrder,
        BTCSeller: {
          EVMAddress: BTCSeller.address,
          provides: {
            asset: "BTC",
            amount: btcAmount
          },
          wants: {
            asset: "ETH",
            amount: ethers.parseEther(ethAmount).toString()
          }
        },
        timelock: {
          withdrawalPeriod: 0,         // No finality lock for testing
          cancellationPeriod: 121,     // 1s after public withdrawal
          publicWithdrawalPeriod: 120, // 2m for private withdrawal
          publicCancellationPeriod: 122 // 1s after private cancellation
        },
        fillOptions: {
          allowPartialFills: false,
          allowMultipleFills: false
        },
        crossChain: {
          srcChainId: chainId,
          dstChainId: 1, // Bitcoin mainnet
          srcSafetyDeposit: ethers.parseEther("0.001").toString(),
          dstSafetyDeposit: ethers.parseEther("0.001").toString(),
          hashLock: {
            type: "SINGLE",
            secret: generateSecret()
          }
        }
      } as OrderBTC2EVM;

    default:
      throw new Error(`Unknown order type: ${orderType}`);
  }
}

async function main() {
  const args = parseArgs();
  
  if (args.help) {
    printUsage();
    return;
  }

  printHeader("🔄 BTC to EVM Cross-Chain Order Creator CLI");
  
  // Get network info from variables.ts
  const rpcUrl = getRpcUrl();
  const chainId = getChainId();
  const networkName = chainId === 137 ? "polygon" : chainId === 1 ? "ethereum" : "unknown";
  
  printSection("🌐 NETWORK CONFIGURATION");
  printKeyValue("Network", networkName);
  printKeyValue("Chain ID", chainId);
  
  // Setup provider and BTCSeller account
  const provider = new ethers.JsonRpcProvider(rpcUrl);
  const BTCSeller = new ethers.Wallet(ALICE_PRIVATE_KEY, provider);
  
  printSection("👤 BTC SELLER DETAILS");
  printKeyValue("EVM Address", BTCSeller.address);
  
  const BTCSellerBalance = await provider.getBalance(BTCSeller.address);
  printKeyValue("ETH Balance", `${ethers.formatEther(BTCSellerBalance)} ETH`);
  
  // Get deployed contracts
  const factoryAddress = "0x";
  const accessTokenAddress = "0x";
  
  printSection("📋 CONTRACT ADDRESSES");
  printKeyValue("Factory", factoryAddress);
  printKeyValue("Access Token", accessTokenAddress);
  
  // Determine which order types to create
  let orderTypes: OrderType[] = [];
  
  switch (args.orderType.toLowerCase()) {
    case "single-fill":
      orderTypes = ["SINGLE_FILL"];
      break;
    case "multiple-fill-100":
      orderTypes = ["MULTIPLE_FILL_100"];
      break;
    case "multiple-fill-50":
      orderTypes = ["MULTIPLE_FILL_50"];
      break;
    case "eth-to-btc":
      orderTypes = ["ETH_TO_BTC"];
      break;
    case "cancellation":
      orderTypes = ["CANCELLATION"];
      break;
    case "all":
      orderTypes = ["SINGLE_FILL", "MULTIPLE_FILL_100", "MULTIPLE_FILL_50", "ETH_TO_BTC", "CANCELLATION"];
      break;
    default:
      console.error(`❌ Unknown order type: ${args.orderType}`);
      console.log("Use --help to see available options");
      process.exit(1);
  }
  
  const orders: OrderBTC2EVM[] = [];
  
  for (const orderType of orderTypes) {
    printSection(`📋 CREATING ${orderType} ORDER`);
    
    const order = createOrderByType(
      orderType,
      BTCSeller,
      chainId,
      networkName,
      factoryAddress,
      accessTokenAddress,
      args.btcAmount,
      args.ethAmount
    );
    
    orders.push(order);
    
    printKeyValue("Order ID", order.orderId);
    printKeyValue("Provides", `${order.BTCSeller.provides.amount} ${order.BTCSeller.provides.asset}`);
    printKeyValue("Wants", `${order.BTCSeller.wants.amount} ${order.BTCSeller.wants.asset}`);
    printKeyValue("Partial Fills", order.fillOptions.allowPartialFills ? "Yes" : "No");
    printKeyValue("Multiple Fills", order.fillOptions.allowMultipleFills ? "Yes" : "No");
    if (order.fillOptions.fillPercentage) {
      printKeyValue("Fill Percentage", `${order.fillOptions.fillPercentage}%`);
    }
    printKeyValue("Withdrawal Period", `${order.timelock.withdrawalPeriod} seconds`);
    printKeyValue("Cancellation Period", `${order.timelock.cancellationPeriod} seconds`);
    
    if (order.crossChain?.hashLock.type === "MULTIPLE") {
      printKeyValue("Hash Lock Type", "Merkle Tree (Multiple Secrets)");
      printKeyValue("Number of Secrets", order.crossChain.hashLock.secrets?.length || 0);
    } else {
      printKeyValue("Hash Lock Type", "Single Secret");
    }
  }
  
  // Save all orders to files
  const ordersDir = path.join(__dirname, args.outputDir);
  if (!fs.existsSync(ordersDir)) {
    fs.mkdirSync(ordersDir, { recursive: true });
  }
  
  printSection("💾 SAVING ORDERS");
  for (const order of orders) {
    const orderPath = path.join(ordersDir, `${order.orderId}.json`);
    fs.writeFileSync(orderPath, JSON.stringify(order, null, 2));
    printKeyValue(order.orderType, orderPath);
  }
  
  printSection("✅ ORDER CREATION COMPLETE");
  console.log(`Created ${orders.length} order(s) in: ${ordersDir}`);
  
  if (orders.length === 1) {
    const order = orders[0];
    console.log(`\n🎯 Order Summary: ${order.orderType}`);
    console.log(`Trade: ${order.BTCSeller.provides.amount} ${order.BTCSeller.provides.asset} → ${order.BTCSeller.wants.amount} ${order.BTCSeller.wants.asset}`);
    console.log(`File: ${order.orderId}.json`);
  }
  
  return orders;
}

if (require.main === module) {
  main().catch((error) => {
    console.error("❌ Error:", error.message);
    process.exit(1);
  });
}

export default main; 