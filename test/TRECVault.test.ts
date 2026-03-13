import { expect } from "chai";
import { ethers } from "hardhat";
import { loadFixture } from "@nomicfoundation/hardhat-toolbox/network-helpers";

describe("TRECVault Operations", function () {
  // We use a fixture to set up the clean state before every single test
  async function deployVaultFixture() {
    const [protocolOwner, rahul, sky, bitGoWallet] = await ethers.getSigners();

    // 1. Deploy our fake USDC
    const MockUSDC = await ethers.getContractFactory("MockUSDC");
    const usdc = await MockUSDC.deploy();

    // 2. Deploy the TREC Vault, pointing it to our fake USDC
    const TRECVault = await ethers.getContractFactory("TRECVault");
    const vault = await TRECVault.deploy(await usdc.getAddress());

    // 3. Give Rahul 1,000 USDC and approve the Vault to take it
    const depositAmount = ethers.parseUnits("1000", 6); // 1000 USDC (6 decimals)
    await usdc.mint(rahul.address, depositAmount);
    await usdc.connect(rahul).approve(await vault.getAddress(), depositAmount);

    return { vault, usdc, protocolOwner, rahul, sky, bitGoWallet, depositAmount };
  }

  it("Should let Rahul deposit his USDC into the Vault", async function () {
    const { vault, usdc, rahul, depositAmount } = await loadFixture(deployVaultFixture);

    // Rahul deposits
    await vault.connect(rahul).depositLiquidity(depositAmount);

    // Check that the Vault now has the money
    expect(await vault.totalPoolLiquidity()).to.equal(depositAmount);
    expect(await usdc.balanceOf(await vault.getAddress())).to.equal(depositAmount);
  });

  it("Should let Sky stake his safety bond in ETH", async function () {
    const { vault, sky } = await loadFixture(deployVaultFixture);

    const bondAmount = ethers.parseEther("0.05"); // About $100 in ETH

    // Sky sends his ETH bond
    await vault.connect(sky).stakeBond({ value: bondAmount });

    // Check that Sky's bond is recorded
    expect(await vault.borrowerBonds(sky.address)).to.equal(bondAmount);
  });

  it("Should lock the loan inside the BitGo wallet, not give it to Sky", async function () {
    const { vault, usdc, protocolOwner, rahul, sky, bitGoWallet, depositAmount } = await loadFixture(deployVaultFixture);

    // Setup: Rahul deposits, Sky bonds
    await vault.connect(rahul).depositLiquidity(depositAmount);
    await vault.connect(sky).stakeBond({ value: ethers.parseEther("0.05") });

    // Protocol issues the loan to the locked BitGo wallet
    await vault.connect(protocolOwner).issueLoan(sky.address, bitGoWallet.address, depositAmount);

    // The BitGo wallet should have the money, NOT Sky
    expect(await usdc.balanceOf(bitGoWallet.address)).to.equal(depositAmount);
    expect(await usdc.balanceOf(sky.address)).to.equal(0);
  });

  it("Should slash Sky's bond if the trade crashes", async function () {
    const { vault, protocolOwner, rahul, sky, bitGoWallet, depositAmount } = await loadFixture(deployVaultFixture);

    // Setup: Deposits and Loans
    await vault.connect(rahul).depositLiquidity(depositAmount);
    const bondAmount = ethers.parseEther("0.05");
    await vault.connect(sky).stakeBond({ value: bondAmount });
    await vault.connect(protocolOwner).issueLoan(sky.address, bitGoWallet.address, depositAmount);

    // Uh oh, trade crashed. We lost a little bit of money.
    // The protocol slashes Sky's bond to cover the $20 shortfall.
    const shortfall = ethers.parseEther("0.01"); // Fake shortfall amount
    await vault.connect(protocolOwner).slashAndRecover(sky.address, depositAmount, shortfall);

    // Sky's bond should be reduced
    const remainingBond = await vault.borrowerBonds(sky.address);
    expect(remainingBond).to.equal(bondAmount - shortfall);
    
    // The active loan should be cleared out
    expect(await vault.activeLoans(sky.address)).to.equal(0);
  });
});