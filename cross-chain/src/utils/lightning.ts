import * as fs from 'fs';
import * as path from 'path';
import * as https from 'https';

export interface LightningNode {
  alias: string;
  rest_port: string;
  macaroons: Array<{
    type: string;
    path: string;
  }>;
  channels?: Array<{
    remote_pubkey: string;
    local_pubkey: string;
    remote_alias: string;
    channel_point: string;
  }>;
}

export interface LightningInvoice {
  payment_request: string;
  r_hash: string;
  add_index: string;
  payment_addr: string;
  value: string;
  cltv_expiry: string;
  expiry: string;
  private: boolean;
  amt_paid: string;
  amt_paid_sat: string;
  amt_paid_msat: string;
  state: string;
  htlcs: any[];
  features: Record<string, any>;
  is_keysend: boolean;
}

export interface LightningConfig {
  nodes: LightningNode[];
}

// Custom HTTPS agent that ignores SSL certificate verification for local development
const httpsAgent = new https.Agent({
  rejectUnauthorized: false
});

/**
 * Issues a Lightning Network invoice using the LND REST API
 * @param amountBtc - Amount in BTC (e.g., 0.01 for 0.01 BTC)
 * @param nodeAlias - Alias of the node to issue invoice from (default: 'alice')
 * @param memo - Optional memo/description for the invoice
 * @returns Promise<LightningInvoice> - The complete invoice data returned by the LN node
 */
export async function issueLightningInvoice(
  amountBtc: number,
  nodeAlias: string = 'alice',
  memo?: string
): Promise<LightningInvoice> {
  try {
    // Convert BTC to satoshis
    const amountSatoshis = Math.floor(amountBtc * 100000000);
    
    // Load LN configuration
    const lnConfig = await loadLightningConfig();
    
    // Find the specified node
    const node = lnConfig.nodes.find(n => n.alias === nodeAlias);
    if (!node) {
      throw new Error(`Node with alias '${nodeAlias}' not found in configuration`);
    }
    
    // Find admin macaroon
    const adminMacaroon = node.macaroons.find(m => m.type === 'admin');
    if (!adminMacaroon) {
      throw new Error(`Admin macaroon not found for node '${nodeAlias}'`);
    }
    
    // Check if macaroon file exists
    if (!fs.existsSync(adminMacaroon.path)) {
      throw new Error(`Admin macaroon file not found at: ${adminMacaroon.path}`);
    }
    
    // Read macaroon file and convert to hex
    const macaroonBuffer = fs.readFileSync(adminMacaroon.path);
    const macaroonHex = macaroonBuffer.toString('hex');
    
    // Prepare request data
    const requestData = {
      value: amountSatoshis.toString(),
      memo: memo || `Cross-chain swap payment for ${amountBtc} BTC`
    };
    
    // Make API request to LND
    const response = await fetch(`https://localhost:${node.rest_port}/v1/invoices`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Grpc-Metadata-macaroon': macaroonHex
      },
      body: JSON.stringify(requestData),
      // @ts-ignore - Node.js fetch supports agent
      agent: httpsAgent
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`LND API request failed with status ${response.status}: ${errorText}`);
    }
    
    const invoiceData = await response.json() as LightningInvoice;
    
    if (!invoiceData.payment_request) {
      throw new Error('No payment request returned from LND API');
    }
    
    console.log(`✅ Lightning invoice issued successfully on node '${nodeAlias}'`);
    console.log(`   Amount: ${amountBtc} BTC (${amountSatoshis} satoshis)`);
    console.log(`   Payment Request: ${invoiceData.payment_request.substring(0, 25)}...`);
    
    return invoiceData;
    
  } catch (error) {
    throw error
  }
}


/**
 * Loads Lightning Network configuration from ln.json
 */
