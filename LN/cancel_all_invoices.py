#!/usr/bin/env python3

"""
Simple script to cancel all invoices from Carol's Lightning Network node
"""

import json
import requests
import sys

# API timeout constant (in seconds)
API_TIMEOUT = 15

# ANSI color codes for terminal output
RED = '\033[0;31m'
GREEN = '\033[0;32m'
YELLOW = '\033[1;33m'
CYAN = '\033[0;36m'
NC = '\033[0m'  # No Color

def print_colored(text: str, color: str = NC) -> None:
    """Print colored text to terminal"""
    print(f"{color}{text}{NC}")

def load_ln_config():
    """Load Lightning Network configuration from ln.json"""
    try:
        with open('ln.json', 'r') as f:
            config = json.load(f)
        return config
    except FileNotFoundError:
        print_colored("[ERROR] ln.json not found. Run setup_polar_macos.sh first.", RED)
        sys.exit(1)

def get_carol_config(config):
    """Extract Carol's node configuration"""
    for node in config:
        if node.get('alias') == 'carol':
            return node
    print_colored("[ERROR] Carol node not found in ln.json", RED)
    sys.exit(1)

def read_macaroon_hex(macaroon_path):
    """Read macaroon file and convert to hex"""
    try:
        with open(macaroon_path, 'rb') as f:
            macaroon_bytes = f.read()
        return macaroon_bytes.hex().upper()
    except FileNotFoundError:
        print_colored(f"[ERROR] Macaroon file not found: {macaroon_path}", RED)
        sys.exit(1)

def get_all_invoices(carol_config):
    """Get all invoices from Carol's node"""
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
    
    # Get all invoices
    url = f"https://localhost:{rest_port}/v1/invoices"
    headers = {"Grpc-Metadata-macaroon": macaroon_hex}
    
    try:
        response = requests.get(url, headers=headers, verify=False, timeout=API_TIMEOUT)
        response.raise_for_status()
        invoices_data = response.json()
        
        if 'invoices' in invoices_data:
            return invoices_data['invoices']
        else:
            return []
            
    except requests.exceptions.RequestException as e:
        print_colored(f"[ERROR] Failed to get invoices: {e}", RED)
        sys.exit(1)

def cancel_invoice(carol_config, payment_hash):
    """Cancel an invoice"""
    rest_port = carol_config['rest_port']
    admin_macaroon_path = None
    
    # Find admin macaroon
    for macaroon in carol_config['macaroons']:
        if macaroon['type'] == 'admin':
            admin_macaroon_path = macaroon['path']
            break
    
    if not admin_macaroon_path:
        return False
    
    # Read macaroon
    macaroon_hex = read_macaroon_hex(admin_macaroon_path)
    
    # Cancel invoice
    url = f"https://localhost:{rest_port}/v2/invoices/cancel"
    headers = {
        "Grpc-Metadata-macaroon": macaroon_hex,
        "Content-Type": "application/json"
    }
    
    cancel_data = {"payment_hash": payment_hash}
    
    try:
        response = requests.post(
            url,
            json=cancel_data,
            headers=headers,
            verify=False,
            timeout=API_TIMEOUT
        )
        response.raise_for_status()
        return True
    except requests.exceptions.RequestException:
        return False

def main():
    """Main function"""
    print_colored("🗑️  Canceling all invoices from Carol's node...", YELLOW)
    
    # Load configuration
    config = load_ln_config()
    carol_config = get_carol_config(config)
    
    # Get all invoices
    invoices = get_all_invoices(carol_config)
    
    if not invoices:
        print_colored("✅ No invoices found to cancel", GREEN)
        return
    
    print_colored(f"📋 Found {len(invoices)} invoices to process", CYAN)
    
    # Cancel only cancelable invoices
    canceled_count = 0
    skipped_count = 0
    failed_count = 0
    
    for invoice in invoices:
        add_index = invoice.get('add_index', 'N/A')
        amount = invoice.get('value', 'N/A')
        status = invoice.get('state', 'UNKNOWN')
        payment_hash = invoice.get('r_hash', '')
        
        # Skip SETTLED invoices (they can't be canceled)
        if status == 'SETTLED':
            print_colored(f"  Index {add_index}: {amount} sats ({status}) - ⏭️  Skipped", YELLOW)
            skipped_count += 1
            continue
        
        print_colored(f"  Index {add_index}: {amount} sats ({status})", CYAN)
        
        if cancel_invoice(carol_config, payment_hash):
            print_colored(f"    ✅ Cancelled", GREEN)
            canceled_count += 1
        else:
            print_colored(f"    ❌ Failed to cancel", RED)
            failed_count += 1
    
    print()
    print_colored(f"🎉 Summary: {canceled_count} canceled, {failed_count} failed", GREEN)

if __name__ == "__main__":
    main() 