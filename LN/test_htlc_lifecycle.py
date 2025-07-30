#!/usr/bin/env python3
"""
HTLC Lifecycle Test Script
This script demonstrates the complete lifecycle of an HTLC (Hash Time Locked Contract)
in a Lightning Network swap between Alice and Carol.

It logs every step to show how secrets and hash locks work.
"""

import json
import hashlib
import secrets
import time
import base64
import requests
from pathlib import Path
from typing import Dict, Tuple

class HTLCLifecycleTest:
    """Test class for demonstrating HTLC lifecycle"""
    
    def __init__(self, config_file: str = "ln.json"):
        self.config_file = Path(config_file)
        self.nodes = self._load_config()
        self.test_results = []
    
    def _load_config(self) -> Dict:
        """Load Lightning Network configuration"""
        if not self.config_file.exists():
            raise FileNotFoundError(f"Configuration file {self.config_file} not found")
        
        with open(self.config_file, 'r') as f:
            config = json.load(f)
        
        nodes = {}
        for node in config:
            nodes[node['alias']] = node
        
        print(f"✅ Loaded configuration for nodes: {list(nodes.keys())}")
        return nodes
    
    def _get_macaroon_path(self, node_alias: str, macaroon_type: str = "admin") -> str:
        """Get macaroon path for a node"""
        node_config = self.nodes[node_alias]
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
        node_config = self.nodes[node_alias]
        rest_port = node_config['rest_port']
        macaroon_path = self._get_macaroon_path(node_alias)
        macaroon_hex = self._read_macaroon_hex(macaroon_path)
        
        url = f"https://localhost:{rest_port}{endpoint}"
        headers = {
            "Grpc-Metadata-macaroon": macaroon_hex,
            "Content-Type": "application/json"
        }
        
        if method == "GET":
            response = requests.get(url, headers=headers, verify=False)
        elif method == "POST":
            response = requests.post(url, headers=headers, json=data, verify=False)
        else:
            raise ValueError(f"Unsupported HTTP method: {method}")
        
        response.raise_for_status()
        return response.json()
    
    def log_step(self, step: str, details: Dict = None):
        """Log a test step with details"""
        timestamp = time.strftime('%H:%M:%S')
        print(f"\n🕐 [{timestamp}] {step}")
        if details:
            for key, value in details.items():
                if isinstance(value, str) and len(value) > 50:
                    print(f"   {key}: {value[:50]}...")
                else:
                    print(f"   {key}: {value}")
        self.test_results.append({"step": step, "timestamp": timestamp, "details": details})
    
    def test_step_1_check_balances(self):
        """Step 1: Check initial balances"""
        self.log_step("STEP 1: Checking initial balances for all nodes")
        
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
                    "channels": len(channels)
                }
                
                self.log_step(f"Balance for {node_alias}", balances[node_alias])
                
            except Exception as e:
                self.log_step(f"Error getting balance for {node_alias}", {"error": str(e)})
                balances[node_alias] = {"error": str(e)}
        
        return balances
    
    def test_step_2_generate_htlc_secret(self):
        """Step 2: Generate secret and hash lock"""
        self.log_step("STEP 2: Generating HTLC secret and hash lock")
        
        # Generate random secret
        secret = secrets.token_hex(32)  # 64 character hex string
        self.log_step("Generated random secret", {"secret": secret})
        
        # Create hash lock
        hash_lock = hashlib.sha256(secret.encode()).hexdigest()
        self.log_step("Created hash lock", {"hash_lock": hash_lock})
        
        # Verify the relationship
        verification = hashlib.sha256(secret.encode()).hexdigest()
        is_valid = verification == hash_lock
        
        self.log_step("Verified secret → hash relationship", {
            "secret_length": len(secret),
            "hash_length": len(hash_lock),
            "verification_passed": is_valid
        })
        
        return secret, hash_lock
    
    def test_step_3_create_htlc_invoice(self, to_node: str, amount_sats: int, secret: str, hash_lock: str):
        """Step 3: Create HTLC invoice on receiving node"""
        self.log_step("STEP 3: Creating HTLC invoice on receiving node", {
            "to_node": to_node,
            "amount_sats": amount_sats
        })
        
        # Create expiry time (30 minutes from now)
        expiry_time = int(time.time()) + (30 * 60)
        expiry_str = time.strftime('%Y-%m-%d %H:%M:%S', time.localtime(expiry_time))
        
        self.log_step("Set invoice expiry", {"expiry_time": expiry_str})
        
        # Prepare invoice data
        invoice_data = {
            "value": str(amount_sats),
            "memo": f"HTLC Test - Hash: {hash_lock[:16]}...",
            "expiry": str(expiry_time),
            "r_preimage": base64.b64encode(bytes.fromhex(secret)).decode()
        }
        
        self.log_step("Prepared invoice data", {
            "memo": invoice_data["memo"],
            "r_preimage_length": len(invoice_data["r_preimage"])
        })
        
        try:
            # Create invoice
            response = self._make_request(to_node, "/v1/invoices", "POST", invoice_data)
            
            payment_request = response.get("payment_request")
            payment_hash = response.get("r_hash")
            
            self.log_step("HTLC invoice created successfully", {
                "payment_request": payment_request[:50] + "..." if payment_request else None,
                "payment_hash": payment_hash,
                "invoice_status": "UNPAID"
            })
            
            return payment_request, payment_hash
            
        except Exception as e:
            self.log_step("Failed to create HTLC invoice", {"error": str(e)})
            raise
    
    def test_step_4_pay_htlc_invoice(self, from_node: str, payment_request: str, secret: str):
        """Step 4: Pay the HTLC invoice"""
        self.log_step("STEP 4: Paying HTLC invoice", {
            "from_node": from_node,
            "payment_request_preview": payment_request[:50] + "..."
        })
        
        # Prepare payment data
        payment_data = {
            "payment_request": payment_request
        }
        
        self.log_step("Prepared payment data", {
            "payment_request_length": len(payment_request)
        })
        
        try:
            # Execute payment
            response = self._make_request(from_node, "/v1/channels/transactions", "POST", payment_data)
            
            if response.get("payment_error"):
                self.log_step("Payment failed", {"payment_error": response["payment_error"]})
                return False
            
            # Payment successful
            payment_hash = response.get("payment_hash")
            payment_preimage = response.get("payment_preimage")
            
            self.log_step("HTLC payment successful", {
                "payment_hash": payment_hash,
                "payment_preimage": payment_preimage,
                "payment_status": "SUCCEEDED"
            })
            
            # Verify the preimage matches our secret
            if payment_preimage:
                revealed_secret = base64.b64decode(payment_preimage).hex()
                secret_matches = revealed_secret == secret
                
                self.log_step("Verified revealed secret", {
                    "original_secret": secret[:16] + "...",
                    "revealed_secret": revealed_secret[:16] + "...",
                    "secrets_match": secret_matches
                })
            
            return True
            
        except Exception as e:
            self.log_step("Payment failed with exception", {"error": str(e)})
            return False
    
    def test_step_5_verify_settlement(self, to_node: str, payment_hash: str):
        """Step 5: Verify HTLC settlement"""
        self.log_step("STEP 5: Verifying HTLC settlement", {
            "checking_node": to_node,
            "payment_hash": payment_hash
        })
        
        try:
            # Get invoice details
            response = self._make_request(to_node, f"/v1/invoices/{payment_hash}")
            
            invoice_state = response.get("state")
            settled = response.get("settled")
            settle_date = response.get("settle_date")
            
            self.log_step("Invoice settlement status", {
                "state": invoice_state,
                "settled": settled,
                "settle_date": settle_date
            })
            
            if settled:
                self.log_step("✅ HTLC settlement verified successfully")
                return True
            else:
                self.log_step("❌ HTLC settlement not yet confirmed")
                return False
                
        except Exception as e:
            self.log_step("Failed to verify settlement", {"error": str(e)})
            return False
    
    def test_step_6_check_final_balances(self):
        """Step 6: Check final balances"""
        self.log_step("STEP 6: Checking final balances")
        
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
                    "channels": len(channels)
                }
                
                self.log_step(f"Final balance for {node_alias}", balances[node_alias])
                
            except Exception as e:
                self.log_step(f"Error getting final balance for {node_alias}", {"error": str(e)})
                balances[node_alias] = {"error": str(e)}
        
        return balances
    
    def run_complete_test(self, amount_sats: int = 1000):
        """Run the complete HTLC lifecycle test"""
        print("🚀 Starting HTLC Lifecycle Test")
        print("=" * 60)
        
        try:
            # Step 1: Check initial balances
            initial_balances = self.test_step_1_check_balances()
            
            # Step 2: Generate HTLC secret and hash lock
            secret, hash_lock = self.test_step_2_generate_htlc_secret()
            
            # Step 3: Create HTLC invoice (Alice → Carol)
            payment_request, payment_hash = self.test_step_3_create_htlc_invoice(
                to_node="carol",
                amount_sats=amount_sats,
                secret=secret,
                hash_lock=hash_lock
            )
            
            # Step 4: Pay HTLC invoice
            payment_success = self.test_step_4_pay_htlc_invoice(
                from_node="alice",
                payment_request=payment_request,
                secret=secret
            )
            
            if payment_success:
                # Step 5: Verify settlement
                settlement_verified = self.test_step_5_verify_settlement(
                    to_node="carol",
                    payment_hash=payment_hash
                )
                
                # Step 6: Check final balances
                final_balances = self.test_step_6_check_final_balances()
                
                # Summary
                print("\n" + "=" * 60)
                print("📊 HTLC LIFECYCLE TEST SUMMARY")
                print("=" * 60)
                
                print(f"✅ Secret Generation: PASSED")
                print(f"   Secret: {secret[:16]}...")
                print(f"   Hash Lock: {hash_lock[:16]}...")
                
                print(f"✅ HTLC Invoice Creation: PASSED")
                print(f"   Amount: {amount_sats} sats")
                print(f"   Payment Hash: {payment_hash}")
                
                print(f"✅ HTLC Payment: {'PASSED' if payment_success else 'FAILED'}")
                print(f"✅ Settlement Verification: {'PASSED' if settlement_verified else 'FAILED'}")
                
                # Show balance changes
                if "alice" in initial_balances and "alice" in final_balances:
                    alice_change = final_balances["alice"]["total_balance"] - initial_balances["alice"]["total_balance"]
                    print(f"📈 Alice balance change: {alice_change} sats")
                
                if "carol" in initial_balances and "carol" in final_balances:
                    carol_change = final_balances["carol"]["total_balance"] - initial_balances["carol"]["total_balance"]
                    print(f"📈 Carol balance change: {carol_change} sats")
                
                print(f"\n🎉 HTLC Lifecycle Test {'COMPLETED SUCCESSFULLY' if payment_success and settlement_verified else 'FAILED'}")
                
            else:
                print("\n❌ HTLC Lifecycle Test FAILED - Payment unsuccessful")
            
        except Exception as e:
            print(f"\n❌ HTLC Lifecycle Test FAILED with exception: {e}")
            raise
        
        return self.test_results

def main():
    """Main function to run the HTLC lifecycle test"""
    try:
        test = HTLCLifecycleTest()
        results = test.run_complete_test(amount_sats=1000)
        
        # Save test results
        with open("htlc_test_results.json", "w") as f:
            json.dump(results, f, indent=2)
        
        print(f"\n📝 Test results saved to: htlc_test_results.json")
        
    except Exception as e:
        print(f"❌ Test failed: {e}")
        return 1
    
    return 0

if __name__ == "__main__":
    exit(main()) 