from web3 import Web3
import json

import SECRETS
from oinch.get_quote import get_quote

MATIC_TOKEN = "0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee"  # Native MATIC (1inch convention)
WETH_TOKEN = "0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619"  # Wrapped ETH on Polygon
BNL_TOKEN = "0x24d84aB1fd4159920084deB1D1B8F129AfF97505"
USDC_TOKEN = "0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359"  # Native USDC on Polygon


def format_token_amount(amount_wei, decimals):
    """Convert wei amount to human readable format"""
    amount = int(amount_wei) / (10 ** decimals)
    return f"{amount:,.6f}".rstrip('0').rstrip('.')


def print_quote_results(quote, from_token_address, to_token_address, input_amount_wei):
    """Print quote results in human readable format"""
    print("=" * 60)
    print("🔄 1INCH SWAP QUOTE RESULTS")
    print("=" * 60)
    
    # Input token info
    from_token = quote['fromToken']
    to_token = quote['toToken']
    
    print(f"\n📤 INPUT:")
    print(f"   Token: {from_token['name']} ({from_token['symbol']})")
    print(f"   Address: {from_token['address']}")
    print(f"   Amount: {format_token_amount(input_amount_wei, from_token['decimals'])} {from_token['symbol']}")
    
    print(f"\n📥 OUTPUT:")
    print(f"   Token: {to_token['name']} ({to_token['symbol']})")
    print(f"   Address: {to_token['address']}")
    print(f"   Amount: {format_token_amount(quote['toAmount'], to_token['decimals'])} {to_token['symbol']}")
    
    # Calculate exchange rate
    input_amount = int(input_amount_wei) / (10 ** from_token['decimals'])
    output_amount = int(quote['toAmount']) / (10 ** to_token['decimals'])
    exchange_rate = output_amount / input_amount
    
    print(f"\n💱 EXCHANGE RATE:")
    print(f"   1 {from_token['symbol']} = {exchange_rate:.6f} {to_token['symbol']}")
    
    # Gas estimate
    print(f"\n⛽ GAS ESTIMATE:")
    print(f"   {quote['gas']:,} gas units")
    
    # Route information
    print(f"\n🛣️  ROUTE:")
    protocols = quote['protocols']
    for i, hop in enumerate(protocols):
        print(f"   Hop {i+1}:")
        for step in hop:
            for protocol in step:
                print(f"     {protocol['name']} ({protocol['part']}%)")
                print(f"     {protocol['fromTokenAddress']} → {protocol['toTokenAddress']}")
    
    print("\n" + "=" * 60)


if __name__ == "__main__":
    # Test the 1inch Swap API v5.2 Quote service
    # This service provides quotes for token swaps by aggregating liquidity from multiple DEXs
    w3 = Web3()
    amount = w3.to_wei(1, 'ether')  # 0.1 MATIC in wei

    from_token = BNL_TOKEN
    to_token = USDC_TOKEN
    
    print("🔍 Getting quote from 1inch Swap API v5.2...")
    
    # Get a quote for swapping BNL to USDC using 1inch Swap API
    quote = get_quote(from_token, to_token, amount, SECRETS.YOUR_1INCH_API_KEY)
    
    # Check if quote was successful
    if quote is None:
        print("❌ Failed to get quote from 1inch API")
        print("   Please check your API key and network connection")
        exit(1)
    
    # Print results in human readable format
    print_quote_results(quote, from_token, to_token, amount)
    

