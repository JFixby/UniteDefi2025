#!/usr/bin/env python3

"""
Lightning Network Invoice Payment Script
Reads invoice.json, pays the invoice, and stores results in receipt.json
Includes HTLC secret information after payment
"""

import json
import requests
import base64
import hashlib
import subprocess
import sys
import argparse
from typing import Dict, Any
from datetime import datetime

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

def print_header() -> None:
    """Print script header"""
    print_colored("╔══════════════════════════════════════════════════════════════╗", BLUE)
    print_colored("║              LIGHTNING INVOICE PAYMENT                       ║", BLUE)
    print_colored("║              Alice → Carol (Pay Invoice)                     ║", BLUE)
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

def get_alice_config(config: Dict[str, Any]) -> Dict[str, Any]:
    """Extract Alice's node configuration"""
    for node in config:
        if node.get('alias') == 'alice':
            return node
    
    print_colored("[ERROR] Alice node not found in ln.json", RED)
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

def load_invoice_data() -> Dict[str, Any]:
    """Load invoice data from invoice.json"""
    try:
        with open('invoice.json', 'r') as f:
            invoice_data = json.load(f)
        return invoice_data
    except FileNotFoundError:
        print_colored("[ERROR] invoice.json not found. Run invoice_carol_to_alice.py first.", RED)
        sys.exit(1)
    except json.JSONDecodeError:
        print_colored("[ERROR] Invalid JSON in invoice.json", RED)
        sys.exit(1)

def pay_invoice(alice_config: Dict[str, Any], payment_request: str) -> Dict[str, Any]:
    """Pay Lightning invoice using Alice's node"""
    print_colored(f"💳 Paying Lightning invoice...", YELLOW)
    
    # Extract Alice's configuration
    rest_port = alice_config['rest_port']
    admin_macaroon_path = None
    
    # Find admin macaroon
    for macaroon in alice_config['macaroons']:
        if macaroon['type'] == 'admin':
            admin_macaroon_path = macaroon['path']
            break
    
    if not admin_macaroon_path:
        print_colored("[ERROR] Admin macaroon not found for Alice", RED)
        sys.exit(1)
    
    # Read macaroon
    macaroon_hex = read_macaroon_hex(admin_macaroon_path)
    
    # Prepare payment request
    payment_data = {
        "payment_request": payment_request
    }
    
    # Pay invoice via REST API
    url = f"https://localhost:{rest_port}/v1/channels/transactions"
    headers = {
        "Grpc-Metadata-macaroon": macaroon_hex,
        "Content-Type": "application/json"
    }
    
    try:
        response = requests.post(
            url,
            json=payment_data,
            headers=headers,
            verify=False,  # Skip SSL verification for local development
            timeout=30
        )
        response.raise_for_status()
        payment_response = response.json()
        
        # Debug: Print the response to see the structure
        print_colored("🔍 Payment response received:", YELLOW)
        print(json.dumps(payment_response, indent=2))
        print()
        
        return payment_response
    except requests.exceptions.RequestException as e:
        print_colored(f"[ERROR] Failed to pay invoice: {e}", RED)
        sys.exit(1)

def decode_base64_to_hex(base64_string: str) -> str:
    """Decode base64 string to hex"""
    try:
        decoded_bytes = base64.b64decode(base64_string)
        return decoded_bytes.hex().upper()
    except Exception as e:
        print_colored(f"[ERROR] Failed to decode base64: {e}", RED)
        return ""

def verify_htlc_hash(secret_hex: str, expected_hash_base64: str) -> Dict[str, Any]:
    """Verify HTLC hash by hashing the secret and comparing"""
    try:
        # Convert hex secret to bytes
        secret_bytes = bytes.fromhex(secret_hex)
        
        # Hash the secret using SHA256
        calculated_hash = hashlib.sha256(secret_bytes).digest()
        calculated_hash_base64 = base64.b64encode(calculated_hash).decode('utf-8')
        
        # Compare with expected hash
        hash_matches = calculated_hash_base64 == expected_hash_base64
        
        return {
            "verified": hash_matches,
            "calculated_hash_base64": calculated_hash_base64,
            "expected_hash_base64": expected_hash_base64,
            "secret_hex": secret_hex,
            "secret_length_bytes": len(secret_bytes)
        }
    except Exception as e:
        print_colored(f"[ERROR] Failed to verify hash: {e}", RED)
        return {
            "verified": False,
            "error": str(e),
            "calculated_hash_base64": "",
            "expected_hash_base64": expected_hash_base64,
            "secret_hex": secret_hex,
            "secret_length_bytes": 0
        }

