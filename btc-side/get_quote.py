import requests
import sys
import os

# Add the ETH directory to the path so we can import from it
sys.path.append(os.path.join(os.path.dirname(__file__), '..', 'ETH'))

from networks import CHAIN_IDS

# 1inch Swap API v5.2 - Quote endpoint
# This service provides quotes for token swaps across multiple DEXs
BASE_API_URL = "https://api.1inch.dev/swap/v5.2"

def get_quote(from_token_address, to_token_address, amount_wei, the_1inch_api_key, network='polygon'):
    """
    Get a quote for swapping tokens using the 1inch Swap API v5.2.
    
    This function uses the 1inch Swap API to get a quote for swapping tokens.
    The API aggregates liquidity from multiple DEXs (like Uniswap, SushiSwap, etc.)
    and provides the best possible swap route with pricing information.
    
    Args:
        from_token_address (str): The address of the token to swap from
        to_token_address (str): The address of the token to swap to
        amount_wei (int): The am"ount to swap in wei
        the_1inch_api_key (str): The 1inch API key for authentication
        network (str): The network to use (default: 'polygon'). Can be a network name or chain ID.
                      Supported networks: ethereum, polygon, bsc, arbitrum, optimism, etc.
                      You can also pass a chain ID directly as a string or integer.
    
    Returns:
        dict: The quote response from the 1inch Swap API, or None if there's an error
        The response includes:
        - fromToken/toToken: Token information (symbol, name, decimals, etc.)
        - toAmount: Expected output amount
        - protocols: Routing information showing which DEXs will be used
        - gas: Estimated gas cost for the swap
    """
    # Determine chain ID
    if isinstance(network, int):
        chain_id = network
    elif isinstance(network, str):
        if network.isdigit():
            chain_id = int(network)
        else:
            chain_id = CHAIN_IDS.get(network.lower())
            if chain_id is None:
                print(f"Error: Unsupported network '{network}'. Supported networks: {', '.join(CHAIN_IDS.keys())}")
                return None
    else:
        print(f"Error: Invalid network parameter. Expected string or integer, got {type(network)}")
        return None
    
    # Build API URL with chain ID
    api_url = f"{BASE_API_URL}/{chain_id}/quote"
    
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
        response = requests.get(api_url, headers=headers, params=params)
        response.raise_for_status()  # Raise an exception for bad status codes
        return response.json()
    except requests.exceptions.RequestException as e:
        print(f"Error making request to 1inch Swap API: {e}")
        return None
    except ValueError as e:
        print(f"Error parsing JSON response: {e}")
        return None