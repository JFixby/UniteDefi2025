#!/usr/bin/env python3
"""
BTC Swap Script for Lightning Network
Implements HTLC-based swaps between Alice and Carol using the configured Lightning Network nodes.

This script demonstrates:
1. HTLC invoice creation with hash locks
2. Cross-node payment routing
3. Secret management for HTLC settlement
4. Swap execution and monitoring

Usage:
    python3 btc_swap.py --help
    python3 btc_swap.py create-swap --from alice --to carol --amount 10000
    python3 btc_swap.py execute-swap --swap-id <swap_id>
    python3 btc_swap.py check-balances
"""

import json
import hashlib
import secrets
import time
import argparse
import requests
import base64
from typing import Dict, List, Optional, Tuple
from dataclasses import dataclass
from pathlib import Path
import logging

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

@dataclass
class SwapOrder:
    """Represents a swap order between two parties"""
    swap_id: str
    from_node: str
    to_node: str
    amount_sats: int
    secret: str
    hash_lock: str
    expiry_time: int
    status: str  # 'pending', 'executing', 'completed', 'failed', 'expired'
    created_at: int
    invoice: Optional[str] = None
    payment_hash: Optional[str] = None

class LightningNetworkSwap:
    """Handles Lightning Network operations for BTC swaps"""
    
    def __init__(self, config_file: str = "ln.json"):
        self.config_file = Path(config_file)
        self.nodes = self._load_config()
        self.swaps: Dict[str, SwapOrder] = {}
        self.swap_file = Path("swaps.json")
        self._load_swaps()
    
    def _load_config(self) -> Dict:
        """Load Lightning Network configuration"""
        if not self.config_file.exists():
            raise FileNotFoundError(f"Configuration file {self.config_file} not found")
        
        with open(self.config_file, 'r') as f:
            config = json.load(f)
        
        # Convert to dictionary for easier access
        nodes = {}
        for node in config:
            nodes[node['alias']] = node
        
        logger.info(f"Loaded configuration for nodes: {list(nodes.keys())}")
        return nodes
    
    def _load_swaps(self):
        """Load existing swaps from file"""
        if self.swap_file.exists():
            with open(self.swap_file, 'r') as f:
                data = json.load(f)
                for swap_data in data:
                    swap = SwapOrder(**swap_data)
                    self.swaps[swap.swap_id] = swap
            logger.info(f"Loaded {len(self.swaps)} existing swaps")
    
    def _save_swaps(self):
        """Save swaps to file"""
        with open(self.swap_file, 'w') as f:
            json.dump([swap.__dict__ for swap in self.swaps.values()], f, indent=2)
    
    def _get_node_config(self, node_alias: str) -> Dict:
        """Get configuration for a specific node"""
        if node_alias not in self.nodes:
            raise ValueError(f"Node '{node_alias}' not found in configuration")
        return self.nodes[node_alias]
    
    def _get_macaroon_path(self, node_alias: str, macaroon_type: str = "admin") -> str:
        """Get macaroon path for a node"""
        node_config = self._get_node_config(node_alias)
        for macaroon in node_config['macaroons']:
            if macaroon['type'] == macaroon_type:
                return macaroon['path']
        raise ValueError(f"Macaroon type '{macaroon_type}' not found for node '{node_alias}'")
    
    def _read_macaroon_hex(self, macaroon_path: str) -> str:
        """Read macaroon file and convert to hex"""
        with open(macaroon_path, 'rb') as f:
            macaroon_bytes = f.read()
        return macaroon_bytes.hex()
    
    def _make_request(self, node_alias: str, endpoint: str, method: str = "GET", data: Dict = None) -> Dict:
        """Make HTTP request to Lightning Network node"""
        node_config = self._get_node_config(node_alias)
        rest_port = node_config['rest_port']
        macaroon_path = self._get_macaroon_path(node_alias)
        macaroon_hex = self._read_macaroon_hex(macaroon_path)
        
        url = f"https://localhost:{rest_port}{endpoint}"
        headers = {
            "Grpc-Metadata-macaroon": macaroon_hex,
            "Content-Type": "application/json"
        }
        
        try:
            if method == "GET":
                response = requests.get(url, headers=headers, verify=False)
            elif method == "POST":
                response = requests.post(url, headers=headers, json=data, verify=False)
            else:
                raise ValueError(f"Unsupported HTTP method: {method}")
            
            response.raise_for_status()
            return response.json()
        
        except requests.exceptions.RequestException as e:
            logger.error(f"Request failed for {node_alias} at {endpoint}: {e}")
            raise
    
    def generate_htlc_secret(self) -> Tuple[str, str]:
        """Generate a random secret and its hash for HTLC"""
        secret = secrets.token_hex(32)  # 64 character hex string
        hash_lock = hashlib.sha256(secret.encode()).hexdigest()
        return secret, hash_lock
    
    def create_swap(self, from_node: str, to_node: str, amount_sats: int, 
                   expiry_minutes: int = 60) -> SwapOrder:
        """Create a new swap order between two nodes"""
        
        # Validate nodes exist
        if from_node not in self.nodes:
            raise ValueError(f"From node '{from_node}' not found")
        if to_node not in self.nodes:
            raise ValueError(f"To node '{to_node}' not found")
        
        # Generate HTLC secret and hash
        secret, hash_lock = self.generate_htlc_secret()
        
        # Create swap order
        swap_id = f"swap_{int(time.time())}_{secrets.token_hex(4)}"
        expiry_time = int(time.time()) + (expiry_minutes * 60)
        
        swap = SwapOrder(
            swap_id=swap_id,
            from_node=from_node,
            to_node=to_node,
            amount_sats=amount_sats,
            secret=secret,
            hash_lock=hash_lock,
            expiry_time=expiry_time,
            status="pending",
            created_at=int(time.time())
        )
        
        # Create HTLC invoice on the receiving node
        try:
            invoice_data = {
                "value": str(amount_sats),
                "memo": f"HTLC Swap {swap_id}",
                "expiry": str(expiry_time),
                "r_preimage": base64.b64encode(bytes.fromhex(secret)).decode()
            }
            
            response = self._make_request(to_node, "/v1/invoices", "POST", invoice_data)
            
            swap.invoice = response.get("payment_request")
            swap.payment_hash = response.get("r_hash")
            swap.status = "executing"
            
            logger.info(f"Created HTLC invoice for swap {swap_id}")
            
        except Exception as e:
            logger.error(f"Failed to create HTLC invoice: {e}")
            swap.status = "failed"
        
        # Save swap
        self.swaps[swap_id] = swap
        self._save_swaps()
        
        return swap
    
    def execute_swap(self, swap_id: str) -> bool:
        """Execute a swap by paying the HTLC invoice"""
        if swap_id not in self.swaps:
            raise ValueError(f"Swap '{swap_id}' not found")
        
        swap = self.swaps[swap_id]
        
        if swap.status != "executing":
            raise ValueError(f"Swap {swap_id} is not in executable state: {swap.status}")
        
        if time.time() > swap.expiry_time:
            swap.status = "expired"
            self._save_swaps()
            raise ValueError(f"Swap {swap_id} has expired")
        
        try:
            # Pay the invoice from the sending node
            payment_data = {
                "payment_request": swap.invoice
            }
            
            response = self._make_request(swap.from_node, "/v1/channels/transactions", "POST", payment_data)
            
            if response.get("payment_error"):
                logger.error(f"Payment failed: {response['payment_error']}")
                swap.status = "failed"
                self._save_swaps()
                return False
            
            # Payment successful
            swap.status = "completed"
            self._save_swaps()
            
            logger.info(f"Swap {swap_id} completed successfully")
            return True
            
        except Exception as e:
            logger.error(f"Failed to execute swap {swap_id}: {e}")
            swap.status = "failed"
            self._save_swaps()
            return False
    
    def get_swap_status(self, swap_id: str) -> Optional[SwapOrder]:
        """Get status of a specific swap"""
        return self.swaps.get(swap_id)
    
    def list_swaps(self, status_filter: str = None) -> List[SwapOrder]:
        """List all swaps, optionally filtered by status"""
        swaps = list(self.swaps.values())
        if status_filter:
            swaps = [s for s in swaps if s.status == status_filter]
        return swaps
    
    def check_balances(self) -> Dict[str, Dict]:
        """Check balances for all nodes"""
        balances = {}
        
        for node_alias in self.nodes.keys():
            try:
                # Get on-chain balance
                onchain_response = self._make_request(node_alias, "/v1/balance/blockchain")
                onchain_balance = onchain_response.get("total_balance", 0)
                
                # Get channel balances
                channels_response = self._make_request(node_alias, "/v1/channels")
                channels = channels_response.get("channels", [])
                
                total_local = sum(ch.get("local_balance", 0) for ch in channels)
                total_remote = sum(ch.get("remote_balance", 0) for ch in channels)
                
                balances[node_alias] = {
                    "onchain_balance": onchain_balance,
                    "channel_balance": total_local,
                    "total_balance": onchain_balance + total_local,
                    "channels": len(channels),
                    "channel_details": channels
                }
                
            except Exception as e:
                logger.error(f"Failed to get balance for {node_alias}: {e}")
                balances[node_alias] = {"error": str(e)}
        
        return balances
    
    def cleanup_expired_swaps(self):
        """Clean up expired swaps"""
        current_time = time.time()
        expired_swaps = [swap_id for swap_id, swap in self.swaps.items() 
                        if current_time > swap.expiry_time and swap.status == "pending"]
        
        for swap_id in expired_swaps:
            self.swaps[swap_id].status = "expired"
            logger.info(f"Marked swap {swap_id} as expired")
        
        if expired_swaps:
            self._save_swaps()

