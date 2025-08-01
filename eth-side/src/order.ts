#!/usr/bin/env node

import { ethers } from "ethers";
import * as fs from "fs";
import * as path from "path";
import * as crypto from "crypto";
import { getRpcUrl, getChainId, getAliceAddress, ALICE_PRIVATE_KEY, getNativeTokenAddress, getEscrowFactoryAddress } from "./variables";

// Import real SDK classes
import {
  CrossChainOrder,
  HashLock,
  TimeLocks,
  Address,
  AuctionDetails,
  randBigInt,
  NetworkEnum,
  ESCROW_FACTORY
} from '@1inch/cross-chain-sdk';

// Import now from fusion-sdk
import { now } from '@1inch/fusion-sdk';

// Order types based on the documentation
type OrderType = 
  | "SINGLE_FILL"           // Simple atomic swap with single execution
  | "MULTIPLE_FILL_100"     // Order that can be filled multiple times, filled completely
  | "MULTIPLE_FILL_50"      // Order that can be filled multiple times, filled partially
  | "ETH_TO_BTC"           // Reverse direction swap from Ethereum to Bitcoin
  | "CANCELLATION";         // Order designed for cancellation testing



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
🔄 Cross-Chain Order Creator CLI

Usage:
  npm run order [orderType] [options]

Order Types:
  single-fill          Create a single fill order (100% fill)
  multiple-fill-100    Create a multiple fill order (100% fill)
  multiple-fill-50     Create a multiple fill order (50% partial fill)
  eth-to-btc          Create an ETH to BTC reverse order
  cancellation        Create a cancellation test order
  all                 Create all order types

Options:
  --help, -h          Show this help message
  --amount <value>    Specify asset amount (BTC for BTC→ETH, ETH for ETH→BTC)
  --eth-amount <value> Specify ETH amount (for BTC→ETH orders)
  --btc-amount <value> Specify BTC amount (for ETH→BTC orders)
  --output <path>     Specify output directory (default: ../orders)

Examples:
  npm run order single-fill --amount 0.001 --eth-amount 0.01
  npm run order multiple-fill-50 --amount 0.01 --btc-amount 0.001
  npm run order all --output ./my-orders
