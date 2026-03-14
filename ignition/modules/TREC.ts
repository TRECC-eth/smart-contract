import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

export default buildModule("TRECProtocolModule", (m) => {
  const deployer = m.getAccount(0);

  // 1. Deploy Mock USDC first
  const mockUSDC = m.contract("MockUSDC");

  // 2. Deploy Registry SECOND (Notice the 'after' property)
  const trecRegistry = m.contract("TRECRegistry", [deployer], {
    after: [mockUSDC]
  });

  // 3. Deploy Vault LAST
  // If your vault needs both USDC and Registry, use: [mockUSDC, trecRegistry]
  const trecVault = m.contract("TRECVault", [trecRegistry], {
    after: [trecRegistry]
  });

  return { mockUSDC, trecRegistry, trecVault };
});