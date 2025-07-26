from web3 import Web3
import json
import time
import random

import SECRETS
from oinch.get_quote import get_quote
from ETH.tokens import get_symbol_from_address, get_address_from_symbol


def format_token_amount(amount_wei, decimals):
    """Convert wei amount to human readable format"""
    amount = int(amount_wei) / (10 ** decimals)
    return f"{amount:,.6f}".rstrip('0').rstrip('.')


def print_quote_results(quote, from_token_address, to_token_address, input_amount_wei, pair_name, network):
    """Print quote results in human readable format"""
    print("=" * 60)
    print(f"🔄 1INCH SWAP QUOTE RESULTS - {pair_name} ({network.upper()})")
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
                from_symbol = get_symbol_from_address(protocol['fromTokenAddress'], network)
                to_symbol = get_symbol_from_address(protocol['toTokenAddress'], network)
                
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


def get_quote_helper(network, symbol_from, symbol_to, amount_wei, api_key, max_retries=5):
    """Helper function to get quote using network and symbol parameters"""
    # Get token addresses from symbols
    from_token_address = get_address_from_symbol(symbol_from, network)
    to_token_address = get_address_from_symbol(symbol_to, network)
    
    # Validate token addresses
    if from_token_address == "Unknown":
        print(f"❌ Error: Unknown token symbol '{symbol_from}' on {network}")
        return None, None, None, None
    if to_token_address == "Unknown":
        print(f"❌ Error: Unknown token symbol '{symbol_to}' on {network}")
        return None, None, None, None
    
    pair_name = f"{symbol_from} → {symbol_to}"
    
    # Get quote with retry logic
    for attempt in range(max_retries):
        try:
            print(f"🔍 Attempt {attempt + 1}/{max_retries}: Getting quote for {pair_name} from 1inch Swap API v5.2 ({network.upper()})...")
            quote = get_quote(from_token_address, to_token_address, amount_wei, api_key, network)
            
            if quote is not None:
                print(f"✅ Quote received successfully on attempt {attempt + 1}")
                return quote, from_token_address, to_token_address, pair_name
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
    
    print(f"❌ All {max_retries} attempts failed for {pair_name}")
    return None, None, None, None


def check_quote(network, symbol_from, symbol_to):
    """Simple function to get quote for a token pair"""
    w3 = Web3()
    amount = w3.to_wei(1, 'ether')  # 1 token
    
    print(f"\n🚀 Getting quote for {symbol_from} → {symbol_to} on {network.upper()}")
    
    # Get quote using helper function
    quote, from_token_address, to_token_address, pair_name = get_quote_helper(
        network, symbol_from, symbol_to, amount, SECRETS.YOUR_1INCH_API_KEY
    )
    
    # Check if quote was successful
    if quote is None:
        print(f"❌ Failed to get quote for {symbol_from} → {symbol_to}")
        return False
    
    # Print results in human readable format
    print_quote_results(quote, from_token_address, to_token_address, amount, pair_name, network)
    
    # Also print raw JSON for debugging (optional)
    print(f"\n📄 Raw JSON Response for {pair_name}:")
    print(json.dumps(quote, indent=2))
    
    return True


if __name__ == "__main__":
    print("🎯 1INCH SWAP API QUOTE CHECKER")
    print("=" * 60)
    
    # Simple calls to get quotes
    check_quote("mainnet", "ETH", "USDT")
    check_quote("polygon", "BNL", "USDC")


