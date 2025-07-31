import { 
  ALICE_PRIVATE_KEY,
  CAROL_PRIVATE_KEY,
  DEV_PORTAL_API_TOKEN, 
  NETWORK, 
  getRpcUrl, 
  hasValidAlicePrivateKey,
  hasValidCarolPrivateKey,
  hasValidPrivateKeys,
  hasValidApiToken 
} from './variables';

console.log('🔧 Testing variables.ts configuration...\n');

// Test core values
console.log('📋 Core Values:');
console.log(`  Network: ${NETWORK}`);
console.log(`  Alice Private Key: ${ALICE_PRIVATE_KEY ? '✅ Set' : '❌ Not set'}`);
console.log(`  Carol Private Key: ${CAROL_PRIVATE_KEY ? '✅ Set' : '❌ Not set'}`);
console.log(`  API Token: ${DEV_PORTAL_API_TOKEN ? '✅ Set' : '❌ Not set'}`);
console.log(`  RPC URL: ${getRpcUrl()}`);

// Test validation helpers
console.log('\n🔍 Validation Results:');
console.log(`  Valid Alice Private Key: ${hasValidAlicePrivateKey() ? '✅ Yes' : '❌ No'}`);
console.log(`  Valid Carol Private Key: ${hasValidCarolPrivateKey() ? '✅ Yes' : '❌ No'}`);
console.log(`  All Private Keys Valid: ${hasValidPrivateKeys() ? '✅ Yes' : '❌ No'}`);
console.log(`  Valid API Token: ${hasValidApiToken() ? '✅ Yes' : '❌ No'}`);

// Test Alice private key details (safely)
if (hasValidAlicePrivateKey()) {
  console.log(`  Alice Private Key Length: ${ALICE_PRIVATE_KEY.length} characters`);
  console.log(`  Alice Private Key Prefix: ${ALICE_PRIVATE_KEY.substring(0, 6)}...`);
} else {
  console.log('  Alice Private Key: Not configured properly');
}

// Test Carol private key details (safely)
if (hasValidCarolPrivateKey()) {
  console.log(`  Carol Private Key Length: ${CAROL_PRIVATE_KEY.length} characters`);
  console.log(`  Carol Private Key Prefix: ${CAROL_PRIVATE_KEY.substring(0, 6)}...`);
} else {
  console.log('  Carol Private Key: Not configured properly');
}

// Test API token details (safely)
if (hasValidApiToken()) {
  console.log(`  API Token Length: ${DEV_PORTAL_API_TOKEN.length} characters`);
  console.log(`  API Token Prefix: ${DEV_PORTAL_API_TOKEN.substring(0, 8)}...`);
} else {
  console.log('  API Token: Not configured properly');
}

// Overall status
console.log('\n📊 Overall Status:');
const allValid = hasValidPrivateKeys() && hasValidApiToken();
console.log(`  Configuration: ${allValid ? '✅ Ready to use' : '❌ Needs configuration'}`);

if (!allValid) {
  console.log('\n⚠️  Issues found:');
  if (!hasValidAlicePrivateKey()) {
    console.log('  - Alice private key is not properly configured');
  }
  if (!hasValidCarolPrivateKey()) {
    console.log('  - Carol private key is not properly configured');
  }
  if (!hasValidApiToken()) {
    console.log('  - API token is not properly configured');
  }
  console.log('\n💡 Make sure your .env file is properly set up with:');
  console.log('  - ALICE_PRIVATE_KEY');
  console.log('  - CAROL_PRIVATE_KEY');
  console.log('  - DEV_PORTAL_API_TOKEN');
  console.log('  - NETWORK (POLYGON or ETH_MAINNET)');
} else {
  console.log('\n🎉 All variables are properly configured!');
} 