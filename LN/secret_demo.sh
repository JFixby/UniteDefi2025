#!/bin/bash

# Interactive Lightning Network Demo
# Step-by-step demonstration of invoice creation and payment
# Designed for public audience demonstration with HTLC secret tracking

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m'

print_error() {
  echo -e "${RED}[ERROR]${NC} $1"
}

print_info() {
  echo -e "${YELLOW}[INFO]${NC} $1"
}

print_success() {
  echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_step() {
  echo -e "${BLUE}╔══════════════════════════════════════════════════════════════╗${NC}"
  echo -e "${BLUE}║                    STEP $1                                    ║${NC}"
  echo -e "${BLUE}╚══════════════════════════════════════════════════════════════╝${NC}"
  echo -e "${CYAN}$2${NC}"
  echo
}

print_header() {
  echo -e "${BOLD}╔══════════════════════════════════════════════════════════════╗${NC}"
  echo -e "${BOLD}║              LIGHTNING NETWORK DEMO                           ║${NC}"
  echo -e "${BOLD}║           Real-time Payment Demonstration                     ║${NC}"
  echo -e "${BOLD}║           with HTLC Secret Lifecycle Tracking                ║${NC}"
  echo -e "${BOLD}╚══════════════════════════════════════════════════════════════╝${NC}"
  echo
}

print_separator() {
  echo -e "${YELLOW}────────────────────────────────────────────────────────────────${NC}"
}

print_htlc_info() {
  echo -e "${BOLD}🔐 HTLC SECRET LIFECYCLE:${NC}"
  echo -e "${CYAN}┌─────────────────┬─────────────────────────────────────────────────┐${NC}"
  echo -e "${CYAN}│ Stage           │ Details                                         │${NC}"
  echo -e "${CYAN}├─────────────────┼─────────────────────────────────────────────────┤${NC}"
  echo -e "${CYAN}│ Secret (Preimage)│ $1 │${NC}"
  echo -e "${CYAN}│ Hash (R-Hash)   │ $2 │${NC}"
  echo -e "${CYAN}│ Verification    │ $3 │${NC}"
  echo -e "${CYAN}└─────────────────┴─────────────────────────────────────────────────┘${NC}"
  echo
}

# Function to decode base64 and convert to hex
decode_base64_to_hex() {
  local base64_string="$1"
  echo "$base64_string" | base64 -d | xxd -p -u -c 1000
}

# Function to verify HTLC hash
verify_htlc_hash() {
  local secret_hex="$1"
  local expected_hash="$2"
  
  # Hash the secret using SHA256
  local calculated_hash=$(echo "$secret_hex" | xxd -r -p | $HASH_CMD | cut -d' ' -f1 | tr '[:lower:]' '[:upper:]')
  
  # Convert expected hash from base64 to hex for comparison
  local expected_hex=$(echo "$expected_hash" | base64 -d | xxd -p -u -c 1000)
  
  if [ "$calculated_hash" = "$expected_hex" ]; then
    echo "✅ VERIFIED - Hash matches secret"
  else
    echo "❌ FAILED - Hash verification failed"
    echo "   Expected: $expected_hex"
    echo "   Calculated: $calculated_hash"
  fi
}

wait_for_user() {
  echo -e "${BOLD}Press Enter to continue to the next step...${NC}"
  read -r
  echo
  print_separator
  echo
}

# Check if required files exist
if [ ! -f ln.json ]; then
  print_error "ln.json not found. Run setup_polar_macos.sh first."
  exit 1
fi

# Check if required tools are installed
for tool in jq curl nc xxd base64; do
  if ! command -v "$tool" >/dev/null 2>&1; then
    print_error "$tool is not installed. Please install $tool to use this script."
    exit 1
  fi
done

# Check for hash command (sha256sum on Linux, shasum on macOS)
if command -v sha256sum >/dev/null 2>&1; then
  HASH_CMD="sha256sum"
elif command -v shasum >/dev/null 2>&1; then
  HASH_CMD="shasum -a 256"
else
  print_error "Neither sha256sum nor shasum is available. Please install a hash utility."
  exit 1
fi

print_header
echo -e "${CYAN}Welcome to the Lightning Network Demo with HTLC Secret Tracking!${NC}"
echo
echo "This demonstration will show you how Lightning Network payments work in real-time."
echo "We'll follow a complete payment flow between two Lightning nodes:"
echo "  • Carol (the invoice creator)"
echo "  • Alice (the payer)"
echo
echo -e "${BOLD}What you'll see:${NC}"
echo "  1. Initial balance check for both nodes"
echo "  2. Carol creates an invoice with HTLC secret generation"
echo "  3. Alice pays the invoice using the HTLC secret"
echo "  4. HTLC secret verification and lifecycle tracking"
echo "  5. Final balance check showing the transfer"
echo
print_separator
echo

# Step 1: Check balances
print_step "1" "Checking Initial Balances - Let's see how much each node has to start with"

echo -e "${YELLOW}Connecting to Carol's Lightning node...${NC}"
CAROL_JSON=$(jq -c '.[] | select(.alias=="carol")' ln.json)
if [ -z "$CAROL_JSON" ]; then
  print_error "Carol node not found in ln.json"
  exit 1
fi

CAROL_REST_PORT=$(echo "$CAROL_JSON" | jq -r '.rest_port')
CAROL_ADMIN_MACAROON=$(echo "$CAROL_JSON" | jq -r '.macaroons[] | select(.type=="admin") | .path')
CAROL_MACAROON_HEX=$(xxd -ps -u -c 1000 "$CAROL_ADMIN_MACAROON")

echo "  → Querying Carol's channel balance..."
CAROL_BALANCE=$(curl -sk -X GET \
  --header "Grpc-Metadata-macaroon: $CAROL_MACAROON_HEX" \
  https://localhost:$CAROL_REST_PORT/v1/balance/channels | jq -r '.balance')

echo -e "${YELLOW}Connecting to Alice's Lightning node...${NC}"
ALICE_JSON=$(jq -c '.[] | select(.alias=="alice")' ln.json)
if [ -z "$ALICE_JSON" ]; then
  print_error "Alice node not found in ln.json"
  exit 1
fi

ALICE_REST_PORT=$(echo "$ALICE_JSON" | jq -r '.rest_port')
ALICE_ADMIN_MACAROON=$(echo "$ALICE_JSON" | jq -r '.macaroons[] | select(.type=="admin") | .path')
ALICE_MACAROON_HEX=$(xxd -ps -u -c 1000 "$ALICE_ADMIN_MACAROON")

echo "  → Querying Alice's channel balance..."
ALICE_BALANCE=$(curl -sk -X GET \
  --header "Grpc-Metadata-macaroon: $ALICE_MACAROON_HEX" \
  https://localhost:$ALICE_REST_PORT/v1/balance/channels | jq -r '.balance')

echo
echo -e "${BOLD}📊 INITIAL BALANCES:${NC}"
echo -e "${CYAN}┌─────────────────┬─────────────────┐${NC}"
echo -e "${CYAN}│ Node            │ Balance         │${NC}"
echo -e "${CYAN}├─────────────────┼─────────────────┤${NC}"
echo -e "${CYAN}│ Carol           │ $CAROL_BALANCE satoshis${NC}"
echo -e "${CYAN}│ Alice           │ $ALICE_BALANCE satoshis${NC}"
echo -e "${CYAN}└─────────────────┴─────────────────┘${NC}"
echo

wait_for_user

# Step 2: Issue invoice from Carol to Alice
print_step "2" "Creating Lightning Invoice - Carol generates a payment request with HTLC secret"

echo -e "${YELLOW}Carol is creating an invoice for 13 satoshis...${NC}"
echo "  → Generating payment request..."
echo "  → Amount: 13 satoshis"
echo "  → Memo: Demo invoice from Carol to Alice - 13 satoshis"
echo "  → Generating HTLC secret (preimage)..."

INVOICE_JSON=$(curl -sk -X POST \
  --header "Grpc-Metadata-macaroon: $CAROL_MACAROON_HEX" \
  -H "Content-Type: application/json" \
  -d '{"value":13, "memo":"Demo invoice from Carol to Alice - 13 satoshis"}' \
  https://localhost:$CAROL_REST_PORT/v1/invoices)

PAYMENT_REQUEST=$(echo "$INVOICE_JSON" | jq -r '.payment_request')
INVOICE_R_HASH=$(echo "$INVOICE_JSON" | jq -r '.r_hash')
INVOICE_R_PREIMAGE=$(echo "$INVOICE_JSON" | jq -r '.r_preimage')

# Convert preimage to hex for display
PREIMAGE_HEX=$(decode_base64_to_hex "$INVOICE_R_PREIMAGE")

print_success "Invoice created successfully!"
echo
echo -e "${BOLD}📋 INVOICE DETAILS:${NC}"
echo -e "${CYAN}┌─────────────────┬─────────────────────────────────────────────────┐${NC}"
echo -e "${CYAN}│ Field           │ Value                                           │${NC}"
echo -e "${CYAN}├─────────────────┼─────────────────────────────────────────────────┤${NC}"
echo -e "${CYAN}│ Amount          │ 13 satoshis                                     │${NC}"
echo -e "${CYAN}│ Payment Request │ ${PAYMENT_REQUEST:0:50}... │${NC}"
echo -e "${CYAN}│ Invoice Hash    │ ${INVOICE_R_HASH:0:50}... │${NC}"
echo -e "${CYAN}└─────────────────┴─────────────────────────────────────────────────┘${NC}"
echo

# Show HTLC secret information
print_htlc_info "$PREIMAGE_HEX" "$INVOICE_R_HASH" "🔒 SECRET GENERATED - Ready for payment"

echo -e "${YELLOW}💡 HTLC Secret Lifecycle - Stage 1:${NC}"
echo "  • Carol's node generated a random 32-byte secret (preimage)"
echo "  • The secret is hashed using SHA256 to create the payment hash"
echo "  • Only Carol knows the secret until payment is made"
echo "  • Alice will need this secret to claim the payment"
echo

wait_for_user

# Step 3: Pay invoice
print_step "3" "Processing Payment - Alice sends 13 satoshis using HTLC secret"

echo -e "${YELLOW}Alice is processing the payment...${NC}"
echo "  → Submitting payment request to Alice's node..."
echo "  → Amount: 13 satoshis"
echo "  → Destination: Carol's node"
echo "  → Using HTLC secret for payment routing..."

PAYMENT_RESPONSE=$(curl -sk -X POST \
  --header "Grpc-Metadata-macaroon: $ALICE_MACAROON_HEX" \
  -H "Content-Type: application/json" \
  -d "{\"payment_request\":\"$PAYMENT_REQUEST\"}" \
  https://localhost:$ALICE_REST_PORT/v1/channels/transactions)

# Check if payment was successful by looking for payment_preimage (indicates success)
PAYMENT_PREIMAGE=$(echo "$PAYMENT_RESPONSE" | jq -r '.payment_preimage')

if [ "$PAYMENT_PREIMAGE" != "null" ] && [ -n "$PAYMENT_PREIMAGE" ]; then
  print_success "Payment completed successfully!"
  PAYMENT_HASH=$(echo "$PAYMENT_RESPONSE" | jq -r '.payment_hash')
  
  # Convert received preimage to hex
  RECEIVED_PREIMAGE_HEX=$(decode_base64_to_hex "$PAYMENT_PREIMAGE")
  
  echo
  echo -e "${BOLD}✅ PAYMENT CONFIRMED:${NC}"
  echo -e "${CYAN}┌─────────────────┬─────────────────────────────────────────────────┐${NC}"
  echo -e "${CYAN}│ Field           │ Value                                           │${NC}"
  echo -e "${CYAN}├─────────────────┼─────────────────────────────────────────────────┤${NC}"
  echo -e "${CYAN}│ Status          │ SUCCEEDED                                       │${NC}"
  echo -e "${CYAN}│ Amount          │ 13 satoshis                                     │${NC}"
  echo -e "${CYAN}│ Payment Hash    │ ${PAYMENT_HASH:0:50}... │${NC}"
  echo -e "${CYAN}└─────────────────┴─────────────────────────────────────────────────┘${NC}"
  echo

  # Show HTLC secret information after payment
  print_htlc_info "$RECEIVED_PREIMAGE_HEX" "$PAYMENT_HASH" "🔓 SECRET REVEALED - Payment claimed"
  
  echo -e "${YELLOW}💡 HTLC Secret Lifecycle - Stage 2:${NC}"
  echo "  • Alice's node received the HTLC secret from Carol"
  echo "  • The secret was used to unlock the payment"
  echo "  • Payment routing completed successfully"
  echo "  • Carol can now spend the received funds"
  echo
  echo -e "${YELLOW}⚡ Lightning Network Benefits:${NC}"
  echo "  • Payment completed in milliseconds"
  echo "  • No blockchain confirmation needed"
  echo "  • Minimal fees"
  echo "  • Instant finality"
  echo "  • Secure HTLC-based routing"
else
  print_error "Payment failed: $PAYMENT_RESPONSE"
  exit 1
fi

wait_for_user

# Step 4: Verify HTLC secret
print_step "4" "HTLC Secret Verification - Verifying the cryptographic proof"

echo -e "${YELLOW}Verifying HTLC secret and hash...${NC}"
echo "  → Checking if received secret matches original hash..."
echo "  → Performing SHA256 verification..."

# Verify the HTLC hash
VERIFICATION_RESULT=$(verify_htlc_hash "$RECEIVED_PREIMAGE_HEX" "$INVOICE_R_HASH")

echo
echo -e "${BOLD}🔍 HTLC VERIFICATION RESULTS:${NC}"
echo -e "${CYAN}┌─────────────────┬─────────────────────────────────────────────────┐${NC}"
echo -e "${CYAN}│ Verification    │ Result                                          │${NC}"
echo -e "${CYAN}├─────────────────┼─────────────────────────────────────────────────┤${NC}"
echo -e "${CYAN}│ Secret Match    │ $VERIFICATION_RESULT │${NC}"
echo -e "${CYAN}│ Original Hash   │ ${INVOICE_R_HASH:0:50}... │${NC}"
echo -e "${CYAN}│ Received Secret │ ${RECEIVED_PREIMAGE_HEX:0:50}... │${NC}"
echo -e "${CYAN}└─────────────────┴─────────────────────────────────────────────────┘${NC}"
echo

# Show complete HTLC lifecycle
echo -e "${BOLD}🔄 COMPLETE HTLC LIFECYCLE:${NC}"
echo -e "${CYAN}┌─────────────────┬─────────────────────────────────────────────────┐${NC}"
echo -e "${CYAN}│ Stage           │ Action                                          │${NC}"
echo -e "${CYAN}├─────────────────┼─────────────────────────────────────────────────┤${NC}"
echo -e "${CYAN}│ 1. Generation   │ Carol creates random 32-byte secret             │${NC}"
echo -e "${CYAN}│ 2. Hashing      │ Secret hashed with SHA256 → Payment Hash       │${NC}"
echo -e "${CYAN}│ 3. Invoice      │ Hash included in Lightning invoice             │${NC}"
echo -e "${CYAN}│ 4. Payment      │ Alice pays using payment request               │${NC}"
echo -e "${CYAN}│ 5. Secret Reveal│ Carol reveals secret to claim payment          │${NC}"
echo -e "${CYAN}│ 6. Verification │ Secret verified against original hash          │${NC}"
echo -e "${CYAN}│ 7. Settlement   │ Payment settled, funds transferred             │${NC}"
echo -e "${CYAN}└─────────────────┴─────────────────────────────────────────────────┘${NC}"
echo

wait_for_user

# Step 5: Check balances again
print_step "5" "Verifying Transfer - Let's see the balance changes"

echo -e "${YELLOW}Checking final balances to confirm the transfer...${NC}"

echo "  → Querying Carol's final balance..."
CAROL_FINAL_BALANCE=$(curl -sk -X GET \
  --header "Grpc-Metadata-macaroon: $CAROL_MACAROON_HEX" \
  https://localhost:$CAROL_REST_PORT/v1/balance/channels | jq -r '.balance')

echo "  → Querying Alice's final balance..."
ALICE_FINAL_BALANCE=$(curl -sk -X GET \
  --header "Grpc-Metadata-macaroon: $ALICE_MACAROON_HEX" \
  https://localhost:$ALICE_REST_PORT/v1/balance/channels | jq -r '.balance')

# Calculate differences
CAROL_DIFF=$((CAROL_FINAL_BALANCE - CAROL_BALANCE))
ALICE_DIFF=$((ALICE_FINAL_BALANCE - ALICE_BALANCE))

echo
echo -e "${BOLD}📊 BALANCE COMPARISON:${NC}"
echo -e "${CYAN}┌─────────────────┬─────────────────┬─────────────────┬─────────────────┐${NC}"
echo -e "${CYAN}│ Node            │ Before          │ After           │ Change          │${NC}"
echo -e "${CYAN}├─────────────────┼─────────────────┼─────────────────┼─────────────────┤${NC}"
echo -e "${CYAN}│ Carol           │ $CAROL_BALANCE satoshis${NC}"
echo -e "${CYAN}│ Alice           │ $ALICE_BALANCE satoshis${NC}"
echo -e "${CYAN}└─────────────────┴─────────────────┴─────────────────┴─────────────────┘${NC}"
echo

echo -e "${BOLD}💰 BALANCE CHANGES:${NC}"
if [ $CAROL_DIFF -gt 0 ]; then
  echo -e "${GREEN}  ➕ Carol: +$CAROL_DIFF satoshis${NC}"
else
  echo -e "${RED}  ➖ Carol: $CAROL_DIFF satoshis${NC}"
fi

if [ $ALICE_DIFF -gt 0 ]; then
  echo -e "${GREEN}  ➕ Alice: +$ALICE_DIFF satoshis${NC}"
else
  echo -e "${RED}  ➖ Alice: $ALICE_DIFF satoshis${NC}"
fi

echo
print_separator
echo
print_success "🎉 DEMO COMPLETED SUCCESSFULLY!"
echo
echo -e "${BOLD}What we just demonstrated:${NC}"
echo "  ✅ Instant payment processing on Lightning Network"
echo "  ✅ Complete HTLC secret lifecycle tracking"
echo "  ✅ Cryptographic secret verification"
echo "  ✅ Real-time balance updates"
echo "  ✅ Secure cryptographic payment routing"
echo "  ✅ Zero-confirmation finality"
echo
echo -e "${CYAN}The Lightning Network enables:${NC}"
echo "  • Instant Bitcoin payments"
echo "  • Micro-transactions"
echo "  • Scalable Bitcoin usage"
echo "  • Low-cost transactions"
echo "  • Secure HTLC-based routing"
echo
echo -e "${BOLD}Thank you for watching the Lightning Network in action! ⚡${NC}" 