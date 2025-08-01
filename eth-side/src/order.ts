#!/usr/bin/env node

import { ethers } from "ethers";
import * as fs from "fs";
import * as path from "path";
import * as crypto from "crypto";
import { getRpcUrl, getChainId, getAliceAddress, ALICE_PRIVATE_KEY } from "./variables";

// Mock SDK classes for demonstration
// In a real implementation, these would be imported from the cross-chain SDK
class MockAddress {
  constructor(public value: string) {}
  toString() { return this.value; }
}

class MockHashLock {
  static forSingleFill(secret: string): MockHashLock {
    return new MockHashLock("single", secret);
  }
  
  static forMultipleFills(leaves: string[]): MockHashLock {
    return new MockHashLock("multiple", undefined, leaves);
  }
  
  static getMerkleLeaves(secrets: string[]): string[] {
    return secrets.map((_, i) => `0x${i.toString().padStart(64, '0')}`);
  }
  
  constructor(
    public type: "single" | "multiple",
    public secret?: string,
    public leaves?: string[]
  ) {}
}

class MockTimeLocks {
  static new(params: any): MockTimeLocks {
    return new MockTimeLocks(params);
  }
  
  constructor(public params: any) {}
}

class MockAuctionDetails {
  constructor(public params: any) {}
}

class MockCrossChainOrder {
  static new(
    escrowFactory: MockAddress,
    orderInfo: any,
    escrowParams: any,
    details: any,
    extra?: any
  ): MockCrossChainOrder {
    return new MockCrossChainOrder(orderInfo, escrowParams, details, extra);
  }
  
  constructor(
    public orderInfo: any,
    public escrowParams: any,
    public details: any,
    public extra?: any
  ) {}
}

// Mock utility functions
const randBigInt = (max: bigint): bigint => {
  return BigInt(Math.floor(Math.random() * Number(max)));
};

const Address = MockAddress;
const HashLock = MockHashLock;
const TimeLocks = MockTimeLocks;
const AuctionDetails = MockAuctionDetails;
const CrossChainOrder = MockCrossChainOrder;

// Order types based on the documentation
type OrderType = 
  | "SINGLE_FILL"           // Simple atomic swap with single execution
  | "MULTIPLE_FILL_100"     // Order that can be filled multiple times, filled completely
  | "MULTIPLE_FILL_50"      // Order that can be filled multiple times, filled partially
  | "ETH_TO_BTC"           // Reverse direction swap from Ethereum to Bitcoin
  | "CANCELLATION";         // Order designed for cancellation testing

interface OrderData {
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

  // SDK order data
  sdkOrder?: any;
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

// Mock token addresses - in real implementation these would come from config
const MOCK_TOKENS = {
  BTC: "0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599", // WBTC on Ethereum
  ETH: "0x0000000000000000000000000000000000000000", // Native ETH
  WETH: "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2" // WETH on Ethereum
};

// Mock contract addresses - in real implementation these would come from config
const MOCK_CONTRACTS = {
  escrowFactory: "0x1234567890123456789012345678901234567890",
  accessToken: "0x0987654321098765432109876543210987654321"
};

function createOrderByType(
  orderType: OrderType,
  BTCSeller: ethers.Wallet,
  chainId: number,
  networkName: string,
  factoryAddress: string,
  accessTokenAddress: string,
  btcAmount: string,
  ethAmount: string
): OrderData {
  const timestamp = Date.now();
  const orderId = `order-${orderType.toLowerCase().replace(/_/g, '_')}-${timestamp}`;
  
  // Convert amounts to wei/satoshi
  const btcAmountWei = ethers.parseUnits(btcAmount, 8); // BTC has 8 decimals
  const ethAmountWei = ethers.parseUnits(ethAmount, 18); // ETH has 18 decimals

  // Create SDK order using CrossChainOrder.new()
  let sdkOrder: any;
  let secrets: string[] = [];
  let hashLockType: "SINGLE" | "MULTIPLE" = "SINGLE";

  try {
    // Common parameters
    const maker = new Address(BTCSeller.address);
    const makerAsset = new Address(MOCK_TOKENS.BTC);
    const takerAsset = new Address(MOCK_TOKENS.ETH);
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
    });

    // Common auction settings
    const auction = new AuctionDetails({
      initialRateBump: 0,
      points: [],
      duration: 120n,
      startTime: BigInt(Math.floor(Date.now() / 1000))
    });

    // Common whitelist
    const whitelist = [
      {
        address: new Address("0x1234567890123456789012345678901234567890"), // Mock resolver
        allowFrom: 0n
      }
    ];

    // Create hash lock based on order type
    let hashLock: MockHashLock;
    
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

