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

// Block explorer URLs for supported networks
export const BLOCK_EXPLORERS = {
  POLYGON: 'https://polygonscan.com',
  ETH_MAINNET: 'https://etherscan.io',
} as const;

// Get current RPC URL based on network
export const getRpcUrl = (): string => {
  return RPC_URLS[NETWORK];
};

// Get current chain ID based on network
export const getChainId = (): number => {
  return CHAIN_IDS[NETWORK];
};

// Get current block explorer URL based on network
export const getBlockExplorerUrl = (): string => {
  return BLOCK_EXPLORERS[NETWORK];
};

// Get block explorer URL for a specific transaction hash
export const getTransactionUrl = (txHash: string): string => {
  const baseUrl = getBlockExplorerUrl();
  return `${baseUrl}/tx/${txHash}`;
};

// Get block explorer URL for a specific address
export const getAddressUrl = (address: string): string => {
  const baseUrl = getBlockExplorerUrl();
  return `${baseUrl}/address/${address}`;
};

// Get block explorer URL for a specific block
export const getBlockUrl = (blockNumber: string | number): string => {
  const baseUrl = getBlockExplorerUrl();
  return `${baseUrl}/block/${blockNumber}`;
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

// Get Carol's address from her private key
export const getCarolAddress = (): string => {
  if (!hasValidCarolPrivateKey()) {
    throw new Error('CAROL_PRIVATE_KEY is not set or invalid');
  }
  const carolWallet = new ethers.Wallet(CAROL_PRIVATE_KEY);
  return carolWallet.address;
};

// Get native token address (ETH address for EVM chains)
export const getNativeTokenAddress = (): string => {
  return '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee'; // Native ETH address for 1inch SDK
};

// Get escrow contract address
export const getEscrowContractAddress = (): string => {
  return '0x20F0Fee5622B6719B3D095665FdeD507352c29Fa';
};