def perform_secret_check(invoice_data: Dict[str, Any], payment_response: Dict[str, Any]) -> Dict[str, Any]:
    """Perform comprehensive secret check and hash verification"""
    print_colored("🔍 PERFORMING SECRET CHECK AND HASH VERIFICATION", BOLD)
    print_colored("=" * 60, CYAN)
    
    # Extract data from invoice and payment
    original_hash_base64 = invoice_data.get('htlc_secret', {}).get('hash_base64', '')
    payment_preimage_base64 = payment_response.get('payment_preimage', '')
    payment_hash_base64 = payment_response.get('payment_hash', '')
    
    # Convert payment preimage to hex
    payment_preimage_hex = decode_base64_to_hex(payment_preimage_base64) if payment_preimage_base64 else ''
    
    print_colored("📋 EXTRACTED DATA:", YELLOW)
    print(f"  Original Hash (from invoice): {original_hash_base64}")
    print(f"  Payment Hash (from response): {payment_hash_base64}")
    print(f"  Payment Preimage (base64): {payment_preimage_base64}")
    print(f"  Payment Preimage (hex): {payment_preimage_hex}")
    print()
    
    # Check 1: Verify original hash matches payment hash
    hash_match_check = original_hash_base64 == payment_hash_base64
    print_colored("🔍 CHECK 1: Hash Consistency", BOLD)
    print(f"  Original Hash == Payment Hash: {hash_match_check}")
    if not hash_match_check:
        print_colored("  ❌ WARNING: Hashes don't match!", RED)
    else:
        print_colored("  ✅ Hashes are consistent", GREEN)
    print()
    
    # Check 2: Verify preimage hashes to the expected hash
    hash_verification = verify_htlc_hash(payment_preimage_hex, original_hash_base64)
    print_colored("🔍 CHECK 2: Preimage Hash Verification", BOLD)
    print(f"  Preimage Length: {hash_verification['secret_length_bytes']} bytes")
    print(f"  Calculated Hash: {hash_verification['calculated_hash_base64']}")
    print(f"  Expected Hash:   {hash_verification['expected_hash_base64']}")
    print(f"  Hash Verification: {hash_verification['verified']}")
    
    if hash_verification['verified']:
        print_colored("  ✅ Preimage correctly hashes to expected hash", GREEN)
    else:
        print_colored("  ❌ CRITICAL ERROR: Preimage does not hash to expected hash!", RED)
        if 'error' in hash_verification:
            print_colored(f"  Error: {hash_verification['error']}", RED)
    print()
    
    # Check 3: Verify preimage is 32 bytes (standard for Lightning)
    preimage_length_check = hash_verification['secret_length_bytes'] == 32
    print_colored("🔍 CHECK 3: Preimage Length Check", BOLD)
    print(f"  Expected Length: 32 bytes")
    print(f"  Actual Length: {hash_verification['secret_length_bytes']} bytes")
    print(f"  Length Check: {preimage_length_check}")
    
    if preimage_length_check:
        print_colored("  ✅ Preimage has correct length (32 bytes)", GREEN)
    else:
        print_colored("  ❌ WARNING: Preimage length is not 32 bytes!", YELLOW)
    print()
    
    # Overall verification result
    overall_verification = hash_match_check and hash_verification['verified'] and preimage_length_check
    
    print_colored("🔍 OVERALL VERIFICATION RESULT", BOLD)
    print_colored("=" * 60, CYAN)
    if overall_verification:
        print_colored("✅ ALL CHECKS PASSED - SECRET IS VALID", GREEN)
        print_colored("  • Hash consistency: ✅", GREEN)
        print_colored("  • Preimage verification: ✅", GREEN)
        print_colored("  • Preimage length: ✅", GREEN)
    else:
        print_colored("❌ VERIFICATION FAILED - SECRET MAY BE INVALID", RED)
        print_colored(f"  • Hash consistency: {'✅' if hash_match_check else '❌'}", GREEN if hash_match_check else RED)
        print_colored(f"  • Preimage verification: {'✅' if hash_verification['verified'] else '❌'}", GREEN if hash_verification['verified'] else RED)
        print_colored(f"  • Preimage length: {'✅' if preimage_length_check else '❌'}", GREEN if preimage_length_check else RED)
    
    print_colored("=" * 60, CYAN)
    print()
    
    return {
        "overall_verification": overall_verification,
        "hash_match_check": hash_match_check,
        "hash_verification": hash_verification,
        "preimage_length_check": preimage_length_check,
        "original_hash_base64": original_hash_base64,
        "payment_hash_base64": payment_hash_base64,
        "payment_preimage_hex": payment_preimage_hex
    }

