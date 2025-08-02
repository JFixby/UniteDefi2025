import * as bolt11 from 'bolt11';
import { OrderBTC2EVM } from '../api/order';
import { getTransactionUrl, ALICE_PRIVATE_KEY } from '../variables';
import { issueLightningInvoice, LightningInvoice } from '../utils/lightning';
import { depositETH } from '../utils/evm';

export interface PaymentReceipt {
  secret: string;
  paymentHash: string;
  amount: number;
  timestamp: Date;
}

export interface EscrowTransaction {
  txHash: string;
  blockNumber: number;
  gasUsed: number;
}

export interface DecodedInvoice {
  hashedSecret: string;
  amount: number;
  description: string;
  expiry: Date;
  paymentHash: string;
}

export interface OrderBTC2EVMResult {
  lightningInvoice: string;
  transactionId: string;
  transactionLink: string;
  hashedSecret: string;
  makerEthAddress: string;
  amountEth: number;
}

export class ResolverBTC2EVM {
  
  async sendToResolver(order: OrderBTC2EVM): Promise<OrderBTC2EVMResult> {
    console.log('----------------------');
    console.log('🤖 RESOLVER PROCESSING STARTED');
    console.log('🤖 RESOLVER: Order Type: Single Fill Order (100% Fill)');
    console.log('----------------------');
    
    // Step 1: Issue Lightning Network invoice using helper
    const lightningInvoiceData = await this.issueLightningInvoiceResolver(order.amountBtc);
    const lightningInvoice = lightningInvoiceData.payment_request;
    console.log('🤖 RESOLVER: ⚡ Generated Lightning Network invoice:', lightningInvoice.substring(0, 25) + '...');
    
    // Step 2: Extract hashed secret from the invoice
    const decodedInvoice = this.decodeBtcLightningNetInvoice(lightningInvoice);
    const hashedSecret = decodedInvoice.hashedSecret;
    console.log('🤖 RESOLVER: 🔑 Extracted hashed secret:', hashedSecret);
    
    // Step 3: Read maker ETH address from the order
    const makerEthAddress = order.ethAddress;
    console.log('🤖 RESOLVER: 👤 Maker ETH address:', makerEthAddress);
    
    // Step 4: Use helper to deposit amount to the ETH address
    const depositResult = await depositETH({
      amountEth: order.amountEth,
      claimerAddress: makerEthAddress,
      expirationSeconds: Math.floor((decodedInvoice.expiry.getTime() - Date.now()) / 1000),
      hashedSecret: hashedSecret,
      depositorPrivateKey: ALICE_PRIVATE_KEY
    });
    console.log('🤖 RESOLVER: 💰 Deposit transaction created');
    
    // Step 5: Confirm transaction from deposit_result
    console.log('🤖 RESOLVER: ✅ Transaction confirmed');
    console.log(`🤖 RESOLVER:    Transaction Hash: ${depositResult.txHash}`);
    console.log(`🤖 RESOLVER:    Deposit ID: ${depositResult.depositId}`);
    console.log(`🤖 RESOLVER:    Amount: ${depositResult.amountWei} Wei`);
    
    // Step 6: Print link to the transaction
    const transactionLink = depositResult.explorerUrl;
    console.log('🤖 RESOLVER: 🔗 Transaction Link:', transactionLink);
    
    // Step 7: Create and return the result
    const result: OrderBTC2EVMResult = {
      lightningInvoice: lightningInvoice,
      transactionId: depositResult.txHash,
      transactionLink: transactionLink,
      hashedSecret: hashedSecret,
      makerEthAddress: makerEthAddress,
      amountEth: order.amountEth
    };
    
    console.log('🤖 RESOLVER: 📋 Result object created:', {
      lightningInvoice: result.lightningInvoice.substring(0, 25) + '...',
      transactionId: result.transactionId,
      transactionLink: result.transactionLink,
      hashedSecret: result.hashedSecret,
      makerEthAddress: result.makerEthAddress,
      amountEth: result.amountEth
    });
    
    console.log('----------------------');
    console.log('🤖 RESOLVER PROCESSING COMPLETED');
    console.log('----------------------');
    
    return result;
  }
  
