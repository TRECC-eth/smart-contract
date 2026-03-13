import { expect } from "chai";
import hre from "hardhat";
const { ethers } = hre;

describe("TRECRegistry (Identity NFT)", function () {
  async function deployRegistryFixture() {
    const [owner, sky, rando, bitgoValidator] = await ethers.getSigners();

    const TRECRegistry = await ethers.getContractFactory("TRECRegistry");
    const registry = await TRECRegistry.deploy(bitgoValidator.address);

    return { registry, owner, sky, rando, bitgoValidator };
  }

  it("Should let Sky register and mint his Agent NFT", async function () {
    const { registry, sky } = await deployRegistryFixture();

    await registry.connect(sky).registerAgent("sky.eth");
    
    expect(await registry.balanceOf(sky.address)).to.equal(1);
    const profile = await registry.agentProfiles(1);
    expect(profile.ensName).to.equal("sky.eth");
  });

  it("Should FAIL if Sky tries to sell/transfer his credit score (Soulbound)", async function () {
    const { registry, sky, rando } = await deployRegistryFixture();

    await registry.connect(sky).registerAgent("sky.eth");

    // Sky tries to send his NFT (ID #1) to Rando
    await expect(
      registry.connect(sky).transferFrom(sky.address, rando.address, 1)
    ).to.be.revertedWith("TREC Identity is Soulbound and cannot be sold!");
  });
});