import requests

# Polygon chain ID
CHAIN_ID = 137
# 1inch Swap API v5.2 - Quote endpoint
# This service provides quotes for token swaps across multiple DEXs
API_URL = f"https://api.1inch.dev/swap/v5.2/{CHAIN_ID}/quote"

# Token addresses on Polygon
MATIC_ADDRESS = "0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee"  # Native MATIC (1inch convention)
WETH_ADDRESS = "0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619"  # Wrapped ETH on Polygon

def get_quote(from_token_address, to_token_address, amount_wei, the_1inch_api_key):
    """
    Get a quote for swapping tokens using the 1inch Swap API v5.2.
    
    This function uses the 1inch Swap API to get a quote for swapping tokens.
    The API aggregates liquidity from multiple DEXs (like Uniswap, SushiSwap, etc.)
    and provides the best possible swap route with pricing information.
    
    Args:
        from_token_address (str): The address of the token to swap from
        to_token_address (str): The address of the token to swap to
        amount_wei (int): The amount to swap in wei
        the_1inch_api_key (str): The 1inch API key for authentication
    
    Returns:
        dict: The quote response from the 1inch Swap API, or None if there's an error
        The response includes:
        - fromToken/toToken: Token information (symbol, name, decimals, etc.)
        - toAmount: Expected output amount
        - protocols: Routing information showing which DEXs will be used
        - gas: Estimated gas cost for the swap
    """
    headers = {
        'Authorization': f'Bearer {the_1inch_api_key}',
        'Accept': 'application/json'
    }
    
    params = {
        'src': from_token_address,
        'dst': to_token_address,
        'amount': str(amount_wei),
        'includeTokensInfo': 'true',  # Include detailed token metadata
        'includeProtocols': 'true',   # Include routing protocol information
        'includeGas': 'true'          # Include gas estimates
    }
    
    try:
        response = requests.get(API_URL, headers=headers, params=params)
        response.raise_for_status()  # Raise an exception for bad status codes
        return response.json()
    except requests.exceptions.RequestException as e:
        print(f"Error making request to 1inch Swap API: {e}")
        return None
    except ValueError as e:
        print(f"Error parsing JSON response: {e}")
        return None