import ETH.seed
from ETH.wallet import check_balance

key = ETH.seed.WALLET_SEED
check_balance(key)