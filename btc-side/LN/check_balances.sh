#!/bin/bash

# check_balances.sh (rewritten)
# Reads ln.json (using ln.model.json as schema) and queries each LN node for live on-chain and channel balances.
# Ignores balances in ln.json, always queries the node via REST API.

set -e

# Color codes for pretty output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BOLD='\033[1m'
NC='\033[0m'

print_header() {
  echo -e "\n${BOLD}$1${NC}"
}

print_success() {
  echo -e "${GREEN}[OK]${NC} $1"
}

print_info() {
  echo -e "${YELLOW}[INFO]${NC} $1"
}

print_error() {
  echo -e "${RED}[ERROR]${NC} $1"
}

# Read ln.json
if [ ! -f ln.json ]; then
  print_error "ln.json not found. Run setup_polar_macos.sh first."
  exit 1
fi

# Remove associative array logic for Bash 3.x compatibility

NODES=$(jq -c '.[]' ln.json)

print_header "Checking latest on-chain and channel balances for each LN node:"

for NODE in $NODES; do
  ALIAS=$(echo "$NODE" | jq -r '.alias')
  # Find admin macaroon
  ADMIN_MACAROON=$(echo "$NODE" | jq -r '.macaroons[] | select(.type=="admin") | .path')
  if [ ! -f "$ADMIN_MACAROON" ]; then
    print_error "Admin macaroon not found for node $ALIAS. Skipping."
    continue
  fi
  # Use rest_port from ln.json
  REST_PORT=$(echo "$NODE" | jq -r '.rest_port')
  if [ -z "$REST_PORT" ]; then
    print_error "REST port not specified for node $ALIAS in ln.json. Skipping."
    continue
  fi
  MACAROON_HEX=$(xxd -ps -u -c 1000 "$ADMIN_MACAROON")
  # Get on-chain balance
  ONCHAIN_JSON=$(curl -sk --header "Grpc-Metadata-macaroon: $MACAROON_HEX" https://localhost:$REST_PORT/v1/balance/blockchain)
  ONCHAIN_BAL=$(echo "$ONCHAIN_JSON" | jq -r '.total_balance')
  # Get channel balances
  CHANNELS_JSON=$(curl -sk --header "Grpc-Metadata-macaroon: $MACAROON_HEX" https://localhost:$REST_PORT/v1/channels)
  CHANNELS_COUNT=$(echo "$CHANNELS_JSON" | jq '.channels | length')
  print_header "Node: $ALIAS"
  print_info "On-chain balance: $ONCHAIN_BAL satoshis"
  if [ "$CHANNELS_COUNT" -eq 0 ]; then
    print_info "No open channels."
  else
    echo -e "${BOLD}Channels:${NC}"
    # For each channel, print remote_alias (from ln.json), channel_point, local/remote balance
    echo "$CHANNELS_JSON" | jq -c '.channels[]' | while read -r CH; do
      CHANNEL_POINT=$(echo "$CH" | jq -r '.channel_point')
      REMOTE_PUBKEY=$(echo "$CH" | jq -r '.remote_pubkey')
      # Inline jq lookup for remote_alias from ln.json for this node and channel_point
      REMOTE_ALIAS=$(jq -r --arg alias "$ALIAS" --arg cp "$CHANNEL_POINT" '.[] | select(.alias == $alias) | .channels[]? | select(.channel_point == $cp) | .remote_alias' ln.json)
      [ -z "$REMOTE_ALIAS" ] && REMOTE_ALIAS="(unknown)"
      LOCAL_BAL=$(echo "$CH" | jq -r '.local_balance')
      REMOTE_BAL=$(echo "$CH" | jq -r '.remote_balance')
      echo -e "  Channel to $REMOTE_ALIAS with pub key $REMOTE_PUBKEY (channel_point: $CHANNEL_POINT)\n    Local balance: $LOCAL_BAL\n    Remote balance: $REMOTE_BAL"
    done
  fi
  echo
  # Optionally, print static channel info from ln.json for cross-checking
  # echo "$NODE" | jq -r '.channels[] | "  [ln.json] Channel with remote_alias: \(.remote_alias), channel_point: \(.channel_point)"'
done 