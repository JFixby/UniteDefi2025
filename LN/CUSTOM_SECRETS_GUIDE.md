# Lightning Network Custom Secrets Guide

This guide explains how to create Lightning Network invoices with custom secrets using the LND API and our enhanced invoice creation script.

## Overview

Lightning Network invoices can be created with custom secrets in two ways:

1. **Regular Invoices** - Specify a custom preimage (secret)
2. **Hold Invoices** - Specify a custom hash (of the preimage)

## API Methods

### 1. Regular Invoice with Custom Secret (`AddInvoice`)

**Proto Definition:**
```protobuf
rpc AddInvoice (Invoice) returns (AddInvoiceResponse);

message Invoice {
    // The hex-encoded preimage (32 byte) which will allow settling an incoming
    // HTLC payable to this preimage. When using REST, this field must be encoded
    // as base64.
    bytes r_preimage = 3;
    // ... other fields
}
```

**Key Points:**
- Use `r_preimage` field to specify your custom 32-byte secret
- The hash (`r_hash`) is automatically derived from your preimage
- The preimage is immediately available and can be used to settle the invoice

### 2. Hold Invoice with Custom Hash (`AddHoldInvoice`)

**Proto Definition:**
```protobuf
rpc AddHoldInvoice (AddHoldInvoiceRequest) returns (AddHoldInvoiceResp);

message AddHoldInvoiceRequest {
    // The hash of the preimage
    bytes hash = 2;
    // ... other fields
}
```

**Key Points:**
- Use `hash` field to specify the SHA256 hash of your preimage
- The invoice is created but not settled until you provide the preimage
- You control when to settle the invoice using `SettleInvoice`

## Usage Examples

### Using the Enhanced Script

#### 1. Regular Invoice with Custom Secret

```bash
# Generate a custom 32-byte secret (64 hex characters)
CUSTOM_SECRET="a1b2c3d4e5f6789012345678901234567890abcdef1234567890abcdef123456"

# Create invoice with custom secret
python3 invoice_carol_to_alice.py --amount 100 --custom-secret $CUSTOM_SECRET
```

#### 2. Hold Invoice with Custom Hash

```bash
# Generate a custom hash (64 hex characters)
CUSTOM_HASH="f1e2d3c4b5a6789012345678901234567890abcdef1234567890abcdef123456"

# Create hold invoice with custom hash
python3 invoice_carol_to_alice.py --amount 100 --hold-invoice --custom-hash $CUSTOM_HASH
```

#### 3. Random Secret Generation

```bash
# Regular invoice with random secret
python3 invoice_carol_to_alice.py --amount 50

# Hold invoice with random hash
python3 invoice_carol_to_alice.py --amount 75 --hold-invoice
```

### Direct API Usage

#### 1. Regular Invoice with Custom Secret

```python
import requests
import base64
import hashlib

# Your custom secret (32 bytes)
custom_secret = "a1b2c3d4e5f6789012345678901234567890abcdef1234567890abcdef123456"
secret_bytes = bytes.fromhex(custom_secret)

# Create invoice request
invoice_data = {
    "value": 100,
    "memo": "Custom secret invoice",
    "r_preimage": base64.b64encode(secret_bytes).decode('utf-8')
}

# Send to LND REST API
response = requests.post(
    "https://localhost:8080/v1/invoices",
    json=invoice_data,
    headers={"Grpc-Metadata-macaroon": "your_macaroon_here"}
)
```

#### 2. Hold Invoice with Custom Hash

```python
import requests
import base64
import hashlib

# Your custom hash (32 bytes)
custom_hash = "f1e2d3c4b5a6789012345678901234567890abcdef1234567890abcdef123456"
hash_bytes = bytes.fromhex(custom_hash)

# Create hold invoice request
invoice_data = {
    "value": 100,
    "memo": "Custom hash hold invoice",
    "hash": base64.b64encode(hash_bytes).decode('utf-8')
}

# Send to LND REST API
response = requests.post(
    "https://localhost:8080/v2/invoices/hodl",
    json=invoice_data,
    headers={"Grpc-Metadata-macaroon": "your_macaroon_here"}
)
```

## Key Differences

| Aspect | Regular Invoice | Hold Invoice |
|--------|----------------|--------------|
| **Secret Control** | Preimage specified upfront | Hash specified upfront |
| **Settlement** | Automatic when payment received | Manual using preimage |
| **Use Case** | Standard payments | Conditional payments |
| **API Method** | `AddInvoice` | `AddHoldInvoice` |
| **Settlement Method** | `SettleInvoice` | `SettleInvoice` |

## Security Considerations

### 1. Secret Generation
- Always use cryptographically secure random generation
- Never reuse secrets across different invoices
- Keep secrets secure until needed for settlement

### 2. Hash Verification
- Verify that your hash matches the expected SHA256 of your preimage
- Use the provided verification functions in the script

### 3. Hold Invoice Security
- Hold invoices remain unsettled until you provide the preimage
- This allows for conditional payment scenarios
- Be careful not to lose the preimage for hold invoices

## Testing

Run the test suite to verify functionality:

```bash
python3 test_custom_secret.py
```

This will test:
- Regular invoices with custom secrets
- Hold invoices with custom hashes
- Random secret generation
- Error handling for invalid inputs

## Common Use Cases

### 1. Atomic Swaps
```bash
# Create hold invoice for atomic swap
python3 invoice_carol_to_alice.py --hold-invoice --amount 1000000
```

### 2. Conditional Payments
```bash
# Create invoice that only settles when conditions are met
python3 invoice_carol_to_alice.py --hold-invoice --custom-hash $CONDITIONAL_HASH
```

### 3. Escrow Services
```bash
# Create invoice for escrow service
python3 invoice_carol_to_alice.py --hold-invoice --amount 500000
```

## Troubleshooting

### Common Errors

1. **Invalid Secret Length**
   ```
   [ERROR] Custom secret must be exactly 64 hex characters (32 bytes)
   ```
   - Ensure your secret is exactly 64 hex characters

2. **Invalid Hash Format**
   ```
   [ERROR] Custom hash must be valid hex string
   ```
   - Ensure your hash contains only valid hex characters (0-9, a-f)

3. **Macaroon Issues**
   ```
   [ERROR] Macaroon file not found
   ```
   - Ensure your LND node is running and macaroon files are accessible

### Debug Tips

1. **Enable Debug Output**
   - The script includes detailed debug information
   - Check the JSON response for API details

2. **Verify Hash Calculation**
   ```python
   import hashlib
   secret = "your_secret_here"
   secret_bytes = bytes.fromhex(secret)
   calculated_hash = hashlib.sha256(secret_bytes).hex()
   print(f"Calculated hash: {calculated_hash}")
   ```

3. **Check Invoice Status**
   ```bash
   # Look up invoice by payment hash
   lncli lookupinvoice <payment_hash>
   ```

## References

- [LND Invoices RPC Documentation](https://github.com/lightningnetwork/lnd/blob/master/lnrpc/invoicesrpc/invoices.proto)
- [LND Lightning RPC Documentation](https://github.com/lightningnetwork/lnd/blob/master/lnrpc/lightning.proto)
- [BOLT 11 Specification](https://github.com/lightningnetwork/bolts/blob/master/11-payment-encoding.md) 