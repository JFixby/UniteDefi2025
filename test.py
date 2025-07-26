from web3 import Web3
import json

import SECRETS
from oinch.get_quote import get_quote, MATIC_ADDRESS, WETH_ADDRESS

if __name__ == "__main__":
    # Test the 1inch Swap API v5.2 Quote service
    # This service provides quotes for token swaps by aggregating liquidity from multiple DEXs
    w3 = Web3()
    amount = w3.to_wei(0.1, 'ether')  # 0.1 MATIC in wei
    
    # Get a quote for swapping MATIC to WETH using 1inch Swap API
    quote = get_quote(MATIC_ADDRESS, WETH_ADDRESS, amount, SECRETS.YOUR_1INCH_API_KEY)
    
    print("Quote for swapping 0.1 MATIC to WETH:")
    print("(Using 1inch Swap API v5.2 - Quote service)")
    print(json.dumps(quote, indent=2))
