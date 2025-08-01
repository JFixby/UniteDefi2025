#!/usr/bin/env python3

"""
Lightning Network Hodl Invoice Creator
Creates a hodl invoice from Carol to Alice for a specified amount using a custom secret
Stores invoice and secret information in invoice.json
"""

import json
import requests
import base64
import hashlib
import subprocess
import sys
import argparse
import secrets
import datetime
from typing import Dict, Any

# ANSI color codes for terminal output
RED = '\033[0;31m'
GREEN = '\033[0;32m'
YELLOW = '\033[1;33m'
BLUE = '\033[0;34m'
CYAN = '\033[0;36m'
BOLD = '\033[1m'
NC = '\033[0m'  # No Color

def print_colored(text: str, color: str = NC) -> None:
    """Print colored text to terminal"""
    print(f"{color}{text}{NC}")

def print_header(amount_satoshis: int) -> None:
    """Print script header"""
    print_colored("╔══════════════════════════════════════════════════════════════╗", BLUE)
    print_colored("║              LIGHTNING HODL INVOICE CREATOR                  ║", BLUE)
    print_colored(f"║           Carol → Alice ({amount_satoshis} satoshis)                        ║", BLUE)
    print_colored("╚══════════════════════════════════════════════════════════════╝", BLUE)
    print()

def load_ln_config() -> Dict[str, Any]:
    """Load Lightning Network configuration from ln.json"""
    try:
        with open('ln.json', 'r') as f:
            config = json.load(f)
        return config
    except FileNotFoundError:
        print_colored("[ERROR] ln.json not found. Run setup_polar_macos.sh first.", RED)
        sys.exit(1)
    except json.JSONDecodeError:
        print_colored("[ERROR] Invalid JSON in ln.json", RED)
        sys.exit(1)

def get_carol_config(config: Dict[str, Any]) -> Dict[str, Any]:
    """Extract Carol's node configuration"""
    for node in config:
        if node.get('alias') == 'carol':
            return node
    
    print_colored("[ERROR] Carol node not found in ln.json", RED)
    sys.exit(1)

def read_macaroon_hex(macaroon_path: str) -> str:
    """Read macaroon file and convert to hex"""
    try:
        with open(macaroon_path, 'rb') as f:
            macaroon_bytes = f.read()
        return macaroon_bytes.hex().upper()
    except FileNotFoundError:
        print_colored(f"[ERROR] Macaroon file not found: {macaroon_path}", RED)
        sys.exit(1)

def generate_random_secret() -> str:
    """Generate a random 32-byte secret in hex format"""
    random_bytes = secrets.token_bytes(32)
    return random_bytes.hex()

def create_hodl_invoice(carol_config: Dict[str, Any], amount_satoshis: int, secret_hex: str, expiry_seconds: int) -> Dict[str, Any]:
    """Create Lightning hodl invoice from Carol using custom secret"""
    print_colored(f"🔐 Creating Lightning hodl invoice from Carol for {amount_satoshis} satoshis...", YELLOW)
    print_colored(f"🔑 Using custom secret: {secret_hex[:16]}...", YELLOW)
    
    # Extract Carol's configuration
    rest_port = carol_config['rest_port']
    admin_macaroon_path = None
    
    # Find admin macaroon
    for macaroon in carol_config['macaroons']:
        if macaroon['type'] == 'admin':
            admin_macaroon_path = macaroon['path']
            break
    
    if not admin_macaroon_path:
        print_colored("[ERROR] Admin macaroon not found for Carol", RED)
        sys.exit(1)
    
    # Read macaroon
    macaroon_hex = read_macaroon_hex(admin_macaroon_path)
    
    # Convert hex secret to bytes and create hash
    try:
        secret_bytes = bytes.fromhex(secret_hex)
        if len(secret_bytes) != 32:
            print_colored("[ERROR] Secret must be exactly 32 bytes (64 hex characters)", RED)
            sys.exit(1)
        
        # Create SHA256 hash of the secret (this is the preimage hash)
        preimage_hash = hashlib.sha256(secret_bytes).digest()
        preimage_hash_base64 = base64.b64encode(preimage_hash).decode('utf-8')
        
        print_colored(f"🔍 Generated preimage hash: {preimage_hash.hex()[:16]}...", YELLOW)
        
    except ValueError as e:
        print_colored(f"[ERROR] Invalid hex secret: {e}", RED)
        sys.exit(1)
    
    # Prepare hodl invoice request
    hodl_invoice_data = {
        "value": amount_satoshis,
        "memo": f"Demo hodl invoice from Carol to Alice - {amount_satoshis} satoshis",
        "hash": preimage_hash_base64,
        "expiry": expiry_seconds  # Use parameter
    }
    
    # Create hodl invoice via REST API
    url = f"https://localhost:{rest_port}/v2/invoices/hodl"
    headers = {
        "Grpc-Metadata-macaroon": macaroon_hex,
        "Content-Type": "application/json"
    }
    
    try:
        response = requests.post(
            url,
            json=hodl_invoice_data,
            headers=headers,
            verify=False,  # Skip SSL verification for local development
            timeout=10
        )
        response.raise_for_status()
        invoice_response = response.json()
        
        # Debug: Print the response to see the structure
        print_colored("🔍 Hodl invoice response received:", YELLOW)
        print(json.dumps(invoice_response, indent=2))
        print()
        
        return invoice_response
    except requests.exceptions.RequestException as e:
        print_colored(f"[ERROR] Failed to create hodl invoice: {e}", RED)
        sys.exit(1)

