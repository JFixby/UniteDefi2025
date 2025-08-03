import { OrderBTC2EVM, OrderEVM2BTC, OrderBTC2EVMResponse, OrderEVM2BTCResponse } from '../api/order';
import { ResolverBTC2EVM, OrderBTC2EVMResult } from './resolver_btc2evm';
import { ResolverEVM2BTC } from './resolver_evm2btc';

const resolverEVM2BTC = new ResolverEVM2BTC();
const resolverBTC2EVM = new ResolverBTC2EVM();

export class Relay {
  private invoiceStartTime: number = 0;
  
  processOrderEVM2BTC(order: OrderEVM2BTC): OrderEVM2BTCResponse {
    console.log('🔄 Received EVM to BTC order from maker...');
    console.log('📋 Order Type: Single Fill Order (100% Fill)');
    console.log('Maker Order Details:', {
      amountBtc: order.amountBtc,
      btcLightningNetInvoice: order.btcLightningNetInvoice,
      amountEth: order.amountEth
    });

    
    // here we simulate relay operations by 1inch of processing the order
    // the order will be import { CrossChainOrder } from '@1inch/cross-chain-sdk'
    // but now we use our stub order since bitcoin os not supported by 1inch yet
    const resolverResponse = resolverEVM2BTC.sendToResolver(order);
    
    // Return empty response as per the class definition
    return new OrderEVM2BTCResponse(resolverResponse.ethAddress);
  }
  
  async processOrderBTC2EVM(order: OrderBTC2EVM): Promise<OrderBTC2EVMResponse> {
    console.log('🔄 Processing BTC to EVM order...');
    console.log('📋 Order Type: Single Fill Order (100% Fill)');
    console.log('Order Details:', {
      amountBtc: order.amountBtc,
      amountEth: order.amountEth,
      ethAddress: order.ethAddress
    });
    
    // Generate Lightning Network invoice
    const result: OrderBTC2EVMResult = await resolverBTC2EVM.sendToResolver(order);
    
    // Start async invoice payment checking loop
    // this.startInvoicePaymentCheck(result, order);
    
    return new OrderBTC2EVMResponse(result.lightningInvoice);
  }
  
  private async startInvoicePaymentCheck(result: OrderBTC2EVMResult, order: OrderBTC2EVM): Promise<void> {
    console.log('🤖 RESOLVER: Starting invoice payment monitoring...');
    
    // Set start time for demo purposes
    this.invoiceStartTime = Date.now();
    
    const maxAttempts = 60; // 5 minutes with 5-second intervals
    let attempts = 0;
    
    const checkInterval = setInterval(async () => {
      attempts++;
      console.log(`🤖 RESOLVER: Payment check attempt ${attempts}/${maxAttempts}`);
      
      const isPaid = await this.checkInvoiceIsPaid(result);
      
      if (isPaid) {
        console.log('🤖 RESOLVER: ✅ Invoice payment confirmed!');
        clearInterval(checkInterval);
        
        // Claim deposit on behalf of the user
        await this.claimDepositOnBehalfOfUser(order, result);
        
      } else if (attempts >= maxAttempts) {
        console.log('🤖 RESOLVER: ⏰ Payment check timeout - invoice not paid within expected time');
        clearInterval(checkInterval);
      } else {
        console.log('🤖 RESOLVER: ⏳ Invoice not yet paid, checking again in 5 seconds...');
      }
    }, 5000); // Check every 5 seconds
  }
  
  private async checkInvoiceIsPaid(result: OrderBTC2EVMResult): Promise<boolean> {
    console.log('🤖 RESOLVER: Checking if invoice is paid...');
    
    // Demo implementation - invoice is paid after 3 seconds (first check at 5s, so second check at 10s)
    // For demo purposes, return true on the second check (after ~10 seconds total)
    const currentTime = Date.now();
    const timeSinceStart = currentTime - this.invoiceStartTime;
    
    if (timeSinceStart >= 3000) { // 3 seconds
      console.log('🤖 RESOLVER: ✅ Invoice payment detected! (Demo: paid after 3 seconds)');
      return true;
    } else {
      console.log(`🤖 RESOLVER: ❌ Invoice not yet paid (Demo: ${Math.floor(timeSinceStart/1000)}s elapsed)`);
      return false;
    }
  }
  
  private async claimDepositOnBehalfOfUser(order: OrderBTC2EVM, result: OrderBTC2EVMResult): Promise<void> {
    console.log('🤖 RESOLVER: 🏦 Claiming deposit on behalf of user...');
    console.log('🤖 RESOLVER: Order Type: Single Fill Order (100% Fill)');
    console.log('🤖 RESOLVER: User Order Details:', {
      amountBtc: order.amountBtc,
      amountEth: order.amountEth,
      ethAddress: order.ethAddress
    });
    
    // Create resolver instance for claiming
    const resolver = new ResolverEVM2BTC();
    
    // Generate a dummy secret and hashed secret (in real implementation this would come from the payment)
    const secret = ""
    const hashedSecret = result.hashedSecret;

    throw new Error('Not implemented');
    
    console.log('🤖 RESOLVER: 🔑 Generated secret for claim:', secret);
    console.log('🤖 RESOLVER: 🔑 Generated hashed secret for claim:', hashedSecret);
    
    // Claim the escrow funds
    const claimTx = await resolver.claimEscrow(secret, hashedSecret);
    
    console.log('🤖 RESOLVER: ✅ Deposit pushed successfully to maker');
    console.log('🤖 RESOLVER: Transaction Details:', claimTx);
    
    // Print updated balance
    resolver.printBalance();
    
    console.log('----------------------');
    console.log('🤖 RESOLVER PUSH AUTOMATION COMPLETED');
    console.log('🎉 Cross-chain swap completed successfully!');
    console.log('----------------------');
  }
}
