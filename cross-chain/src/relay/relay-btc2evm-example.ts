import { Relay } from './relay';
import { OrderBTC2EVM } from '../api/order';
import { payLightningInvoice } from '../utils/lightning';
import { ALICE_PRIVATE_KEY, getAliceAddress } from '../variables';
import * as bolt11 from 'bolt11';

// Example usage of the Relay class methods for BTC to EVM
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

// Run the example if this file is executed directly
if (require.main === module) {
  console.log('🎯 Cross-Chain Relay Demo - BTC to EVM Example...\n');
  btcToEvmExample()
    .then(() => {
      console.log('\n🎉 BTC to EVM demo completed successfully!');
    })
    .catch(console.error);
} 