async function loadLightningConfig(): Promise<LightningConfig> {
  try {
    // Try to load from btc-side/LN/ln.json first
    const btcSidePath = path.join(__dirname, '../../../btc-side/LN/ln.json');
    const crossChainPath = path.join(__dirname, '../ln.json');
    
    let configPath: string;
    if (fs.existsSync(btcSidePath)) {
      configPath = btcSidePath;
    } else if (fs.existsSync(crossChainPath)) {
      configPath = crossChainPath;
    } else {
      throw new Error('ln.json configuration file not found. Please ensure the file exists in btc-side/LN/ or cross-chain/src/');
    }
    
    const configData = fs.readFileSync(configPath, 'utf8');
    const nodes = JSON.parse(configData);
    
    return { nodes };
  } catch (error) {
    console.error('❌ Failed to load Lightning configuration:', error);
    throw error;
  }
}

/**
 * Validates if a Lightning Network node is accessible
 * @param nodeAlias - Alias of the node to check
 * @returns Promise<boolean> - True if node is accessible
 */
export async function validateLightningNode(nodeAlias: string = 'alice'): Promise<boolean> {
  try {
    const lnConfig = await loadLightningConfig();
    const node = lnConfig.nodes.find(n => n.alias === nodeAlias);
    
    if (!node) {
      console.error(`❌ Node '${nodeAlias}' not found in configuration`);
      return false;
    }
    
    // Check if REST port is accessible
    const response = await fetch(`https://localhost:${node.rest_port}/v1/getinfo`, {
      method: 'GET',
      headers: {
        'Grpc-Metadata-macaroon': fs.readFileSync(
          node.macaroons.find(m => m.type === 'admin')!.path
        ).toString('hex')
      },
      // @ts-ignore - Node.js fetch supports agent
      agent: httpsAgent
    });
    
    if (response.ok) {
      console.log(`✅ Node '${nodeAlias}' is accessible`);
      return true;
    } else {
      console.error(`❌ Node '${nodeAlias}' is not accessible (HTTP ${response.status})`);
      return false;
    }
  } catch (error) {
    console.error(`❌ Failed to validate node '${nodeAlias}':`, error);
    return false;
  }
}

export interface PaymentReceipt {
  secret: string;
  paymentHash: string;
  amount: number;
  timestamp: Date;
}

/**
 * Pays a Lightning Network invoice using the LND REST API
 * @param paymentRequest - The Lightning Network payment request (invoice)
 * @param nodeAlias - Alias of the node to pay from (default: 'alice')
 * @returns Promise<PaymentReceipt> - Payment details including the secret
 */
