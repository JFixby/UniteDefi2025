# ETH Escrow Contract (HTLC) - Lightning Network Integration

A Hash Time Locked Contract (HTLC) for secure conditional transfers between Ethereum and Lightning Network. This contract implements an escrow system where ETH can be locked with a hashlock from a Lightning Network invoice and claimed by providing the corresponding secret.

## 🏗️ Project Structure

### 📁 Core Contract Files

#### `contracts/escrow.sol`
The main smart contract implementing HTLC functionality:
- **`deposit()`**: Creates a new deposit with hashlock and expiration
- **`claim()`**: Claims deposit by providing the correct secret (can claim anytime)
- **`cancelDeposit()`**: Cancels expired deposit and returns funds to depositor
- **`getDeposit()`**: Returns deposit details
- **`isExpired()`**: Checks if deposit is expired

### 📁 Configuration Files

#### `variables.ts`
Central configuration file containing:
- Environment variable loading and validation
- Network configuration (POLYGON/ETH_MAINNET)
- RPC URL management
- Private key validation helpers
- Contract address management

#### `package.json`
Project dependencies and npm scripts:
- **`npm run compile`**: Compile smart contracts
- **`npm run deploy:contract`**: Deploy escrow contract
- **`npm run check:escrow`**: Test deposit and claim functionality
- **`npm run test:cancel`**: Test cancel deposit functionality
- **`npm run cancel:stuck`**: Cancel stuck deposits
- **`npm run type-check`**: TypeScript type checking

### 📁 Core Management Files

#### `deposit-standalone.ts`
Main contract interaction class `EscrowContractManager`:
- **`createDeposit()`**: Create new deposits
- **`claimDeposit()`**: Claim deposits with secret
- **`cancelDeposit()`**: Cancel expired deposits
- **`getDepositInfo()`**: Get deposit details
- **`displayContractInfo()`**: Display contract information
- **`displayDepositInfo()`**: Display deposit information
- **`getAccountBalance()`**: Get account balances
- **`getContractBalance()`**: Get contract balance

#### `deployEscrowContract.ts`
Contract deployment script:
- Deploys escrow contract to specified network
- Saves deployment information
- Verifies contract deployment
- Updates contract address files

### 📁 Test and Utility Files

#### `checkEscrow-standalone.ts`
Main test script for escrow functionality:
- Tests complete deposit → claim workflow
- Demonstrates HTLC usage
- Shows balance tracking
- Interactive testing with user confirmation

#### `testCancelDeposit.ts`
Test script for cancel functionality:
- Creates deposit with short expiration
- Waits for expiration
- Tests cancellation by depositor
- Verifies fund return

#### `cancelStuckDeposit.ts`
Utility script for canceling stuck deposits:
- Uses specific deposit ID from previous tests
- Checks expiration status
- Cancels expired deposits
- Useful for cleanup

#### `claimExistingDeposit.ts`
Script for claiming existing deposits:
- Uses hardcoded deposit ID and secret
- Useful for testing specific scenarios
- Demonstrates claim functionality

#### `checkClaimAmount.ts`
Verification script for claim amounts:
- Checks exact amounts received
- Compares expected vs actual balances
- Useful for debugging transfer issues

#### `print-variables.ts`
Debug utility for configuration:
- Displays all environment variables
- Shows network configuration
- Validates private keys
- Useful for troubleshooting

### 📁 Deployment and Artifact Files

#### `hardhat.config.js`
Hardhat configuration for contract compilation and deployment

#### `tsconfig.json`
TypeScript configuration for the project

#### `artifacts/`
Compiled contract artifacts (auto-generated)

#### `deployment-polygon-*.json`
Deployment information files (auto-generated)

#### `polygon-escrow-address.txt`
Current contract address (auto-updated)

## 🚀 Quick Start

### 1. Environment Setup

Create a `.env` file with required variables:

```env
# Alice's private key for deployment and testing
ALICE_PRIVATE_KEY=your_alice_private_key_here

# Carol's private key for testing
CAROL_PRIVATE_KEY=your_carol_private_key_here

# Network selection (POLYGON or ETH_MAINNET)
NETWORK=POLYGON

# RPC URLs (optional - defaults to public RPCs)
POLYGON_RPC_URL=https://polygon-rpc.com
ETHEREUM_RPC_URL=https://eth-mainnet.g.alchemy.com/v2/demo
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Compile Contracts

```bash
npm run compile
```

### 4. Deploy Contract

```bash
npm run deploy:contract
```

### 5. Test Functionality

```bash
# Test complete escrow workflow
npm run check:escrow

