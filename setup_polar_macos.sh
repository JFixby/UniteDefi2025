#!/bin/bash

# Color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BOLD='\033[1m'
NC='\033[0m' # No Color

# Pretty print header
print_header() {
  echo -e "\n${BOLD}$1${NC}"
}

# Pretty print success
print_success() {
  echo -e "${GREEN}[OK]${NC} $1"
}

# Pretty print info
print_info() {
  echo -e "${YELLOW}[INFO]${NC} $1"
}

# Pretty print error
print_error() {
  echo -e "${RED}[ERROR]${NC} $1"
}

# Check if Polar is installed
if ! command -v polar &> /dev/null && ! ls /Applications | grep -iq polar; then
  print_error "Polar is not installed."
  echo -e "\n${BOLD}Installation instructions:${NC}"
  echo -e "  1. Download Polar from: https://lightningpolar.com/download"
  echo -e "  2. Open the .dmg file and drag Polar to your Applications folder."
  echo -e "  3. Make sure Docker Desktop is installed and running."
  exit 1
else
  print_success "Polar is installed."
fi

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
  print_error "Docker is not running. Please start Docker Desktop."
  exit 1
else
  print_success "Docker is running."
fi

# Check if Polar Lightning Network containers are running
POLAR_CONTAINERS=$(docker ps --format '{{.Names}}' | grep -i 'polar-n')
if [ -z "$POLAR_CONTAINERS" ]; then
  print_error "No Polar Lightning Network containers are running."
  echo "  Start a network in the Polar app, then re-run this script."
  exit 1
else
  print_success "Polar Lightning Network containers are running:"
  while IFS= read -r container; do
    echo -e "    - $container"
  done <<< "$POLAR_CONTAINERS"
fi

# Print available macaroons
print_header "Available macaroon files in ~/.polar:"
MACAROONS=$(find ~/.polar -type f -name '*.macaroon')
if [ -z "$MACAROONS" ]; then
  print_error "No macaroon files found in ~/.polar."
else
  print_success "Found the following macaroon files:"
  while IFS= read -r macaroon; do
    safe_path="~${macaroon#$HOME}"
    echo -e "    - $safe_path"
  done <<< "$MACAROONS"
fi

# Try to make a test call to LND REST API (default ports: 8081, 8082, 8083)
LND_PORTS=(8081 8082 8083)
LND_WORKING=0
ADMIN_MACAROON=$(echo "$MACAROONS" | grep admin.macaroon | head -n1)
if [ -n "$ADMIN_MACAROON" ]; then
  MACAROON_HEX=$(xxd -ps -u -c 1000 "$ADMIN_MACAROON")
  for PORT in "${LND_PORTS[@]}"; do
    RESPONSE=$(curl -sk --header "Grpc-Metadata-macaroon: $MACAROON_HEX" https://localhost:$PORT/v1/getinfo)
    if [[ "$RESPONSE" == *'"alias"'* && "$RESPONSE" == *'"identity_pubkey"'* ]]; then
      print_success "Authenticated LND REST API call succeeded on port $PORT."
      # Pretty print JSON if jq is available
      if command -v jq &> /dev/null; then
        echo "$RESPONSE" | jq .
      else
        echo "$RESPONSE"
      fi
      LND_WORKING=1
      break
    fi
  done
  if [ $LND_WORKING -eq 1 ]; then
    print_success "Lightning Network is working and authenticated!"
  else
    print_error "Authenticated call to LND REST API failed on all default ports."
    echo "  - Check if the admin.macaroon matches the running node."
    echo "  - Check the Polar UI for node status."
  fi
else
  print_error "No admin.macaroon found. Cannot perform authenticated API check."
fi

# Unauthenticated check (fallback)
if [ $LND_WORKING -eq 0 ]; then
  for PORT in "${LND_PORTS[@]}"; do
    RESPONSE=$(curl -sk https://localhost:$PORT/v1/getinfo)
    if [[ "$RESPONSE" == *'"code":2'* && "$RESPONSE" == *'macaroon'* ]]; then
      print_success "LND REST API is responding on port $PORT (macaroon required)."
      LND_WORKING=1
      break
    fi
  done
  if [ $LND_WORKING -eq 1 ]; then
    print_success "Lightning Network is working (unauthenticated, macaroon required for full access)."
  else
    print_error "Could not connect to LND REST API on default ports."
    echo "  - Make sure your Polar network is running and has LND nodes."
    echo "  - Check the Polar UI for node status."
    echo "  - If you changed the default ports, update this script."
  fi
fi

# --- New: Check on-chain and channel balances for each node ---

print_header "Checking on-chain and channel balances for each Polar LND node:"

# Helper: get REST port for a node
get_rest_port() {
  local NODE_NAME="$1"
  # Try to get the first host port mapped to 8080/tcp
  local PORT=$(docker inspect "$NODE_NAME" --format '{{(index (index .NetworkSettings.Ports "8080/tcp") 0).HostPort}}' 2>/dev/null)
  if [[ -n "$PORT" ]]; then
    echo "$PORT"
    return
  fi
  # Fallback: use default mapping
  case "$NODE_NAME" in
    *alice*) echo 8081 ;;
    *bob*) echo 8082 ;;
    *carol*) echo 8083 ;;
    *backend1*) echo 8084 ;;
    *) echo "" ;;
  esac
}

