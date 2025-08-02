import * as bolt11 from 'bolt11';
import { OrderBTC2EVM } from '../api/order';
import { getTransactionUrl } from '../variables';

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
  
  sendToResolver(order: OrderBTC2EVM): OrderBTC2EVMResult {
    console.log('----------------------');
    console.log('🤖 RESOLVER PROCESSING STARTED');
    console.log('🤖 RESOLVER: Order Type: Single Fill Order (100% Fill)');
    console.log('----------------------');
    
    // Step 1: Issue Lightning Network invoice using helper
    const lightningInvoice = this.issueLightningInvoice(order.amountBtc);
    console.log('🤖 RESOLVER: ⚡ Generated Lightning Network invoice:', lightningInvoice.substring(0, 25) + '...');
    
    // Step 2: Extract hashed secret from the invoice
    const decodedInvoice = this.decodeBtcLightningNetInvoice(lightningInvoice);
    const hashedSecret = decodedInvoice.hashedSecret;
    console.log('🤖 RESOLVER: 🔑 Extracted hashed secret:', hashedSecret);
    
    // Step 3: Read maker ETH address from the order
    const makerEthAddress = order.ethAddress;
    console.log('🤖 RESOLVER: 👤 Maker ETH address:', makerEthAddress);
    
    // Step 4: Use helper to deposit amount to the ETH address
    const depositResult = this.deposit(order.amountEth, makerEthAddress, decodedInvoice.expiry, hashedSecret);
    console.log('🤖 RESOLVER: 💰 Deposit transaction created');
    
    // Step 5: Confirm transaction from deposit_result
    console.log('🤖 RESOLVER: ✅ Transaction confirmed');
    console.log(`🤖 RESOLVER:    Transaction Hash: ${depositResult.txHash}`);
    console.log(`🤖 RESOLVER:    Block Number: ${depositResult.blockNumber}`);
    console.log(`🤖 RESOLVER:    Gas Used: ${depositResult.gasUsed}`);
    
    // Step 6: Print link to the transaction
    const transactionLink = getTransactionUrl(depositResult.txHash);
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
  private issueLightningInvoice(amountBtc: number): string {
    console.log('🤖 RESOLVER: 📝 Issuing Lightning Network invoice...');
  
    console.log('🤖 RESOLVER: ✅ Lightning Network invoice issued successfully');
    return "lnbc100u1p5guy6ypp5eeyft8ntelam75uvpnz8lcx46qpp5aa6a4rrvc2qtc74qaz8776scqzyssp5us7lxaq6xny2e85sjfxa6dttua7v0ag32q2huzue5m67czzj5nes9q7sqqqqqqqqqqqqqqqqqqqsqqqqqysgqdqqmqz9gxqyjw5qrzjqwryaup9lh50kkranzgcdnn2fgvx390wgj5jd07rwr3vxeje0glcllmqlf20lk5u3sqqqqlgqqqqqeqqjqr4dqnmedj6pz9jvh2ufw0v0grfa27khg7tfwvun8u9fcxg952ua5zed68d2naa6whng33z7qnvt8x5x07lzf6lchegvr70xsrjmk8uqpsjef9k";
  }
  
  // Helper function to deposit ETH to escrow
  private deposit(amountEth: number, ethAddress: string, expiration: Date, hashedSecret: string): EscrowTransaction {
    console.log('🤖 RESOLVER: 💰 Depositing ETH to escrow contract...');
    console.log(`🤖 RESOLVER:    Amount: ${amountEth} ETH`);
    console.log(`🤖 RESOLVER:    Recipient Address: ${ethAddress}`);
    console.log(`🤖 RESOLVER:    Expiration: ${expiration.toISOString()}`);
    console.log(`🤖 RESOLVER:    Hashed Secret: ${hashedSecret}`);
    
    // Dummy transaction data
    const tx: EscrowTransaction = {
      txHash: '0x' + Math.random().toString(16).substring(2, 66),
      blockNumber: Math.floor(Math.random() * 1000000) + 18000000,
      gasUsed: Math.floor(Math.random() * 100000) + 50000
    };
    
    console.log('🤖 RESOLVER: ✅ ETH deposit successful');
    console.log(`🤖 RESOLVER:    Transaction Hash: ${tx.txHash}`);
    console.log(`🤖 RESOLVER:    Block Number: ${tx.blockNumber}`);
    console.log(`🤖 RESOLVER:    Gas Used: ${tx.gasUsed}`);
    
    return tx;
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
      console.error('🤖 RESOLVER: ❌ Error decoding Lightning invoice:', error);
      
      // Fallback to dummy data if decoding fails
      console.log('🤖 RESOLVER: ⚠️  Falling back to dummy data');
      const dummyData: DecodedInvoice = {
        hashedSecret: '0x' + Math.random().toString(16).substring(2, 66),
        amount: 0.001,
        description: 'Cross-chain swap payment (fallback)',
        expiry: new Date(Date.now() + 3600000), // 1 hour from now
        paymentHash: '0x' + Math.random().toString(16).substring(2, 66)
      };
      
      return dummyData;
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
  
  sendETHToUser(ethAddress: string, amountEth: number): EscrowTransaction {
    console.log('🤖 RESOLVER: 💰 Sending ETH to user address...');
    console.log(`🤖 RESOLVER:    User Address: ${ethAddress}`);
    console.log(`🤖 RESOLVER:    Amount: ${amountEth} ETH`);
    
    // Dummy transaction data
    const tx: EscrowTransaction = {
      txHash: '0x' + Math.random().toString(16).substring(2, 66),
      blockNumber: Math.floor(Math.random() * 1000000) + 18000000,
      gasUsed: Math.floor(Math.random() * 100000) + 50000
    };
    
    console.log('🤖 RESOLVER: ✅ ETH transfer successful');
    console.log(`🤖 RESOLVER:    Transaction Hash: ${tx.txHash}`);
    console.log(`🤖 RESOLVER:    Block Number: ${tx.blockNumber}`);
    console.log(`🤖 RESOLVER:    Gas Used: ${tx.gasUsed}`);
    
    return tx;
  }
  
  calculateRate(btcAmount: number, ethAmount: number): number {
    // Dummy conversion rate calculation
    // In a real implementation, this would fetch current exchange rates
    return btcAmount * 15000; // 1 BTC = 15000 ETH (dummy rate)
  }
  
  printBalance(): void {
    console.log('🤖 RESOLVER: 💳 Current Balance Report:');
    console.log('🤖 RESOLVER:    ETH Balance: 0.985 ETH');
    console.log('🤖 RESOLVER:    BTC Balance: 0.001 BTC');
    console.log('🤖 RESOLVER:    USDC Balance: 150.00 USDC');
    console.log('🤖 RESOLVER:    Last Updated: ' + new Date().toISOString());
  }
} 