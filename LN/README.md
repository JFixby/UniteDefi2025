# Lightning Network BTC Swap Implementation

This directory contains a complete implementation of BTC swaps using the Lightning Network with HTLC (Hash Time Locked Contract) functionality. The implementation supports swaps between Alice and Carol nodes.

## 🎭 **The Scenario: Alice and Carol Swap BTC**

### **Characters:**
- **Alice** - Lightning Network node (port 8081)
- **Bob** - Intermediary node (port 8082) - acts as routing hub
- **Carol** - Lightning Network node (port 8083)

### **The Swap Scenario:**

#### **Scenario 1: Alice → Carol Swap**
```
Alice wants to send 5000 satoshis to Carol
```

**What happens:**
1. **Alice** creates a swap order to send BTC to **Carol**
2. **Carol** generates an HTLC invoice with a hash lock
3. **Alice** pays the invoice through the Lightning Network
4. **Bob** routes the payment between Alice and Carol
5. **Carol** receives the BTC instantly via Lightning

#### **Scenario 2: Carol → Alice Swap**
```
Carol wants to send 3000 satoshis back to Alice
```

**What happens:**
1. **Carol** creates a swap order to send BTC to **Alice**
2. **Alice** generates an HTLC invoice with a hash lock
3. **Carol** pays the invoice through the Lightning Network
4. **Bob** routes the payment between Carol and Alice
5. **Alice** receives the BTC instantly via Lightning

## 🔐 **HTLC (Hash Time Locked Contract) Scenario:**

### **The Security Mechanism:**
```
1. Generate Secret: "abc123..." (32 bytes)
2. Create Hash: SHA256("abc123...") = "def456..."
3. Alice pays Carol using "def456..." as condition
4. Only when Alice reveals "abc123..." does Carol get paid
5. If Alice doesn't reveal secret within time limit, payment expires
```

### **Why This Matters:**
- **Atomic**: Either both sides complete or both fail
- **Trustless**: No need to trust the other party
- **Time-bound**: Automatic expiry prevents indefinite holds
- **Cryptographic**: Uses hash functions for security

## 🎯 **Demo Scenario for Hackathon:**

### **What You'll Show:**
1. **"Alice has 10,000 sats, Carol has 5,000 sats"**
2. **"Alice wants to send 3,000 sats to Carol"**
3. **"Create HTLC swap with 30-minute expiry"**
4. **"Execute the swap through Lightning Network"**
5. **"Alice now has 7,000 sats, Carol has 8,000 sats"**

### **The Magic:**
- ✅ **Instant settlement** (Lightning Network)
- ✅ **No on-chain fees** (channel-based)
- ✅ **Atomic execution** (HTLC guarantees)
- ✅ **Bidirectional** (works both ways)

## 🔄 **Integration Scenario with 1inch:**

### **Cross-Chain Scenario:**
```
Alice (BTC) ←→ Lightning Network ←→ Polygon ←→ Carol (ETH)
```

1. **Alice** wants to swap **1 BTC** for **15 ETH**
2. **Lightning Network** handles BTC side (this script)
3. **Polygon** handles ETH side (1inch Fusion+)
4. **Same HTLC secret** used on both chains
5. **Relayer** coordinates the secret exchange

## 🏗️ Architecture

The swap system uses the following components:

- **Lightning Network Nodes**: Alice, Bob, and Carol (Bob acts as intermediary)
- **HTLC Contracts**: Hash Time Locked Contracts for atomic swaps
- **REST API Integration**: Direct communication with LND nodes
- **Secret Management**: Cryptographic secrets for HTLC settlement

## 📁 Files

- `btc_swap.py` - Main swap implementation with CLI interface
- `demo_swap.py` - Demo script showing complete swap flows
- `ln.json` - Lightning Network node configuration
- `swaps.json` - Persistent storage for swap orders (created automatically)

## 🚀 Quick Start

### Prerequisites

1. **Lightning Network Setup**: Ensure your Lightning Network nodes are running
2. **Python Dependencies**: Install required packages
   ```bash
   pip install requests
   ```

### Basic Usage

#### 1. Check Node Balances
```bash
python3 btc_swap.py check-balances
```

