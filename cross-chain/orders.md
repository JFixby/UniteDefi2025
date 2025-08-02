# Cross-Chain Order Flow Documentation

## BTC to ETH Flow

1. **Frontend sends order** - User creates an order on the frontend
2. **Backend returns QR code** - System generates a Lightning Network invoice QR code
3. **User pays with Lightning** - User scans QR and pays with Bitcoin via Lightning Network
4. **Wait for ETH** - System processes the payment and sends ETH to user's address

## ETH to BTC Flow

1. **Add invoice text field** - User needs a field to paste their Bitcoin Lightning invoice
2. **User creates invoice** - User generates a Lightning invoice for the amount they want to receive
3. **User calls deposit()** - Frontend calls the smart contract's `deposit()` method (MetaMask transaction puts ETH in escrow)
4. **Frontend sends order to backend** - Order is submitted to the backend system
5. **Wait for BTC** - System processes the escrow and sends Bitcoin via Lightning Network

## Example JSON Structures

### OrderBTC2EVM Request
```json
{
  "amountBtc": 0.001,
  "amountEth": 0.015,
  "ethAddress": "0x742d35Cc6634C0532925a3b8D4C9db96C4b4d8b6"
}
```

### OrderBTC2EVM Response
```json
{
  "lightningNetworkInvoice": "lnbc10u1p3xnhl2pp5jptserfk3zk4qy42..."
}
```

### OrderEVM2BTC Request
```json
{
  "amountBtc": 0.001,
  "btcLightningNetInvoice": "lnbc10u1p3xnhl2pp5jptserfk3zk4qy42...",
  "amountEth": 0.015
}
```

### OrderEVM2BTC Response
```json
{}
``` 