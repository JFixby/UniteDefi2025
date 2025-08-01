#!/bin/bash

# BTC to EVM Cross-Chain Order Creator Script
# Creates orders for swapping 0.1 BTC to ETH

echo "🔄 Creating BTC to EVM Cross-Chain Orders"
echo "=========================================="

# Set amounts
BTC_AMOUNT="0.1"
ETH_AMOUNT="1.5"  # Approximate ETH equivalent for 0.1 BTC

# Create output directory
OUTPUT_DIR="./orders/btc2evm"
mkdir -p "$OUTPUT_DIR"

echo "📊 Order Parameters:"
echo "  BTC Amount: $BTC_AMOUNT"
echo "  ETH Amount: $ETH_AMOUNT"
echo "  Output Directory: $OUTPUT_DIR"
echo ""

# Create single fill order
echo "📝 Creating Single Fill Order..."
npx ts-node src/order.ts single-fill --btc-amount "$BTC_AMOUNT" --eth-amount "$ETH_AMOUNT" --output "$OUTPUT_DIR"

echo ""
echo "✅ All BTC to EVM orders created successfully!"
echo "📁 Orders saved in: $OUTPUT_DIR"
echo ""
echo "📋 Created Orders:"
ls -la "$OUTPUT_DIR"/*.json 2>/dev/null || echo "No order files found" 