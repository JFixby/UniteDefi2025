import { Relay } from './relay';
import { OrderBTC2EVM, OrderEVM2BTC } from '../api/order';
import { issueLightningInvoice, payLightningInvoice } from '../utils/lightning';
import { depositETH, checkDepositEVM } from '../utils/evm';
import { ALICE_PRIVATE_KEY, getCarolAddress, getAliceAddress } from '../variables';
import * as bolt11 from 'bolt11';
import { ResolverBTC2EVM } from './resolver_btc2evm';

// Example usage of the Relay class methods
export async function btcToEvmExample() {
  const relay = new Relay();
  
  // Example 1: Process BTC to EVM order
  console.log('\n🚀 === BTC to EVM Order Example ===');
  const amountBtc = 0.0005;
  const amountEth = 0.015;
  
  console.log(`💰 Amount BTC: ${amountBtc}`);
  console.log(`💰 Amount ETH: ${amountEth}`);

  const btcToEvmOrder = new OrderBTC2EVM(
    amountBtc, // amountBtc
    amountEth, // amountEth
    getAliceAddress(),
  );
  
  // Step 1: Process order through relay to get Lightning invoice
  const btcToEvmResponse = await relay.processOrderBTC2EVM(btcToEvmOrder);
  console.log('📋 BTC to EVM Response:', btcToEvmResponse);
  console.log('⚡ Lightning Invoice:', btcToEvmResponse.lightningNetworkInvoice.substring(0, 25) + '...');

  // Step 2: Extract and decode the Lightning invoice
  console.log('\n📋 Step 2: Decoding Lightning invoice...');
  const decodedInvoice = bolt11.decode(btcToEvmResponse.lightningNetworkInvoice);
  const paymentHash = decodedInvoice.tags.find(tag => tag.tagName === 'payment_hash')?.data;
  
  if (!paymentHash) {
    throw new Error('Payment hash not found in Lightning invoice');
  }
  
  // Convert payment hash to hex string format expected by EVM
  const hashedSecret = '0x' + paymentHash;
  
  console.log(`🔑 Payment Hash: ${paymentHash}`);
  console.log(`🔐 Hashed Secret: ${hashedSecret}`);

  // Step 3: Actually pay the Lightning invoice
  console.log('\n📋 Step 3: Paying Lightning invoice...');
  const paymentReceipt = await payLightningInvoice(btcToEvmResponse.lightningNetworkInvoice, 'alice');
  const secret = paymentReceipt.secret;
  console.log(`🔓 Payment completed! Secret revealed: ${secret}`);

  // Step 4: Use the secret to claim the escrow deposit
  console.log('\n📋 Step 4: Claiming escrow deposit with secret...');
  
  // Import the claimETH function
  const { claimETH } = await import('../utils/evm');
  
  // Claim the deposit using the secret revealed from Lightning payment
  const claimResult = await claimETH({
    depositId: hashedSecret, // The payment hash from Lightning invoice
    secret: secret, // The secret revealed from Lightning payment
    claimerPrivateKey: ALICE_PRIVATE_KEY // Alice's private key to claim the deposit
  });
  
  console.log('✅ Deposit claimed successfully!');
  console.log(`🔗 Transaction Hash: ${claimResult.txHash}`);
  console.log(`🌐 Explorer URL: ${claimResult.explorerUrl}`);
  console.log(`💰 Amount Claimed: ${amountEth} ETH`);
  console.log(`👤 Claimer: ${getAliceAddress()}`);
  console.log(`🔓 Secret Used: ${claimResult.secret}`);

  console.log('\n✅ BTC to EVM example completed!');
}

/**
 * Waits for the resolver to claim the deposit from the escrow contract
 * @param hashedSecret - The deposit ID (hashed secret) to monitor
 * @param maxWaitTimeSeconds - Maximum time to wait in seconds (default: 60)
 * @param checkIntervalSeconds - Interval between checks in seconds (default: 5)
 */
