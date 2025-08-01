#!/usr/bin/env node

import { ethers } from "ethers";
import * as fs from "fs";
import * as path from "path";
import * as crypto from "crypto";
import { getRpcUrl, getChainId, getAliceAddress, ALICE_PRIVATE_KEY } from "./variables";

interface OrderBTC2EVM {
  orderId: string;
  timestamp: number;
  network: string;
  chainId: number;
  
  BTCSeller: {
    EVMAddress: string;
    provides: {
      asset: "BTC";
      amount: string;
    };
    wants: {
      asset: "ETH" | "ERC20";
      amount: string;
      token?: string;
    };
  };
  
  timelock: {
    withdrawalPeriod: number;
    cancellationPeriod: number;
  };
  
  status: "CREATED" | "FILLED" | "COMPLETED" | "CANCELLED";
  
  contracts: {
    btcEscrowFactory: string;
    accessToken: string;
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

async function main() {
  printHeader("🔄 CREATING ATOMIC SWAP ORDER (BTC → ETH)");
  
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
  
  // Create BTC to EVM order with withdrawal
  const orderId = `order-btc2evm-${Date.now()}`;
  const timestamp = Date.now();
  
  const order: OrderBTC2EVM = {
    orderId,
    timestamp,
    network: networkName,
    chainId,
    
    BTCSeller: {
      EVMAddress: BTCSeller.address,
      provides: {
        asset: "BTC",
        amount: "0.002" // 0.002 BTC
      },
      wants: {
        asset: "ETH",
        amount: ethers.parseEther("0.02").toString() // 0.02 ETH
      }
    },
    
    timelock: {
      withdrawalPeriod: 0,     // 🎯  WITHDRAWAL!
      cancellationPeriod: 3600 // 1 hour cancellation period
    },
    
    status: "CREATED",
    
    contracts: {
      btcEscrowFactory: factoryAddress,
      accessToken: accessTokenAddress
    }
  };
  
  printSection("📋 ORDER DETAILS");
  printKeyValue("Order ID", orderId);
  printKeyValue("BTC Amount", `${order.BTCSeller.provides.amount} BTC`);
  printKeyValue("ETH Amount", `${ethers.formatEther(order.BTCSeller.wants.amount)} ETH`);
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
  
  printSection("🎯 NEXT STEPS (BTC to EVM FLOW)");
  console.log("1. [BTC Buyer] Create lightning invoice with secret:");
  console.log(`   ORDER_ID=${orderId} npm run btcbuyer:lightning:invoice`);
  console.log("\n2. [BTC Buyer] Create EVM escrow with ETH using the secret:");
  console.log(`   ORDER_ID=${orderId} npm run reverse:btcbuyer:escrow`);
  console.log("\n3. [BTC Seller] Pay lightning invoice (reveals secret):");
  console.log(`   ORDER_ID=${orderId} npm run reverse:btcseller:payln`);
  console.log("\n4. [BTC Seller] Claim ETH from escrow (using revealed secret):");
  console.log(`   ORDER_ID=${orderId} npm run reverse:btcseller:claim`);
  
  printSection("✅ ORDER SUMMARY");
  console.log(`Trade: ${order.BTCSeller.provides.amount} BTC → ${ethers.formatEther(order.BTCSeller.wants.amount)} ETH`);
  console.log("BTCSeller provides: BTC");
  console.log("BTC Buyer provides: ETH");
  console.log("Withdrawal: Immediate (0 seconds)");
  
  return order;
}

if (require.main === module) {
  main().catch(console.error);
}

export default main; 