import { type Address, type EIP1193Provider } from 'viem';
import { GIWA_PERMIT2, GIWA_DEX_ROUTER } from '../contracts';

export interface Permit2Data {
  token: Address;
  amount: bigint;
  nonce: bigint;
  deadline: bigint;
  spender: Address;
  signature: `0x${string}`;
}

export const PERMIT2_DOMAIN = {
  name: 'Permit2',
  chainId: 91342,
  verifyingContract: GIWA_PERMIT2,
};

export const PERMIT2_TYPES = {
  PermitTransferFrom: [
    { name: 'permitted', type: 'TokenPermissions' },
    { name: 'spender', type: 'address' },
    { name: 'nonce', type: 'uint256' },
    { name: 'deadline', type: 'uint256' },
  ],
  TokenPermissions: [
    { name: 'token', type: 'address' },
    { name: 'amount', type: 'uint256' },
  ],
};

/**
 * Generates an EIP-712 Permit2 single-signature payload for gasless batch swap authorization
 */
export async function signPermit2Approval(
  provider: EIP1193Provider,
  userAddress: Address,
  tokenAddress: Address,
  amount: bigint
): Promise<Permit2Data> {
  const nonce = BigInt(Math.floor(Date.now() / 1000) * 1000 + Math.floor(Math.random() * 1000));
  const deadline = BigInt(Math.floor(Date.now() / 1000) + 3600); // 1 hour validity

  const message = {
    permitted: {
      token: tokenAddress,
      amount: amount.toString(),
    },
    spender: GIWA_DEX_ROUTER,
    nonce: nonce.toString(),
    deadline: deadline.toString(),
  };

  const typedData = {
    types: {
      EIP712Domain: [
        { name: 'name', type: 'string' },
        { name: 'chainId', type: 'uint256' },
        { name: 'verifyingContract', type: 'address' },
      ],
      ...PERMIT2_TYPES,
    },
    primaryType: 'PermitTransferFrom',
    domain: PERMIT2_DOMAIN,
    message,
  };

  // Provider rejection and failures propagate; never fabricate signatures.
  const signature = (await provider.request({
      method: 'eth_signTypedData_v4',
      params: [userAddress, JSON.stringify(typedData)],
    })) as `0x${string}`;

  return {
      token: tokenAddress,
      amount,
      nonce,
      deadline,
      spender: GIWA_DEX_ROUTER,
      signature,
  };
}
