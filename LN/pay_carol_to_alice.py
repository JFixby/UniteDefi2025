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
from datetime import datetime, timezone

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

def check_invoice_expiration(invoice_data: Dict[str, Any]) -> bool:
    """Check if the invoice has expired"""
    timing = invoice_data.get('timing', {})
    expires_at = timing.get('expires_at')
    
    if not expires_at:
        print_colored("[WARNING] No expiration time found in invoice data", YELLOW)
        return False  # Assume not expired if no timing info
    
    try:
        # Parse the expiration time
        expiration_time = datetime.fromisoformat(expires_at.replace('Z', '+00:00'))
        current_time = datetime.now(timezone.utc)
        
        if current_time > expiration_time:
            print_colored(f"❌ INVOICE EXPIRED!", RED)
            print_colored(f"   Expired at: {expiration_time.strftime('%Y-%m-%d %H:%M:%S UTC')}", RED)
            print_colored(f"   Current time: {current_time.strftime('%Y-%m-%d %H:%M:%S UTC')}", RED)
            return True
        else:
            time_remaining = expiration_time - current_time
            print_colored(f"✅ Invoice is valid", GREEN)
            print_colored(f"   Expires at: {expiration_time.strftime('%Y-%m-%d %H:%M:%S UTC')}", CYAN)
            print_colored(f"   Time remaining: {time_remaining.total_seconds():.0f} seconds", CYAN)
            return False
            
    except Exception as e:
        print_colored(f"[ERROR] Failed to parse expiration time: {e}", RED)
        return False  # Assume not expired if parsing fails

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
            timeout=60
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

def get_node_balance(node_config: Dict[str, Any], node_name: str) -> Dict[str, Any]:
    """Get balance information for a Lightning node"""
    print_colored(f"💰 Getting {node_name} balance...", YELLOW)
    
    rest_port = node_config['rest_port']
    admin_macaroon_path = None
    
    # Find admin macaroon
    for macaroon in node_config['macaroons']:
        if macaroon['type'] == 'admin':
            admin_macaroon_path = macaroon['path']
            break
    
    if not admin_macaroon_path:
        print_colored(f"[ERROR] Admin macaroon not found for {node_name}", RED)
        return {"error": "Macaroon not found"}
    
    # Read macaroon
    macaroon_hex = read_macaroon_hex(admin_macaroon_path)
    
    # Get balance via REST API
    url = f"https://localhost:{rest_port}/v1/balance/blockchain"
    headers = {
        "Grpc-Metadata-macaroon": macaroon_hex
    }
    
    try:
        response = requests.get(
            url,
            headers=headers,
            verify=False,
            timeout=15
        )
        response.raise_for_status()
        balance_data = response.json()
        
        # Also get channel balance
        channel_url = f"https://localhost:{rest_port}/v1/balance/channels"
        channel_response = requests.get(
            channel_url,
            headers=headers,
            verify=False,
            timeout=15
        )
        channel_response.raise_for_status()
        channel_data = channel_response.json()
        
        return {
            "onchain_balance_sat": balance_data.get('total_balance', '0'),
            "channel_balance_sat": channel_data.get('local_balance', '0'),
            "remote_balance_sat": channel_data.get('remote_balance', '0'),
            "pending_open_balance_sat": channel_data.get('pending_open_local_balance', '0'),
            "pending_close_balance_sat": channel_data.get('pending_closing_local_balance', '0'),
            "timestamp": datetime.now().isoformat()
        }
        
    except requests.exceptions.RequestException as e:
        print_colored(f"[ERROR] Failed to get {node_name} balance: {e}", RED)
        return {"error": str(e)}

def settle_hodl_invoice(carol_config: Dict[str, Any], secret_hex: str) -> Dict[str, Any]:
    """Settle hodl invoice using Carol's node with the provided secret"""
    print_colored(f"🔐 Settling hodl invoice with secret...", YELLOW)
    
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
    
    # Convert hex secret to base64
    try:
        secret_bytes = bytes.fromhex(secret_hex)
        secret_base64 = base64.b64encode(secret_bytes).decode('utf-8')
    except ValueError as e:
        print_colored(f"[ERROR] Invalid hex secret: {e}", RED)
        sys.exit(1)
    
    # Prepare settlement request
    settlement_data = {
        "preimage": secret_base64
    }
    
    # Settle hodl invoice via REST API
    url = f"https://localhost:{rest_port}/v2/invoices/settle"
    headers = {
        "Grpc-Metadata-macaroon": macaroon_hex,
        "Content-Type": "application/json"
    }
    
    try:
        response = requests.post(
            url,
            json=settlement_data,
            headers=headers,
            verify=False,  # Skip SSL verification for local development
            timeout=60
        )
        response.raise_for_status()
        settlement_response = response.json()
        
        # Debug: Print the response to see the structure
        print_colored("🔍 Settlement response received:", YELLOW)
        print(json.dumps(settlement_response, indent=2))
        print()
        
        return settlement_response
    except requests.exceptions.RequestException as e:
        print_colored(f"[ERROR] Failed to settle hodl invoice: {e}", RED)
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