`);
}

function parseArgs(): {
  orderType: string;
  btcAmount: string;
  ethAmount: string;
  outputDir: string;
  help: boolean;
} {
  const args = process.argv.slice(2);
  const result = {
    orderType: "single-fill",
    btcAmount: "0.001",
    ethAmount: "0.01",
    outputDir: "../orders",
    help: false
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    
    if (arg === "--help" || arg === "-h") {
      result.help = true;
    } else if (arg === "--amount" && i + 1 < args.length) {
      const amount = args[++i];
      if (result.orderType.includes("btc")) {
        result.btcAmount = amount;
      } else {
        result.ethAmount = amount;
      }
    } else if (arg === "--eth-amount" && i + 1 < args.length) {
      result.ethAmount = args[++i];
    } else if (arg === "--btc-amount" && i + 1 < args.length) {
      result.btcAmount = args[++i];
    } else if (arg === "--output" && i + 1 < args.length) {
      result.outputDir = args[++i];
    } else if (!arg.startsWith("--")) {
      result.orderType = arg;
    }
  }

  return result;
}

function generateSecret(): string {
  return "0x" + crypto.randomBytes(32).toString("hex");
}

function generateMultipleSecrets(count: number): string[] {
  return Array.from({ length: count }, () => generateSecret());
}

function createOrderByType(
  orderType: OrderType,
  BTCSeller: ethers.Wallet,
  chainId: number,
  networkName: string,
  factoryAddress: string,
  accessTokenAddress: string,
  btcAmount: string,
  ethAmount: string
): CrossChainOrder {
  const timestamp = Date.now();
  
  // Convert amounts to wei/satoshi
  const btcAmountWei = ethers.parseUnits(btcAmount, 8); // BTC has 8 decimals
  const ethAmountWei = ethers.parseUnits(ethAmount, 18); // ETH has 18 decimals

  // Create SDK order using CrossChainOrder.new()
  let secrets: string[] = [];
  let hashLockType: "SINGLE" | "MULTIPLE" = "SINGLE";

  try {
    // Common parameters
    const maker = new Address(BTCSeller.address);
    const nativeToken = getNativeTokenAddress();
    const makerAsset = new Address(nativeToken);
    const takerAsset = new Address(nativeToken);
    const escrowFactory = new Address(factoryAddress);
    
    // Common time locks
    const timeLocks = TimeLocks.new({
      srcWithdrawal: orderType === "CANCELLATION" ? 0n : 10n,
      srcPublicWithdrawal: 120n,
      srcCancellation: 121n,
      srcPublicCancellation: 122n,
      dstWithdrawal: orderType === "CANCELLATION" ? 0n : 10n,
      dstPublicWithdrawal: 100n,
      dstCancellation: 101n
    }).setDeployedAt(now());

    // Common auction settings
    const auction = new AuctionDetails({
      initialRateBump: 0,
      points: [],
      duration: 120n,
      startTime: BigInt(Math.floor(Date.now() / 1000))
    });

    // Common whitelist - create a minimal whitelist with the maker address
    const whitelist = [
      {
        address: maker,
        allowFrom: 0n
      }
    ];

    // Create hash lock based on order type
    let hashLock: HashLock;
    
    if (orderType === "SINGLE_FILL" || orderType === "CANCELLATION" || orderType === "ETH_TO_BTC") {
      const secret = generateSecret();
      secrets = [secret];
      hashLock = HashLock.forSingleFill(secret);
      hashLockType = "SINGLE";
    } else {
      // Multiple fill orders
      secrets = generateMultipleSecrets(11);
      const leaves = HashLock.getMerkleLeaves(secrets);
      hashLock = HashLock.forMultipleFills(leaves);
      hashLockType = "MULTIPLE";
    }

    // Create and return the SDK order directly
    return CrossChainOrder.new(
      escrowFactory,
      {
        salt: randBigInt(1000n),
        maker,
        makingAmount: orderType === "ETH_TO_BTC" ? ethAmountWei : btcAmountWei,
        takingAmount: orderType === "ETH_TO_BTC" ? btcAmountWei : ethAmountWei,
        makerAsset: orderType === "ETH_TO_BTC" ? new Address(nativeToken) : new Address("0x0000000000000000000000000000000000000000"),
        takerAsset: orderType === "ETH_TO_BTC" ? new Address("0x0000000000000000000000000000000000000000") : new Address(nativeToken)
      },
      {
        hashLock,
        timeLocks,
        srcChainId: (orderType === "ETH_TO_BTC" ? chainId : 1) as any, // Bitcoin chain ID for BTC->ETH, EVM chain for ETH->BTC
        dstChainId: (orderType === "ETH_TO_BTC" ? 1 : chainId) as any, // EVM chain ID for BTC->ETH, Bitcoin chain for ETH->BTC
        srcSafetyDeposit: ethers.parseEther("0.001"),
        dstSafetyDeposit: ethers.parseEther("0.001")
      },
      {
        auction,
        whitelist,
        resolvingStartTime: 0n
      },
      {
        nonce: randBigInt(2n ** 40n - 1n),
        allowPartialFills: orderType.includes("MULTIPLE_FILL"),
        allowMultipleFills: orderType.includes("MULTIPLE_FILL")
      }
    );

  } catch (error) {
    console.error("Error creating SDK order:", error);
    throw error;
  }
}

function getOrderDirection(orderType: OrderType): string {
  if (orderType === "ETH_TO_BTC") {
    return "evm2btc";
  } else {
    return "btc2evm";
  }
}

function saveOrderToFile(order: CrossChainOrder, outputDir: string, orderType: OrderType, timestamp: number): void {
  // Ensure output directory exists
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const direction = getOrderDirection(orderType);
  const orderId = `order-${direction}-${orderType.toLowerCase().replace(/_/g, '_')}-${timestamp}`;
  const filename = `${orderId}.json`;
  const filepath = path.join(outputDir, filename);
  
  // Create a simplified order summary for JSON output
  const orderSummary = {
    orderId,
    timestamp,
    orderType,
    maker: order.maker.toString(),
    makerAsset: order.makerAsset.toString(),
    takerAsset: order.takerAsset.toString(),
    makingAmount: order.makingAmount.toString(),
    takingAmount: order.takingAmount.toString(),
    salt: order.salt.toString(),
    nonce: order.nonce.toString(),
    partialFillAllowed: order.partialFillAllowed,
    multipleFillsAllowed: order.multipleFillsAllowed,
    dstChainId: order.dstChainId,
    escrowExtension: {
      hashLock: order.escrowExtension.hashLockInfo.toString(),
      dstChainId: order.escrowExtension.dstChainId,
      dstToken: order.escrowExtension.dstToken.toString(),
      srcSafetyDeposit: order.escrowExtension.srcSafetyDeposit.toString(),
      dstSafetyDeposit: order.escrowExtension.dstSafetyDeposit.toString()
    }
  };
  
  fs.writeFileSync(filepath, JSON.stringify(orderSummary, null, 2));
  console.log(`✅ Order saved to: ${filepath}`);
}

function printOrderSummary(order: CrossChainOrder, orderType: OrderType, timestamp: number): void {
  const direction = getOrderDirection(orderType);
  const orderId = `order-${direction}-${orderType.toLowerCase().replace(/_/g, '_')}-${timestamp}`;
  
  printSection("Order Summary");
  printKeyValue("Order ID", orderId);
  printKeyValue("Type", orderType);
  printKeyValue("Timestamp", timestamp);
  
  printSection("Order Info");
  printKeyValue("Maker", order.maker.toString());
  printKeyValue("Making Amount", order.makingAmount.toString());
  printKeyValue("Taking Amount", order.takingAmount.toString());
  printKeyValue("Maker Asset", order.makerAsset.toString());
  printKeyValue("Taker Asset", order.takerAsset.toString());
  printKeyValue("Salt", order.salt.toString());
  
  printSection("Escrow Parameters");
  printKeyValue("Destination Chain ID", order.dstChainId.toString());
  printKeyValue("Source Safety Deposit", ethers.formatEther(order.escrowExtension.srcSafetyDeposit));
  printKeyValue("Destination Safety Deposit", ethers.formatEther(order.escrowExtension.dstSafetyDeposit));
  printKeyValue("Hash Lock", order.escrowExtension.hashLockInfo.toString());
  
  printSection("Fill Options");
  printKeyValue("Allow Partial Fills", order.partialFillAllowed.toString());
  printKeyValue("Allow Multiple Fills", order.multipleFillsAllowed.toString());
  
  printSection("Time Locks");
  const timeLocks = order.escrowExtension.timeLocks;
  const srcTimeLocks = timeLocks.toSrcTimeLocks();
  const dstTimeLocks = timeLocks.toDstTimeLocks();
  printKeyValue("Source Private Withdrawal", `${srcTimeLocks.privateWithdrawal}s`);
  printKeyValue("Source Public Withdrawal", `${srcTimeLocks.publicWithdrawal}s`);
  printKeyValue("Source Private Cancellation", `${srcTimeLocks.privateCancellation}s`);
  printKeyValue("Source Public Cancellation", `${srcTimeLocks.publicCancellation}s`);
  printKeyValue("Destination Private Withdrawal", `${dstTimeLocks.privateWithdrawal}s`);
  printKeyValue("Destination Public Withdrawal", `${dstTimeLocks.publicWithdrawal}s`);
  printKeyValue("Destination Private Cancellation", `${dstTimeLocks.privateCancellation}s`);
}

async function main() {
  try {
    const args = parseArgs();
    
    if (args.help) {
      printUsage();
      return;
    }

    // Validate environment
    if (!ALICE_PRIVATE_KEY) {
      throw new Error("ALICE_PRIVATE_KEY environment variable is required");
    }

    const rpcUrl = getRpcUrl();
    const chainId = getChainId();
    const aliceAddress = getAliceAddress();
    
    // Create wallet
    const BTCSeller = new ethers.Wallet(ALICE_PRIVATE_KEY);
    
    // Validate wallet address
    if (BTCSeller.address !== aliceAddress) {
      throw new Error("Wallet address mismatch");
    }

    printHeader("Cross-Chain Order Creator CLI");
    printSection("Configuration");
    printKeyValue("Network", process.env.NETWORK || "POLYGON");
    printKeyValue("Chain ID", chainId);
    printKeyValue("RPC URL", rpcUrl);
    printKeyValue("Alice Address", aliceAddress);
    printKeyValue("Output Directory", args.outputDir);

    const orderTypes: OrderType[] = [];
    
    if (args.orderType === "all") {
      orderTypes.push("SINGLE_FILL", "MULTIPLE_FILL_100", "MULTIPLE_FILL_50", "ETH_TO_BTC", "CANCELLATION");
    } else {
      // Map CLI order types to internal types
      const orderTypeMap: Record<string, OrderType> = {
        "single-fill": "SINGLE_FILL",
        "multiple-fill-100": "MULTIPLE_FILL_100",
        "multiple-fill-50": "MULTIPLE_FILL_50",
        "eth-to-btc": "ETH_TO_BTC",
        "cancellation": "CANCELLATION"
      };
      
      const orderType = orderTypeMap[args.orderType];
      if (!orderType) {
        throw new Error(`Unknown order type: ${args.orderType}\nUse --help to see available options`);
      }
      
      orderTypes.push(orderType);
    }

    // Create orders
    for (const orderType of orderTypes) {
      printSection(`Creating ${orderType} Order`);
      
      const timestamp = Date.now();
      const order = createOrderByType(
        orderType,
        BTCSeller,
        chainId,
        process.env.NETWORK || "POLYGON",
        getEscrowFactoryAddress().toString(),
        "", // accessToken not needed for order creation
        args.btcAmount,
        args.ethAmount
      );

      printOrderSummary(order, orderType, timestamp);
      saveOrderToFile(order, args.outputDir, orderType, timestamp);
    }

    printHeader("✅ Order Creation Complete");
    console.log(`Created ${orderTypes.length} order(s) in: ${args.outputDir}`);
    
  } catch (error) {
    console.error("❌ Error:", (error as Error).message);
    process.exit(1);
  }
}

// Run the CLI
if (require.main === module) {
  main();
}

export { createOrderByType, saveOrderToFile, printOrderSummary, CrossChainOrder };
