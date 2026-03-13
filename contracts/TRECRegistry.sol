// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";

contract TRECRegistry is Ownable {
    
    // This is Sky's On-Chain ID Card
    struct Profile {
        string ensName;
        uint256 creditScore;  // Starts at 0
        bool isVerified;      // True once BitGo KYC passes
        uint256 totalBorrowed;
        uint256 totalRepaid;
    }

    // Maps a user's wallet address to their Profile
    mapping(address => Profile) public profiles;

    // Events to tell the Next.js frontend when things change
    event ProfileCreated(address indexed user, string ensName);
    event ScoreUpdated(address indexed user, uint256 newScore);
    event VerificationStatusChanged(address indexed user, bool status);

    constructor() Ownable(msg.sender) {}

    // --- 1. USER ACTION: Register ---
    // Sky calls this when he first connects his wallet to the app
    function registerProfile(string memory _ensName) external {
        require(bytes(profiles[msg.sender].ensName).length == 0, "Profile already exists");
        
        profiles[msg.sender] = Profile({
            ensName: _ensName,
            creditScore: 0,
            isVerified: false,
            totalBorrowed: 0,
            totalRepaid: 0
        });

        emit ProfileCreated(msg.sender, _ensName);
    }

    // --- 2. BACKEND ACTIONS: ELSA / BitGo Updates ---
    // Only the protocol (your backend) can verify users after they pass BitGo KYC
    function setVerification(address _user, bool _status) external onlyOwner {
        require(bytes(profiles[_user].ensName).length != 0, "User not registered");
        profiles[_user].isVerified = _status;
        
        emit VerificationStatusChanged(_user, _status);
    }

    // ELSA calls this after a loan is successfully paid back or forcefully liquidated
    function updateCreditScore(address _user, uint256 _newScore) external onlyOwner {
        require(bytes(profiles[_user].ensName).length != 0, "User not registered");
        profiles[_user].creditScore = _newScore;
        
        emit ScoreUpdated(_user, _newScore);
    }

    // Tracks volume to build trust over time
    function recordLoanActivity(address _user, uint256 _borrowed, uint256 _repaid) external onlyOwner {
        profiles[_user].totalBorrowed += _borrowed;
        profiles[_user].totalRepaid += _repaid;
    }
}