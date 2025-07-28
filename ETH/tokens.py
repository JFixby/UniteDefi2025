# Token mappings for multiple networks
# Maps token symbols to addresses and vice versa for different networks

# Network-specific token mappings
NETWORK_TOKENS = {
    "polygon": {
        # Native tokens
        "MATIC": "0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee",  # Native MATIC (1inch convention)
        "WMATIC": "0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270",  # Wrapped MATIC
        
        # Major stablecoins
        "USDC": "0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359",  # USDC on Polygon (official Circle address)
        "USDC_BRIDGED": "0x2791bca1f2de4661ed88a30c99a7a9449aa84174",  # USDC on Polygon (bridged USDC - deprecated)
        "USDT": "0xc2132D05D31c914a87C6611C10748AEb04B58e8F",  # USDT on Polygon
        "DAI": "0x8f3Cf7ad23Cd3CaDbD9735AFf958023239c6A063",  # DAI on Polygon
        
        # Wrapped tokens
        "WETH": "0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619",  # Wrapped ETH on Polygon
        "WBTC": "0x1BFD67037B42Cf73acF2047067bd4F2C47D9BfD6",  # Wrapped BTC on Polygon
        
        # Project tokens
        "BNL": "0x24d84aB1fd4159920084deB1D1B8F129AfF97505",  # BNLCoin
        "1INCH": "0x9c2C5fd7b07E95EE044DDeba0E97a665F142394f",  # 1INCH token on Polygon
        
        # DeFi tokens
        "AAVE": "0xD6DF932A45C0f255f85145f286eA0b292B21C90B",  # AAVE on Polygon
        "CRV": "0x172370d5Cd63279eFa6d502DAB29171933a610AF",  # Curve DAO Token
        "SUSHI": "0x0b3F868E0BE5597D5DB7fEB59E1CADBb0fdDa50a",  # SushiSwap
        "UNI": "0xb33EaAd8d922B1083446DC23f610c2567fB5180f",  # Uniswap
        
        # Gaming/Metaverse
        "MANA": "0xA1c57f48F0Deb89f569dFbE6E2B7f46D33606fD4",  # Decentraland
        "SAND": "0xBbba073C31bF03b8acFf3790a6a6113B25495E8e",  # The Sandbox
        "AXS": "0x61BDD9C7d4dF4Bf47A4508c0c8245505F2Af5b2b",  # Axie Infinity
        
        # Other popular tokens
        "LINK": "0x53E0bca35eC356BD5ddDFebbD1Fc0fD03FaBad39",  # Chainlink
        "COMP": "0x8505b9d2254A7Ae468c0E9dd10Cea3A837aef5c6",  # Compound
        "MKR": "0x6f7C932e7684666C9fd1d44527765433e01fF61d",  # Maker
        "YFI": "0xDA537104D6A5edd53c6fBba9A898708E465260b6",  # Yearn Finance
    },
    "mainnet": {
        # Native tokens
        "ETH": "0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee",  # Native ETH (1inch convention)
        "WETH": "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",  # Wrapped ETH
        
        # Major stablecoins
        "USDC": "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48",  # USDC on Ethereum (official Circle address)
        "USDT": "0xdAC17F958D2ee523a2206206994597C13D831ec7",  # USDT on Ethereum
        "DAI": "0x6B175474E89094C44Da98b954EedeAC495271d0F",  # DAI on Ethereum
        
        # Wrapped tokens
        "WBTC": "0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599",  # Wrapped BTC on Ethereum
        
        # DeFi tokens
        "AAVE": "0x7Fc66500c84A76Ad7e9c93437bFc5Ac33E2DDaE9",  # AAVE on Ethereum
        "UNI": "0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984",  # Uniswap on Ethereum
        "LINK": "0x514910771AF9Ca656af840dff83E8264EcF986CA",  # Chainlink on Ethereum
    },
    "bsc": {
        # Native tokens
        "BNB": "0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee",  # Native BNB (1inch convention)
        "WBNB": "0xbb4CdB9CBd36B01bD1cBaEF2aF378a0bD5D3D3D3D",  # Wrapped BNB
        
        # Major stablecoins
        "USDC": "0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d",  # USDC on BSC
        "USDT": "0x55d398326f99059fF775485246999027B3197955",  # USDT on BSC
        "DAI": "0x1AF3F329e8BE154074D8769D1FFa4eE058B1DBc3",  # DAI on BSC
        
        # Wrapped tokens
        "WETH": "0x2170Ed0880ac9A755fd29B2688956BD959F933F8",  # Wrapped ETH on BSC
        "WBTC": "0x7130d2A12B9BCbFAe4f2634d864A1Ee1Ce3Ead9c",  # Wrapped BTC on BSC
    },
    "arbitrum": {
        # Native tokens
        "ETH": "0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee",  # Native ETH (1inch convention)
        "WETH": "0x82aF49447D8a07e3bd95BD0d56f35241523fBab1",  # Wrapped ETH on Arbitrum
        
        # Major stablecoins
        "USDC": "0xFF970A61A04b1cA14834A43f5dE4533eBDDB5CC8",  # USDC on Arbitrum
        "USDT": "0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9",  # USDT on Arbitrum
        "DAI": "0xDA10009cBd5D07dd0CeCc66161FC93D7c9000da1",  # DAI on Arbitrum
        
        # Wrapped tokens
        "WBTC": "0x2f2a2543B76A4166549F7aaB2e75Bef0aefC5B0f",  # Wrapped BTC on Arbitrum
    }
}

# Helper function to get symbol from address for a specific network
def get_symbol_from_address(address, network="polygon"):
    """Get token symbol from address for a specific network (case-insensitive)"""
    network_tokens = NETWORK_TOKENS.get(network, {})
    address_to_symbol = {addr.lower(): symbol for symbol, addr in network_tokens.items()}
    return address_to_symbol.get(address.lower(), "Unknown")

# Helper function to get address from symbol for a specific network
def get_address_from_symbol(symbol, network="polygon"):
    """Get token address from symbol for a specific network (case-insensitive)"""
    network_tokens = NETWORK_TOKENS.get(network, {})
    return network_tokens.get(symbol.upper(), "Unknown")

# Helper function to check if address is known for a specific network
def is_known_token(address, network="polygon"):
    """Check if token address is in our database for a specific network"""
    network_tokens = NETWORK_TOKENS.get(network, {})
    address_to_symbol = {addr.lower(): symbol for symbol, addr in network_tokens.items()}
    return address.lower() in address_to_symbol

# Helper function to get all known symbols for a specific network
def get_all_symbols(network="polygon"):
    """Get list of all known token symbols for a specific network"""
    network_tokens = NETWORK_TOKENS.get(network, {})
    return list(network_tokens.keys())

# Helper function to get all known addresses for a specific network
def get_all_addresses(network="polygon"):
    """Get list of all known token addresses for a specific network"""
    network_tokens = NETWORK_TOKENS.get(network, {})
    return list(network_tokens.values())

# Helper function to get supported networks
def get_supported_networks():
    """Get list of all supported networks"""
    return list(NETWORK_TOKENS.keys()) 