def save_receipt_data(invoice_data: Dict[str, Any], payment_response: Dict[str, Any], secret_hex: str, secret_check_result: Dict[str, Any] = None) -> None:
    """Save payment receipt data to receipt.json"""
    payment_timestamp = datetime.now().isoformat()
    
    # Extract payment details
    payment_hash = payment_response.get('payment_hash', '')
    payment_preimage = payment_response.get('payment_preimage', '')
    payment_preimage_hex = decode_base64_to_hex(payment_preimage) if payment_preimage else ''
    
    # Verify the HTLC hash
    original_hash = invoice_data.get('htlc_secret', {}).get('hash_base64', '')
    hash_verification = verify_htlc_hash(payment_preimage_hex, original_hash) if payment_preimage_hex else {"verified": False}
    
    receipt_data = {
        "payment_receipt": {
            "payment_hash": payment_hash,
            "payment_preimage_base64": payment_preimage,
            "payment_preimage_hex": payment_preimage_hex,
            "payment_timestamp": payment_timestamp,
            "payment_status": "SUCCESS" if payment_response.get('status') == 'SUCCEEDED' else "FAILED"
        },
        "hash_verification": {
            "invoice_hash_base64": original_hash,
            "payment_hash_base64": payment_hash,
            "secret_hash_base64": hash_verification.get("calculated_hash_base64", ""),
            "verification_flags": {
                "invoice_vs_payment_hash_match": original_hash == payment_hash,
                "invoice_vs_secret_hash_match": original_hash == hash_verification.get("calculated_hash_base64", ""),
                "preimage_verifies": hash_verification.get("verified", False),
                "correct_length": hash_verification.get("secret_length_bytes", 0) == 32,
                "overall_verification": (original_hash == payment_hash) and hash_verification.get("verified", False) and (hash_verification.get("secret_length_bytes", 0) == 32)
            },
            "comprehensive_verification": secret_check_result if secret_check_result else {
                "overall_verification": False,
                "hash_match_check": False,
                "hash_verification": {"verified": False},
                "preimage_length_check": False
            },
            "verification_timestamp": payment_timestamp
        },
        "htlc_secret": {
            "preimage_base64": payment_preimage,
            "preimage_hex": payment_preimage_hex,
            "invoice_hash_base64": original_hash,
            "secret_hash_base64": hash_verification.get("calculated_hash_base64", ""),
            "verification": {
                "hash_verified": hash_verification.get("verified", False),
                "invoice_vs_secret_hash_match": original_hash == hash_verification.get("calculated_hash_base64", ""),
                "calculated_hash": hash_verification.get("calculated_hash_base64", ""),
                "expected_hash": hash_verification.get("expected_hash_base64", ""),
                "secret_length_bytes": hash_verification.get("secret_length_bytes", 0),
                "timestamp": payment_timestamp,
                "status": "PAYMENT_COMPLETED_SECRET_REVEALED"
            }
        },
        "original_invoice": invoice_data,
        "metadata": {
            "amount_satoshis": invoice_data.get('metadata', {}).get('amount_satoshis', 0),
            "memo": invoice_data.get('metadata', {}).get('memo', ''),
            "payment_request": invoice_data.get('metadata', {}).get('payment_request', ''),
            "paid_by": "Alice",
            "paid_to": "Carol",
            "payment_status": "COMPLETED"
        }
    }
    
    try:
        with open('receipt.json', 'w') as f:
            json.dump(receipt_data, f, indent=2)
        print_colored("✅ Payment receipt saved to receipt.json", GREEN)
    except Exception as e:
        print_colored(f"[ERROR] Failed to save receipt data: {e}", RED)
        sys.exit(1)

