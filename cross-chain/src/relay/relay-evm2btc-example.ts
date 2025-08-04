import { Relay } from './relay';
import { OrderEVM2BTC } from '../api/order';
import { issueLightningInvoice, getLNBalances, printLNBalancesChange } from '../utils/lightning';
import { depositETH, checkDepositEVM, getAliceETHBalance, getCarolETHBalance, printETHBalanceChange } from '../utils/evm';
import { ALICE_PRIVATE_KEY } from '../variables';
import { pause, confirm } from '../utils/pause';

/**
 * Waits for the resolver to claim the deposit from the escrow contract
 */
async function waitResolverClaimDeposit(): Promise<void> {
  console.log('⏳ Wait 3 seconds...');
  await pause('Press Enter to continue...');
  await new Promise(resolve => setTimeout(resolve, 3000));
}

export async function evmToBtcExample() {
  const amountBtc = 0.0005;
  const amountEth = 0.015;

  // Get initial balances for Alice and Carol (LN and ETH)
  const aliceBalancesBefore = await getLNBalances('alice');
  const carolBalancesBefore = await getLNBalances('carol');
  const aliceETHBalanceBefore = await getAliceETHBalance();
  const carolETHBalanceBefore = await getCarolETHBalance();
  
  
  console.log('\n🚀 === EVM to BTC Order Example ===');
  console.log(`💰 Amount BTC: ${amountBtc}`);
  console.log(`💰 Amount ETH: ${amountEth}`);
  
  await pause('Press Enter to start Step 1: Generating Lightning Network invoice...');
  
  // Step 1: Generate Lightning Network invoice for BTC
  console.log('\n--------------------------------------------');
  console.log('📋 Step 1: Generating Lightning Network invoice...');
  console.log('--------------------------------------------');
  const invoiceData = await issueLightningInvoice(amountBtc, 'alice', "Alice selling BTC for ETH");
  const hashedSecret = invoiceData.r_hash;
  const btcLightningNetInvoice = invoiceData.payment_request;
  
  console.log(`[USER]⚡ Lightning Invoice: ${btcLightningNetInvoice.substring(0, 25)}...`);
  console.log(`[USER]🔐 Hashed Secret: ${hashedSecret}`);
  
  await pause('[USER]Press Enter to continue to Step 3: Processing order through relay...');
  
  // Step 3: Process EVM to BTC order through relay
  console.log('\n--------------------------------------------');
  console.log('📋 Step 2: Processing order through relay...');
  console.log('--------------------------------------------');
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
  console.log('\n--------------------------------------------');
  console.log('📋 Step 3: Depositing ETH into escrow...');
  console.log('--------------------------------------------');
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

  // Step 4: Wait for resolver to claim deposit
  
  await waitResolverClaimDeposit(); // Wait 5 seconds for resolver

  console.log('\n--------------------------------------------');
  const aliceBalancesAfter = await getLNBalances('alice');
  const carolBalancesAfter = await getLNBalances('carol');
  const aliceETHBalanceAfter = await getAliceETHBalance();
  const carolETHBalanceAfter = await getCarolETHBalance();
  
  console.log('📊 Balance Changes:');
  console.log('Lightning Network:');
  printLNBalancesChange(aliceBalancesBefore, aliceBalancesAfter);
  printLNBalancesChange(carolBalancesBefore, carolBalancesAfter);
  console.log('Ethereum:');
  printETHBalanceChange(aliceETHBalanceBefore, aliceETHBalanceAfter);
  printETHBalanceChange(carolETHBalanceBefore, carolETHBalanceAfter);
  
  console.log('✅ EVM to BTC example completed!');
  console.log('--------------------------------------------');
}

// Run the example if this file is executed directly
if (require.main === module) {
  console.log('🎯 Cross-Chain Relay Demo - EVM to BTC Example...\n');
  evmToBtcExample()
    .then(() => {
      console.log('\n🎉 EVM to BTC demo completed successfully!');
      process.exit(0);
    })
    .catch(async (error) => {
      console.error('\n❌ Error occurred:', error.message);
      console.error('Full error:', error);
      
      process.exit(1);
    });
} 