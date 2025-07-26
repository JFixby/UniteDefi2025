import requests
import time
import json

import SECRETS
from ETH.wallet import wallet
from ETH.networks import infra_rpc, NETWORK
from tokens import get_address_from_symbol

# === CONFIG ===
PRIVATE_KEY = SECRETS.WALLET_SEED
API_KEY = SECRETS.YOUR_1INCH_API_KEY
FUSION_API_URL = 'https://api.1inch.dev/fusion'
NETWORK_ID = '1'  # Ethereum mainnet chain ID

# --- Setup ---
# Get the correct RPC URL for the network
node_url = infra_rpc(NETWORK)
# Get the account object (and print address)
account = wallet(PRIVATE_KEY)
wallet_address = account.address

HEADERS = {
    'Authorization': f'Bearer {API_KEY}',
    'Accept': 'application/json'
}

# --- Step 1: Get a quote ---
params = {
    'fromTokenAddress': get_address_from_symbol('MATIC'),  # Will update to ETH below
    'toTokenAddress': get_address_from_symbol('USDC'),
    'amount': str(1 * 10**18),  # 1 ETH (18 decimals)
    'walletAddress': wallet_address,
    'network': NETWORK_ID,
    'source': 'sdk-test'
}
# 1inch convention for native ETH is 0xeeee... on Ethereum
params['fromTokenAddress'] = '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee'
quote_resp = requests.get(f"{FUSION_API_URL}/quote", headers=HEADERS, params=params)
print(f"Status code: {quote_resp.status_code}")
print(f"Raw response: {quote_resp.text}")
try:
    quote = quote_resp.json()
    print("Quote:", json.dumps(quote, indent=2))
except Exception as e:
    print(f"Failed to parse JSON: {e}")
    quote = None

# --- Step 2: Print auction amounts ---
if 'presets' in quote and 'recommendedPreset' in quote:
    preset = quote['presets'][quote['recommendedPreset']]
    auction_start = int(preset['auctionStartAmount']) / 10**18
    auction_end = int(preset['auctionEndAmount']) / 10**18
    print(f"Auction start amount: {auction_start}")
    print(f"Auction end amount: {auction_end}")
else:
    print("No auction preset info in quote.")

# --- Step 3: Prepare the order ---
# This requires building the order object as per 1inch Fusion spec
# See: https://docs.1inch.io/docs/fusion-swap/fusion-sdk/for-integrators/creating-fusion-orders
order = {
    # Fill in required fields from quote and params
    # 'makerAsset': params['fromTokenAddress'],
    # 'takerAsset': params['toTokenAddress'],
    # ...
}

# --- Step 4: Sign the order (EIP-712) ---
# You must construct the EIP-712 typed data for the order and sign it
# from eth_account.messages import encode_structured_data
# message = encode_structured_data(typed_data)
# signed = account.sign_message(message)
# signature = signed.signature.hex()
signature = '0x...'  # TODO: Implement EIP-712 signing for Fusion order

# --- Step 5: Submit the order ---
# submission = {
#     "order": order,
#     "signature": signature,
#     "quoteId": quote.get('id'),
#     "extension": "0x..."  # if needed
# }
# submit_resp = requests.post(f"{FUSION_API_URL}/order", headers=HEADERS, json=submission)
# info = submit_resp.json()
# print("OrderHash", info.get('orderHash'))
#
# --- Step 6: Poll for order status ---
# order_hash = info.get('orderHash')
# start = time.time()
# while True:
#     status_resp = requests.get(f"{FUSION_API_URL}/order/{order_hash}/status", headers=HEADERS)
#     status = status_resp.json()
#     print("Order status:", status)
#     if status['status'] in ['Filled', 'Expired', 'Cancelled']:
#         break
#     time.sleep(10)
# print('Order executed for', time.time() - start, 'sec')

# --- END --- 