import { Relay } from './relay';
import { OrderEVM2BTC } from '../api/order';
import { issueLightningInvoice } from '../utils/lightning';
import { depositETH, checkDepositEVM } from '../utils/evm';
import { ALICE_PRIVATE_KEY } from '../variables';
import { pause, confirm } from '../utils/pause';

/**
 * Waits for the resolver to claim the deposit from the escrow contract
 * @param hashedSecret - The deposit ID (hashed secret) to monitor
 * @param maxWaitTimeSeconds - Maximum time to wait in seconds (default: 60)
 * @param checkIntervalSeconds - Interval between checks in seconds (default: 10)
 * @param escrowAddress - The escrow contract address (optional)
 */
async function waitResolverClaimDeposit(
  hashedSecret: string, 
  maxWaitTimeSeconds: number = 60, 
  checkIntervalSeconds: number = 10,
  escrowAddress?: string
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
        
        const contractLink = escrowAddress ? `🌐 Contract: ${escrowAddress}` : '';
        console.log(`⏳ Still waiting for deposit... ${contractLink}`);
        
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
  
  await pause('Press Enter to start Step 1: Generating Lightning Network invoice...');
  
  // Step 1: Generate Lightning Network invoice for BTC
  console.log('\n📋[USER] Step 1: Generating Lightning Network invoice...');
  const invoiceData = await issueLightningInvoice(amountBtc, 'alice', "Alice selling BTC for ETH");
  const hashedSecret = invoiceData.r_hash;
  const btcLightningNetInvoice = invoiceData.payment_request;
  
  console.log(`[USER]⚡ Lightning Invoice: ${btcLightningNetInvoice.substring(0, 25)}...`);
  console.log(`[USER]🔐 Hashed Secret: ${hashedSecret}`);
  
  await pause('[USER]Press Enter to continue to Step 3: Processing order through relay...');
  
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

  await pause('[USER] Press Enter to continue to Step 2: Depositing ETH into escrow...');

  // Step 2: Deposit ETH into escrow with HTLC
  console.log('\n📋[USER] Step 2: Depositing ETH into escrow...');
  const expirationSeconds = 10; // 10 seconds for demo purposes
  
  // Convert base64 hashed secret to hex format for EVM contract
  const hashedSecretHex = '0x' + Buffer.from(hashedSecret, 'base64').toString('hex');
  console.log(`🔐 Original hashed secret (base64): ${hashedSecret}`);
  console.log(`🔐 Converted hashed secret (hex): ${hashedSecretHex}`);
  
  const transactionInfo = await depositETH({
    amountEth: amountEth,
    hashedSecret: hashedSecretHex,
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

  await pause('[USER] Press Enter to continue to final step: Waiting for resolver to claim deposit...');

  // wait for resolver to claim deposit...
  await waitResolverClaimDeposit(hashedSecretHex, 60, 10, transactionInfo.escrowAddress); // Use hex format for contract

  console.log('\n✅ EVM to BTC example completed!');
}

// Run the example if this file is executed directly
if (require.main === module) {
  console.log('🎯 Cross-Chain Relay Demo - EVM to BTC Example...\n');
  evmToBtcExample()
    .then(() => {
      console.log('\n🎉 EVM to BTC demo completed successfully!');
    })
    .catch(async (error) => {
      console.error('\n❌ Error occurred:', error.message);
      console.error('Full error:', error);
      
      process.exit(1);
    });
} 