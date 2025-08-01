#!/bin/bash

# EVM to BTC Cross-Chain Order Creator Script
# Creates orders for swapping 1.5 ETH to BTC

echo "🔄 Creating EVM to BTC Cross-Chain Orders"
echo "=========================================="

# Set amounts
ETH_AMOUNT="1.5"
BTC_AMOUNT="0.1"  # Approximate BTC equivalent for 1.5 ETH

# Create output directory
OUTPUT_DIR="./orders/evm2btc"
mkdir -p "$OUTPUT_DIR"

echo "📊 Order Parameters:"
echo "  ETH Amount: $ETH_AMOUNT"
echo "  BTC Amount: $BTC_AMOUNT"
echo "  Output Directory: $OUTPUT_DIR"
echo ""

# Create single fill order
echo "📝 Creating Single Fill Order..."
npx ts-node src/order.ts single-fill --eth-amount "$ETH_AMOUNT" --btc-amount "$BTC_AMOUNT" --output "$OUTPUT_DIR"

echo ""
echo "✅ All EVM to BTC orders created successfully!"
echo "📁 Orders saved in: $OUTPUT_DIR"
echo ""
echo "📋 Created Orders:"
ls -la "$OUTPUT_DIR"/*.json 2>/dev/null || echo "No order files found" 