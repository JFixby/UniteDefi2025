import dotenv from 'dotenv';
import { ethers } from 'ethers';

// Load environment variables
dotenv.config();

// Core environment variables
export const ALICE_PRIVATE_KEY = process.env.ALICE_PRIVATE_KEY || '';
export const CAROL_PRIVATE_KEY = process.env.CAROL_PRIVATE_KEY || '';
export const DEV_PORTAL_API_TOKEN = process.env.DEV_PORTAL_API_TOKEN || '';

// Network configuration - only POLYGON or ETH_MAINNET
export const NETWORK = (process.env.NETWORK || 'POLYGON').toUpperCase() as 'POLYGON' | 'ETH_MAINNET';

// Validate network value
if (NETWORK !== 'POLYGON' && NETWORK !== 'ETH_MAINNET') {
  throw new Error('NETWORK must be either "POLYGON" or "ETH_MAINNET"');
}

// RPC URLs - only for supported networks
export const RPC_URLS = {
  POLYGON: process.env.POLYGON_RPC_URL || 'https://polygon-rpc.com',
  ETH_MAINNET: process.env.ETHEREUM_RPC_URL || 'https://eth-mainnet.g.alchemy.com/v2/demo',
} as const;

// Chain IDs for supported networks
export const CHAIN_IDS = {
  POLYGON: 137,
  ETH_MAINNET: 1,
} as const;

// Get current RPC URL based on network
export const getRpcUrl = (): string => {
  return RPC_URLS[NETWORK];
};

// Get current chain ID based on network
export const getChainId = (): number => {
  return CHAIN_IDS[NETWORK];
};

// Validation helpers
export const hasValidAlicePrivateKey = (): boolean => {
  return ALICE_PRIVATE_KEY.length > 0 && ALICE_PRIVATE_KEY !== '0x';
};

export const hasValidCarolPrivateKey = (): boolean => {
  return CAROL_PRIVATE_KEY.length > 0 && CAROL_PRIVATE_KEY !== '0x';
};

export const hasValidPrivateKeys = (): boolean => {
  return hasValidAlicePrivateKey() && hasValidCarolPrivateKey();
};

export const hasValidApiToken = (): boolean => {
  return DEV_PORTAL_API_TOKEN.length > 0;
};

// Get Alice's address from her private key
export const getAliceAddress = (): string => {
  if (!hasValidAlicePrivateKey()) {
    throw new Error('ALICE_PRIVATE_KEY is not set or invalid');
  }
  const aliceWallet = new ethers.Wallet(ALICE_PRIVATE_KEY);
  return aliceWallet.address;
};

// Get native token address (ETH address for EVM chains)
export const getNativeTokenAddress = (): string => {
  return '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee'; // Native ETH address for 1inch SDK
};

// Get escrow factory address based on network
export const getEscrowFactoryAddress = (): string => {
  // Mock addresses - in real implementation these would come from deployment configs
  const ESCROW_FACTORIES = {
    POLYGON: '0x1234567890123456789012345678901234567890',
    ETH_MAINNET: '0x0987654321098765432109876543210987654321',
  } as const;
  
  return ESCROW_FACTORIES[NETWORK];
}; 