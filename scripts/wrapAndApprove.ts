/**
 * One-time setup script for trecc.eth subname registration.
 * 
 * Does three things in sequence:
 *   1. Approves the ENS Name Wrapper on the Base Registrar (.eth ERC-721)
 *   2. Wraps trecc.eth in the Name Wrapper (makes subname creation possible)
 *   3. Approves the TRECCSubnameRegistrar as an operator on the Name Wrapper
 *
 * IMPORTANT: DEPLOYER_PRIVATE_KEY in .env must be the wallet that owns trecc.eth
 * (the ENS Registry owner — 0xA74164...C102b is the WRONG wallet, use trecc.eth owner).
 *
 * Run:
 *   npx hardhat run scripts/wrapAndApprove.ts --network sepolia
 */

import { ethers } from "hardhat";

// ENS Sepolia contract addresses
const BASE_REGISTRAR     = "0x57f1887a8BF19b14fC0dF6Fd9B2acc9Af147eA85"; // .eth ERC-721
const NAME_WRAPPER       = "0x0635513f179D50A207757E05759CbD106d7dFcE8";
const PUBLIC_RESOLVER    = "0xE99638b40E4Fff0129D56f03b55b6bbC4BBE49b5";

const BASE_REGISTRAR_ABI = [
  "function ownerOf(uint256 tokenId) external view returns (address)",
  "function setApprovalForAll(address operator, bool approved) external",
  "function isApprovedForAll(address owner, address operator) external view returns (bool)",
];

const NAME_WRAPPER_ABI = [
  "function ownerOf(uint256 tokenId) external view returns (address)",
  "function setApprovalForAll(address operator, bool approved) external",
  "function isApprovedForAll(address account, address operator) external view returns (bool)",
  "function wrapETH2LD(string calldata label, address wrappedOwner, uint16 ownerControlledFuses, address resolver) external returns (uint64 expiry)",
];

async function main() {
  const registrarAddress = process.env.TRECC_REGISTRAR_ADDRESS;
  if (!registrarAddress || !registrarAddress.startsWith("0x")) {
    throw new Error("Set TRECC_REGISTRAR_ADDRESS in .env first.");
  }

  const [signer] = await ethers.getSigners();
  console.log("Wallet:", signer.address);

  const baseRegistrar = new ethers.Contract(BASE_REGISTRAR, BASE_REGISTRAR_ABI, signer);
  const nameWrapper   = new ethers.Contract(NAME_WRAPPER, NAME_WRAPPER_ABI, signer);

  // 1. Check we own trecc.eth (Base Registrar ERC-721)
  // tokenId = uint256(keccak256("trecc"))
  const labelHash = ethers.keccak256(ethers.toUtf8Bytes("trecc"));
  const tokenId   = BigInt(labelHash);

  let erc721Owner: string;
  try {
    erc721Owner = await baseRegistrar.ownerOf(tokenId);
    console.log("Base Registrar owner of trecc.eth:", erc721Owner);
  } catch {
    throw new Error(
      "trecc.eth doesn't exist in the Base Registrar. Register it first at app.ens.domains (Sepolia)."
    );
  }

  if (erc721Owner.toLowerCase() !== signer.address.toLowerCase()) {
    throw new Error(
      `Wrong wallet! Connected wallet ${signer.address} does NOT own trecc.eth.\n` +
      `Owner is: ${erc721Owner}\n` +
      `Update DEPLOYER_PRIVATE_KEY in .env to match the trecc.eth owner wallet.`
    );
  }

  // 2. Check if already wrapped
  const treccNode   = "0xb7de80fcb6135fa4fc7e65dd78473942b8d9abe58f147a4a79d02e34266f1194";
  const nwTokenId   = BigInt(treccNode);
  let nwOwner: string;
  try {
    nwOwner = await nameWrapper.ownerOf(nwTokenId);
  } catch {
    nwOwner = ethers.ZeroAddress;
  }

  const isWrapped = nwOwner !== ethers.ZeroAddress && nwOwner.toLowerCase() !== ethers.ZeroAddress.toLowerCase();

  if (!isWrapped) {
    // Step 1: Approve Name Wrapper on Base Registrar
    const alreadyApproved = await baseRegistrar.isApprovedForAll(signer.address, NAME_WRAPPER);
    if (!alreadyApproved) {
      console.log("\n[1/3] Approving Name Wrapper on Base Registrar...");
      const tx = await baseRegistrar.setApprovalForAll(NAME_WRAPPER, true);
      console.log("  Tx sent:", tx.hash);
      await tx.wait();
      console.log("  ✅ Approved.");
    } else {
      console.log("\n[1/3] Name Wrapper already approved on Base Registrar. Skipping.");
    }

    // Step 2: Wrap trecc.eth
    console.log("\n[2/3] Wrapping trecc.eth in the Name Wrapper...");
    const tx = await nameWrapper.wrapETH2LD(
      "trecc",          // label (without .eth)
      signer.address,   // wrapped owner
      0,                // ownerControlledFuses (0 = no restrictions)
      PUBLIC_RESOLVER
    );
    console.log("  Tx sent:", tx.hash);
    await tx.wait();
    console.log("  ✅ trecc.eth is now wrapped!");
  } else {
    console.log("\n[1-2/3] trecc.eth is already wrapped (owner:", nwOwner, "). Skipping wrap steps.");

    if (nwOwner.toLowerCase() !== signer.address.toLowerCase()) {
      throw new Error(
        `trecc.eth is wrapped but owned by ${nwOwner}, not your wallet ${signer.address}.\n` +
        `Transfer the wrapped name to your wallet first, or use the correct private key.`
      );
    }
  }

  // Step 3: Approve the subname registrar
  const isRegistrarApproved = await nameWrapper.isApprovedForAll(signer.address, registrarAddress);
  if (!isRegistrarApproved) {
    console.log("\n[3/3] Approving subname registrar on Name Wrapper...");
    const tx = await nameWrapper.setApprovalForAll(registrarAddress, true);
    console.log("  Tx sent:", tx.hash);
    await tx.wait();
    console.log("  ✅ Registrar approved!");
  } else {
    console.log("\n[3/3] Registrar already approved on Name Wrapper. Skipping.");
  }

  console.log("\n🎉 All done! Users can now claim *.trecc.eth subnames.");
  console.log(`   Registrar: ${registrarAddress}`);
  console.log(`   Don't forget: add NEXT_PUBLIC_TRECC_ENS_REGISTRAR=${registrarAddress} to your frontend .env`);
}

main().catch((err) => {
  console.error("\n❌", err.message);
  process.exit(1);
});
