#!/usr/bin/env python3
"""
Demo script for BTC swaps between Alice and Carol
This script demonstrates the complete swap flow using the Lightning Network.
"""

import time
import sys
from btc_swap import LightningNetworkSwap

def print_separator(title):
    print(f"\n{'='*60}")
    print(f" {title}")
    print(f"{'='*60}")

def demo_alice_to_carol_swap():
    """Demonstrate a swap from Alice to Carol"""
    print_separator("DEMO: Alice → Carol Swap")
    
    try:
        # Initialize swap tool
        swap_tool = LightningNetworkSwap()
        
        # Step 1: Check initial balances
        print("📊 Checking initial balances...")
        balances = swap_tool.check_balances()
        for node, balance in balances.items():
            if "error" not in balance:
                print(f"  {node}: {balance['total_balance']} sats")
        
        # Step 2: Create swap (Alice sends 5000 sats to Carol)
        print("\n🔄 Creating swap: Alice → Carol (5000 sats)")
        swap = swap_tool.create_swap(
            from_node="alice",
            to_node="carol", 
            amount_sats=5000,
            expiry_minutes=30
        )
        
        print(f"✅ Swap created: {swap.swap_id}")
        print(f"   Status: {swap.status}")
        print(f"   Hash Lock: {swap.hash_lock[:16]}...")
        
        # Step 3: Execute the swap
        print(f"\n⚡ Executing swap {swap.swap_id}...")
        success = swap_tool.execute_swap(swap.swap_id)
        
        if success:
            print("✅ Swap executed successfully!")
        else:
            print("❌ Swap execution failed!")
            return False
        
        # Step 4: Check final balances
        print("\n📊 Checking final balances...")
        balances = swap_tool.check_balances()
        for node, balance in balances.items():
            if "error" not in balance:
                print(f"  {node}: {balance['total_balance']} sats")
        
        # Step 5: Show swap status
        print(f"\n📋 Final swap status:")
        final_swap = swap_tool.get_swap_status(swap.swap_id)
        print(f"   Status: {final_swap.status}")
        print(f"   From: {final_swap.from_node} → To: {final_swap.to_node}")
        print(f"   Amount: {final_swap.amount_sats} sats")
        
        return True
        
    except Exception as e:
        print(f"❌ Demo failed: {e}")
        return False

def demo_carol_to_alice_swap():
    """Demonstrate a swap from Carol to Alice"""
    print_separator("DEMO: Carol → Alice Swap")
    
    try:
        # Initialize swap tool
        swap_tool = LightningNetworkSwap()
        
        # Step 1: Check initial balances
        print("📊 Checking initial balances...")
        balances = swap_tool.check_balances()
        for node, balance in balances.items():
            if "error" not in balance:
                print(f"  {node}: {balance['total_balance']} sats")
        
        # Step 2: Create swap (Carol sends 3000 sats to Alice)
        print("\n🔄 Creating swap: Carol → Alice (3000 sats)")
        swap = swap_tool.create_swap(
            from_node="carol",
            to_node="alice", 
            amount_sats=3000,
            expiry_minutes=30
        )
        
        print(f"✅ Swap created: {swap.swap_id}")
        print(f"   Status: {swap.status}")
        print(f"   Hash Lock: {swap.hash_lock[:16]}...")
        
        # Step 3: Execute the swap
        print(f"\n⚡ Executing swap {swap.swap_id}...")
        success = swap_tool.execute_swap(swap.swap_id)
        
        if success:
            print("✅ Swap executed successfully!")
        else:
            print("❌ Swap execution failed!")
            return False
        
        # Step 4: Check final balances
        print("\n📊 Checking final balances...")
        balances = swap_tool.check_balances()
        for node, balance in balances.items():
            if "error" not in balance:
                print(f"  {node}: {balance['total_balance']} sats")
        
        return True
        
    except Exception as e:
        print(f"❌ Demo failed: {e}")
        return False

def demo_htlc_features():
    """Demonstrate HTLC features"""
    print_separator("DEMO: HTLC Features")
    
    try:
        swap_tool = LightningNetworkSwap()
        
        # Create a swap but don't execute it immediately
        print("🔄 Creating HTLC swap with 60-minute expiry...")
        swap = swap_tool.create_swap(
            from_node="alice",
            to_node="carol",
            amount_sats=1000,
            expiry_minutes=60
        )
        
        print(f"✅ HTLC swap created: {swap.swap_id}")
        print(f"   Secret: {swap.secret[:16]}...")
        print(f"   Hash Lock: {swap.hash_lock[:16]}...")
        print(f"   Expires: {time.strftime('%Y-%m-%d %H:%M:%S', time.localtime(swap.expiry_time))}")
        print(f"   Invoice: {swap.invoice[:50]}...")
        
        # Show swap details
        print(f"\n📋 HTLC Swap Details:")
        print(f"   - Uses SHA256 hash of secret as payment condition")
        print(f"   - Secret is revealed only after payment is made")
        print(f"   - Time-locked to prevent indefinite holds")
        print(f"   - Atomic: either both sides complete or both fail")
        
        # List all swaps
        print(f"\n📋 All swaps:")
        swaps = swap_tool.list_swaps()
        for s in swaps:
            print(f"   {s.swap_id}: {s.from_node} → {s.to_node} ({s.amount_sats} sats) - {s.status}")
        
        return True
        
    except Exception as e:
        print(f"❌ HTLC demo failed: {e}")
        return False

def main():
    """Run the complete demo"""
    print("🚀 Lightning Network BTC Swap Demo")
    print("This demo shows HTLC-based swaps between Alice and Carol")
    
    # Check if Lightning nodes are running
    try:
        swap_tool = LightningNetworkSwap()
        print("✅ Lightning Network configuration loaded")
    except Exception as e:
        print(f"❌ Failed to load Lightning Network configuration: {e}")
        print("Make sure your Lightning Network nodes are running and ln.json is configured.")
        return 1
    
    # Run demos
    demos = [
        ("Alice → Carol Swap", demo_alice_to_carol_swap),
        ("Carol → Alice Swap", demo_carol_to_alice_swap),
        ("HTLC Features", demo_htlc_features)
    ]
    
    success_count = 0
    for demo_name, demo_func in demos:
        try:
            if demo_func():
                success_count += 1
            else:
                print(f"❌ {demo_name} failed")
        except Exception as e:
            print(f"❌ {demo_name} crashed: {e}")
    
    print_separator("DEMO SUMMARY")
    print(f"✅ Successful demos: {success_count}/{len(demos)}")
    
    if success_count == len(demos):
        print("🎉 All demos completed successfully!")
        print("\n💡 Key Features Demonstrated:")
        print("   - HTLC-based atomic swaps")
        print("   - Cross-node Lightning payments")
        print("   - Secret management and hash locks")
        print("   - Time-locked contracts")
        print("   - Bidirectional swap capability")
    else:
        print("⚠️  Some demos failed. Check Lightning Network connectivity.")
    
    return 0 if success_count == len(demos) else 1

if __name__ == "__main__":
    exit(main()) 