# Build a map of pubkey to alias for all nodes
PUBKEY_ALIAS_MAP="{}"
NODE_PUBKEYS=()
NODE_ALIASES=()

# First pass: collect pubkeys and aliases
NODE_INFO=$(docker ps --format '{{.Names}} {{.Image}}' | grep -i 'polar-n')
if [ -z "$NODE_INFO" ]; then
  print_error "No Polar node containers found."
else
  while IFS= read -r LINE; do
    NODE=$(echo "$LINE" | awk '{print $1}')
    IMAGE=$(echo "$LINE" | awk '{print $2}')
    if [[ "$IMAGE" != *lnd* ]]; then
      continue
    fi
    REST_PORT=$(get_rest_port "$NODE")
    if [ -z "$REST_PORT" ]; then
      continue
    fi
    NODE_ALIAS=$(echo "$NODE" | sed -E 's/.*-([a-zA-Z0-9]+)$/\1/')
    MACAROON_PATH=$(find ~/.polar/networks/ -type f -path "*/volumes/lnd/${NODE_ALIAS}/data/chain/bitcoin/regtest/admin.macaroon" | head -n1)
    if [ ! -f "$MACAROON_PATH" ]; then
      continue
    fi
    MACAROON_HEX=$(xxd -ps -u -c 1000 "$MACAROON_PATH")
    GETINFO_JSON=$(curl -sk --header "Grpc-Metadata-macaroon: $MACAROON_HEX" https://localhost:$REST_PORT/v1/getinfo)
    PUBKEY=$(echo "$GETINFO_JSON" | grep -o '"identity_pubkey":"[^\"]*"' | cut -d'"' -f4)
    if [ -n "$PUBKEY" ]; then
      NODE_PUBKEYS+=("$PUBKEY")
      NODE_ALIASES+=("$NODE_ALIAS")
    fi
  done <<< "$NODE_INFO"
fi

# Helper: get alias by pubkey
get_alias_by_pubkey() {
  local SEARCH_PUBKEY="$1"
  for idx in "${!NODE_PUBKEYS[@]}"; do
    if [ "${NODE_PUBKEYS[$idx]}" = "$SEARCH_PUBKEY" ]; then
      echo "${NODE_ALIASES[$idx]}"
      return
    fi
  done
  echo ""
}

# Re-run the node info loop to collect balances and channel info
NODE_JSON="[]"
NODE_NAMES=()
ONCHAIN_BALANCES=()
CHANNEL_BALANCES=()
NODE_INFO=$(docker ps --format '{{.Names}} {{.Image}}' | grep -i 'polar-n')
if [ -z "$NODE_INFO" ]; then
  print_error "No Polar node containers found."
else
  while IFS= read -r LINE; do
    NODE=$(echo "$LINE" | awk '{print $1}')
    IMAGE=$(echo "$LINE" | awk '{print $2}')
    if [[ "$IMAGE" != *lnd* ]]; then
      continue
    fi
    REST_PORT=$(get_rest_port "$NODE")
    if [ -z "$REST_PORT" ]; then
      continue
    fi
    NODE_ALIAS=$(echo "$NODE" | sed -E 's/.*-([a-zA-Z0-9]+)$/\1/')
    MACAROON_PATH=$(find ~/.polar/networks/ -type f -path "*/volumes/lnd/${NODE_ALIAS}/data/chain/bitcoin/regtest/admin.macaroon" | head -n1)
    if [ ! -f "$MACAROON_PATH" ]; then
      continue
    fi
    MACAROON_HEX=$(xxd -ps -u -c 1000 "$MACAROON_PATH")
    ONCHAIN=$(curl -sk --header "Grpc-Metadata-macaroon: $MACAROON_HEX" https://localhost:$REST_PORT/v1/balance/blockchain)
    CHANNELS=$(curl -sk --header "Grpc-Metadata-macaroon: $MACAROON_HEX" https://localhost:$REST_PORT/v1/balance/channels)
    ONCHAIN_BAL=$(echo "$ONCHAIN" | grep -o '"total_balance":"[0-9]*"' | grep -o '[0-9]*')
    CHANNEL_BAL=$(echo "$CHANNELS" | grep -o '"balance":"[0-9]*"' | grep -o '[0-9]*')
    NODE_NAMES+=("$NODE_ALIAS")
    ONCHAIN_BALANCES+=("$ONCHAIN_BAL")
    CHANNEL_BALANCES+=("$CHANNEL_BAL")
    # Get per-channel details
    CHANNELS_JSON=$(curl -sk --header "Grpc-Metadata-macaroon: $MACAROON_HEX" https://localhost:$REST_PORT/v1/channels)
    if command -v jq &> /dev/null; then
      # Add remote_alias to each channel
      CHANNELS_LIST=$(echo "$CHANNELS_JSON" | jq -c '.channels')
      CHANNELS_WITH_ALIAS="[]"
      for row in $(echo "$CHANNELS_LIST" | jq -c '.[]'); do
        REMOTE_PUBKEY=$(echo "$row" | jq -r '.remote_pubkey')
        REMOTE_ALIAS=$(get_alias_by_pubkey "$REMOTE_PUBKEY")
        row_with_alias=$(echo "$row" | jq --arg remote_alias "$REMOTE_ALIAS" --arg local_pubkey "$PUBKEY" '. + {remote_alias: $remote_alias, local_pubkey: $local_pubkey} | {remote_pubkey, local_pubkey, remote_alias, channel_point}')
        CHANNELS_WITH_ALIAS=$(echo "$CHANNELS_WITH_ALIAS" | jq ". + [${row_with_alias}]")
      done
    else
      CHANNELS_WITH_ALIAS="[]"
    fi
    # Find all macaroon files for this node
    MACAROON_DIR=$(dirname "$MACAROON_PATH")
    MACAROONS_ARRAY="[]"
    if [ -d "$MACAROON_DIR" ]; then
      for mfile in "$MACAROON_DIR"/*.macaroon; do
        if [ -f "$mfile" ]; then
          MTYPENAME=$(basename "$mfile" | sed 's/\.macaroon$//')
          MACAROONS_ARRAY=$(echo "$MACAROONS_ARRAY" | jq ". + [{type: \"$MTYPENAME\", path: \"$mfile\"}]")
        fi
      done
    fi
    # Compose node JSON (add macaroons array)
    NODE_OBJ=$(cat <<EOF
{
  "alias": "$NODE_ALIAS",
  "docker_image": "$IMAGE",
  "rest_port": "$REST_PORT",
  "macaroons": $MACAROONS_ARRAY,
  "channels": $CHANNELS_WITH_ALIAS
}
EOF
)
    if [ "$NODE_JSON" = "[]" ]; then
      NODE_JSON="[$NODE_OBJ]"
    else
      NODE_JSON=$(echo "$NODE_JSON" | jq ". + [$NODE_OBJ]")
    fi
  done <<< "$NODE_INFO"
fi

# Print the summary table
if [ ${#NODE_NAMES[@]} -gt 0 ]; then
  print_header "\nSummary Table: Node Balances"
  printf "%-10s | %-15s | %-15s\n" "Node" "On-chain Balance" "Channel Balance"
  printf -- "----------------------------------------------\n"
  for i in "${!NODE_NAMES[@]}"; do
    printf "%-10s | %-15s | %-15s\n" "${NODE_NAMES[$i]}" "${ONCHAIN_BALANCES[$i]}" "${CHANNEL_BALANCES[$i]}"
  done
else
  print_info "No LND node balances to summarize."
fi

# --- Print per-channel balances for each node ---
for i in "${!NODE_NAMES[@]}"; do
  NODE_ALIAS="${NODE_NAMES[$i]}"
  # Find the container name for this alias
  NODE_CONTAINER=$(docker ps --format '{{.Names}} {{.Image}}' | grep -i 'polar-n' | awk '{print $1}' | grep -i "$NODE_ALIAS")
  if [ -z "$NODE_CONTAINER" ]; then
    continue
  fi
  REST_PORT=$(get_rest_port "$NODE_CONTAINER")
  if [ -z "$REST_PORT" ]; then
    continue
  fi
  MACAROON_PATH=$(find ~/.polar/networks/ -type f -path "*/volumes/lnd/${NODE_ALIAS}/data/chain/bitcoin/regtest/admin.macaroon" | head -n1)
  if [ ! -f "$MACAROON_PATH" ]; then
    continue
  fi
  MACAROON_HEX=$(xxd -ps -u -c 1000 "$MACAROON_PATH")
  CHANNELS_JSON=$(curl -sk --header "Grpc-Metadata-macaroon: $MACAROON_HEX" https://localhost:$REST_PORT/v1/channels)
  if command -v jq &> /dev/null; then
    CHANNELS_COUNT=$(echo "$CHANNELS_JSON" | jq '.channels | length')
    if [ "$CHANNELS_COUNT" -eq 0 ]; then
      echo -e "\n${BOLD}Node: $NODE_ALIAS${NC} has no open channels."
    else
      echo -e "\n${BOLD}Node: $NODE_ALIAS${NC} channels:"
      echo "$CHANNELS_JSON" | jq -r '.channels[] | "  Channel with remote_pubkey: \(.remote_pubkey) (channel_point: \(.channel_point))\n    Local balance: \(.local_balance)\n    Remote balance: \(.remote_balance)"'
    fi
  else
    # Fallback: print raw JSON if jq is not available
    echo -e "\n${BOLD}Node: $NODE_ALIAS${NC} channels (raw):"
    echo "$CHANNELS_JSON"
  fi
  done

# --- Write JSON to file ---
echo "$NODE_JSON" | jq . > ln.json
print_success "Wrote LN node and channel data to ln.json."

# --- Write/Update ln.model.json ---
cat > ln.model.json <<EOM
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "title": "LNNodesAndChannels",
  "type": "array",
  "description": "List of Lightning Network nodes with their channels, docker image, and macaroon file paths.",
  "items": {
    "type": "object",
    "properties": {
      "alias": {
        "type": "string",
        "description": "Node alias (name)"
      },
      "docker_image": {
        "type": "string",
        "description": "Docker image name for the node container"
      },
      "rest_port": {
        "type": "string",
        "description": "REST API port mapped for this node"
      },
      "macaroons": {
        "type": "array",
        "description": "List of macaroon files for this node.",
        "items": {
          "type": "object",
          "properties": {
            "type": {
              "type": "string",
              "description": "Macaroon type (e.g., admin, invoice, readonly, etc.)"
            },
            "path": {
              "type": "string",
              "description": "Filesystem path to the macaroon file"
            }
          },
          "required": ["type", "path"]
        }
      },
      "channels": {
        "type": "array",
        "description": "List of channels for this node.",
        "items": {
          "type": "object",
          "properties": {
            "remote_pubkey": {
              "type": "string",
              "description": "Remote node's public key"
            },
            "local_pubkey": {
              "type": "string",
              "description": "Local node's public key"
            },
            "remote_alias": {
              "type": "string",
              "description": "Remote node's alias (if known)"
            },
            "channel_point": {
              "type": "string",
              "description": "Channel point (funding txid:index)"
            },
            "local_balance": {
              "type": "string",
              "pattern": "^\\d+$",
              "description": "Local balance in satoshis (as string)"
            },
            "remote_balance": {
              "type": "string",
              "pattern": "^\\d+$",
              "description": "Remote balance in satoshis (as string)"
            }
          },
          "required": ["remote_pubkey", "local_pubkey", "remote_alias", "channel_point", "local_balance", "remote_balance"]
        }
      }
    },
    "required": ["alias", "docker_image", "rest_port", "macaroons", "channels"]
  }
}
EOM
print_success "Wrote LN data model to ln.model.json."
