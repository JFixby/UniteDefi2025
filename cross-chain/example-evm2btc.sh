#!/bin/bash

# Cross-Chain Relay Demo - EVM to BTC Example
echo "🚀 Starting EVM to BTC Example..."

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

echo "🎯 Running EVM to BTC Example..."
echo "=================================="

# Run the EVM to BTC example
npx ts-node src/relay/relay-evm2btc-example.ts

echo ""
echo "🏁 EVM to BTC example completed!" 