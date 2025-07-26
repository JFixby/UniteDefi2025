# Token mappings for Polygon network
# Maps token symbols to addresses and vice versa

# Symbol to Address mapping
SYMBOL_TO_ADDRESS = {
    # Native tokens
    "MATIC": "0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee",  # Native MATIC (1inch convention)
    "WMATIC": "0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270",  # Wrapped MATIC
    
    # Major stablecoins
    "USDC": "0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359",  # Native USDC on Polygon
    "USDC_1": "0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359",  # 1inch naming convention
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
}

# Address to Symbol mapping (reverse lookup)
ADDRESS_TO_SYMBOL = {address.lower(): symbol for symbol, address in SYMBOL_TO_ADDRESS.items()}

# Helper function to get symbol from address
def get_symbol_from_address(address):
    """Get token symbol from address (case-insensitive)"""
    return ADDRESS_TO_SYMBOL.get(address.lower(), "Unknown")

# Helper function to get address from symbol
def get_address_from_symbol(symbol):
    """Get token address from symbol (case-insensitive)"""
    return SYMBOL_TO_ADDRESS.get(symbol.upper(), "Unknown")

# Helper function to check if address is known
def is_known_token(address):
    """Check if token address is in our database"""
    return address.lower() in ADDRESS_TO_SYMBOL

# Helper function to get all known symbols
def get_all_symbols():
    """Get list of all known token symbols"""
    return list(SYMBOL_TO_ADDRESS.keys())

# Helper function to get all known addresses
def get_all_addresses():
    """Get list of all known token addresses"""
    return list(SYMBOL_TO_ADDRESS.values()) 