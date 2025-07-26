import requests
import json
import SECRETS
from tokens import get_address_from_symbol, get_symbol_from_address

# 1inch Fusion API endpoint for quotes (Polygon network)
FUSION_API_URL = "https://api.1inch.dev/fusion/quote"

# Token addresses
BNL_TOKEN = get_address_from_symbol("BNL")
USDC_TOKEN = get_address_from_symbol("USDC")

# Amount to swap (in wei)
AMOUNT_WEI = 10 ** 18  # 1 BNL (assuming 18 decimals)

# Prepare headers for authentication
HEADERS = {
    'Authorization': f'Bearer {SECRETS.YOUR_1INCH_API_KEY}',
    'Accept': 'application/json'
}

# Prepare quote parameters
params = {
    'fromTokenAddress': BNL_TOKEN,
    'toTokenAddress': USDC_TOKEN,
    'amount': str(AMOUNT_WEI),
    'network': '137',  # Polygon chain ID
}

# Request a quote from the 1inch Fusion API
response = requests.get(FUSION_API_URL, headers=HEADERS, params=params)

if response.status_code == 200:
    quote = response.json()
    print("=== 1inch Fusion Swap Quote (BNL → USDC) ===")
    print(json.dumps(quote, indent=2))
    # Print summary if available
    if 'toAmount' in quote:
        from_symbol = get_symbol_from_address(BNL_TOKEN)
        to_symbol = get_symbol_from_address(USDC_TOKEN)
        print(f"\nQuote: 1 {from_symbol} → {int(quote['toAmount']) / 10**6:.6f} {to_symbol}")
else:
    print(f"Error: {response.status_code} - {response.text}") 