#### 2. Create a Swap
```bash
# Alice sends 5000 sats to Carol
python3 btc_swap.py create-swap --from alice --to carol --amount 5000
```

#### 3. Execute a Swap
```bash
# Execute the swap using the swap ID from step 2
python3 btc_swap.py execute-swap --swap-id swap_1234567890_abcd
```

#### 4. List All Swaps
```bash
python3 btc_swap.py list-swaps
```

#### 5. Check Swap Status
```bash
python3 btc_swap.py swap-status --swap-id swap_1234567890_abcd
```

### Run Complete Demo

```bash
python3 demo_swap.py
```

This will run a complete demonstration showing:
- Alice → Carol swap
- Carol → Alice swap  
- HTLC features and security

## 🔧 Technical Details

### HTLC Implementation

The swap uses Hash Time Locked Contracts with the following flow:

1. **Secret Generation**: Random 32-byte secret generated
2. **Hash Lock**: SHA256 hash of the secret used as payment condition
3. **Invoice Creation**: HTLC invoice created on receiving node
4. **Payment Execution**: Sending node pays the invoice
5. **Secret Revelation**: Secret revealed to complete the swap

### Security Features

- **Atomic Swaps**: Either both sides complete or both fail
- **Time Locks**: Automatic expiry prevents indefinite holds
- **Hash Locks**: Cryptographic proof of payment
- **Secret Management**: Secure handling of HTLC secrets

### Node Configuration

The system uses the existing Lightning Network setup with:
- **Alice**: REST port 8081
- **Bob**: REST port 8082 (intermediary)
- **Carol**: REST port 8083

Each node has admin macaroons for API access.

## 📊 Swap States

Swaps can be in the following states:

- `pending` - Swap created, waiting for execution
- `executing` - HTLC invoice created, ready for payment
- `completed` - Swap successfully executed
- `failed` - Swap execution failed
- `expired` - Swap expired due to time lock

## 🔍 API Endpoints Used

The script communicates with LND nodes using these REST endpoints:

- `GET /v1/balance/blockchain` - Get on-chain balance
- `GET /v1/channels` - Get channel information
- `POST /v1/invoices` - Create HTLC invoice
- `POST /v1/channels/transactions` - Pay invoice

## 🛠️ Troubleshooting

### Common Issues

1. **Node Not Running**
   ```
   Error: REST port not accessible
   ```
   Solution: Ensure Lightning Network nodes are running

2. **Macaroon Access**
   ```
   Error: Admin macaroon not found
   ```
   Solution: Check macaroon file paths in `ln.json`

3. **Insufficient Balance**
   ```
   Error: Payment failed
   ```
   Solution: Check node balances and channel capacity

### Debug Mode

Enable detailed logging by modifying the logging level in `btc_swap.py`:

```python
logging.basicConfig(level=logging.DEBUG, format='%(asctime)s - %(levelname)s - %(message)s')
```

## 🔗 Integration with 1inch Fusion+

This Lightning Network swap implementation can be integrated with 1inch Fusion+ for cross-chain swaps:

1. **Lightning Side**: This implementation handles BTC transfers
2. **Ethereum Side**: 1inch Fusion+ handles ETH/ERC20 transfers
3. **Relayer**: Coordinates secret exchange between chains
4. **HTLC Bridge**: Same hash lock used on both chains

### Integration Points

- Use the same HTLC secret/hash on both Lightning and Ethereum
- Coordinate expiry times between chains
- Implement relayer service for secret management
- Handle failure scenarios across both chains

## 📈 Scaling Considerations

For production use:

1. **Channel Management**: Implement automatic channel opening/closing
2. **Routing**: Use Lightning Network routing for optimal paths
3. **Liquidity**: Ensure sufficient channel capacity
4. **Monitoring**: Add real-time swap monitoring
5. **Error Recovery**: Implement automatic retry mechanisms

## 🧪 Testing

The demo script provides comprehensive testing:

```bash
# Run all tests
python3 demo_swap.py

# Test specific components
python3 btc_swap.py check-balances
python3 btc_swap.py create-swap --from alice --to carol --amount 1000
```

## 📝 License

This implementation is part of the UniteDefi2025 hackathon project extending 1inch Fusion+ protocol. 