import * as bolt11 from 'bolt11';
import { OrderEVM2BTC } from '../api/order';

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

export class ResolverEVM2BTC {
  
  sendToResolver(order: OrderEVM2BTC): void {
    // here we simulate relay operations by 1inch of processing the order
    // the order will be import { CrossChainOrder } from '@1inch/cross-chain-sdk'
    // but now we use our stub order since bitcoin os not supported by 1inch yet

    console.log('----------------------');
    console.log('🤖 RESOLVER PROCESSING STARTED');
    console.log('🤖 RESOLVER: Order Type: Single Fill Order (100% Fill)');
    console.log('----------------------');
    console.log('🤖 RESOLVER: received Lightning Invoice:', order.btcLightningNetInvoice.substring(0, 25) + '...');
    const btcLightningNetInvoice = order.btcLightningNetInvoice;
    // Decode the Lightning invoice
    const decodedData = this.decodeBtcLightningNetInvoice(btcLightningNetInvoice);
    console.log('🤖 RESOLVER: Decoded Invoice Data:', decodedData); // print 
    
    // Extract hashed secret and amounts
    const { hashedSecret, amount } = decodedData;
    const eth_amount = order.amountEth;
    const btc_amount = amount;
    console.log('🤖 RESOLVER: Extracted Hashed Secret:', hashedSecret);
    console.log('🤖 RESOLVER: Extracted Amount (BTC):', btc_amount);
    console.log('🤖 RESOLVER: Amount in ETH (converted):', this.calculateRate(btc_amount, eth_amount)); // Dummy conversion rate
    
    // Deposit to escrow
    const ethAmount = eth_amount; 
    const escrowTx = this.depositEscrowETH(hashedSecret, ethAmount);
    console.log('🤖 RESOLVER: Escrow Transaction:', escrowTx);
    
    // Pay Lightning invoice
    const paymentReceipt = this.payLightningNetInvoice(btcLightningNetInvoice);
    console.log('🤖 RESOLVER: Payment Receipt:', paymentReceipt);
    
    // Claim from escrow using the secret
    const claimTx = this.claimEscrow(paymentReceipt.secret);
    console.log('🤖 RESOLVER: Claim Transaction:', claimTx);
    
    // Print final balance
    this.printBalance();
    
    console.log('----------------------');
    console.log('🤖 RESOLVER PROCESSING COMPLETED');
    console.log('----------------------');
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
  
  depositEscrowETH(hashedSecret: string, amountEth: number): EscrowTransaction {
    console.log('🤖 RESOLVER: 💰 Depositing native tokens to escrow contract...');
    console.log(`🤖 RESOLVER:    Hashed Secret: ${hashedSecret}`);
    console.log(`🤖 RESOLVER:    Amount: ${amountEth} ETH`);
    console.log('🤖 RESOLVER:    Contract Address: 0x742d35Cc6634C0532925a3b8D4C9db96C4b4d8b6');
    
    // Dummy transaction data
    const tx: EscrowTransaction = {
      txHash: '0x' + Math.random().toString(16).substring(2, 66),
      blockNumber: Math.floor(Math.random() * 1000000) + 18000000,
      gasUsed: Math.floor(Math.random() * 100000) + 50000
    };
    
    console.log('🤖 RESOLVER: ✅ Escrow deposit successful');
    console.log(`🤖 RESOLVER:    Transaction Hash: ${tx.txHash}`);
    console.log(`🤖 RESOLVER:    Block Number: ${tx.blockNumber}`);
    console.log(`🤖 RESOLVER:    Gas Used: ${tx.gasUsed}`);
    
    return tx;
  }
  
  payLightningNetInvoice(invoice: string): PaymentReceipt {
    console.log('🤖 RESOLVER: ⚡ Paying Lightning Network invoice...');
    console.log(`🤖 RESOLVER:    Invoice: ${invoice.substring(0, 25)}...`);
    
    // Dummy payment receipt
    const receipt: PaymentReceipt = {
      secret: '0x' + Math.random().toString(16).substring(2, 66),
      paymentHash: '0x' + Math.random().toString(16).substring(2, 66),
      amount: 0.001,
      timestamp: new Date()
    };
    
    console.log('🤖 RESOLVER: ✅ Lightning payment successful');
    console.log(`🤖 RESOLVER:    Secret: ${receipt.secret}`);
    console.log(`🤖 RESOLVER:    Payment Hash: ${receipt.paymentHash}`);
    console.log(`🤖 RESOLVER:    Amount: ${receipt.amount} BTC`);
    console.log(`🤖 RESOLVER:    Timestamp: ${receipt.timestamp.toISOString()}`);
    
    return receipt;
  }
  
  claimEscrow(secret: string): EscrowTransaction {
    console.log('🤖 RESOLVER: 🏦 Claiming funds from escrow contract...');
    console.log(`🤖 RESOLVER:    Secret: ${secret}`);
    
    // Dummy claim transaction
    const tx: EscrowTransaction = {
      txHash: '0x' + Math.random().toString(16).substring(2, 66),
      blockNumber: Math.floor(Math.random() * 1000000) + 18000000,
      gasUsed: Math.floor(Math.random() * 50000) + 25000
    };
    
    console.log('🤖 RESOLVER: ✅ Escrow claim successful');
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