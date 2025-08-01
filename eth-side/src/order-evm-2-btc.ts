#!/usr/bin/env node

import { ethers } from "ethers";
import * as fs from "fs";
import * as path from "path";
import * as crypto from "crypto";
import { getRpcUrl, getChainId, getAliceAddress, ALICE_PRIVATE_KEY } from "./variables";

interface OrderEVM2BTC {
  orderId: string;
  timestamp: number;
  network: string;
  chainId: number;
  
  ETHSeller: {
    EVMAddress: string;
    provides: {
      asset: "ETH" | "ERC20";
      amount: string;
      token?: string;
    };
    wants: {
      asset: "BTC";
      amount: string;
    };
  };
  
  lightning: {
    invoiceSecret: string;
    invoiceHashlock: string;
    invoiceAmount: string;
    invoiceExpiry: number;
  };
  
  secret: string;
  hashlock: string;
  
  timelock: {
    withdrawalPeriod: number;
    cancellationPeriod: number;
  };
  
  status: "CREATED" | "FILLED" | "COMPLETED" | "CANCELLED";
  
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

async function main() {
  printHeader("🔄 CREATING ATOMIC SWAP ORDER (ETH → BTC)");
  
  // Get network info from variables.ts
  const rpcUrl = getRpcUrl();
  const chainId = getChainId();
  const networkName = chainId === 137 ? "polygon" : chainId === 1 ? "ethereum" : "unknown";
  
  printSection("🌐 NETWORK CONFIGURATION");
  printKeyValue("Network", networkName);
  printKeyValue("Chain ID", chainId);
  
  // Setup provider and ETHSeller account
  const provider = new ethers.JsonRpcProvider(rpcUrl);
  const ETHSeller = new ethers.Wallet(ALICE_PRIVATE_KEY, provider);
  
  printSection("👤 ETH SELLER DETAILS");
  printKeyValue("EVM Address", ETHSeller.address);
  
  const ETHSellerBalance = await provider.getBalance(ETHSeller.address);
  printKeyValue("ETH Balance", `${ethers.formatEther(ETHSellerBalance)} ETH`);
  
  // Generate secure random secret
  const secretBytes = crypto.randomBytes(32);
  const secret = "0x" + secretBytes.toString("hex");
  const hashlock = ethers.sha256(secret);
  
  printSection("🔐 CRYPTOGRAPHIC SETUP");
  printKeyValue("Secret", secret);
  printKeyValue("Hashlock", hashlock);
  printKeyValue("Lightning Invoice Amount", "0.001 BTC");
  printKeyValue("Lightning Invoice Expiry", new Date((Math.floor(Date.now() / 1000) + 3600) * 1000).toISOString());
  
  // Create ETH to BTC order with withdrawal
  const orderId = `order-evm2btc-${Date.now()}`;
  const timestamp = Date.now();
  
  const order: OrderEVM2BTC = {
    orderId,
    timestamp,
    network: networkName,
    chainId,
    
    ETHSeller: {
      EVMAddress: ETHSeller.address,
      provides: {
        asset: "ETH",
        amount: ethers.parseEther("0.01").toString() // 0.01 ETH
      },
      wants: {
        asset: "BTC",
        amount: "0.001", // 0.001 BTC
      }
    },
    
    lightning: {
      invoiceSecret: secret, // Use the same secret for Lightning invoice
      invoiceHashlock: hashlock, // Use the same hashlock for Lightning invoice
      invoiceAmount: "0.001", // BTC amount for Lightning invoice
      invoiceExpiry: Math.floor(Date.now() / 1000) + 3600 // 1 hour expiry
    },
    
    secret,
    hashlock,
    
    timelock: {
      withdrawalPeriod: 0,     // 🎯  WITHDRAWAL!
      cancellationPeriod: 3600 // 1 hour cancellation period
    },
    
    status: "CREATED",
    
  };
  
  printSection("📋 ORDER DETAILS");
  printKeyValue("Order ID", orderId);
  printKeyValue("ETH Amount", `${ethers.formatEther(order.ETHSeller.provides.amount)} ETH`);
  printKeyValue("BTC Amount", `${order.ETHSeller.wants.amount} BTC`);
  printKeyValue("Withdrawal Period", `${order.timelock.withdrawalPeriod} seconds`);
  printKeyValue("Cancellation Period", `${order.timelock.cancellationPeriod} seconds`);
  
  // Save order to file
  const ordersDir = path.join(__dirname, "../orders");
  if (!fs.existsSync(ordersDir)) {
    fs.mkdirSync(ordersDir, { recursive: true });
  }
  
  const orderPath = path.join(ordersDir, `${orderId}.json`);
  fs.writeFileSync(orderPath, JSON.stringify(order, null, 2));
  
  printSection("💾 ORDER SAVED");
  printKeyValue("File Path", orderPath);
  printKeyValue("Secret", secret);
  printKeyValue("Hashlock", hashlock);
  
  printSection("🎯 NEXT STEPS (ETH to BTC FLOW)");
  console.log("1. [ETH Seller] Create Lightning invoice with secret:");
  console.log(`   ORDER_ID=${orderId} npm run ethseller:lightning:invoice`);
  console.log("\n2. [ETH Seller] Create EVM escrow with ETH (using invoice secret):");
  console.log(`   ORDER_ID=${orderId} npm run ethseller:escrow`);
  console.log("\n3. [ETH Buyer] Pay Lightning invoice (reveals secret):");
  console.log(`   ORDER_ID=${orderId} npm run btcbuyer:lightning:pay`);
  console.log("\n4. [ETH Buyer] Claim ETH from escrow (using revealed secret):");
  console.log(`   ORDER_ID=${orderId} npm run btcbuyer:claim`);
  
  printSection("✅ ORDER SUMMARY");
  console.log(`Trade: ${ethers.formatEther(order.ETHSeller.provides.amount)} ETH → ${order.ETHSeller.wants.amount} BTC`);
  console.log("ETH Seller provides: ETH (via EVM escrow)");
  console.log("ETH Buyer provides: BTC (via Lightning Network)");
  console.log("Lightning invoice secret used for escrow");
  console.log("Withdrawal: (0 seconds)");
  console.log("Cancellation: 1 hour safety period");
  
  return order;
}

if (require.main === module) {
  main().catch(console.error);
}

export default main; 