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

async function main() {
  console.log("🔄 CREATING ATOMIC SWAP ORDER (ETH → BTC)");
  console.log("====================================================");
  
  // Get network info from variables.ts
  const rpcUrl = getRpcUrl();
  const chainId = getChainId();
  const networkName = chainId === 137 ? "polygon" : chainId === 1 ? "ethereum" : "unknown";
  
  console.log("🌐 Network:", networkName);
  console.log("🔗 Chain ID:", chainId);
  
  // Setup provider and ETHSeller account
  const provider = new ethers.JsonRpcProvider(rpcUrl);
  const ETHSeller = new ethers.Wallet(ALICE_PRIVATE_KEY, provider);
  console.log("👤 ETHSeller (EVM Address):", ETHSeller.address);
  
  const ETHSellerBalance = await provider.getBalance(ETHSeller.address);
  console.log("💰 ETHSeller ETH Balance:", ethers.formatEther(ETHSellerBalance), "ETH");
  
  // Generate secure random secret
  const secretBytes = crypto.randomBytes(32);
  const secret = "0x" + secretBytes.toString("hex");
  const hashlock = ethers.sha256(secret);
  
  console.log("\n🔐 CRYPTOGRAPHIC SETUP:");
  console.log("=======================");
  console.log("🔑 Secret:", secret);
  console.log("🔒 Hashlock:", hashlock);
  console.log("⚡ Lightning Invoice Amount:", "0.001 BTC");
  console.log("⏰ Lightning Invoice Expiry:", new Date((Math.floor(Date.now() / 1000) + 3600) * 1000).toISOString());
  
  console.log("\n📋 CONTRACTS:");
  console.log("=============");

  
  // Create ETH to BTC order with  withdrawal
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
  
  console.log("\n📋 ETH to BTC ORDER DETAILS:");
  console.log("===========================");
  console.log("📄 Order ID:", orderId);
  console.log("👤 ETHSeller (EVM):", order.ETHSeller.EVMAddress);
  console.log("💰 ETHSeller provides:", ethers.formatEther(order.ETHSeller.provides.amount), "ETH");
  console.log("🪙 ETHSeller wants:", order.ETHSeller.wants.amount, "BTC");
  console.log("⏰ Withdrawal period:", order.timelock.withdrawalPeriod, "seconds (!)");
  console.log("⏰ Cancellation period:", order.timelock.cancellationPeriod, "seconds");
  
  // Save order to file
  const ordersDir = path.join(__dirname, "../orders");
  if (!fs.existsSync(ordersDir)) {
    fs.mkdirSync(ordersDir, { recursive: true });
  }
  
  const orderPath = path.join(ordersDir, `${orderId}.json`);
  fs.writeFileSync(orderPath, JSON.stringify(order, null, 2));
  
  console.log("\n✅ ORDER CREATED SUCCESSFULLY!");
  console.log("==============================");
  console.log("📄 Order ID:", orderId);
  console.log("🔑 Secret:", secret);
  console.log("🔒 Hashlock:", hashlock);
  console.log("💾 Order saved to:", orderPath);
  
  console.log("\n🎯 NEXT STEPS (ETH to BTC via Lightning FLOW):");
  console.log("=============================================");
  console.log("1. ETHSeller creates Lightning invoice with secret:");
  console.log("   ORDER_ID=" + orderId + " npm run ethseller:lightning:invoice");
  console.log("2. ETHSeller creates EVM escrow with ETH (using invoice secret):");
  console.log("   ORDER_ID=" + orderId + " npm run ethseller:escrow");
  console.log("3. BTC Buyer pays Lightning invoice (reveals secret):");
  console.log("   ORDER_ID=" + orderId + " npm run btcbuyer:lightning:pay");
  console.log("5. BTC Buyer claims ETH from escrow (using revealed secret):");
  console.log("   ORDER_ID=" + orderId + " npm run btcbuyer:claim");
  
  console.log("\n🔄 ETH to BTC via Lightning ATOMIC SWAP READY!");
  console.log("=============================================");
  console.log("Trade:", ethers.formatEther(order.ETHSeller.provides.amount), "ETH →", order.ETHSeller.wants.amount, "BTC");
  console.log("ETHSeller provides: ETH (via EVM escrow)");
  console.log("BTC Buyer provides: BTC (via Lightning Network)");
  console.log("Lightning invoice secret used for escrow");
  console.log("Withdrawal:  (0 seconds)");
  console.log("Cancellation: 1 hour safety period");
  console.log("Perfect for eth to btc via lightning atomic swap testing!");
  
  return order;
}

if (require.main === module) {
  main().catch(console.error);
}

export default main; 