from web3 import Web3

import SECRETS
from ETH.networks import infra_rpc, NETWORK


def get_w3_connection(network=NETWORK):
    """Create and return a Web3 connection for the specified network"""
    indra_url = infra_rpc(network)
    return Web3(Web3.HTTPProvider(indra_url))


def wallet(key=SECRETS.WALLET_SEED, network=NETWORK):
    """Create and return a wallet account for the specified network"""
    w3 = get_w3_connection(network)
    account = w3.eth.account.from_key(key)
    wallet_address = account.address
    print(f"Connected to wallet: {wallet_address} on {network}")
    return account


def get_balance(token_address, network=NETWORK, wallet_address=None):
    """
    Get balance for a token address on the specified network.
    
    Args:
        token_address: Token contract address (use None or empty string for native token)
        network: Network name (e.g., 'polygon', 'ethereum', 'bsc', 'arbitrum')
        wallet_address: Wallet address to check balance for (optional, uses default wallet if not provided)
    
    Returns:
        float: Token balance
    """
    w3 = get_w3_connection(network)
    
    # If no wallet address provided, use the default wallet
    if not wallet_address:
        account = wallet(network=network)
        wallet_address = account.address
    
    # If no token address provided, get native token balance
    if not token_address:
        balance_wei = w3.eth.get_balance(wallet_address)
        balance_ether = w3.from_wei(balance_wei, 'ether')
        return float(balance_ether)
    
    # ERC-20 token ABI for balanceOf and decimals functions
    abi = [
        {
            "constant": True,
            "inputs": [{"name": "_owner", "type": "address"}],
            "name": "balanceOf",
            "outputs": [{"name": "balance", "type": "uint256"}],
            "type": "function"
        },
        {
            "constant": True,
            "inputs": [],
            "name": "decimals",
            "outputs": [{"name": "", "type": "uint8"}],
            "type": "function"
        }
    ]
    
    try:
        # Convert address to checksum format
        checksum_address = w3.to_checksum_address(token_address)
        
        # Create contract instance
        contract = w3.eth.contract(address=checksum_address, abi=abi)
        
        # Get balance and decimals
        balance = contract.functions.balanceOf(wallet_address).call()
        decimals = contract.functions.decimals().call()
        
        # Calculate actual balance
        result = balance / (10 ** decimals)
        return result
        
    except Exception as e:
        print(f"Error getting ERC-20 balance: {e}")
        return None