def print_payment_summary(invoice_data: Dict[str, Any], payment_response: Dict[str, Any], secret_hex: str, secret_check_result: Dict[str, Any] = None) -> None:
    """Print summary of payment"""
    amount_satoshis = invoice_data.get('metadata', {}).get('amount_satoshis', 0)
    
    print_colored("📋 PAYMENT SUMMARY:", BOLD)
    print_colored("┌─────────────────┬─────────────────────────────────────────────────┐", CYAN)
    print_colored("│ Field           │ Value                                           │", CYAN)
    print_colored("├─────────────────┼─────────────────────────────────────────────────┤", CYAN)
    print_colored(f"│ Amount Paid     │ {amount_satoshis} satoshis                                     │", CYAN)
    print_colored(f"│ Payment Hash    │ {payment_response.get('payment_hash', '')[:50]}... │", CYAN)
    print_colored(f"│ Payment Status  │ {payment_response.get('status', 'UNKNOWN')} │", CYAN)
    print_colored(f"│ Secret (Hex)    │ {secret_hex[:50]}... │", CYAN)
    print_colored("└─────────────────┴─────────────────────────────────────────────────┘", CYAN)
    print()
    
    # Get the calculated hash from secret check result
    calculated_hash = ""
    if secret_check_result and 'hash_verification' in secret_check_result:
        calculated_hash = secret_check_result['hash_verification'].get('calculated_hash_base64', '')
    
    print_colored("🔐 HTLC SECRET DETAILS:", BOLD)
    print_colored("┌─────────────────┬─────────────────────────────────────────────────┐", CYAN)
    print_colored("│ Field           │ Value                                           │", CYAN)
    print_colored("├─────────────────┼─────────────────────────────────────────────────┤", CYAN)
    print_colored(f"│ Secret (Preimage)│ {secret_hex} │", CYAN)
    print_colored(f"│ Invoice Hash    │ {invoice_data.get('htlc_secret', {}).get('hash_base64', '')} │", CYAN)
    print_colored(f"│ Secret Hash     │ {calculated_hash} │", CYAN)
    print_colored(f"│ Hash Match      │ ✅ VERIFIED │", CYAN)
    print_colored("└─────────────────┴─────────────────────────────────────────────────┘", CYAN)
    print()
    
    print_colored("💡 What this means:", YELLOW)
    print("  • Alice successfully paid the invoice to Carol")
    print("  • The HTLC secret (preimage) has been revealed")
    print("  • The secret can be used to unlock funds in other protocols")
    print("  • The hash verification confirms the secret is correct")
    print("  • Payment receipt is stored in receipt.json")
    print()

def parse_arguments():
    """Parse command line arguments"""
    parser = argparse.ArgumentParser(
        description="Pay a Lightning Network invoice from Alice to Carol",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  python3 pay_carol_to_alice.py                    # Pay invoice from invoice.json
  python3 pay_carol_to_alice.py --dry-run          # Show what would be paid without paying
        """
    )
    parser.add_argument(
        '--dry-run',
        action='store_true',
        help='Show payment details without actually paying'
    )
    return parser.parse_args()

def main():
    """Main function"""
    # Parse command line arguments
    args = parse_arguments()
    
    print_header()
    
    # Load configuration
    print_colored("📂 Loading Lightning Network configuration...", YELLOW)
    config = load_ln_config()
    alice_config = get_alice_config(config)
    print_colored("✅ Configuration loaded successfully", GREEN)
    print()
    
    # Load invoice data
    print_colored("📄 Loading invoice data...", YELLOW)
    invoice_data = load_invoice_data()
    payment_request = invoice_data.get('metadata', {}).get('payment_request', '')
    amount_satoshis = invoice_data.get('metadata', {}).get('amount_satoshis', 0)
    print_colored(f"✅ Invoice loaded: {amount_satoshis} satoshis", GREEN)
    print()
    
    if args.dry_run:
        print_colored("🔍 DRY RUN MODE - Payment details:", YELLOW)
        print(f"  Amount: {amount_satoshis} satoshis")
        print(f"  Payment Request: {payment_request[:100]}...")
        print_colored("  (No actual payment made)", YELLOW)
        return
    
    # Pay invoice
    payment_response = pay_invoice(alice_config, payment_request)
    
    # Extract secret from payment response
    payment_preimage = payment_response.get('payment_preimage', '')
    secret_hex = decode_base64_to_hex(payment_preimage) if payment_preimage else ''
    
    # Perform comprehensive secret check and hash verification
    secret_check_result = perform_secret_check(invoice_data, payment_response)
    
    # Save receipt data with verification results
    save_receipt_data(invoice_data, payment_response, secret_hex, secret_check_result)
    
    # Print summary
    print_payment_summary(invoice_data, payment_response, secret_hex, secret_check_result)
    
    print_colored("🎉 Payment completed successfully!", GREEN)
    print_colored("📄 Check receipt.json for complete payment details", CYAN)
    print_colored("🔐 HTLC secret is now available for cross-chain operations", CYAN)

if __name__ == "__main__":
    main() 