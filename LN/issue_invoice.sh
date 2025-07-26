#!/bin/bash

# issue_invoice.sh
# Issues an invoice on a selected LN node defined in ln.json
# Usage: ./issue_invoice.sh <node_alias> <amount> [memo]
# If arguments are not provided, prompts interactively.

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BOLD='\033[1m'
NC='\033[0m'

print_error() {
  echo -e "${RED}[ERROR]${NC} $1"
}

print_info() {
  echo -e "${YELLOW}[INFO]${NC} $1"
}

print_success() {
  echo -e "${GREEN}[OK]${NC} $1"
}

if [ ! -f ln.json ]; then
  print_error "ln.json not found. Run setup_polar_macos.sh first."
  exit 1
fi

NODE_ALIAS="$1"
AMOUNT="$2"
MEMO="$3"

if [ -z "$NODE_ALIAS" ] || [ -z "$AMOUNT" ]; then
  echo -e "${BOLD}Available LN nodes:${NC}"
  jq -r '.[].alias' ln.json | nl
  read -p "Enter node alias to issue invoice: " NODE_ALIAS
  read -p "Enter invoice amount (satoshis): " AMOUNT
  read -p "Enter invoice memo/description: " MEMO
else
  if [ -z "$MEMO" ]; then
    MEMO="Invoice from $NODE_ALIAS for $AMOUNT sats"
  fi
fi

print_info "Selected node alias: $NODE_ALIAS"
print_info "Amount: $AMOUNT"
print_info "Memo: $MEMO"

NODE_JSON=$(jq -c --arg alias "$NODE_ALIAS" '.[] | select(.alias==$alias)' ln.json)
if [ -z "$NODE_JSON" ]; then
  print_error "Node alias '$NODE_ALIAS' not found in ln.json."
  exit 1
fi

REST_PORT=$(echo "$NODE_JSON" | jq -r '.rest_port')
if [ -z "$REST_PORT" ] || [ "$REST_PORT" == "null" ]; then
  print_error "rest_port not found for node $NODE_ALIAS in ln.json."
  exit 1
fi

ADMIN_MACAROON=$(echo "$NODE_JSON" | jq -r '.macaroons[] | select(.type=="admin") | .path')
print_info "Admin macaroon path: $ADMIN_MACAROON"
# Check if admin macaroon file exists and is readable
if [ ! -f "$ADMIN_MACAROON" ]; then
  print_error "Admin macaroon not found for node $NODE_ALIAS at $ADMIN_MACAROON."
  exit 1
fi
if [ ! -r "$ADMIN_MACAROON" ]; then
  print_error "Admin macaroon exists but is not readable: $ADMIN_MACAROON. Check permissions."
  exit 1
fi

# Check if REST port is open and accessible
if ! command -v nc >/dev/null 2>&1; then
  print_error "nc (netcat) is not installed. Please install nc to use this script."
  exit 1
fi
if ! nc -z localhost "$REST_PORT" >/dev/null 2>&1; then
  print_error "REST port $REST_PORT is not open on localhost. Is the node running?"
  exit 1
fi

# Check if jq is installed
if ! command -v jq >/dev/null 2>&1; then
  print_error "jq is not installed. Please install jq to use this script."
  exit 1
fi

if ! [[ "$AMOUNT" =~ ^[0-9]+$ ]]; then
  print_error "Amount must be a positive integer."
  exit 1
fi

MACAROON_HEX=$(xxd -ps -u -c 1000 "$ADMIN_MACAROON")

print_info "About to call invoice API: https://localhost:$REST_PORT/v1/invoices"
print_info "POST data: {\"value\":$AMOUNT, \"memo\":\"$MEMO\"}"

# Perform the API call and capture HTTP status and errors
CURL_OUT=$(mktemp)
CURL_ERR=$(mktemp)
HTTP_STATUS=$(curl -sk -w "%{http_code}" -o "$CURL_OUT" -X POST \
  --header "Grpc-Metadata-macaroon: $MACAROON_HEX" \
  -H "Content-Type: application/json" \
  -d '{"value":'$AMOUNT', "memo":"'$MEMO'"}' \
  https://localhost:$REST_PORT/v1/invoices 2>"$CURL_ERR")
CURL_EXIT=$?
INVOICE_JSON=$(cat "$CURL_OUT")
CURL_ERROR_MSG=$(cat "$CURL_ERR")
rm -f "$CURL_OUT" "$CURL_ERR"

if [ $CURL_EXIT -ne 0 ]; then
  print_error "cURL failed with exit code $CURL_EXIT. Error: $CURL_ERROR_MSG"
  exit 1
fi
if [ "$HTTP_STATUS" -ne 200 ]; then
  print_error "API call failed with HTTP status $HTTP_STATUS. Response: $INVOICE_JSON"
  exit 1
fi

# Validate JSON response
if ! echo "$INVOICE_JSON" | jq . >/dev/null 2>&1; then
  print_error "API response is not valid JSON. Raw response: $INVOICE_JSON"
  exit 1
fi

PAY_REQ=$(echo "$INVOICE_JSON" | jq -r '.payment_request')
if [ "$PAY_REQ" == "null" ] || [ -z "$PAY_REQ" ]; then
  print_error "Failed to issue invoice. Response: $INVOICE_JSON"
  exit 1
fi

print_success "Invoice issued on node $NODE_ALIAS!"

# Pretty-print the invoice JSON to the terminal
if command -v jq >/dev/null 2>&1; then
  echo "$INVOICE_JSON" | jq
else
  echo "$INVOICE_JSON"
fi

# Save the pretty-printed invoice JSON to ln.invoice.json
if command -v jq >/dev/null 2>&1; then
  echo "$INVOICE_JSON" | jq > ln.invoice.json
else
  echo "$INVOICE_JSON" > ln.invoice.json
fi

echo -e "${BOLD}Payment Request:${NC} $PAY_REQ" 