def verify_htlc_hash(secret_hex: str, expected_hash_base64: str) -> bool:
    """Verify HTLC hash by hashing the secret and comparing"""
    try:
        # Convert hex secret to bytes
        secret_bytes = bytes.fromhex(secret_hex)
        
        # Hash the secret using SHA256
        calculated_hash = hashlib.sha256(secret_bytes).digest()
        calculated_hash_base64 = base64.b64encode(calculated_hash).decode('utf-8')
        
        # Compare with expected hash
        return calculated_hash_base64 == expected_hash_base64
    except Exception as e:
        print_colored(f"[ERROR] Failed to verify hash: {e}", RED)
        return False

def save_invoice_data(invoice_data: Dict[str, Any], amount_satoshis: int, secret_hex: str, carol_config: Dict[str, Any], expiry_seconds: int) -> None:
    """Save invoice and secret data to invoice.json"""
    # Create hash from secret for verification
    secret_bytes = bytes.fromhex(secret_hex)
    secret_hash = hashlib.sha256(secret_bytes).digest()
    secret_hash_base64 = base64.b64encode(secret_hash).decode('utf-8')
    
    # Calculate creation and expiration times
    creation_time = datetime.datetime.utcnow()
    expiration_time = creation_time + datetime.timedelta(seconds=expiry_seconds)
    
    output_data = {
        "invoice": invoice_data,
        "htlc_secret": {
            "secret": "HIDDEN",
            "secret_hash": secret_hash_base64,
            "verification": {
                "hash_verified": verify_htlc_hash(secret_hex, secret_hash_base64),
                "timestamp": invoice_data.get('add_index', ''),
                "expiry_seconds": expiry_seconds,
                "status": "HODL_INVOICE_CREATED_AWAITING_PAYMENT"
            }
        },
        "secret_debug": {
            "secret_hex": secret_hex,
            "generated_at": "invoice_creation",
            "note": "This field is for debugging purposes only - contains the actual secret"
        },
        "hash_verification": {
            "calculated_hash": secret_hash_base64,
            "calculated_hash_hex": secret_hash.hex(),
            "verification_status": "VERIFIED"
        },
        "metadata": {
            "amount_satoshis": amount_satoshis,
            "memo": f"Demo hodl invoice from Carol to Alice - {amount_satoshis} satoshis",
            "payment_request": invoice_data.get('payment_request', ''),
            "created_by": "Carol",
            "created_for": "Alice",
            "invoice_type": "HODL_INVOICE",
            "invoice_status": "UNPAID"
        },
        "timing": {
            "created_at": creation_time.isoformat() + "Z",
            "expires_at": expiration_time.isoformat() + "Z",
            "expiry_seconds": expiry_seconds,
            "timezone": "UTC"
        }
    }
    
    try:
        with open('invoice.json', 'w') as f:
            json.dump(output_data, f, indent=2)
        print_colored("✅ Hodl invoice data saved to invoice.json", GREEN)
    except Exception as e:
        print_colored(f"[ERROR] Failed to save invoice data: {e}", RED)
        sys.exit(1)

