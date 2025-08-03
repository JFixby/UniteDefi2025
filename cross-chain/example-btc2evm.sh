#!/bin/bash

# Cross-Chain Relay Demo - BTC to EVM Example
echo "🚀 Starting BTC to EVM Example..."

# Clear console
clear

# Disable SSL verification (for development purposes)
export NODE_TLS_REJECT_UNAUTHORIZED=0

# Navigate to the cross-chain directory
cd "$(dirname "$0")"

# Compile TypeScript code
echo "📦 Compiling TypeScript code..."
npm run build

# Check if compilation was successful
if [ $? -ne 0 ]; then
    echo "❌ Compilation failed!"
    exit 1
fi

echo "✅ Compilation successful!"

# Clear console again after compilation
clear

echo "🎯 Running BTC to EVM Example..."
echo "=================================="

# Run the BTC to EVM example
npx ts-node src/relay/relay-btc2evm-example.ts

echo ""
echo "🏁 BTC to EVM example completed!" 