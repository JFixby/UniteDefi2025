import { 
  PRIVATE_KEY, 
  DEV_PORTAL_API_TOKEN, 
  NETWORK, 
  getRpcUrl, 
  hasValidPrivateKey, 
  hasValidApiToken 
} from './variables';

console.log('🔧 Testing variables.ts configuration...\n');

// Test core values
console.log('📋 Core Values:');
console.log(`  Network: ${NETWORK}`);
console.log(`  Private Key: ${PRIVATE_KEY ? '✅ Set' : '❌ Not set'}`);
console.log(`  API Token: ${DEV_PORTAL_API_TOKEN ? '✅ Set' : '❌ Not set'}`);
console.log(`  RPC URL: ${getRpcUrl()}`);

// Test validation helpers
console.log('\n🔍 Validation Results:');
console.log(`  Valid Private Key: ${hasValidPrivateKey() ? '✅ Yes' : '❌ No'}`);
console.log(`  Valid API Token: ${hasValidApiToken() ? '✅ Yes' : '❌ No'}`);

// Test private key details (safely)
if (hasValidPrivateKey()) {
  console.log(`  Private Key Length: ${PRIVATE_KEY.length} characters`);
  console.log(`  Private Key Prefix: ${PRIVATE_KEY.substring(0, 6)}...`);
} else {
  console.log('  Private Key: Not configured properly');
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
const allValid = hasValidPrivateKey() && hasValidApiToken();
console.log(`  Configuration: ${allValid ? '✅ Ready to use' : '❌ Needs configuration'}`);

if (!allValid) {
  console.log('\n⚠️  Issues found:');
  if (!hasValidPrivateKey()) {
    console.log('  - Private key is not properly configured');
  }
  if (!hasValidApiToken()) {
    console.log('  - API token is not properly configured');
  }
  console.log('\n💡 Make sure your .env file is properly set up!');
} else {
  console.log('\n🎉 All variables are properly configured!');
} 