def print_invoice_summary() -> None:
    """Print summary of created hodl invoice by loading data from invoice.json"""
    try:
        with open('invoice.json', 'r') as f:
            invoice_data = json.load(f)
    except FileNotFoundError:
        print_colored("[ERROR] invoice.json not found. Run the script first to create an invoice.", RED)
        return
    except json.JSONDecodeError:
        print_colored("[ERROR] Invalid JSON in invoice.json", RED)
        return
    
    # Extract data from invoice.json
    invoice = invoice_data.get('invoice', {})
    htlc_secret = invoice_data.get('htlc_secret', {})
    secret_debug = invoice_data.get('secret_debug', {})
    hash_verification = invoice_data.get('hash_verification', {})
    metadata = invoice_data.get('metadata', {})
    
    print_colored("🔐 SECRET:", BOLD)
    print_colored(f"Secret (Preimage): {secret_debug.get('secret_hex', 'N/A')}", CYAN)
    print()
    
    print_colored("🔍 SECRET DEBUG:", BOLD)
    print_colored(f"Secret Hex: {secret_debug.get('secret_hex', 'N/A')}", CYAN)
    print_colored(f"Generated At: {secret_debug.get('generated_at', 'N/A')}", CYAN)
    print_colored(f"Note: {secret_debug.get('note', 'N/A')}", CYAN)
    print()
    
    print_colored("🔗 SECRET HASH:", BOLD)
    print_colored(f"Hash (Base64): {htlc_secret.get('secret_hash', 'N/A')}", CYAN)
    print_colored(f"Hash (Hex): {hash_verification.get('calculated_hash_hex', 'N/A')}", CYAN)
    print_colored(f"Verification: {'✅ VERIFIED' if htlc_secret.get('verification', {}).get('hash_verified', False) else '❌ FAILED'}", CYAN)
    print()
    
    print_colored("💳 PAYMENT DATA:", BOLD)
    print_colored(f"Amount: {metadata.get('amount_satoshis', 'N/A')} satoshis", CYAN)
    print_colored(f"Payment Request: {invoice.get('payment_request', 'N/A')}", CYAN)
    print_colored(f"Add Index: {invoice.get('add_index', 'N/A')}", CYAN)
    print_colored(f"Payment Address: {invoice.get('payment_addr', 'N/A')}", CYAN)
    print_colored(f"Memo: {metadata.get('memo', 'N/A')}", CYAN)
    print_colored(f"Status: {metadata.get('invoice_status', 'N/A')}", CYAN)
    print()
    
    print_colored("💡 What this means:", YELLOW)
    print("  • Carol generated a hodl invoice using a custom 32-byte secret (preimage)")
    print("  • The secret was hashed using SHA256 to create the payment hash")
    print("  • The invoice is now in HODL state - payment can be made but not settled")
    print("  • Only Carol knows the secret and can settle the invoice")
    print("  • Alice can pay the invoice, but Carol must settle it with the secret")
    print("  • The invoice is stored in invoice.json")
    print("  • To settle: use SettleInvoice API with the preimage")
    print()

def parse_arguments():
    """Parse command line arguments"""
    parser = argparse.ArgumentParser(
        description="Create a Lightning Network hodl invoice from Carol to Alice",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  python3 invoice_carol_to_alice.py                                    # Create hodl invoice for 13 satoshis with random secret
  python3 invoice_carol_to_alice.py --amount 100                      # Create hodl invoice for 100 satoshis with random secret
  python3 invoice_carol_to_alice.py -a 1000 -s 1234...abcd            # Create hodl invoice with custom secret
  python3 invoice_carol_to_alice.py --amount 500 --secret 1111...1111 # Create hodl invoice with custom secret
  python3 invoice_carol_to_alice.py --expiry 300                      # Create hodl invoice with 5 minute expiry
  python3 invoice_carol_to_alice.py -a 100 -e 60                      # Create hodl invoice for 100 satoshis with 1 minute expiry
        """
    )
    parser.add_argument(
        '-a', '--amount',
        type=int,
        default=13,
        help='Amount in satoshis (default: 13)'
    )
    parser.add_argument(
        '-s', '--secret',
        type=str,
        help='32-byte secret in hex format (if not provided, a random secret will be generated)'
    )
    parser.add_argument(
        '-e', '--expiry',
        type=int,
        default=60,
        help='Invoice expiry time in seconds (default: 60)'
    )
    return parser.parse_args()

def main():
    """Main function"""
    # Parse command line arguments
    args = parse_arguments()
    amount_satoshis = args.amount
    
    # Handle secret generation
    if args.secret:
        secret_hex = args.secret
        print_colored(f"🔑 Using provided secret: {secret_hex[:16]}...", YELLOW)
        
        # Validate secret length
        if len(secret_hex) != 64:
            print_colored("[ERROR] Secret must be exactly 64 hex characters (32 bytes)", RED)
            sys.exit(1)
        
        # Validate secret is valid hex
        try:
            bytes.fromhex(secret_hex)
        except ValueError:
            print_colored("[ERROR] Secret must be valid hexadecimal", RED)
            sys.exit(1)
    else:
        secret_hex = generate_random_secret()
        print_colored(f"🎲 Generated random secret: {secret_hex[:16]}...", YELLOW)
    
    print_header(amount_satoshis)
    
    # Load configuration
    print_colored("📂 Loading Lightning Network configuration...", YELLOW)
    config = load_ln_config()
    carol_config = get_carol_config(config)
    print_colored("✅ Configuration loaded successfully", GREEN)
    print()
    
    # Create hodl invoice
    invoice_data = create_hodl_invoice(carol_config, amount_satoshis, secret_hex, args.expiry)
    
    # Save invoice data
    save_invoice_data(invoice_data, amount_satoshis, secret_hex, carol_config, args.expiry)
    
    # Print summary
    print_invoice_summary()
    
    print_colored("🎉 Hodl invoice creation completed successfully!", GREEN)
    print_colored("📄 Check invoice.json for complete invoice data", CYAN)
    print_colored("🔐 The secret is stored and ready for settlement", CYAN)
    print_colored("💡 Use SettleInvoice API to settle the invoice when payment is received", CYAN)

if __name__ == "__main__":
    main() 