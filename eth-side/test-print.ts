import * as variables from './variables';

console.log('Testing variables import...');
console.log('NETWORK:', variables.NETWORK);
console.log('RPC_URLS:', variables.RPC_URLS);
console.log('ALICE_PRIVATE_KEY exists:', !!variables.ALICE_PRIVATE_KEY);
console.log('CAROL_PRIVATE_KEY exists:', !!variables.CAROL_PRIVATE_KEY);
console.log('DEV_PORTAL_API_TOKEN exists:', !!variables.DEV_PORTAL_API_TOKEN); 