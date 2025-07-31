#!/bin/bash

# Interactive Lightning Network Demo
# Step-by-step demonstration of invoice creation and payment

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
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

print_step() {
  echo -e "${BLUE}[STEP $1]${NC} $2"
}

wait_for_user() {
  echo -e "${BOLD}Press Enter to continue to the next step...${NC}"
  read -r
  echo
}

# Check if required files exist
if [ ! -f ln.json ]; then
  print_error "ln.json not found. Run setup_polar_macos.sh first."
  exit 1
fi

# Check if required tools are installed
for tool in jq curl nc xxd; do
  if ! command -v "$tool" >/dev/null 2>&1; then
    print_error "$tool is not installed. Please install $tool to use this script."
    exit 1
  fi
done

echo -e "${BOLD}=== Lightning Network Demo ===${NC}"
echo "This demo will show a complete invoice and payment flow between Carol and Alice."
echo

# Step 1: Check balances
print_step "1" "Checking initial balances for Carol and Alice..."
wait_for_user

echo "Checking Carol's balance..."
CAROL_JSON=$(jq -c '.[] | select(.alias=="carol")' ln.json)
if [ -z "$CAROL_JSON" ]; then
  print_error "Carol node not found in ln.json"
  exit 1
fi

CAROL_REST_PORT=$(echo "$CAROL_JSON" | jq -r '.rest_port')
CAROL_ADMIN_MACAROON=$(echo "$CAROL_JSON" | jq -r '.macaroons[] | select(.type=="admin") | .path')
CAROL_MACAROON_HEX=$(xxd -ps -u -c 1000 "$CAROL_ADMIN_MACAROON")

CAROL_BALANCE=$(curl -sk -X GET \
  --header "Grpc-Metadata-macaroon: $CAROL_MACAROON_HEX" \
  https://localhost:$CAROL_REST_PORT/v1/balance/channels | jq -r '.balance')

echo "Checking Alice's balance..."
ALICE_JSON=$(jq -c '.[] | select(.alias=="alice")' ln.json)
if [ -z "$ALICE_JSON" ]; then
  print_error "Alice node not found in ln.json"
  exit 1
fi

ALICE_REST_PORT=$(echo "$ALICE_JSON" | jq -r '.rest_port')
ALICE_ADMIN_MACAROON=$(echo "$ALICE_JSON" | jq -r '.macaroons[] | select(.type=="admin") | .path')
ALICE_MACAROON_HEX=$(xxd -ps -u -c 1000 "$ALICE_ADMIN_MACAROON")

ALICE_BALANCE=$(curl -sk -X GET \
  --header "Grpc-Metadata-macaroon: $ALICE_MACAROON_HEX" \
  https://localhost:$ALICE_REST_PORT/v1/balance/channels | jq -r '.balance')

echo -e "${BOLD}Initial Balances:${NC}"
echo "Carol: $CAROL_BALANCE satoshis"
echo "Alice: $ALICE_BALANCE satoshis"
echo

# Step 2: Issue invoice from Carol to Alice
print_step "2" "Issuing invoice from Carol to Alice for 13 satoshis..."
wait_for_user

INVOICE_JSON=$(curl -sk -X POST \
  --header "Grpc-Metadata-macaroon: $CAROL_MACAROON_HEX" \
  -H "Content-Type: application/json" \
  -d '{"value":13, "memo":"Demo invoice from Carol to Alice - 13 satoshis"}' \
  https://localhost:$CAROL_REST_PORT/v1/invoices)

PAYMENT_REQUEST=$(echo "$INVOICE_JSON" | jq -r '.payment_request')
INVOICE_R_HASH=$(echo "$INVOICE_JSON" | jq -r '.r_hash')

print_success "Invoice created successfully!"
echo "Payment Request: $PAYMENT_REQUEST"
echo "Invoice Hash: $INVOICE_R_HASH"
echo

# Step 3: Pay invoice
print_step "3" "Paying invoice from Alice to Carol..."
wait_for_user

PAYMENT_RESPONSE=$(curl -sk -X POST \
  --header "Grpc-Metadata-macaroon: $ALICE_MACAROON_HEX" \
  -H "Content-Type: application/json" \
  -d "{\"payment_request\":\"$PAYMENT_REQUEST\"}" \
  https://localhost:$ALICE_REST_PORT/v1/channels/transactions)

PAYMENT_STATUS=$(echo "$PAYMENT_RESPONSE" | jq -r '.status')

if [ "$PAYMENT_STATUS" = "SUCCEEDED" ]; then
  print_success "Payment successful!"
  PAYMENT_HASH=$(echo "$PAYMENT_RESPONSE" | jq -r '.payment_hash')
  echo "Payment Hash: $PAYMENT_HASH"
else
  print_error "Payment failed: $PAYMENT_RESPONSE"
  exit 1
fi
echo

# Step 4: Check balances again
print_step "4" "Checking final balances to see the difference..."
wait_for_user

echo "Checking Carol's final balance..."
CAROL_FINAL_BALANCE=$(curl -sk -X GET \
  --header "Grpc-Metadata-macaroon: $CAROL_MACAROON_HEX" \
  https://localhost:$CAROL_REST_PORT/v1/balance/channels | jq -r '.balance')

echo "Checking Alice's final balance..."
ALICE_FINAL_BALANCE=$(curl -sk -X GET \
  --header "Grpc-Metadata-macaroon: $ALICE_MACAROON_HEX" \
  https://localhost:$ALICE_REST_PORT/v1/balance/channels | jq -r '.balance')

echo -e "${BOLD}Final Balances:${NC}"
echo "Carol: $CAROL_FINAL_BALANCE satoshis"
echo "Alice: $ALICE_FINAL_BALANCE satoshis"
echo

# Calculate differences
CAROL_DIFF=$((CAROL_FINAL_BALANCE - CAROL_BALANCE))
ALICE_DIFF=$((ALICE_FINAL_BALANCE - ALICE_BALANCE))

echo -e "${BOLD}Balance Changes:${NC}"
echo "Carol: $CAROL_DIFF satoshis"
echo "Alice: $ALICE_DIFF satoshis"
echo

print_success "Demo completed successfully!"
echo "The payment of 13 satoshis has been transferred from Alice to Carol." 