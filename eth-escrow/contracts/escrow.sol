// SPDX-License-Identifier: MIT 
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";

/**
 * @title SHA256 Library
 * @dev Simple SHA256 implementation for Lightning Network compatibility
 */
library SHA256 {
    function sha256(bytes memory data) internal pure returns (bytes32) {
        bytes32 hash;
        assembly {
            hash := sha256(data, mload(data))
        }
        return hash;
    }
}

/**
 * @title Escrow Contract
 * @dev A Hash Time Locked Contract (HTLC) for secure conditional transfers
 */
contract Escrow is ReentrancyGuard {
    using ECDSA for bytes32;
    using SHA256 for bytes;

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

        // Create unique deposit ID using depositor address and hashlock
        bytes32 depositId = keccak256(abi.encodePacked(msg.sender, hashlock, block.timestamp));

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
        Deposit storage deposit = deposits[depositId];
        
        require(deposit.depositor != address(0), "Deposit does not exist");
        require(!deposit.claimed, "Deposit already claimed");
        require(!deposit.cancelled, "Deposit already cancelled");
        require(msg.sender == deposit.claimer, "Only claimer can claim");
        require(block.timestamp <= deposit.expirationTime, "Deposit expired");
        
        // Verify the secret matches the hashlock using SHA256 (Lightning Network compatible)
        bytes32 computedHashlock = SHA256.sha256(secret);
        require(deposit.hashlock == computedHashlock, "Invalid secret");

        // Mark as claimed
        deposit.claimed = true;

        // Transfer funds to claimer
        (bool success, ) = deposit.claimer.call{value: deposit.amount}("");
        require(success, "Transfer to claimer failed");

        emit DepositClaimed(depositId, deposit.claimer, secret);
    }

    /**
     * @dev Cancels the deposit and returns funds to depositor after expiration
     * @param depositId The ID of the deposit to cancel
     */
    function cancelDeposit(bytes32 depositId) external nonReentrant {
        Deposit storage deposit = deposits[depositId];
        
        require(deposit.depositor != address(0), "Deposit does not exist");
        require(!deposit.claimed, "Deposit already claimed");
        require(!deposit.cancelled, "Deposit already cancelled");
        require(msg.sender == deposit.depositor, "Only depositor can cancel");
        require(block.timestamp > deposit.expirationTime, "Deposit not yet expired");

        // Mark as cancelled
        deposit.cancelled = true;

        // Transfer funds back to depositor
        (bool success, ) = deposit.depositor.call{value: deposit.amount}("");
        require(success, "Transfer to depositor failed");

        emit DepositCancelled(depositId, deposit.depositor);
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
        Deposit storage deposit = deposits[depositId];
        return (
            deposit.depositor,
            deposit.claimer,
            deposit.amount,
            deposit.expirationTime,
            deposit.hashlock,
            deposit.claimed,
            deposit.cancelled
        );
    }

    /**
     * @dev Check if a deposit is expired
     * @param depositId The ID of the deposit
     * @return True if deposit is expired
     */
    function isExpired(bytes32 depositId) external view returns (bool) {
        Deposit storage deposit = deposits[depositId];
        return block.timestamp > deposit.expirationTime;
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
