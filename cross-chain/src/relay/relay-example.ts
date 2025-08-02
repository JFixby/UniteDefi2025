import { Relay } from './relay';
import { OrderBTC2EVM, OrderEVM2BTC } from '../maker-front/order';

// Example usage of the Relay class methods
export function exampleUsage() {
  const relay = new Relay();
  
  // Example 1: Process BTC to EVM order
  console.log('\n🚀 === BTC to EVM Order Example ===');
  const btcToEvmOrder = new OrderBTC2EVM(
    0.001, // amountBtc
    0.015, // amountEth
    "0x742d35Cc6634C0532925a3b8D4C9db96C4b4d8b6" // ethAddress
  );
  
  const btcToEvmResponse = relay.processOrderBTC2EVM(btcToEvmOrder);
  console.log('📋 BTC to EVM Response:', btcToEvmResponse);
  console.log('⚡ Lightning Invoice:', btcToEvmResponse.lightningNetworkInvoice.substring(0, 25) + '...');
}

export function evmToBtcExample() {
  const relay = new Relay();
  
  // Example 2: Process EVM to BTC order
  console.log('\n🚀 === EVM to BTC Order Example ===');
  const evmToBtcOrder = new OrderEVM2BTC(
    0.001, // amountBtc
    "lnbc100u1p5guy6ypp5eeyft8ntelam75uvpnz8lcx46qpp5aa6a4rrvc2qtc74qaz8776scqzyssp5us7lxaq6xny2e85sjfxa6dttua7v0ag32q2huzue5m67czzj5nes9q7sqqqqqqqqqqqqqqqqqqqsqqqqqysgqdqqmqz9gxqyjw5qrzjqwryaup9lh50kkranzgcdnn2fgvx390wgj5jd07rwr3vxeje0glcllmqlf20lk5u3sqqqqlgqqqqqeqqjqr4dqnmedj6pz9jvh2ufw0v0grfa27khg7tfwvun8u9fcxg952ua5zed68d2naa6whng33z7qnvt8x5x07lzf6lchegvr70xsrjmk8uqpsjef9k", // btcLightningNetInvoice
    0.015 // amountEth
  );
  
  const evmToBtcResponse = relay.processOrderEVM2BTC(evmToBtcOrder);
  console.log('📋 EVM to BTC Response:', evmToBtcResponse);
}

export function runBothExamples() {
  console.log('🎯 Cross-Chain Relay Demo - Running Both Examples...\n');
  exampleUsage();
  evmToBtcExample();
  console.log('\n🎉 Both demos completed successfully!');
}

// Run the example based on command line arguments
if (require.main === module) {
  const args = process.argv.slice(2);
  const command = args[0] || 'both';
  
  switch (command.toLowerCase()) {
    case 'btc2evm':
    case 'btc-to-evm':
      console.log('🎯 Cross-Chain Relay Demo - BTC to EVM Example...\n');
      exampleUsage();
      console.log('\n🎉 BTC to EVM demo completed successfully!');
      break;
      
    case 'evm2btc':
    case 'evm-to-btc':
      console.log('🎯 Cross-Chain Relay Demo - EVM to BTC Example...\n');
      evmToBtcExample();
      console.log('\n🎉 EVM to BTC demo completed successfully!');
      break;
      
    case 'both':
    default:
      runBothExamples();
      break;
      
    case 'help':
      console.log('📖 Available commands:');
      console.log('  npm run example btc2evm    - Run BTC to EVM example only');
      console.log('  npm run example evm2btc    - Run EVM to BTC example only');
      console.log('  npm run example both       - Run both examples (default)');
      console.log('  npm run example help       - Show this help message');
      break;
  }
} 