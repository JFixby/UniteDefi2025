console.log('Cross-chain DeFi project initialized!');

interface CrossChainConfig {
  name: string;
  version: string;
  description: string;
}

const config: CrossChainConfig = {
  name: 'cross-chain',
  version: '1.0.0',
  description: 'Cross-chain DeFi project'
};

console.log('Configuration:', config);

// Export the new block explorer helper functions
export { 
  getBlockExplorerUrl,
  getTransactionUrl,
  getAddressUrl,
  getBlockUrl,
  getChainId,
  getRpcUrl,
  NETWORK,
  CHAIN_IDS,
  RPC_URLS,
  BLOCK_EXPLORERS
} from './variables';

// Export Lightning Network functions
export {
  issueLightningInvoice,
  payLightningInvoice,
  validateLightningNode,
  getLNBalances,
  printLNBalancesChange,
  type LightningInvoice,
  type PaymentReceipt,
  type LNNodeBalances,
  type LNChannelBalance
} from './utils/lightning';

export { config }; 