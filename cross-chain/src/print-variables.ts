import {
  ALICE_PRIVATE_KEY,
  CAROL_PRIVATE_KEY,
  DEV_PORTAL_API_TOKEN,
  NETWORK,
  RPC_URLS,
  CHAIN_IDS,
  getRpcUrl,
  getChainId,
  hasValidAlicePrivateKey,
  hasValidCarolPrivateKey,
  hasValidPrivateKeys,
  hasValidApiToken
} from './variables';

console.log('=== All Variables from variables.ts ===\n');

// Print core environment variables
console.log('Core Environment Variables:');
console.log('ALICE_PRIVATE_KEY:', ALICE_PRIVATE_KEY ? `${ALICE_PRIVATE_KEY.substring(0, 10)}...` : 'NOT SET');
console.log('CAROL_PRIVATE_KEY:', CAROL_PRIVATE_KEY ? `${CAROL_PRIVATE_KEY.substring(0, 10)}...` : 'NOT SET');
console.log('DEV_PORTAL_API_TOKEN:', DEV_PORTAL_API_TOKEN ? `${DEV_PORTAL_API_TOKEN.substring(0, 10)}...` : 'NOT SET');
console.log('NETWORK:', NETWORK);
console.log();

// Print RPC URLs
console.log('RPC URLs:');
console.log('POLYGON:', RPC_URLS.POLYGON);
console.log('ETH_MAINNET:', RPC_URLS.ETH_MAINNET);
console.log();

// Print Chain IDs
console.log('Chain IDs:');
console.log('POLYGON:', CHAIN_IDS.POLYGON);
console.log('ETH_MAINNET:', CHAIN_IDS.ETH_MAINNET);
console.log();

// Print current RPC URL
console.log('Current RPC URL (based on NETWORK):');
console.log(getRpcUrl());
console.log();

// Print current Chain ID
console.log('Current Chain ID (based on NETWORK):');
console.log(getChainId());
console.log();

// Print validation results
console.log('Validation Results:');
console.log('hasValidAlicePrivateKey():', hasValidAlicePrivateKey());
console.log('hasValidCarolPrivateKey():', hasValidCarolPrivateKey());
console.log('hasValidPrivateKeys():', hasValidPrivateKeys());
console.log('hasValidApiToken():', hasValidApiToken());
console.log();

// Print full private keys if they exist (for debugging)
if (ALICE_PRIVATE_KEY && ALICE_PRIVATE_KEY !== '0x') {
  console.log('Full ALICE_PRIVATE_KEY:', ALICE_PRIVATE_KEY);
}
if (CAROL_PRIVATE_KEY && CAROL_PRIVATE_KEY !== '0x') {
  console.log('Full CAROL_PRIVATE_KEY:', CAROL_PRIVATE_KEY);
}
if (DEV_PORTAL_API_TOKEN) {
  console.log('Full DEV_PORTAL_API_TOKEN:', DEV_PORTAL_API_TOKEN);
}