async function waitResolverClaimDeposit(
  hashedSecret: string, 
  maxWaitTimeSeconds: number = 60, 
  checkIntervalSeconds: number = 5
): Promise<void> {
  console.log('\n⏳ Waiting for resolver to claim deposit...');
  console.log(`🔍 Monitoring deposit ID: ${hashedSecret}`);
  console.log(`⏰ Max wait time: ${maxWaitTimeSeconds} seconds`);
  console.log(`🔄 Check interval: ${checkIntervalSeconds} seconds`);
  
  const startTime = Date.now();
  const maxWaitTimeMs = maxWaitTimeSeconds * 1000;
  let attempts = 0;
  
  return new Promise((resolve, reject) => {
    const checkInterval = setInterval(async () => {
      attempts++;
      const elapsedMs = Date.now() - startTime;
      const elapsedSeconds = Math.floor(elapsedMs / 1000);
      
      console.log(`\n🔍 Check attempt ${attempts} (${elapsedSeconds}s elapsed)...`);
      
      try {
        // Check deposit status
        const depositStatus = await checkDepositEVM(hashedSecret);
        
        if (!depositStatus.exists) {
          console.log('❌ Deposit not found - it may have been claimed or never existed');
          clearInterval(checkInterval);
          reject(new Error('Deposit not found'));
          return;
        }
        
        if (depositStatus.claimed) {
          console.log('✅ Deposit has been claimed by resolver!');
          console.log(`💰 Claimed amount: ${depositStatus.amount} ETH`);
          console.log(`👤 Claimer: ${depositStatus.claimer}`);
          clearInterval(checkInterval);
          resolve();
          return;
        }
        
        if (depositStatus.cancelled) {
          console.log('❌ Deposit was cancelled');
          clearInterval(checkInterval);
          reject(new Error('Deposit was cancelled'));
          return;
        }
        
        if (depositStatus.expired) {
          console.log('⏰ Deposit has expired');
          clearInterval(checkInterval);
          reject(new Error('Deposit has expired'));
          return;
        }
        
        console.log('⏳ Deposit still unclaimed, waiting...');
        
        // Check if we've exceeded max wait time
        if (elapsedMs >= maxWaitTimeMs) {
          console.log(`⏰ Max wait time (${maxWaitTimeSeconds}s) exceeded`);
          clearInterval(checkInterval);
          reject(new Error(`Max wait time (${maxWaitTimeSeconds}s) exceeded`));
          return;
        }
        
      } catch (error) {
        console.error('❌ Error checking deposit status:', error);
        clearInterval(checkInterval);
        reject(error);
      }
    }, checkIntervalSeconds * 1000);
  });
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

  // Step 2: Deposit ETH into escrow with HTLC
  console.log('\n📋 Step 2: Depositing ETH into escrow...');
  const expirationSeconds = 10; // 10 seconds for demo purposes
  
  const transactionInfo = await depositETH({
    amountEth: amountEth,
    hashedSecret: hashedSecret,
    expirationSeconds: expirationSeconds,
    depositorPrivateKey: ALICE_PRIVATE_KEY,
    claimerAddress: evmToBtcResponse.ethAddress
  });
  
  // Print transaction info for debug
  console.log('\n📋 Transaction Information:');
  console.log(`🆔 Deposit ID: ${transactionInfo.depositId}`);
  console.log(`🔗 Transaction Hash: ${transactionInfo.txHash}`);
  console.log(`🌐 Explorer URL: ${transactionInfo.explorerUrl}`);
  console.log(`📦 Escrow Address: ${transactionInfo.escrowAddress}`);
  console.log(`💰 Amount (Wei): ${transactionInfo.amountWei}`);
  console.log(`⏰ Expiration Time: ${new Date(transactionInfo.expirationTime * 1000).toISOString()}`);

  // wait for resolver to claim deposit...
  await waitResolverClaimDeposit(hashedSecret); // hashedSecret is deposit_id

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