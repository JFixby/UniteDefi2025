import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Core environment variables
export const PRIVATE_KEY = process.env.PRIVATE_KEY ? `0x${process.env.PRIVATE_KEY}` : '';
export const DEV_PORTAL_API_TOKEN = process.env.DEV_PORTAL_API_TOKEN || '';

// Network configuration
export const NETWORK = process.env.NETWORK || 'POLYGON';

// RPC URLs
export const RPC_URLS = {
  POLYGON: process.env.POLYGON_RPC_URL || 'https://polygon-rpc.com',
  ETHEREUM: process.env.ETHEREUM_RPC_URL || 'https://eth.llamarpc.com',
  SEPOLIA: process.env.SEPOLIA_RPC_URL || 'https://sepolia.drpc.org',
  MAINNET: process.env.MAINNET_RPC_URL || 'https://eth-mainnet.g.alchemy.com/v2/demo',
  BSC: process.env.BSC_RPC_URL || 'https://bsc-dataseed1.binance.org',
} as const;

// Get current RPC URL based on network
export const getRpcUrl = (): string => {
  const network = NETWORK.toUpperCase();
  return RPC_URLS[network as keyof typeof RPC_URLS] || RPC_URLS.POLYGON;
};

// Validation helpers
export const hasValidPrivateKey = (): boolean => {
  return PRIVATE_KEY.length > 0 && PRIVATE_KEY !== '0x';
};

export const hasValidApiToken = (): boolean => {
  return DEV_PORTAL_API_TOKEN.length > 0;
}; 