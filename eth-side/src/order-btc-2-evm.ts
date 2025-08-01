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

async function main() {
  console.log("🔄 CREATING ATOMIC SWAP ORDER (BTC → ETH)");
  console.log("=================================================");
  
  // Get network info from variables.ts
  const rpcUrl = getRpcUrl();
  const chainId = getChainId();
  const networkName = chainId === 137 ? "polygon" : chainId === 1 ? "ethereum" : "unknown";
  
  console.log("🌐 Network:", networkName);
  console.log("🔗 Chain ID:", chainId);
  
  // Setup provider and BTCSeller account
  const provider = new ethers.JsonRpcProvider(rpcUrl);
  const BTCSeller = new ethers.Wallet(ALICE_PRIVATE_KEY, provider);
  console.log("👤 BTCSeller (EVM Address):", BTCSeller.address);
  
  const BTCSellerBalance = await provider.getBalance(BTCSeller.address);
  console.log("💰 BTCSeller ETH Balance:", ethers.formatEther(BTCSellerBalance), "ETH");
  
  
  // Get deployed contracts
  const factoryAddress = "0x";
  const accessTokenAddress = "0x";
  
  console.log("\n📋 CONTRACTS:");
  console.log("=============");
  console.log("🏭 Factory:", factoryAddress);
  console.log("🎫 Access Token:", accessTokenAddress);
  
  // Create BTC to EVM order with  withdrawal
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
  
  console.log("\n📋 BTC to EVM ORDER DETAILS:");
  console.log("=========================");
  console.log("📄 Order ID:", orderId);
  console.log("👤 BTCSeller (EVM):", order.BTCSeller.EVMAddress);
  console.log("🪙 BTCSeller provides:", order.BTCSeller.provides.amount, "BTC");
  console.log("💰 BTCSeller wants:", ethers.formatEther(order.BTCSeller.wants.amount), "ETH");
  
  // Save order to file
  const ordersDir = path.join(__dirname, "../orders");
  if (!fs.existsSync(ordersDir)) {
    fs.mkdirSync(ordersDir, { recursive: true });
  }
  
  const orderPath = path.join(ordersDir, `${orderId}.json`);
  fs.writeFileSync(orderPath, JSON.stringify(order, null, 2));
  
  console.log("\n✅ BTC to EVM ORDER CREATED SUCCESSFULLY!");
  console.log("=====================================");
  console.log("📄 Order ID:", orderId);
  console.log("💾 Order saved to:", orderPath);
  
  console.log("\n🎯 NEXT STEPS (BTC to EVM FLOW):");
  console.log("=============================");
  console.log("1. BTC Buyer creates lightning invoice with secret: ");
  console.log("   ORDER_ID=" + orderId + " npm run btcbuyer:lightning:invoice");
  console.log("3. BTC Buyer creates EVM escrow with ETH using the secret from the lightning invoice:");
  console.log("   ORDER_ID=" + orderId + " npm run reverse:btcbuyer:escrow");
  console.log("4. BTCSeller pays lightning invoice and (reveals secret):");
  console.log("   ORDER_ID=" + orderId + " npm run reverse:btcseller:payln");
  console.log("5. BTC Seller claims ETH from escrow (using revealed secret):");
  console.log("   ORDER_ID=" + orderId + " npm run reverse:btcseller:claim");
  
  console.log("\n🔄 BTC to EVM ATOMIC SWAP READY!");
  console.log("==============================");
  console.log("Trade:", order.BTCSeller.provides.amount, "BTC → ", ethers.formatEther(order.BTCSeller.wants.amount), "ETH");
  console.log("BTCSeller provides: BTC");
  console.log("BTC Buyer provides: ETH");
  console.log("Withdrawal:  (0 seconds)");

  
  return order;
}

if (require.main === module) {
  main().catch(console.error);
}

export default main; 