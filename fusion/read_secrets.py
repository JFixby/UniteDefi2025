#!/usr/bin/env python3
"""
Script to read secrets from SECRETS.py and output them as environment variables
"""

import sys
import os
from pathlib import Path

def read_secrets():
    """Read secrets from SECRETS.py and return as dict"""
    # Get the path to SECRETS.py in the parent directory
    secrets_path = Path(__file__).parent.parent / "SECRETS.py"
    
    if not secrets_path.exists():
        print(f"Error: SECRETS.py not found at {secrets_path}", file=sys.stderr)
        return {}
    
    # Read and execute SECRETS.py to get the variables
    secrets = {}
    try:
        with open(secrets_path, 'r') as f:
            exec(f.read(), {}, secrets)
        
        # Extract the variables we need
        result = {}
        if 'YOUR_INFURA_PROJECT_ID' in secrets:
            result['NODE_URL'] = f"https://mainnet.infura.io/v3/{secrets['YOUR_INFURA_PROJECT_ID']}"
        if 'WALLET_SEED' in secrets:
            result['PRIVATE_KEY'] = secrets['WALLET_SEED']
        if 'YOUR_DEV_PORTAL_API_TOKEN' in secrets:
            result['DEV_PORTAL_API_TOKEN'] = secrets['YOUR_DEV_PORTAL_API_TOKEN']
        
        return result
        
    except Exception as e:
        print(f"Error reading SECRETS.py: {e}", file=sys.stderr)
        return {}

def main():
    """Main function to output secrets as environment variables"""
    secrets = read_secrets()
    
    if not secrets:
        print("No secrets found or error reading SECRETS.py", file=sys.stderr)
        sys.exit(1)
    
    # Output as environment variable format
    for key, value in secrets.items():
        print(f"{key}={value}")

if __name__ == "__main__":
    main() 