# Test cancel functionality
npm run test:cancel

# Cancel stuck deposits
npm run cancel:stuck
```

## 🔧 How It Works

### 1. Deposit Process
1. **Depositor** creates a deposit with:
   - `claimer`: Address that can claim the funds
   - `expirationTime`: Unix timestamp after which depositor can cancel
   - `hashlock`: String hashlock from Lightning Network invoice
   - `amount`: ETH amount to deposit

2. **Lightning Network Integration**: The hashlock comes from a Lightning Network invoice's payment hash
3. **Fund Locking**: ETH is locked in the contract until claimed or expired

### 2. Claim Process
1. **Claimer** calls `claim()` with:
   - `depositId`: Unique identifier of the deposit
   - `secret`: The secret from Lightning Network payment (preimage)
2. **Verification**: Contract verifies the secret hashes to the Lightning Network hashlock
3. **Transfer**: If valid, funds are transferred to the claimer

### 3. Cancel Process
1. **Expiration Check**: After expiration time, depositor can call `cancelDeposit()`
2. **Refund**: Funds are returned to the depositor
3. **State Update**: Deposit is marked as cancelled

## 🎯 Key Features

### ✅ **Secure Deposits**
- Lock ETH with a hashlock and expiration time
- Reentrancy protection using OpenZeppelin's ReentrancyGuard
- Comprehensive event logging for tracking

### ✅ **Flexible Claims**
- Claimer can claim at any time with correct secret
- Expiration doesn't block legitimate claims
- SHA256 hash verification (Lightning Network compatible)

### ✅ **Automatic Refunds**
- Depositor can retrieve funds after expiration
- Anyone can cancel expired deposits
- Safe fund transfer with failure handling

### ✅ **Cross-Chain Ready**
- Designed for Lightning Network integration
- Compatible with any hashlock-based system
- Extensible for other blockchain networks

## 🔍 Testing Scenarios

### Basic Workflow Test
```bash
npm run check:escrow
```
- Creates deposit
- Waits for user confirmation
- Claims deposit
- Verifies balances

### Cancel Functionality Test
```bash
npm run test:cancel
```
- Creates deposit with short expiration
- Waits for expiration
- Cancels deposit
- Verifies fund return

### Stuck Deposit Cleanup
```bash
npm run cancel:stuck
```
- Uses specific deposit ID
- Checks expiration status
- Cancels if expired
- Useful for maintenance

## 🛠️ Development

### Adding New Features
1. Modify `contracts/escrow.sol` for contract changes
2. Update `deposit-standalone.ts` for new functionality
3. Create test scripts in TypeScript
4. Update `variables.ts` for new configuration

### Debugging
```bash
# Check configuration
npx ts-node print-variables.ts

# Verify claim amounts
npx ts-node checkClaimAmount.ts

# Type checking
npm run type-check
```

### Contract Verification
- Deployment info saved to `deployment-polygon-*.json`
- Contract address saved to `polygon-escrow-address.txt`
- Explorer links provided in test output

## 🔗 Integration

### Lightning Network Integration
- Use Lightning Network invoice payment hash as hashlock
- Extract preimage from Lightning payment as secret
- Compatible with standard Lightning Network protocols

### API Integration
- Use `EscrowContractManager` class for programmatic access
- All functions return transaction hashes and status
- Comprehensive error handling and validation

## 📊 Monitoring

### Transaction Tracking
- All transactions include explorer links
- Balance tracking before/after operations
- Detailed deposit state information

### Event Logging
- `DepositCreated`: New deposit events
- `DepositClaimed`: Successful claim events
- `DepositCancelled`: Cancellation events

## 🚨 Security Considerations

### Private Key Management
- Never commit private keys to version control
- Use environment variables for sensitive data
- Consider hardware wallets for production

### Network Security
- Test thoroughly on testnets before mainnet
- Verify contract addresses before transactions
- Monitor gas prices and network conditions

### Contract Security
- Reentrancy protection implemented
- Input validation on all parameters
- Safe transfer patterns for fund movement

## 📝 License

MIT License - see LICENSE file for details

## 🤝 Contributing

1. Fork the repository
2. Create feature branch
3. Make changes with tests
4. Submit pull request

## 📞 Support

For issues and questions:
- Check existing test scripts for examples
- Review contract documentation
- Test on testnets before mainnet deployment 