export async function payLightningInvoice(
  paymentRequest: string,
  nodeAlias: string = 'alice'
): Promise<PaymentReceipt> {
  try {
    console.log(`⚡ Paying Lightning Network invoice...`);
    console.log(`   Invoice: ${paymentRequest.substring(0, 25)}...`);
    
    // Load LN configuration
    const lnConfig = await loadLightningConfig();
    
    // Find the specified node
    const node = lnConfig.nodes.find(n => n.alias === nodeAlias);
    if (!node) {
      throw new Error(`Node with alias '${nodeAlias}' not found in configuration`);
    }
    
    // Find admin macaroon
    const adminMacaroon = node.macaroons.find(m => m.type === 'admin');
    if (!adminMacaroon) {
      throw new Error(`Admin macaroon not found for node '${nodeAlias}'`);
    }
    
    // Check if macaroon file exists
    if (!fs.existsSync(adminMacaroon.path)) {
      throw new Error(`Admin macaroon file not found at: ${adminMacaroon.path}`);
    }
    
    // Read macaroon file and convert to hex
    const macaroonBuffer = fs.readFileSync(adminMacaroon.path);
    const macaroonHex = macaroonBuffer.toString('hex');
    
    // First, decode the payment request to get the amount
    const decodeResponse = await fetch(`https://localhost:${node.rest_port}/v1/payreq/${encodeURIComponent(paymentRequest)}`, {
      method: 'GET',
      headers: {
        'Grpc-Metadata-macaroon': macaroonHex
      },
      // @ts-ignore - Node.js fetch supports agent
      agent: httpsAgent
    });
    
    if (!decodeResponse.ok) {
      const errorText = await decodeResponse.text();
      throw new Error(`Failed to decode payment request with status ${decodeResponse.status}: ${errorText}`);
    }
    
    const decodedData = await decodeResponse.json() as any;
    const amountSatoshis = parseInt(decodedData.num_satoshis || '0');
    const amountBtc = amountSatoshis / 100000000;
    
    // Prepare request data for payment
    const requestData = {
      payment_request: paymentRequest
    };
    
    // Make API request to LND to pay the invoice
    const response = await fetch(`https://localhost:${node.rest_port}/v1/channels/transactions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Grpc-Metadata-macaroon': macaroonHex
      },
      body: JSON.stringify(requestData),
      // @ts-ignore - Node.js fetch supports agent
      agent: httpsAgent
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`LND payment request failed with status ${response.status}: ${errorText}`);
    }
    
    const paymentData = await response.json() as any;
    
    // Extract payment details
    const receipt: PaymentReceipt = {
      secret: paymentData.payment_preimage,
      paymentHash: paymentData.payment_hash,
      amount: amountBtc, // Use the amount from decoded payment request
      timestamp: new Date()
    };
    
    console.log('✅ Lightning payment successful');
    console.log(`   Secret: ${receipt.secret}`);
    console.log(`   Payment Hash: ${receipt.paymentHash}`);
    console.log(`   Amount: ${receipt.amount} BTC`);
    console.log(`   Timestamp: ${receipt.timestamp.toISOString()}`);
    
    return receipt;
    
  } catch (error) {
    throw error
  }
} 

export interface LNChannelBalance {
  channelPoint: string;
  remotePubkey: string;
  remoteAlias: string;
  localBalance: number;
  remoteBalance: number;
}

export interface LNNodeBalances {
  nodeAlias: string;
  onchainBalance: number; // in satoshis
  channels: LNChannelBalance[];
  totalLocalBalance: number; // sum of all local channel balances
  totalRemoteBalance: number; // sum of all remote channel balances
}

/**
 * Gets Lightning Network balances for a specific node
 * @param nodeAlias - Alias of the node to check balances for
 * @returns Promise<LNNodeBalances> - Complete balance information for the node
 */
export async function getLNBalances(nodeAlias: string): Promise<LNNodeBalances> {
  try {
    console.log(`🔍 Getting Lightning Network balances for node '${nodeAlias}'...`);
    
    // Load LN configuration
    const lnConfig = await loadLightningConfig();
    
    // Find the specified node
    const node = lnConfig.nodes.find(n => n.alias === nodeAlias);
    if (!node) {
      throw new Error(`Node with alias '${nodeAlias}' not found in configuration`);
    }
    
    // Find admin macaroon
    const adminMacaroon = node.macaroons.find(m => m.type === 'admin');
    if (!adminMacaroon) {
      throw new Error(`Admin macaroon not found for node '${nodeAlias}'`);
    }
    
    // Check if macaroon file exists
    if (!fs.existsSync(adminMacaroon.path)) {
      throw new Error(`Admin macaroon file not found at: ${adminMacaroon.path}`);
    }
    
    // Read macaroon file and convert to hex
    const macaroonBuffer = fs.readFileSync(adminMacaroon.path);
    const macaroonHex = macaroonBuffer.toString('hex');
    
    // Get on-chain balance
    const onchainResponse = await fetch(`https://localhost:${node.rest_port}/v1/balance/blockchain`, {
      method: 'GET',
      headers: {
        'Grpc-Metadata-macaroon': macaroonHex
      },
      // @ts-ignore - Node.js fetch supports agent
      agent: httpsAgent
    });
    
    if (!onchainResponse.ok) {
      const errorText = await onchainResponse.text();
      throw new Error(`Failed to get on-chain balance with status ${onchainResponse.status}: ${errorText}`);
    }
    
    const onchainData = await onchainResponse.json() as any;
    const onchainBalance = parseInt(onchainData.total_balance || '0');
    
    // Get channel balances
    const channelsResponse = await fetch(`https://localhost:${node.rest_port}/v1/channels`, {
      method: 'GET',
      headers: {
        'Grpc-Metadata-macaroon': macaroonHex
      },
      // @ts-ignore - Node.js fetch supports agent
      agent: httpsAgent
    });
    
    if (!channelsResponse.ok) {
      const errorText = await channelsResponse.text();
      throw new Error(`Failed to get channel balances with status ${channelsResponse.status}: ${errorText}`);
    }
    
    const channelsData = await channelsResponse.json() as any;
    const channels: LNChannelBalance[] = [];
    let totalLocalBalance = 0;
    let totalRemoteBalance = 0;
    
    if (channelsData.channels && Array.isArray(channelsData.channels)) {
      for (const channel of channelsData.channels) {
        const channelPoint = channel.channel_point;
        const remotePubkey = channel.remote_pubkey;
        const localBalance = parseInt(channel.local_balance || '0');
        const remoteBalance = parseInt(channel.remote_balance || '0');
        
                 // Find remote alias from ln.json configuration
         let remoteAlias = '(unknown)';
         for (const configNode of lnConfig.nodes) {
           if (configNode.alias === nodeAlias && configNode.channels) {
             const configChannel = configNode.channels.find((c: { channel_point: string }) => c.channel_point === channelPoint);
             if (configChannel) {
               remoteAlias = configChannel.remote_alias;
               break;
             }
           }
         }
        
        channels.push({
          channelPoint,
          remotePubkey,
          remoteAlias,
          localBalance,
          remoteBalance
        });
        
        totalLocalBalance += localBalance;
        totalRemoteBalance += remoteBalance;
      }
    }
    
    const balances: LNNodeBalances = {
      nodeAlias,
      onchainBalance,
      channels,
      totalLocalBalance,
      totalRemoteBalance
    };
    
    console.log(`✅ Retrieved balances for node '${nodeAlias}'`);
    console.log(`   On-chain: ${onchainBalance} satoshis`);
    console.log(`   Channels: ${channels.length} open channels`);
    console.log(`   Total local balance: ${totalLocalBalance} satoshis`);
    console.log(`   Total remote balance: ${totalRemoteBalance} satoshis`);
    
    return balances;
    
  } catch (error) {
    console.error(`❌ Failed to get balances for node '${nodeAlias}':`, error);
    throw error;
  }
}

