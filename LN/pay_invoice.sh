#!/bin/bash

# pay_invoice.sh
# Pays an invoice using a selected LN node defined in ln.json and invoice from ln.invoice.json
# Usage: ./pay_invoice.sh <node_alias>
# If argument is not provided, prompts interactively.

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

if [ ! -f ln.invoice.json ]; then
  print_error "ln.invoice.json not found. Run issue_invoice.sh first."
  exit 1
fi

NODE_ALIAS="$1"
if [ -z "$NODE_ALIAS" ]; then
  echo -e "${BOLD}Available LN nodes:${NC}"
  jq -r '.[].alias' ln.json | nl
  read -p "Enter node alias to pay invoice: " NODE_ALIAS
fi

print_info "Selected node alias: $NODE_ALIAS"

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
if [ ! -f "$ADMIN_MACAROON" ]; then
  print_error "Admin macaroon not found for node $NODE_ALIAS at $ADMIN_MACAROON."
  exit 1
fi
if [ ! -r "$ADMIN_MACAROON" ]; then
  print_error "Admin macaroon exists but is not readable: $ADMIN_MACAROON. Check permissions."
  exit 1
fi

if ! command -v nc >/dev/null 2>&1; then
  print_error "nc (netcat) is not installed. Please install nc to use this script."
  exit 1
fi
if ! nc -z localhost "$REST_PORT" >/dev/null 2>&1; then
  print_error "REST port $REST_PORT is not open on localhost. Is the node running?"
  exit 1
fi

if ! command -v jq >/dev/null 2>&1; then
  print_error "jq is not installed. Please install jq to use this script."
  exit 1
fi

MACAROON_HEX=$(xxd -ps -u -c 1000 "$ADMIN_MACAROON")

PAY_REQ=$(jq -r '.payment_request' ln.invoice.json)
if [ -z "$PAY_REQ" ] || [ "$PAY_REQ" == "null" ]; then
  print_error "No payment_request found in ln.invoice.json."
  exit 1
fi

print_info "About to call pay API: https://localhost:$REST_PORT/v1/channels/transactions"
print_info "POST data: {\"payment_request\":\"$PAY_REQ\"}"

CURL_OUT=$(mktemp)
CURL_ERR=$(mktemp)
HTTP_STATUS=$(curl -sk -w "%{http_code}" -o "$CURL_OUT" -X POST \
  --header "Grpc-Metadata-macaroon: $MACAROON_HEX" \
  -H "Content-Type: application/json" \
  -d '{"payment_request":"'$PAY_REQ'"}' \
  https://localhost:$REST_PORT/v1/channels/transactions 2>"$CURL_ERR")
CURL_EXIT=$?
PAYMENT_JSON=$(cat "$CURL_OUT")
CURL_ERROR_MSG=$(cat "$CURL_ERR")
rm -f "$CURL_OUT" "$CURL_ERR"

if [ $CURL_EXIT -ne 0 ]; then
  print_error "cURL failed with exit code $CURL_EXIT. Error: $CURL_ERROR_MSG"
  exit 1
fi
if [ "$HTTP_STATUS" -ne 200 ]; then
  print_error "API call failed with HTTP status $HTTP_STATUS. Response: $PAYMENT_JSON"
  exit 1
fi

if ! echo "$PAYMENT_JSON" | jq . >/dev/null 2>&1; then
  print_error "API response is not valid JSON. Raw response: $PAYMENT_JSON"
  exit 1
fi

print_success "Invoice paid from node $NODE_ALIAS!"

if command -v jq >/dev/null 2>&1; then
  echo "$PAYMENT_JSON" | jq
else
  echo "$PAYMENT_JSON"
fi

if command -v jq >/dev/null 2>&1; then
  echo "$PAYMENT_JSON" | jq > ln.payment.json
else
  echo "$PAYMENT_JSON" > ln.payment.json
fi 