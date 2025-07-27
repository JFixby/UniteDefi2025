# 1inch Fusion ETH to USDT Swap Example

This project demonstrates how to use the 1inch Fusion SDK to swap ETH for USDT on Ethereum mainnet.

## Prerequisites

1. **Node.js** (v16 or higher)
2. **Ethereum wallet** with some ETH for gas fees and swapping
3. **1inch API token** from [1inch Developer Portal](https://portal.1inch.dev/)
4. **Ethereum node URL** (Alchemy, Infura, etc.)

## Setup

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Configure secrets:**
   
   The project automatically reads secrets from `../SECRETS.py` in the parent directory.
   
   **Required secrets in SECRETS.py:**
   - `WALLET_SEED`: Your wallet private key (without 0x prefix)
   - `YOUR_INFURA_PROJECT_ID`: Your Infura project ID
   - `YOUR_DEV_PORTAL_API_TOKEN`: Your 1inch API token
   
   **Alternative: Use environment variables:**
   ```bash
   cp env.example .env
   ```
   
   Then edit `.env` with your actual values:
   - `PRIVATE_KEY`: Your wallet private key (without 0x prefix)
   - `NODE_URL`: Your Ethereum node URL
   - `DEV_PORTAL_API_TOKEN`: Your 1inch API token

## Usage

### Run the swap example:
```bash
npm start
```

### Development mode (with auto-restart):
```bash
npm run dev
```

### Build TypeScript:
```bash
npm run build
```

## What the example does

1. **Connects** to Ethereum mainnet using your provider
2. **Gets a quote** for swapping 0.01 ETH to USDT
3. **Creates and submits** the order to 1inch Fusion
4. **Monitors** the order status until completion
5. **Displays** the results including execution time

## Configuration

### Swap Amount
You can modify the swap amount by changing the `SWAP_AMOUNT` constant in `src/eth-to-usdt-swap.ts`:

```typescript
const SWAP_AMOUNT = '10000000000000000' // 0.01 ETH in wei
```

### Token Addresses
The example uses these token addresses on Ethereum mainnet:
- **ETH**: `0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee`
- **USDT**: `0xdac17f958d2ee523a2206206994597c13d831ec7`

## Safety Notes

⚠️ **Important Security Considerations:**

1. **Never commit your private key** to version control
2. **Use environment variables** for sensitive data
3. **Test with small amounts** first
4. **Verify token addresses** before swapping
5. **Check gas fees** and ensure sufficient ETH balance

## Troubleshooting

### Common Issues:

1. **"Invalid private key"**: Make sure your private key is correct and doesn't include the 0x prefix
2. **"Insufficient balance"**: Ensure your wallet has enough ETH for the swap + gas fees
3. **"API token invalid"**: Verify your 1inch API token is correct
4. **"Network error"**: Check your Ethereum node URL and internet connection

### Getting Help:

- [1inch Fusion Documentation](https://docs.1inch.io/)
- [1inch Developer Portal](https://portal.1inch.dev/)
- [Fusion SDK GitHub](https://github.com/1inch/fusion-sdk)

## License

ISC 