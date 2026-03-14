import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

const TRECCSubnameRegistrarModule = buildModule("TRECCSubnameRegistrarModule", (m) => {
  const registrar = m.contract("TRECCSubnameRegistrar");
  return { registrar };
});

export default TRECCSubnameRegistrarModule;