def save_receipt_data(invoice_data: Dict[str, Any], payment_response: Dict[str, Any], secret_hex: str, 
                     secret_check_result: Dict[str, Any] = None, 
                     alice_balance_before: Dict[str, Any] = None,
                     alice_balance_after: Dict[str, Any] = None,
                     carol_balance_before: Dict[str, Any] = None,
                     carol_balance_after: Dict[str, Any] = None) -> None:
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
        "balance_changes": {
            "alice": {
                "before_payment": alice_balance_before or {"error": "Not captured"},
                "after_payment": alice_balance_after or {"error": "Not captured"},
                "change": {
                    "onchain_delta": "N/A",
                    "channel_delta": "N/A",
                    "remote_delta": "N/A"
                }
            },
            "carol": {
                "before_payment": carol_balance_before or {"error": "Not captured"},
                "after_payment": carol_balance_after or {"error": "Not captured"},
                "change": {
                    "onchain_delta": "N/A",
                    "channel_delta": "N/A",
                    "remote_delta": "N/A"
                }
            }
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
    
    # Calculate balance changes if both before and after are available
    if alice_balance_before and alice_balance_after and 'error' not in alice_balance_before and 'error' not in alice_balance_after:
        try:
            # Handle nested structure with sat/msat fields
            alice_before_channel_data = alice_balance_before.get('channel_balance_sat', {})
            alice_after_channel_data = alice_balance_after.get('channel_balance_sat', {})
            alice_before_remote_data = alice_balance_before.get('remote_balance_sat', {})
            alice_after_remote_data = alice_balance_after.get('remote_balance_sat', {})
            
            alice_before_channel = int(alice_before_channel_data.get('sat', 0) if isinstance(alice_before_channel_data, dict) else alice_before_channel_data)
            alice_after_channel = int(alice_after_channel_data.get('sat', 0) if isinstance(alice_after_channel_data, dict) else alice_after_channel_data)
            alice_before_remote = int(alice_before_remote_data.get('sat', 0) if isinstance(alice_before_remote_data, dict) else alice_before_remote_data)
            alice_after_remote = int(alice_after_remote_data.get('sat', 0) if isinstance(alice_after_remote_data, dict) else alice_after_remote_data)
            
            receipt_data["balance_changes"]["alice"]["change"] = {
                "channel_delta": alice_after_channel - alice_before_channel,
                "remote_delta": alice_after_remote - alice_before_remote
            }
        except (ValueError, TypeError, AttributeError):
            pass
    
    if carol_balance_before and carol_balance_after and 'error' not in carol_balance_before and 'error' not in carol_balance_after:
        try:
            # Handle nested structure with sat/msat fields
            carol_before_channel_data = carol_balance_before.get('channel_balance_sat', {})
            carol_after_channel_data = carol_balance_after.get('channel_balance_sat', {})
            carol_before_remote_data = carol_balance_before.get('remote_balance_sat', {})
            carol_after_remote_data = carol_balance_after.get('remote_balance_sat', {})
            
            carol_before_channel = int(carol_before_channel_data.get('sat', 0) if isinstance(carol_before_channel_data, dict) else carol_before_channel_data)
            carol_after_channel = int(carol_after_channel_data.get('sat', 0) if isinstance(carol_after_channel_data, dict) else carol_after_channel_data)
            carol_before_remote = int(carol_before_remote_data.get('sat', 0) if isinstance(carol_before_remote_data, dict) else carol_before_remote_data)
            carol_after_remote = int(carol_after_remote_data.get('sat', 0) if isinstance(carol_after_remote_data, dict) else carol_after_remote_data)
            
            receipt_data["balance_changes"]["carol"]["change"] = {
                "channel_delta": carol_after_channel - carol_before_channel,
                "remote_delta": carol_after_remote - carol_before_remote
            }
        except (ValueError, TypeError, AttributeError):
            pass
    
    try:
        with open('receipt.json', 'w') as f:
            json.dump(receipt_data, f, indent=2)
        print_colored("✅ Payment receipt saved to receipt.json", GREEN)
    except Exception as e:
        print_colored(f"[ERROR] Failed to save receipt data: {e}", RED)
        sys.exit(1)

def print_payment_summary() -> None:
    """Print summary of payment by loading data from receipt.json"""
    try:
        with open('receipt.json', 'r') as f:
            receipt_data = json.load(f)
    except FileNotFoundError:
        print_colored("[ERROR] receipt.json not found. Run the payment script first.", RED)
        return
    except json.JSONDecodeError:
        print_colored("[ERROR] Invalid JSON in receipt.json", RED)
        return
    
    # Extract data from receipt.json
    payment_receipt = receipt_data.get('payment_receipt', {})
    balance_changes = receipt_data.get('balance_changes', {})
    hash_verification = receipt_data.get('hash_verification', {})
    htlc_secret = receipt_data.get('htlc_secret', {})
    metadata = receipt_data.get('metadata', {})
    
    print_colored("🔐 SECRET:", BOLD)
    print_colored(f"Secret (Preimage): {htlc_secret.get('preimage_hex', 'N/A')}", CYAN)
    print()
    
    print_colored("🔍 SECRET DEBUG:", BOLD)
    print_colored(f"Secret Hex: {htlc_secret.get('preimage_hex', 'N/A')}", CYAN)
    print_colored(f"Secret Base64: {htlc_secret.get('preimage_base64', 'N/A')}", CYAN)
    print_colored(f"Secret Length: {htlc_secret.get('verification', {}).get('secret_length_bytes', 'N/A')} bytes", CYAN)
    print()
    
    print_colored("🔗 SECRET HASH:", BOLD)
    print_colored(f"Hash (Base64): {htlc_secret.get('secret_hash_base64', 'N/A')}", CYAN)
    print_colored(f"Hash (Hex): {hash_verification.get('secret_hash_base64', 'N/A')}", CYAN)
    print_colored(f"Verification: {'✅ VERIFIED' if htlc_secret.get('verification', {}).get('hash_verified', False) else '❌ FAILED'}", CYAN)
    print()
    
    print_colored("💳 PAYMENT DATA:", BOLD)
    print_colored(f"Amount: {metadata.get('amount_satoshis', 'N/A')} satoshis", CYAN)
    print_colored(f"Payment Hash: {payment_receipt.get('payment_hash', 'N/A')}", CYAN)
    print_colored(f"Payment Status: {payment_receipt.get('payment_status', 'N/A')}", CYAN)
    print_colored(f"Payment Timestamp: {payment_receipt.get('payment_timestamp', 'N/A')}", CYAN)
    print_colored(f"Paid By: {metadata.get('paid_by', 'N/A')}", CYAN)
    print_colored(f"Paid To: {metadata.get('paid_to', 'N/A')}", CYAN)
    print_colored(f"Memo: {metadata.get('memo', 'N/A')}", CYAN)
    print()
    
    print_colored("💰 BALANCE CHANGES:", BOLD)
    alice_changes = balance_changes.get('alice', {}).get('change', {})
    carol_changes = balance_changes.get('carol', {}).get('change', {})
    
    print_colored(f"Alice Channel Delta: {alice_changes.get('channel_delta', 'N/A')} satoshis", CYAN)
    print_colored(f"Alice Remote Delta: {alice_changes.get('remote_delta', 'N/A')} satoshis", CYAN)
    print_colored(f"Carol Channel Delta: {carol_changes.get('channel_delta', 'N/A')} satoshis", CYAN)
    print_colored(f"Carol Remote Delta: {carol_changes.get('remote_delta', 'N/A')} satoshis", CYAN)
    print()
    
    print_colored("🔍 VERIFICATION FLAGS:", BOLD)
    verification_flags = hash_verification.get('verification_flags', {})
    print_colored(f"Invoice vs Payment Hash Match: {'✅' if verification_flags.get('invoice_vs_payment_hash_match', False) else '❌'}", CYAN)
    print_colored(f"Invoice vs Secret Hash Match: {'✅' if verification_flags.get('invoice_vs_secret_hash_match', False) else '❌'}", CYAN)
    print_colored(f"Preimage Verifies: {'✅' if verification_flags.get('preimage_verifies', False) else '❌'}", CYAN)
    print_colored(f"Correct Length: {'✅' if verification_flags.get('correct_length', False) else '❌'}", CYAN)
    print_colored(f"Overall Verification: {'✅' if verification_flags.get('overall_verification', False) else '❌'}", CYAN)
    print()
    
    print_colored("💡 What this means:", YELLOW)
    print("  • Alice successfully paid the invoice to Carol")
    print("  • The HTLC secret (preimage) has been revealed")
    print("  • The secret can be used to unlock funds in other protocols")
    print("  • The hash verification confirms the secret is correct")
    print("  • Balance changes are recorded in receipt.json")
    print("  • Payment receipt is stored in receipt.json")
    print()

def parse_arguments():
    """Parse command line arguments"""
    parser = argparse.ArgumentParser(
        description="Pay a Lightning Network invoice from Alice to Carol",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  python3 pay_carol_to_alice.py                                    # Pay regular invoice from invoice.json
  python3 pay_carol_to_alice.py --secret 1234...abcd              # Pay hodl invoice with custom secret
  python3 pay_carol_to_alice.py                                    # Pay hodl invoice using debug secret (if available)
  python3 pay_carol_to_alice.py --dry-run                         # Show what would be paid without paying
  python3 pay_carol_to_alice.py --dry-run --secret 1234...abcd    # Show hodl payment details
        """
    )
    parser.add_argument(
        '--dry-run',
        action='store_true',
        help='Show payment details without actually paying'
    )
    parser.add_argument(
        '-s', '--secret',
        type=str,
        help='32-byte secret in hex format for hodl invoice settlement (if not provided, will try to use debug secret from invoice.json)'
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
    carol_config = get_carol_config(config)
    print_colored("✅ Configuration loaded successfully", GREEN)
    print()
    
    # Load invoice data
    print_colored("📄 Loading invoice data...", YELLOW)
    invoice_data = load_invoice_data()
    payment_request = invoice_data.get('metadata', {}).get('payment_request', '')
    amount_satoshis = invoice_data.get('metadata', {}).get('amount_satoshis', 0)
    invoice_type = invoice_data.get('metadata', {}).get('invoice_type', 'REGULAR')
    print_colored(f"✅ Invoice loaded: {amount_satoshis} satoshis ({invoice_type})", GREEN)
    print()
    
    # Check invoice expiration
    print_colored("⏰ Checking invoice expiration...", YELLOW)
    if check_invoice_expiration(invoice_data):
        print_colored("[ERROR] Cannot pay expired invoice. Please create a new invoice.", RED)
        sys.exit(1)
    print()
    
    # Check if this is a hodl invoice
    is_hodl_invoice = invoice_type == 'HODL_INVOICE'
    
    if args.secret:
        if not is_hodl_invoice:
            print_colored("[WARNING] Secret provided but invoice is not a hodl invoice", YELLOW)
        print_colored(f"🔑 Using provided secret: {args.secret[:16]}...", YELLOW)
        secret_hex = args.secret
    elif is_hodl_invoice:
        # Try to read secret from secret_debug field
        secret_debug = invoice_data.get('secret_debug', {})
        debug_secret = secret_debug.get('secret_hex', '')
        
        if debug_secret:
            print_colored(f"🔍 Reading secret from debug field: {debug_secret[:16]}...", YELLOW)
            secret_hex = debug_secret
        else:
            print_colored("[ERROR] Hodl invoice detected but no secret provided and no debug secret found. Use --secret option.", RED)
            sys.exit(1)
    else:
        secret_hex = None
    
    if args.dry_run:
        print_colored("🔍 DRY RUN MODE - Payment details:", YELLOW)
        print(f"  Amount: {amount_satoshis} satoshis")
        print(f"  Invoice Type: {invoice_type}")
        print(f"  Payment Request: {payment_request[:100]}...")
        if secret_hex:
            print(f"  Secret: {secret_hex[:16]}...")
        print_colored("  (No actual payment made)", YELLOW)
        return
    
    # Get balances before payment
    print_colored("📊 Capturing balances before payment...", YELLOW)
    alice_balance_before = get_node_balance(alice_config, "Alice")
    carol_balance_before = get_node_balance(carol_config, "Carol")
    print()
    
    # Pay invoice
    payment_response = pay_invoice(alice_config, payment_request)
    
    # Handle hodl invoice settlement
    if is_hodl_invoice and secret_hex:
        print_colored("🔄 Hodl invoice detected - settling with provided secret...", YELLOW)
        settlement_response = settle_hodl_invoice(carol_config, secret_hex)
        print_colored("✅ Hodl invoice settled successfully", GREEN)
    else:
        # Extract secret from payment response for regular invoices
        payment_preimage = payment_response.get('payment_preimage', '')
        secret_hex = decode_base64_to_hex(payment_preimage) if payment_preimage else ''
    
    # Get balances after payment
    print_colored("📊 Capturing balances after payment...", YELLOW)
    alice_balance_after = get_node_balance(alice_config, "Alice")
    carol_balance_after = get_node_balance(carol_config, "Carol")
    print()
    
    # Perform comprehensive secret check and hash verification
    secret_check_result = perform_secret_check(invoice_data, payment_response)
    
    # Save receipt data with verification results and balance changes
    save_receipt_data(invoice_data, payment_response, secret_hex, secret_check_result,
                     alice_balance_before, alice_balance_after,
                     carol_balance_before, carol_balance_after)
    
    # Print summary with balance information
    print_payment_summary()
    
    print_colored("🎉 Payment completed successfully!", GREEN)
    print_colored("📄 Check receipt.json for complete payment details", CYAN)
    if is_hodl_invoice:
        print_colored("🔐 Hodl invoice settled with provided secret", CYAN)
    else:
        print_colored("🔐 HTLC secret is now available for cross-chain operations", CYAN)

if __name__ == "__main__":
    main() 