// SPDX-License-Identifier: MIT 
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/utils/cryptography/MessageHashUtils.sol";

/**
 * @title Escrow Contract - 1inch Simulation
 * @dev This contract simulates 1inch's escrow management logic for cross-chain atomic swaps
 * 
 * In a production environment, 1inch would use their sophisticated escrow system with:
 * - Advanced order routing and aggregation
 * - Multi-chain liquidity pools
 * - Complex fee structures and gas optimization
 * - Professional security audits and formal verification
 * 
 * For demo purposes, we use this simplified HTLC (Hash Time Locked Contract) that:
 * - Handles basic escrow functionality for cross-chain swaps
 * - Uses Lightning Network compatible hashlocks
 * - Provides atomic swap capabilities between BTC (Lightning) and ETH
 * - Demonstrates the core principles of secure conditional transfers
 * 
 * This is NOT a production-ready 1inch implementation, but rather a simplified
 * demonstration of escrow mechanics for educational and testing purposes.
 */
contract Escrow is ReentrancyGuard {
    using ECDSA for bytes32;

    struct Deposit {
        address depositor;
        address claimer;
        uint256 amount;
        uint256 expirationTime;
        bytes32 hashlock;
        bool claimed;
        bool cancelled;
    }

    // Mapping from deposit ID to deposit details
    mapping(bytes32 => Deposit) public deposits;
    
    // Events
    event DepositCreated(
        bytes32 indexed depositId,
        address indexed depositor,
        address indexed claimer,
        uint256 amount,
        uint256 expirationTime,
        bytes32 hashlock
    );
    
    event DepositClaimed(
        bytes32 indexed depositId,
        address indexed claimer,
        bytes secret
    );
    
    event DepositCancelled(
        bytes32 indexed depositId,
        address indexed depositor
    );

    /**
     * @dev Creates a new deposit with HTLC functionality
     * @param claimer Address of the user who can claim the deposit
     * @param expirationTime Unix timestamp after which depositor can cancel
     * @param hashlock Bytes32 hashlock from Lightning Network invoice
     */
    function deposit(
        address claimer,
        uint256 expirationTime,
        bytes32 hashlock
    ) external payable nonReentrant {
        require(msg.value > 0, "Deposit amount must be greater than 0");
        require(claimer != address(0), "Invalid claimer address");
        require(expirationTime > block.timestamp, "Expiration time must be in the future");
        require(hashlock != bytes32(0), "Hashlock cannot be empty");

        // Use the hashlock directly as the deposit ID
        bytes32 depositId = hashlock;

        // Ensure deposit doesn't already exist
        require(deposits[depositId].depositor == address(0), "Deposit already exists");

        // Create the deposit
        deposits[depositId] = Deposit({
            depositor: msg.sender,
            claimer: claimer,
            amount: msg.value,
            expirationTime: expirationTime,
            hashlock: hashlock,
            claimed: false,
            cancelled: false
        });

        emit DepositCreated(
            depositId,
            msg.sender,
            claimer,
            msg.value,
            expirationTime,
            hashlock
        );
    }

    /**
     * @dev Claims the deposit by providing the secret that matches the hashlock
     * @param depositId The ID of the deposit to claim
     * @param secret The secret that hashes to the hashlock (from Lightning Network)
     */
    function claim(bytes32 depositId, bytes memory secret) external nonReentrant {
        Deposit storage depositInfo = deposits[depositId];
        
        require(depositInfo.depositor != address(0), "Deposit does not exist");
        require(!depositInfo.claimed, "Deposit already claimed");
        require(!depositInfo.cancelled, "Deposit already cancelled");
        require(msg.sender == depositInfo.claimer, "Only claimer can claim");
        // Removed expiration check - claimer can claim at any time with correct secret
        
        // Verify the secret matches the hashlock using SHA256 (Lightning Network compatible)
        bytes32 computedHashlock = sha256(secret);
        require(depositInfo.hashlock == computedHashlock, "Invalid secret");

        // Mark as claimed
        depositInfo.claimed = true;

        // Transfer funds to claimer
        (bool success, ) = depositInfo.claimer.call{value: depositInfo.amount}("");
        require(success, "Transfer to claimer failed");

        emit DepositClaimed(depositId, depositInfo.claimer, secret);
    }

    /**
     * @dev Cancels the deposit and returns funds to depositor after expiration
     * @param depositId The ID of the deposit to cancel
     * @notice Anyone can cancel an expired deposit, not just the depositor
     */
    function cancelDeposit(bytes32 depositId) external nonReentrant {
        Deposit storage depositInfo = deposits[depositId];
        
        require(depositInfo.depositor != address(0), "Deposit does not exist");
        require(!depositInfo.claimed, "Deposit already claimed");
        require(!depositInfo.cancelled, "Deposit already cancelled");
        require(block.timestamp > depositInfo.expirationTime, "Deposit not yet expired");

        // Mark as cancelled
        depositInfo.cancelled = true;

        // Transfer funds back to depositor
        (bool success, ) = depositInfo.depositor.call{value: depositInfo.amount}("");
        require(success, "Transfer to depositor failed");

        emit DepositCancelled(depositId, depositInfo.depositor);
    }

    /**
     * @dev Get deposit details
     * @param depositId The ID of the deposit
     * @return depositor Address of the depositor
     * @return claimer Address of the claimer
     * @return amount Amount of ETH deposited
     * @return expirationTime Expiration timestamp
     * @return hashlock Bytes32 hashlock from Lightning Network
     * @return claimed Whether deposit has been claimed
     * @return cancelled Whether deposit has been cancelled
     */
    function getDeposit(bytes32 depositId) external view returns (
        address depositor,
        address claimer,
        uint256 amount,
        uint256 expirationTime,
        bytes32 hashlock,
        bool claimed,
        bool cancelled
    ) {
        Deposit storage depositInfo = deposits[depositId];
        return (
            depositInfo.depositor,
            depositInfo.claimer,
            depositInfo.amount,
            depositInfo.expirationTime,
            depositInfo.hashlock,
            depositInfo.claimed,
            depositInfo.cancelled
        );
    }

    /**
     * @dev Check if a deposit is expired
     * @param depositId The ID of the deposit
     * @return True if deposit is expired
     */
    function isExpired(bytes32 depositId) external view returns (bool) {
        Deposit storage depositInfo = deposits[depositId];
        return block.timestamp > depositInfo.expirationTime;
    }

    /**
     * @dev Get contract balance
     */
    function getBalance() external view returns (uint256) {
        return address(this).balance;
    }

    // Fallback function to receive ETH
    receive() external payable {
        revert("Use deposit() function to create deposits");
    }
}