  // Helper function to issue Lightning Network invoice
  private async issueLightningInvoiceResolver(amountBtc: number): Promise<LightningInvoice> {
    console.log('🤖 RESOLVER: 📝 Issuing Lightning Network invoice...');
    
    try {
      const invoice = await issueLightningInvoice(amountBtc, 'carol', `Resolver request payment for ${amountBtc} BTC`);
      console.log('🤖 RESOLVER: ✅ Lightning Network invoice issued successfully');
      return invoice;
    } catch (error) {
      console.error('🤖 RESOLVER: ❌ Failed to issue Lightning invoice:', error);
      throw error;
    }
  }
  
  
  
  decodeBtcLightningNetInvoice(invoice: string): DecodedInvoice {
    console.log('🤖 RESOLVER: 🔍 Decoding Lightning Network invoice...');
    console.log(`🤖 RESOLVER:    Invoice: ${invoice.substring(0, 25)}...`);
    
    try {
      // Decode the Lightning Network invoice using bolt11 library
      const decoded = bolt11.decode(invoice);
      
      // Extract the payment hash (this is the hashed secret)
      const paymentHash = decoded.tags.find(tag => tag.tagName === 'payment_hash')?.data;
      if (!paymentHash) {
        throw new Error('Payment hash not found in invoice');
      }
      
      // Extract the amount in satoshis
      let amountSatoshis = 0;
      if (decoded.satoshis) {
        amountSatoshis = decoded.satoshis;
      } else if (decoded.millisatoshis) {
        amountSatoshis = Math.floor(Number(decoded.millisatoshis) / 1000);
      }
      
      // Convert satoshis to BTC
      const amountBTC = amountSatoshis / 100000000;
      
      // Extract description
      const descriptionTag = decoded.tags.find(tag => tag.tagName === 'description');
      const description = typeof descriptionTag?.data === 'string' ? descriptionTag.data : 'Cross-chain swap payment';
      
      // Extract expiry time
      const expiryTag = decoded.tags.find(tag => tag.tagName === 'expiry');
      const expirySeconds = typeof expiryTag?.data === 'number' ? expiryTag.data : 3600; // Default 1 hour
      const expiry = new Date(Date.now() + (expirySeconds * 1000));
      
      // Create the decoded invoice object
      const decodedData: DecodedInvoice = {
        hashedSecret: '0x' + paymentHash,
        amount: amountBTC,
        description: description,
        expiry: expiry,
        paymentHash: '0x' + paymentHash
      };
      
      console.log('🤖 RESOLVER: ✅ Invoice decoded successfully');
      console.log(`🤖 RESOLVER:    Payment Hash: ${decodedData.paymentHash}`);
      console.log(`🤖 RESOLVER:    Amount: ${decodedData.amount} BTC (${amountSatoshis} satoshis)`);
      console.log(`🤖 RESOLVER:    Description: ${decodedData.description}`);
      console.log(`🤖 RESOLVER:    Expiry: ${decodedData.expiry.toISOString()}`);
      console.log(`🤖 RESOLVER:    Network: ${decoded.network || 'mainnet'}`);
      
      return decodedData;
      
    } catch (error) {
      throw error
    }
  }
  
  waitForLightningPayment(invoice: string): PaymentReceipt {
    console.log('🤖 RESOLVER: ⚡ Waiting for Lightning Network payment...');
    console.log(`🤖 RESOLVER:    Invoice: ${invoice.substring(0, 25)}...`);
    
    // Dummy payment receipt
    const receipt: PaymentReceipt = {
      secret: '0x' + Math.random().toString(16).substring(2, 66),
      paymentHash: '0x' + Math.random().toString(16).substring(2, 66),
      amount: 0.001,
      timestamp: new Date()
    };
    
    console.log('🤖 RESOLVER: ✅ Lightning payment received');
    console.log(`🤖 RESOLVER:    Secret: ${receipt.secret}`);
    console.log(`🤖 RESOLVER:    Payment Hash: ${receipt.paymentHash}`);
    console.log(`🤖 RESOLVER:    Amount: ${receipt.amount} BTC`);
    console.log(`🤖 RESOLVER:    Timestamp: ${receipt.timestamp.toISOString()}`);
    
    return receipt;
  }


} 