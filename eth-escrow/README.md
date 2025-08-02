# ETH Escrow Contract (HTLC) - Lightning Network Integration

A Hash Time Locked Contract (HTLC) for secure conditional transfers between Ethereum and Lightning Network. This contract implements an escrow system where ETH can be locked with a hashlock from a Lightning Network invoice and claimed by providing the corresponding secret.

## Features

- **Secure Deposits**: Lock ETH with a hashlock and expiration time
- **Conditional Claims**: Funds can only be claimed by providing the correct secret
- **Automatic Refunds**: Depositor can retrieve funds after expiration if not claimed
- **Reentrancy Protection**: Uses OpenZeppelin's ReentrancyGuard for security
- **Event Logging**: Comprehensive events for tracking all operations

## How It Works

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

## Contract Functions

### Core Functions

#### `deposit(address claimer, uint256 expirationTime, string memory hashlock)`
- **Purpose**: Creates a new deposit
- **Parameters**:
  - `claimer`: Address that can claim the deposit
  - `expirationTime`: Unix timestamp for expiration
  - `hashlock`: String hashlock from Lightning Network invoice
- **Value**: Must send ETH with the transaction
- **Events**: `DepositCreated`

#### `claim(bytes32 depositId, string memory secret)`
- **Purpose**: Claims a deposit by providing the secret
- **Parameters**:
  - `depositId`: Unique identifier of the deposit
  - `secret`: Secret from Lightning Network payment (preimage)
- **Restrictions**: Only claimer can call, must be before expiration
- **Events**: `DepositClaimed`

#### `cancelDeposit(bytes32 depositId)`
- **Purpose**: Cancels a deposit and returns funds to depositor
- **Parameters**:
  - `depositId`: Unique identifier of the deposit
- **Restrictions**: Only depositor can call, must be after expiration
- **Events**: `DepositCancelled`

### View Functions

#### `getDeposit(bytes32 depositId)`
Returns all details of a deposit:
- `depositor`: Address of the depositor
- `claimer`: Address of the claimer
- `amount`: Amount of ETH deposited
- `expirationTime`: Expiration timestamp
- `hashlock`: String hashlock from Lightning Network
- `claimed`: Whether deposit has been claimed
- `cancelled`: Whether deposit has been cancelled

#### `isExpired(bytes32 depositId)`
Returns `true` if the deposit has expired.

#### `getBalance()`
Returns the total ETH balance of the contract.

## Usage Examples

### JavaScript/TypeScript (with ethers.js)

```javascript
const { ethers } = require("ethers");

// Get hashlock from Lightning Network invoice
const lightningInvoice = "lnbc1..."; // Lightning Network invoice
const hashlock = getPaymentHashFromInvoice(lightningInvoice); // Extract payment hash
const secret = "payment_preimage"; // This comes from Lightning Network payment

// Create deposit
const expirationTime = Math.floor(Date.now() / 1000) + 3600; // 1 hour
const depositTx = await escrow.deposit(
  claimerAddress,
  expirationTime,
  hashlock,
  { value: ethers.parseEther("1.0") }
);

// Get deposit ID from event
const receipt = await depositTx.wait();
const event = receipt.events.find(e => e.event === "DepositCreated");
const depositId = event.args.depositId;

// Claim deposit
const claimTx = await escrow.connect(claimer).claim(depositId, secret);

// Cancel deposit (after expiration)
const cancelTx = await escrow.connect(depositor).cancelDeposit(depositId);
```

### Python (with web3.py)

```python
from web3 import Web3
import lightning_pb2  # Lightning Network library

# Get hashlock from Lightning Network invoice
lightning_invoice = "lnbc1..."  # Lightning Network invoice
hashlock = extract_payment_hash(lightning_invoice)  # Extract payment hash
secret = "payment_preimage"  # This comes from Lightning Network payment

# Create deposit
expiration_time = int(time.time()) + 3600  # 1 hour
deposit_tx = escrow.functions.deposit(
    claimer_address,
    expiration_time,
    hashlock
).transact({'value': Web3.to_wei(1.0, 'ether')})

# Get deposit ID from event
receipt = w3.eth.wait_for_transaction_receipt(deposit_tx)
event = escrow.events.DepositCreated().process_receipt(receipt)[0]
deposit_id = event['args']['depositId']

# Claim deposit
claim_tx = escrow.functions.claim(deposit_id, secret).transact()

# Cancel deposit (after expiration)
cancel_tx = escrow.functions.cancelDeposit(deposit_id).transact()
```

## Security Features

1. **Reentrancy Protection**: Uses OpenZeppelin's ReentrancyGuard
2. **Input Validation**: Comprehensive checks for all parameters
3. **Access Control**: Only authorized parties can perform actions
4. **Time-based Security**: Expiration mechanism prevents indefinite locking
5. **Cryptographic Security**: SHA-256 hashing for secret verification

## Installation and Setup

1. **Install Dependencies**:
   ```bash
   npm install
   ```

2. **Compile Contract**:
   ```bash
   npx hardhat compile
   ```

3. **Run Tests**:
   ```bash
   npx hardhat test
   ```

4. **Deploy Contract**:
   ```bash
   npx hardhat run scripts/deploy.js --network <network-name>
   ```

## Use Cases

1. **Lightning Network Integration**: Secure transfers between Ethereum and Lightning Network
2. **Cross-Chain Transfers**: Secure transfers between different blockchains
3. **Atomic Swaps**: Trustless exchange of ETH and Bitcoin via Lightning
4. **Conditional Payments**: Payments that require Lightning Network payment completion
5. **Escrow Services**: Secure holding of ETH until Lightning payment is made
6. **Time-Locked Deposits**: Deposits that can only be claimed within a time window

## Events

The contract emits the following events:

- `DepositCreated`: When a new deposit is created
- `DepositClaimed`: When a deposit is successfully claimed
- `DepositCancelled`: When a deposit is cancelled and refunded

## License

MIT License - see LICENSE file for details. 