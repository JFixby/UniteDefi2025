#!/usr/bin/env python3
"""
Balance checker using ETH/wallet.py and ETH/tokens.py
Checks balances for specific tokens on Ethereum and Polygon networks
"""

from ETH.wallet import wallet, get_balance
from ETH.tokens import get_address_from_symbol
import SECRETS

def check_token_balance(wallet_address, token_symbol, network):
    """Check balance for a specific token on a network"""
    try:
        # Get token address from symbol
        token_address = get_address_from_symbol(token_symbol, network)
        
        if token_address == "Unknown":
            print(f"❌ {token_symbol} not found on {network}")
            return None
        
        # Handle native tokens (ETH, MATIC, etc.)
        if token_address == "0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee":
            # For native tokens, pass None as token_address
            balance = get_balance(None, network, wallet_address)
        else:
            # For ERC-20 tokens, pass the token address
            balance = get_balance(token_address, network, wallet_address)
        
        if balance is not None:
            # Display contract address for ERC-20 tokens, "Native" for native tokens
            contract_display = token_address if token_address != "0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee" else "Native"
            print(f"✅ {token_symbol}: {balance:.6f} | Contract: {contract_display}")
            return balance
        else:
            print(f"❌ Failed to get {token_symbol} balance on {network}")
            return None
            
    except Exception as e:
        print(f"❌ Error checking {token_symbol} on {network}: {e}")
        return None

def main():
    print("🔍 Checking Wallet Balances")
    print("=" * 50)
    
    # Connect to wallet
    print("Connecting to wallet...")
    account = wallet(SECRETS.WALLET_SEED, "polygon")  # Use polygon as default
    wallet_address = account.address
    print(f"Wallet address: {wallet_address}")
    print()
    
    # Check Ethereum network balances
    print("🌐 ETHEREUM NETWORK")
    print("-" * 30)
    
    ethereum_tokens = ["USDT", "USDC", "ETH"]
    for token in ethereum_tokens:
        check_token_balance(wallet_address, token, "mainnet")
    
    print()
    
    # Check Polygon network balances
    print("🌐 POLYGON NETWORK")
    print("-" * 30)
    
    polygon_tokens = ["MATIC", "USDT", "USDC", "BNL"]
    for token in polygon_tokens:
        check_token_balance(wallet_address, token, "polygon")
    
    print()
    print("=" * 50)
    print("✅ Balance check complete!")

if __name__ == "__main__":
    main()