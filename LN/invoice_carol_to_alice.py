#!/usr/bin/env python3

"""
Lightning Network Invoice Creator
Creates an invoice from Carol to Alice for a specified amount
Stores invoice and secret information in invoice.json
"""

import json
import requests
import base64
import hashlib
import subprocess
import sys
import argparse
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
    print_colored("║              LIGHTNING INVOICE CREATOR                       ║", BLUE)
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

def create_invoice(carol_config: Dict[str, Any], amount_satoshis: int) -> Dict[str, Any]:
    """Create Lightning invoice from Carol"""
    print_colored(f"🔐 Creating Lightning invoice from Carol for {amount_satoshis} satoshis...", YELLOW)
    
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
    
    # Prepare invoice request
    invoice_data = {
        "value": amount_satoshis,
        "memo": f"Demo invoice from Carol to Alice - {amount_satoshis} satoshis"
    }
    
    # Create invoice via REST API
    url = f"https://localhost:{rest_port}/v1/invoices"
    headers = {
        "Grpc-Metadata-macaroon": macaroon_hex,
        "Content-Type": "application/json"
    }
    
    try:
        response = requests.post(
            url,
            json=invoice_data,
            headers=headers,
            verify=False,  # Skip SSL verification for local development
            timeout=10
        )
        response.raise_for_status()
        invoice_response = response.json()
        
        # Debug: Print the response to see the structure
        print_colored("🔍 Invoice response received:", YELLOW)
        print(json.dumps(invoice_response, indent=2))
        print()
        
        return invoice_response
    except requests.exceptions.RequestException as e:
        print_colored(f"[ERROR] Failed to create invoice: {e}", RED)
        sys.exit(1)

def decode_base64_to_hex(base64_string: str) -> str:
    """Decode base64 string to hex"""
    try:
        decoded_bytes = base64.b64decode(base64_string)
        return decoded_bytes.hex().upper()
    except Exception as e:
        print_colored(f"[ERROR] Failed to decode base64: {e}", RED)
        return ""

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

def save_invoice_data(invoice_data: Dict[str, Any], secret_hex: str, amount_satoshis: int) -> None:
    """Save invoice and secret data to invoice.json"""
    output_data = {
        "invoice": invoice_data,
        "htlc_secret": {
            "preimage_base64": invoice_data.get('r_preimage', 'NOT_AVAILABLE_YET'),
            "preimage_hex": secret_hex,
            "hash_base64": invoice_data.get('r_hash', ''),
            "verification": {
                "hash_verified": "PENDING_PAYMENT",
                "timestamp": invoice_data.get('creation_date', ''),
                "expiry": invoice_data.get('expiry', ''),
                "status": "INVOICE_CREATED_AWAITING_PAYMENT"
            }
        },
        "metadata": {
            "amount_satoshis": amount_satoshis,
            "memo": f"Demo invoice from Carol to Alice - {amount_satoshis} satoshis",
            "payment_request": invoice_data.get('payment_request', ''),
            "created_by": "Carol",
            "created_for": "Alice",
            "invoice_status": "UNPAID"
        }
    }
    
    try:
        with open('invoice.json', 'w') as f:
            json.dump(output_data, f, indent=2)
        print_colored("✅ Invoice data saved to invoice.json", GREEN)
    except Exception as e:
        print_colored(f"[ERROR] Failed to save invoice data: {e}", RED)
        sys.exit(1)

def print_invoice_summary(invoice_data: Dict[str, Any], secret_hex: str, amount_satoshis: int) -> None:
    """Print summary of created invoice"""
    print_colored("📋 INVOICE SUMMARY:", BOLD)
    print_colored("┌─────────────────┬─────────────────────────────────────────────────┐", CYAN)
    print_colored("│ Field           │ Value                                           │", CYAN)
    print_colored("├─────────────────┼─────────────────────────────────────────────────┤", CYAN)
    print_colored(f"│ Amount          │ {amount_satoshis} satoshis                                     │", CYAN)
    print_colored(f"│ Payment Request │ {invoice_data.get('payment_request', '')[:50]}... │", CYAN)
    print_colored(f"│ Invoice Hash    │ {invoice_data.get('r_hash', '')[:50]}... │", CYAN)
    print_colored(f"│ Secret (Hex)    │ {secret_hex[:50]}... │", CYAN)
    print_colored("└─────────────────┴─────────────────────────────────────────────────┘", CYAN)
    print()
    
    print_colored("🔐 HTLC SECRET DETAILS:", BOLD)
    print_colored("┌─────────────────┬─────────────────────────────────────────────────┐", CYAN)
    print_colored("│ Field           │ Value                                           │", CYAN)
    print_colored("├─────────────────┼─────────────────────────────────────────────────┤", CYAN)
    print_colored(f"│ Secret (Preimage)│ {secret_hex} │", CYAN)
    print_colored(f"│ Hash (R-Hash)   │ {invoice_data.get('r_hash', '')} │", CYAN)
    print_colored(f"│ Verification    │ 🔄 PENDING PAYMENT │", CYAN)
    print_colored("└─────────────────┴─────────────────────────────────────────────────┘", CYAN)
    print()
    
    print_colored("💡 What this means:", YELLOW)
    print("  • Carol generated a random 32-byte secret (preimage)")
    print("  • The secret was hashed using SHA256 to create the payment hash")
    print("  • Only Carol knows the secret until payment is made")
    print("  • Alice will need this secret to claim the payment")
    print("  • The invoice is stored in invoice.json")
    print("  • The secret will be revealed when the invoice is paid")
    print()

def parse_arguments():
    """Parse command line arguments"""
    parser = argparse.ArgumentParser(
        description="Create a Lightning Network invoice from Carol to Alice",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  python3 invoice_carol_to_alice.py                    # Create invoice for 13 satoshis (default)
  python3 invoice_carol_to_alice.py --amount 100       # Create invoice for 100 satoshis
  python3 invoice_carol_to_alice.py -a 1000            # Create invoice for 1000 satoshis
        """
    )
    parser.add_argument(
        '-a', '--amount',
        type=int,
        default=13,
        help='Amount in satoshis (default: 13)'
    )
    return parser.parse_args()

def main():
    """Main function"""
    # Parse command line arguments
    args = parse_arguments()
    amount_satoshis = args.amount
    
    print_header(amount_satoshis)
    
    # Load configuration
    print_colored("📂 Loading Lightning Network configuration...", YELLOW)
    config = load_ln_config()
    carol_config = get_carol_config(config)
    print_colored("✅ Configuration loaded successfully", GREEN)
    print()
    
    # Create invoice
    invoice_data = create_invoice(carol_config, amount_satoshis)
    
    # Note: r_preimage is not included in the initial invoice response
    # It's only revealed when the invoice is paid
    print_colored("ℹ️  Note: The HTLC secret (preimage) is not included in the initial invoice response.", YELLOW)
    print_colored("   It will only be revealed when the invoice is paid.", YELLOW)
    print()
    
    # For now, we'll store the invoice without the preimage
    # The preimage will be added when the invoice is paid
    secret_hex = "PENDING_PAYMENT"  # Placeholder until payment
    
    # Save invoice data
    save_invoice_data(invoice_data, secret_hex, amount_satoshis)
    
    # Print summary
    print_invoice_summary(invoice_data, secret_hex, amount_satoshis)
    
    print_colored("🎉 Invoice creation completed successfully!", GREEN)
    print_colored("📄 Check invoice.json for complete invoice data", CYAN)
    print_colored("🔐 The HTLC secret will be available after payment", CYAN)

if __name__ == "__main__":
    main() 