import { Relay } from './relay';
import { OrderBTC2EVM, OrderEVM2BTC } from '../api/order';
import { issueLightningInvoice } from '../utils/lightning';

// Example usage of the Relay class methods
export async function btcToEvmExample() {
  const relay = new Relay();
  
  // Example 1: Process BTC to EVM order
  console.log('\n🚀 === BTC to EVM Order Example ===');
  const btcToEvmOrder = new OrderBTC2EVM(
    0.001, // amountBtc
    0.015, // amountEth
    "0x742d35Cc6634C0532925a3b8D4C9db96C4b4d8b6" // ethAddress
  );
  
  const btcToEvmResponse = await relay.processOrderBTC2EVM(btcToEvmOrder);
  console.log('📋 BTC to EVM Response:', btcToEvmResponse);
  console.log('⚡ Lightning Invoice:', btcToEvmResponse.lightningNetworkInvoice.substring(0, 25) + '...');
}

export async function evmToBtcExample() {

  const btcLightningNetInvoice = await issueLightningInvoice(0.01, 'alice',"Alice selling BTC for ETH");

  const relay = new Relay();
  
  // Example 2: Process EVM to BTC order
  console.log('\n🚀 === EVM to BTC Order Example ===');
  const evmToBtcOrder = new OrderEVM2BTC(
    0.001, // amountBtc
    btcLightningNetInvoice,
    0.015 // amountEth
  );
  
  const evmToBtcResponse = relay.processOrderEVM2BTC(evmToBtcOrder);
  console.log('📋 EVM to BTC Response:', evmToBtcResponse);
}

export async function runBothExamples() {
  console.log('🎯 Cross-Chain Relay Demo - Running Both Examples...\n');
  await btcToEvmExample();
  await evmToBtcExample();
  console.log('\n🎉 Both demos completed successfully!');
}

// Run the example based on command line arguments
if (require.main === module) {
  const args = process.argv.slice(2);
  const command = args[0] || 'both';
  
  const runExample = async () => {
    switch (command.toLowerCase()) {
      case 'btc2evm':
      case 'btc-to-evm':
        console.log('🎯 Cross-Chain Relay Demo - BTC to EVM Example...\n');
        await btcToEvmExample();
        console.log('\n🎉 BTC to EVM demo completed successfully!');
        break;
        
      case 'evm2btc':
      case 'evm-to-btc':
        console.log('🎯 Cross-Chain Relay Demo - EVM to BTC Example...\n');
        await evmToBtcExample();
        console.log('\n🎉 EVM to BTC demo completed successfully!');
        break;
        
      case 'both':
      default:
        await runBothExamples();
        break;
        
      case 'help':
        console.log('📖 Available commands:');
        console.log('  npm run example btc2evm    - Run BTC to EVM example only');
        console.log('  npm run example evm2btc    - Run EVM to BTC example only');
        console.log('  npm run example both       - Run both examples (default)');
        console.log('  npm run example help       - Show this help message');
        break;
    }
  };
  
  runExample().catch(console.error);
} 