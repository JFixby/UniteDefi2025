from web3 import Web3
import json
import time
import random

import SECRETS
from oinch.get_quote import get_quote
from tokens import get_symbol_from_address, get_address_from_symbol

# Use token addresses from tokens.py
BNL_TOKEN = get_address_from_symbol("BNL")
USDC_TOKEN = get_address_from_symbol("USDC")


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
                # Find token symbols for better readability using token mapping
                from_symbol = get_symbol_from_address(protocol['fromTokenAddress'])
                to_symbol = get_symbol_from_address(protocol['toTokenAddress'])
                
                # If symbol is "Unknown", show shortened address
                if from_symbol == "Unknown":
                    from_symbol = protocol['fromTokenAddress'][:8] + "..." if len(protocol['fromTokenAddress']) > 10 else protocol['fromTokenAddress']
                if to_symbol == "Unknown":
                    to_symbol = protocol['toTokenAddress'][:8] + "..." if len(protocol['toTokenAddress']) > 10 else protocol['toTokenAddress']
                
                print(f"     {from_symbol} → {to_symbol}")
                
                # Add helpful comment for intermediate tokens
                if (protocol['fromTokenAddress'].lower() != from_token['address'].lower() and 
                    protocol['toTokenAddress'].lower() != to_token['address'].lower()):
                    print(f"     (intermediate token)")
    
    print("\n" + "=" * 60)


def get_quote_with_retry(from_token, to_token, amount, api_key, max_retries=5):
    """Get quote with automatic retry on failure"""
    for attempt in range(max_retries):
        try:
            print(f"🔍 Attempt {attempt + 1}/{max_retries}: Getting quote from 1inch Swap API v5.2...")
            quote = get_quote(from_token, to_token, amount, api_key)
            
            if quote is not None:
                print(f"✅ Quote received successfully on attempt {attempt + 1}")
                return quote
            else:
                print(f"❌ Attempt {attempt + 1} failed - no quote received")
                
        except Exception as e:
            print(f"❌ Attempt {attempt + 1} failed with error: {e}")
        
        # If this wasn't the last attempt, wait before retrying
        if attempt < max_retries - 1:
            # Exponential backoff with jitter
            wait_time = (2 ** attempt) + random.uniform(0, 1)
            print(f"⏳ Waiting {wait_time:.1f} seconds before retry...")
            time.sleep(wait_time)
    
    print(f"❌ All {max_retries} attempts failed")
    return None


if __name__ == "__main__":
    # Test the 1inch Swap API v5.2 Quote service
    # This service provides quotes for token swaps by aggregating liquidity from multiple DEXs
    w3 = Web3()
    amount = w3.to_wei(1, 'ether')  # 1 BNL in wei

    from_token = BNL_TOKEN
    to_token = USDC_TOKEN
    
    # Get a quote for swapping BNL to USDC using 1inch Swap API with retry logic
    quote = get_quote_with_retry(from_token, to_token, amount, SECRETS.YOUR_1INCH_API_KEY)
    
    # Check if quote was successful
    if quote is None:
        print("❌ Failed to get quote from 1inch API after all retries")
        print("   Please check your API key and network connection")
        exit(1)
    
    # Print results in human readable format
    # Also print raw JSON for debugging (optional)
    print("\n📄 Raw JSON Response:")
    print(json.dumps(quote, indent=2))

    print_quote_results(quote, from_token, to_token, amount)
    

