import SECRETS
from ETH.wallet import check_balance

key = SECRETS.WALLET_SEED
check_balance(key)