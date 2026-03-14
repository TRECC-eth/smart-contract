// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;

/**
 * TRECCSubnameRegistrar — open, free registrar for *.trecc.eth subnames on Sepolia.
 *
 * DEPLOY STEPS (owner of trecc.eth must do this):
 * 1. Deploy this contract on Sepolia.
 * 2. Call nameWrapper.setApprovalForAll(<this contract address>, true)
 *    from the wallet that owns trecc.eth on the Name Wrapper.
 * 3. Set NEXT_PUBLIC_TRECC_ENS_REGISTRAR=<this contract address> in your .env.
 *
 * Name Wrapper (Sepolia): 0x0635513f179D50A207757E05759CbD106d7dFcE8
 * Public Resolver (Sepolia): 0xE99638b40E4Fff0129D56f03b55b6bbC4BBE49b5
 * trecc.eth namehash: 0xb7de80fcb6135fa4fc7e65dd78473942b8d9abe58f147a4a79d02e34266f1194
 */

interface INameWrapper {
    function setSubnodeRecord(
        bytes32 parentNode,
        string calldata label,
        address owner,
        address resolver,
        uint64 ttl,
        uint32 fuses,
        uint64 expiry
    ) external returns (bytes32 node);
}

contract TRECCSubnameRegistrar {
    INameWrapper public constant NAME_WRAPPER =
        INameWrapper(0x0635513f179D50A207757E05759CbD106d7dFcE8);

    bytes32 public constant TRECC_NODE =
        0xb7de80fcb6135fa4fc7e65dd78473942b8d9abe58f147a4a79d02e34266f1194;

    address public constant RESOLVER =
        0xE99638b40E4Fff0129D56f03b55b6bbC4BBE49b5;

    /** Track claimed labels so each subname can only be registered once. */
    mapping(bytes32 => bool) public claimed;

    event SubnameRegistered(string label, address indexed owner, bytes32 node);

    /**
     * Register label.trecc.eth to msg.sender.
     * @param parentNode Must equal TRECC_NODE (prevents misuse).
     * @param label      The subname label (e.g. "rahul" → rahul.trecc.eth).
     */
    function register(bytes32 parentNode, string calldata label) external {
        require(parentNode == TRECC_NODE, "wrong parent");
        require(bytes(label).length > 0, "empty label");

        bytes32 labelHash = keccak256(bytes(label));
        require(!claimed[labelHash], "already claimed");
        claimed[labelHash] = true;

        bytes32 node = NAME_WRAPPER.setSubnodeRecord(
            TRECC_NODE,
            label,
            msg.sender,
            RESOLVER,
            0,    // ttl
            0,    // no fuses — keeps subname simple and revocable by parent if needed
            type(uint64).max
        );

        emit SubnameRegistered(label, msg.sender, node);
    }
}