    // Create the SDK order
    sdkOrder = CrossChainOrder.new(
      escrowFactory,
      {
        salt: randBigInt(1000n),
        maker,
        makingAmount: orderType === "ETH_TO_BTC" ? ethAmountWei : btcAmountWei,
        takingAmount: orderType === "ETH_TO_BTC" ? btcAmountWei : ethAmountWei,
        makerAsset: orderType === "ETH_TO_BTC" ? new Address(MOCK_TOKENS.ETH) : makerAsset,
        takerAsset: orderType === "ETH_TO_BTC" ? new Address(MOCK_TOKENS.BTC) : takerAsset
      },
      {
        hashLock,
        timeLocks,
        srcChainId: chainId as any,
        dstChainId: (orderType === "ETH_TO_BTC" ? 1 : chainId) as any, // Bitcoin chain ID
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

  // Create the order data structure
  const order: OrderData = {
    orderId,
    timestamp,
    network: networkName,
    chainId,
    orderType,
    
    BTCSeller: {
      EVMAddress: BTCSeller.address,
      provides: {
        asset: orderType === "ETH_TO_BTC" ? "ETH" : "BTC",
        amount: orderType === "ETH_TO_BTC" ? ethAmount : btcAmount
      },
      wants: {
        asset: orderType === "ETH_TO_BTC" ? "BTC" : "ETH",
        amount: orderType === "ETH_TO_BTC" ? btcAmount : ethAmount
      }
    },
    
    timelock: {
      withdrawalPeriod: orderType === "CANCELLATION" ? 0 : 10,
      cancellationPeriod: 121,
      publicWithdrawalPeriod: 120,
      publicCancellationPeriod: 122
    },
    
    fillOptions: {
      allowPartialFills: orderType.includes("MULTIPLE_FILL"),
      allowMultipleFills: orderType.includes("MULTIPLE_FILL"),
      fillPercentage: orderType === "MULTIPLE_FILL_50" ? 50 : undefined
    },
    
    status: "CREATED",
    
    contracts: {
      btcEscrowFactory: factoryAddress,
      accessToken: accessTokenAddress
    },
    
    crossChain: {
      srcChainId: chainId,
      dstChainId: orderType === "ETH_TO_BTC" ? 1 : chainId,
      srcSafetyDeposit: ethers.formatEther(ethers.parseEther("0.001")),
      dstSafetyDeposit: ethers.formatEther(ethers.parseEther("0.001")),
      hashLock: {
        type: hashLockType,
        secret: hashLockType === "SINGLE" ? secrets[0] : undefined,
        secrets: hashLockType === "MULTIPLE" ? secrets : undefined,
        merkleLeaves: hashLockType === "MULTIPLE" ? HashLock.getMerkleLeaves(secrets) : undefined
      }
    },

    sdkOrder
  };

  return order;
}

function saveOrderToFile(order: OrderData, outputDir: string): void {
  // Ensure output directory exists
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const filename = `${order.orderId}.json`;
  const filepath = path.join(outputDir, filename);
  
  // Remove SDK order from JSON output to keep it clean
  const { sdkOrder, ...orderForJson } = order;
  
  fs.writeFileSync(filepath, JSON.stringify(orderForJson, null, 2));
  console.log(`✅ Order saved to: ${filepath}`);
}

function printOrderSummary(order: OrderData): void {
  printSection("Order Summary");
  printKeyValue("Order ID", order.orderId);
  printKeyValue("Type", order.orderType);
  printKeyValue("Network", order.network);
  printKeyValue("Chain ID", order.chainId);
  printKeyValue("Status", order.status);
  
  printSection("Swap Details");
  printKeyValue("Maker Address", order.BTCSeller.EVMAddress);
  printKeyValue("Provides", `${order.BTCSeller.provides.amount} ${order.BTCSeller.provides.asset}`);
  printKeyValue("Wants", `${order.BTCSeller.wants.amount} ${order.BTCSeller.wants.asset}`);
  
  printSection("Fill Options");
  printKeyValue("Allow Partial Fills", order.fillOptions.allowPartialFills.toString());
  printKeyValue("Allow Multiple Fills", order.fillOptions.allowMultipleFills.toString());
  if (order.fillOptions.fillPercentage) {
    printKeyValue("Fill Percentage", `${order.fillOptions.fillPercentage}%`);
  }
  
  printSection("Time Locks");
  printKeyValue("Withdrawal Period", `${order.timelock.withdrawalPeriod}s`);
  printKeyValue("Public Withdrawal", `${order.timelock.publicWithdrawalPeriod}s`);
  printKeyValue("Cancellation Period", `${order.timelock.cancellationPeriod}s`);
  printKeyValue("Public Cancellation", `${order.timelock.publicCancellationPeriod}s`);
  
  if (order.crossChain) {
    printSection("Cross-Chain Details");
    printKeyValue("Source Chain ID", order.crossChain.srcChainId);
    printKeyValue("Destination Chain ID", order.crossChain.dstChainId);
    printKeyValue("Source Safety Deposit", `${order.crossChain.srcSafetyDeposit} ETH`);
    printKeyValue("Destination Safety Deposit", `${order.crossChain.dstSafetyDeposit} ETH`);
    printKeyValue("Hash Lock Type", order.crossChain.hashLock.type);
  }
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
      
      const order = createOrderByType(
        orderType,
        BTCSeller,
        chainId,
        process.env.NETWORK || "POLYGON",
        MOCK_CONTRACTS.escrowFactory,
        MOCK_CONTRACTS.accessToken,
        args.btcAmount,
        args.ethAmount
      );

      printOrderSummary(order);
      saveOrderToFile(order, args.outputDir);
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

export { createOrderByType, saveOrderToFile, printOrderSummary };