def main():
    parser = argparse.ArgumentParser(description="Lightning Network BTC Swap Tool")
    subparsers = parser.add_subparsers(dest="command", help="Available commands")
    
    # Create swap command
    create_parser = subparsers.add_parser("create-swap", help="Create a new swap")
    create_parser.add_argument("--from", dest="from_node", required=True, help="Source node (e.g., alice)")
    create_parser.add_argument("--to", dest="to_node", required=True, help="Destination node (e.g., carol)")
    create_parser.add_argument("--amount", type=int, required=True, help="Amount in satoshis")
    create_parser.add_argument("--expiry", type=int, default=60, help="Expiry time in minutes (default: 60)")
    
    # Execute swap command
    execute_parser = subparsers.add_parser("execute-swap", help="Execute a swap")
    execute_parser.add_argument("--swap-id", required=True, help="Swap ID to execute")
    
    # List swaps command
    list_parser = subparsers.add_parser("list-swaps", help="List all swaps")
    list_parser.add_argument("--status", help="Filter by status (pending, executing, completed, failed, expired)")
    
    # Check balances command
    subparsers.add_parser("check-balances", help="Check balances for all nodes")
    
    # Get swap status command
    status_parser = subparsers.add_parser("swap-status", help="Get status of a specific swap")
    status_parser.add_argument("--swap-id", required=True, help="Swap ID to check")
    
    # Cleanup command
    subparsers.add_parser("cleanup", help="Clean up expired swaps")
    
    args = parser.parse_args()
    
    if not args.command:
        parser.print_help()
        return
    
    try:
        swap_tool = LightningNetworkSwap()
        
        if args.command == "create-swap":
            swap = swap_tool.create_swap(
                from_node=getattr(args, 'from_node'),
                to_node=args.to_node,
                amount_sats=args.amount,
                expiry_minutes=args.expiry
            )
            print(f"\n✅ Swap created successfully!")
            print(f"Swap ID: {swap.swap_id}")
            print(f"From: {swap.from_node}")
            print(f"To: {swap.to_node}")
            print(f"Amount: {swap.amount_sats} sats")
            print(f"Status: {swap.status}")
            print(f"Expires: {time.strftime('%Y-%m-%d %H:%M:%S', time.localtime(swap.expiry_time))}")
            print(f"Hash Lock: {swap.hash_lock[:16]}...")
            print(f"Payment Request: {swap.invoice}")
        
        elif args.command == "execute-swap":
            success = swap_tool.execute_swap(args.swap_id)
            if success:
                print(f"✅ Swap {args.swap_id} executed successfully!")
            else:
                print(f"❌ Swap {args.swap_id} execution failed!")
        
        elif args.command == "list-swaps":
            swaps = swap_tool.list_swaps(args.status)
            if not swaps:
                print("No swaps found.")
            else:
                print(f"\nFound {len(swaps)} swap(s):")
                for swap in swaps:
                    print(f"\nSwap ID: {swap.swap_id}")
                    print(f"  From: {swap.from_node} → To: {swap.to_node}")
                    print(f"  Amount: {swap.amount_sats} sats")
                    print(f"  Status: {swap.status}")
                    print(f"  Created: {time.strftime('%Y-%m-%d %H:%M:%S', time.localtime(swap.created_at))}")
                    if swap.expiry_time:
                        print(f"  Expires: {time.strftime('%Y-%m-%d %H:%M:%S', time.localtime(swap.expiry_time))}")
        
        elif args.command == "check-balances":
            balances = swap_tool.check_balances()
            print("\n💰 Lightning Network Balances:")
            for node, balance in balances.items():
                if "error" in balance:
                    print(f"\n❌ {node}: Error - {balance['error']}")
                else:
                    print(f"\n✅ {node}:")
                    print(f"  On-chain: {balance['onchain_balance']} sats")
                    print(f"  Channel: {balance['channel_balance']} sats")
                    print(f"  Total: {balance['total_balance']} sats")
                    print(f"  Channels: {balance['channels']}")
        
        elif args.command == "swap-status":
            swap = swap_tool.get_swap_status(args.swap_id)
            if swap:
                print(f"\n📋 Swap Status: {swap.swap_id}")
                print(f"  From: {swap.from_node} → To: {swap.to_node}")
                print(f"  Amount: {swap.amount_sats} sats")
                print(f"  Status: {swap.status}")
                print(f"  Created: {time.strftime('%Y-%m-%d %H:%M:%S', time.localtime(swap.created_at))}")
                if swap.expiry_time:
                    print(f"  Expires: {time.strftime('%Y-%m-%d %H:%M:%S', time.localtime(swap.expiry_time))}")
                if swap.invoice:
                    print(f"  Invoice: {swap.invoice}")
            else:
                print(f"❌ Swap {args.swap_id} not found")
        
        elif args.command == "cleanup":
            swap_tool.cleanup_expired_swaps()
            print("✅ Cleaned up expired swaps")
    
    except Exception as e:
        logger.error(f"Error: {e}")
        return 1
    
    return 0

if __name__ == "__main__":
    exit(main()) 