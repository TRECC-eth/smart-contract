// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract TRECVault is Ownable {
    IERC20 public usdcToken;

    // --- State Variables ---
    // Tracking Lender's money (The Lenders)
    mapping(address => uint256) public lenderDeposits;
    uint256 public totalPoolLiquidity;

    // Tracking Staker's money (The Borrowers)
    mapping(address => uint256) public borrowerBonds;
    mapping(address => uint256) public activeLoans;

    // Events so our ELSA backend knows when things happen
    event Deposited(address indexed lender, uint256 amount);
    event BondStaked(address indexed borrower, uint256 amount);
    event LoanIssued(address indexed borrower, address indexed bitGoWallet, uint256 amount);
    event Liquidated(address indexed borrower, uint256 slashedAmount);

    constructor(address _usdcAddress) Ownable(msg.sender) {
        usdcToken = IERC20(_usdcAddress);
    }

    // Lender deposits his USDC into the global pool
    function depositLiquidity(uint256 _amount) external {
        require(_amount > 0, "Deposit must be greater than zero");
        
        // Move USDC from Lender to this Vault
        require(usdcToken.transferFrom(msg.sender, address(this), _amount), "Transfer failed");
        
        lenderDeposits[msg.sender] += _amount;
        totalPoolLiquidity += _amount;
        
        emit Deposited(msg.sender, _amount);
    }

    // --- 2. BORROWER FLOW (Staker) ---
    // Staker deposits ETH as his "Safety Bond" to unlock credit
    function stakeBond() external payable {
        require(msg.value > 0, "Must stake some ETH");
        borrowerBonds[msg.sender] += msg.value;
        
        emit BondStaked(msg.sender, msg.value);
    }

    // The backend (ELSA) triggers this once BitGo & Identity checks pass
    function issueLoan(address _borrower, address _bitGoWallet, uint256 _loanAmount) external onlyOwner {
        require(borrowerBonds[_borrower] > 0, "Borrower has no safety bond");
        require(totalPoolLiquidity >= _loanAmount, "Not enough USDC in the pool");
        
        // Update states
        activeLoans[_borrower] += _loanAmount;
        totalPoolLiquidity -= _loanAmount;

        // Send the USDC to the locked BitGo MPC wallet, NOT the borrower's personal wallet
        require(usdcToken.transfer(_bitGoWallet, _loanAmount), "Loan transfer failed");
        
        emit LoanIssued(_borrower, _bitGoWallet, _loanAmount);
    }

    // --- 3. THE EMERGENCY BRAKE ---
    // If the trade goes bad, the backend hits this to recover funds and slash the bond
    function slashAndRecover(address _borrower, uint256 _recoveredUSDC, uint256 _shortfallAmount) external onlyOwner {
        require(activeLoans[_borrower] > 0, "No active loan to liquidate");
        
        // Take the shortfall from the borrower's ETH bond (simplification for hackathon)
        // In reality, we'd swap the ETH bond to USDC to make Lender whole.
        borrowerBonds[_borrower] -= _shortfallAmount; 
        
        // Clear the loan
        activeLoans[_borrower] = 0;
        
        emit Liquidated(_borrower, _shortfallAmount);
    }
}