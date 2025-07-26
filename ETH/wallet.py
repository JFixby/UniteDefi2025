import json

import requests
from web3 import Web3

from ETH import seed
from ETH.networks import infra_rpc, NETWORK
from ETH.seed import POLYGONSCAN_API_KEY

indra_url = infra_rpc(NETWORK)
# ✅ Connect to Polygon Network
w3 = Web3(Web3.HTTPProvider(indra_url))


def wallet(key=seed.WALLET_SEED):
    account = w3.eth.account.from_key(key)
    wallet_address = account.address
    print(f"Connected to wallet: {wallet_address}")
    return account


def get_balance(address):
    balance_wei = w3.eth.get_balance(address)
    balance_matic = w3.from_wei(balance_wei, 'ether')
    return float(balance_matic)


def get_erc20_poly_balance(address, token_contract):
    caddress = token_contract
    url = (f"https://api.polygonscan.com/api?module=account&action=tokenbalance"
           f"&contractAddress={caddress}"
           f"&address={address}"
           f"&tag=latest&apikey={POLYGONSCAN_API_KEY}")
    
    try:
        response = requests.get(url)
        response_json = response.json()
        
        if "result" in response_json:
            amount = response_json["result"]
            result = int(amount) / 10 ** 18
            return result
        else:
            return None
            
    except requests.exceptions.RequestException as e:
        print(f"Request failed: {e}")
        return None
    except json.JSONDecodeError as e:
        print(f"JSON decode error: {e}")
        return None
    except Exception as e:
        print(f"Unexpected error: {e}")
        return None


def check_balance(key):
    account = w3.eth.account.from_key(key)
    wallet_address = account.address
    # Print balances
    matic_balance = get_balance(wallet_address)
    print(f"Balance for {wallet_address}")
    print(f"ETH: {matic_balance}")

    token_contract = "0x24d84aB1fd4159920084deB1D1B8F129AfF97505"

    erc20_balance = get_erc20_poly_balance(wallet_address, token_contract)
    if erc20_balance is not None:
        print(f"BNL: {erc20_balance}")
    else:
        print("Failed to fetch ERC-20 token balances.")
