import { Relay } from './relay';
import { OrderBTC2EVM, OrderEVM2BTC } from '../api/order';
import { issueLightningInvoice } from '../utils/lightning';
import { depositETH } from '../utils/evm';
import { ALICE_PRIVATE_KEY, getCarolAddress } from '../variables';

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
  const amountBtc = 0.0005;
  const amountEth = 0.015;
  
  console.log('\n🚀 === EVM to BTC Order Example ===');
  console.log(`💰 Amount BTC: ${amountBtc}`);
  console.log(`💰 Amount ETH: ${amountEth}`);
  
  // Step 1: Generate Lightning Network invoice for BTC
  console.log('\n📋 Step 1: Generating Lightning Network invoice...');
  const invoiceData = await issueLightningInvoice(amountBtc, 'alice', "Alice selling BTC for ETH");
  const hashedSecret = invoiceData.r_hash;
  const btcLightningNetInvoice = invoiceData.payment_request;
  
  console.log(`⚡ Lightning Invoice: ${btcLightningNetInvoice.substring(0, 25)}...`);
  console.log(`🔐 Hashed Secret: ${hashedSecret}`);
  
  // Step 2: Deposit ETH into escrow with HTLC
  console.log('\n📋 Step 2: Depositing ETH into escrow...');
  const expirationSeconds = 10; // 10 seconds for demo purposes
  
  const transactionInfo = await depositETH({
    amountEth: amountEth,
    hashedSecret: hashedSecret,
    expirationSeconds: expirationSeconds,
    depositorPrivateKey: ALICE_PRIVATE_KEY,
    claimerAddress: getCarolAddress()
  });
  
  // Print transaction info for debug
  console.log('\n📋 Transaction Information:');
  console.log(`🆔 Deposit ID: ${transactionInfo.depositId}`);
  console.log(`🔗 Transaction Hash: ${transactionInfo.txHash}`);
  console.log(`🌐 Explorer URL: ${transactionInfo.explorerUrl}`);
  console.log(`📦 Escrow Address: ${transactionInfo.escrowAddress}`);
  console.log(`💰 Amount (Wei): ${transactionInfo.amountWei}`);
  console.log(`⏰ Expiration Time: ${new Date(transactionInfo.expirationTime * 1000).toISOString()}`);

  // Step 3: Process EVM to BTC order through relay
  console.log('\n📋 Step 3: Processing order through relay...');
  const relay = new Relay();
  
  const evmToBtcOrder = new OrderEVM2BTC(
    amountBtc, // amountBtc
    btcLightningNetInvoice, // btcLightningNetInvoice
    amountEth // amountEth
  );
  
  const evmToBtcResponse = await relay.processOrderEVM2BTC(evmToBtcOrder);
  console.log('📋 EVM to BTC Response:', evmToBtcResponse);
  
  console.log('\n✅ EVM to BTC example completed!');
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