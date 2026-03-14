/**
 * Approves the deployed TRECCSubnameRegistrar on the ENS Name Wrapper.
 *
 * Run AFTER deploying the registrar:
 *   npx hardhat run scripts/approveRegistrar.ts --network sepolia
 *
 * The DEPLOYER_PRIVATE_KEY in .env must belong to the owner of trecc.eth.
 */

import { ethers } from "hardhat";

const NAME_WRAPPER_ADDRESS = "0x0635513f179D50A207757E05759CbD106d7dFcE8";
const NAME_WRAPPER_ABI = [
  "function setApprovalForAll(address operator, bool approved) external",
  "function isApprovedForAll(address account, address operator) external view returns (bool)",
];

async function main() {
  const registrarAddress = process.env.TRECC_REGISTRAR_ADDRESS;
  if (!registrarAddress || !registrarAddress.startsWith("0x")) {
    throw new Error(
      "Set TRECC_REGISTRAR_ADDRESS=0x<deployed address> in your .env first."
    );
  }

  const [signer] = await ethers.getSigners();
  console.log("Signing from:", signer.address);

  const nameWrapper = new ethers.Contract(
    NAME_WRAPPER_ADDRESS,
    NAME_WRAPPER_ABI,
    signer
  );

  const alreadyApproved = await nameWrapper.isApprovedForAll(
    signer.address,
    registrarAddress
  );
  if (alreadyApproved) {
    console.log("✅ Registrar is already approved — nothing to do.");
    return;
  }

  console.log(`Approving registrar ${registrarAddress} on Name Wrapper…`);
  const tx = await nameWrapper.setApprovalForAll(registrarAddress, true);
  console.log("Tx sent:", tx.hash);
  await tx.wait();
  console.log("✅ Approval confirmed. Users can now claim *.trecc.eth subnames.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