/**
 * Prints a comparison of Lightning Network balances before and after an operation
 * @param balancesBefore - Balances before the operation
 * @param balancesAfter - Balances after the operation
 */
export function printLNBalancesChange(balancesBefore: LNNodeBalances, balancesAfter: LNNodeBalances): void {
  console.log('\n' + '='.repeat(80));
  console.log(`📊 LIGHTNING NETWORK BALANCE CHANGES FOR NODE: ${balancesBefore.nodeAlias}`);
  console.log('='.repeat(80));
  
  // On-chain balance change
  const onchainChange = balancesAfter.onchainBalance - balancesBefore.onchainBalance;
  const onchainChangeBtc = onchainChange / 100000000;
  const onchainChangeSign = onchainChange >= 0 ? '+' : '';
  
  console.log(`\n💰 ON-CHAIN BALANCE:`);
  console.log(`   Before: ${balancesBefore.onchainBalance} satoshis (${(balancesBefore.onchainBalance / 100000000).toFixed(8)} BTC)`);
  console.log(`   After:  ${balancesAfter.onchainBalance} satoshis (${(balancesAfter.onchainBalance / 100000000).toFixed(8)} BTC)`);
  console.log(`   Change: ${onchainChangeSign}${onchainChange} satoshis (${onchainChangeSign}${onchainChangeBtc.toFixed(8)} BTC)`);
  
  // Channel balance changes
  console.log(`\n⚡ CHANNEL BALANCES:`);
  
  // Create a map of channels by channel point for easy comparison
  const beforeChannels = new Map<string, LNChannelBalance>();
  const afterChannels = new Map<string, LNChannelBalance>();
  
  balancesBefore.channels.forEach(ch => beforeChannels.set(ch.channelPoint, ch));
  balancesAfter.channels.forEach(ch => afterChannels.set(ch.channelPoint, ch));
  
  // Get all unique channel points
  const allChannelPoints = new Set([
    ...beforeChannels.keys(),
    ...afterChannels.keys()
  ]);
  
  if (allChannelPoints.size === 0) {
    console.log(`   No open channels found.`);
  } else {
    for (const channelPoint of allChannelPoints) {
      const beforeChannel = beforeChannels.get(channelPoint);
      const afterChannel = afterChannels.get(channelPoint);
      
      if (!beforeChannel && afterChannel) {
        // New channel opened
        console.log(`   📈 NEW CHANNEL: ${afterChannel.remoteAlias} (${afterChannel.remotePubkey.substring(0, 20)}...)`);
        console.log(`      Local:  ${afterChannel.localBalance} satoshis`);
        console.log(`      Remote: ${afterChannel.remoteBalance} satoshis`);
      } else if (beforeChannel && !afterChannel) {
        // Channel closed
        console.log(`   📉 CLOSED CHANNEL: ${beforeChannel.remoteAlias} (${beforeChannel.remotePubkey.substring(0, 20)}...)`);
        console.log(`      Was: Local ${beforeChannel.localBalance} / Remote ${beforeChannel.remoteBalance} satoshis`);
      } else if (beforeChannel && afterChannel) {
        // Channel balance changed
        const localChange = afterChannel.localBalance - beforeChannel.localBalance;
        const remoteChange = afterChannel.remoteBalance - beforeChannel.remoteBalance;
        const localChangeSign = localChange >= 0 ? '+' : '';
        const remoteChangeSign = remoteChange >= 0 ? '+' : '';
        
        if (localChange !== 0 || remoteChange !== 0) {
          console.log(`   🔄 CHANNEL UPDATE: ${afterChannel.remoteAlias} (${afterChannel.remotePubkey.substring(0, 20)}...)`);
          console.log(`      Local:  ${beforeChannel.localBalance} → ${afterChannel.localBalance} (${localChangeSign}${localChange})`);
          console.log(`      Remote: ${beforeChannel.remoteBalance} → ${afterChannel.remoteBalance} (${remoteChangeSign}${remoteChange})`);
        }
      }
    }
  }
  
  // Total channel balance changes
  const totalLocalChange = balancesAfter.totalLocalBalance - balancesBefore.totalLocalBalance;
  const totalRemoteChange = balancesAfter.totalRemoteBalance - balancesBefore.totalRemoteBalance;
  const totalLocalChangeSign = totalLocalChange >= 0 ? '+' : '';
  const totalRemoteChangeSign = totalRemoteChange >= 0 ? '+' : '';
  
  console.log(`\n📋 TOTAL CHANNEL BALANCES:`);
  console.log(`   Local balance:  ${balancesBefore.totalLocalBalance} → ${balancesAfter.totalLocalBalance} (${totalLocalChangeSign}${totalLocalChange})`);
  console.log(`   Remote balance: ${balancesBefore.totalRemoteBalance} → ${balancesAfter.totalRemoteBalance} (${totalRemoteChangeSign}${totalRemoteChange})`);
  
  // Summary
  console.log(`\n📊 SUMMARY:`);
  console.log(`   Total balance change: ${onchainChangeSign}${onchainChange + totalLocalChange} satoshis`);
  console.log(`   Total balance change: ${onchainChangeSign}${((onchainChange + totalLocalChange) / 100000000).toFixed(8)} BTC`);
  
  console.log('='.repeat(80) + '\n');
} 