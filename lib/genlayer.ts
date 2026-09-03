'use client';

type EthereumProvider = {
  request(args: { method: string; params?: unknown[] }): Promise<unknown>;
};

declare global {
  interface Window {
    ethereum?: EthereumProvider;
  }
}

const deployedContract = '0x692cb9D71acC57C07a72D173aa8a0CDaEc41b6b7';

export const contractAddress =
  process.env.NEXT_PUBLIC_CONTRACT_ADDRESS?.trim() || deployedContract;
export const isContractConfigured = /^0x[0-9a-fA-F]{40}$/.test(contractAddress);
const chainId = Number(process.env.NEXT_PUBLIC_GENLAYER_CHAIN_ID ?? '61999');
const rpcUrl =
  process.env.NEXT_PUBLIC_GENLAYER_RPC_URL ?? 'https://studio.genlayer.com/api';

function objectFromMap(value: unknown): unknown {
  if (value instanceof Map) {
    return Object.fromEntries(
      Array.from(value.entries()).map(([key, child]) => [
        String(key),
        objectFromMap(child),
      ]),
    );
  }
  if (Array.isArray(value)) return value.map(objectFromMap);
  return value;
}

export async function getConnectedAccount(): Promise<string | null> {
  if (typeof window === 'undefined' || !window.ethereum) return null;
  const accounts = (await window.ethereum.request({
    method: 'eth_accounts',
  })) as string[];
  return accounts[0] ?? null;
}

export async function connectWallet(): Promise<string> {
  if (!window.ethereum)
    throw new Error('A compatible wallet extension is required.');
  const accounts = (await window.ethereum.request({
    method: 'eth_requestAccounts',
  })) as string[];
  if (!accounts[0]) throw new Error('No wallet account was selected.');

  const expectedChain = `0x${chainId.toString(16)}`;
  try {
    await window.ethereum.request({
      method: 'wallet_switchEthereumChain',
      params: [{ chainId: expectedChain }],
    });
  } catch (error) {
    const code = (error as { code?: number }).code;
    if (code !== 4902) throw error;
    await window.ethereum.request({
      method: 'wallet_addEthereumChain',
      params: [
        {
          chainId: expectedChain,
          chainName:
            process.env.NEXT_PUBLIC_GENLAYER_CHAIN_NAME ?? 'GenLayer Studio',
          nativeCurrency: { name: 'GEN', symbol: 'GEN', decimals: 18 },
          rpcUrls: [rpcUrl],
          blockExplorerUrls: [],
        },
      ],
    });
  }
  return accounts[0];
}

async function clientFor(account: string) {
  const [{ createClient }, { studionet }] = await Promise.all([
    import('genlayer-js'),
    import('genlayer-js/chains'),
  ]);
  return createClient({
    chain: studionet,
    account: account as `0x${string}`,
    endpoint: rpcUrl,
  } as never);
}

async function waitForAccepted(
  client: Awaited<ReturnType<typeof clientFor>>,
  hash: unknown,
) {
  return client.waitForTransactionReceipt({
    hash: hash as never,
    status: 'ACCEPTED' as never,
    retries: 36,
    interval: 5000,
  });
}

export async function saveMandate(
  account: string,
  mandateId: string,
  mandate: string,
) {
  if (!isContractConfigured)
    throw new Error('Contract address is not configured.');
  const client = await clientFor(account);
  const hash = await client.writeContract({
    address: contractAddress as `0x${string}`,
    functionName: 'register_mandate',
    args: [mandateId, mandate],
    value: BigInt(0),
  });
  await waitForAccepted(client, hash);
}

export type PaymentRecord = {
  decision: {
    verdict: 'APPROVE' | 'REJECT' | 'MANUAL_REVIEW';
    reason_code: string;
    matched_rule: string;
    explanation: string;
  };
  execution: {
    status: 'READY' | 'WITHHELD' | 'SCHEDULED';
    recipient: string;
    amount_wei: string;
  };
};

export async function authorizePayment(
  account: string,
  mandateId: string,
  requestId: string,
  action: Record<string, unknown>,
) {
  if (!isContractConfigured)
    throw new Error('Contract address is not configured.');
  const client = await clientFor(account);
  const hash = await client.writeContract({
    address: contractAddress as `0x${string}`,
    functionName: 'authorize_payment',
    args: [mandateId, requestId, JSON.stringify(action)],
    value: BigInt(0),
  });
  await waitForAccepted(client, hash);
  const record = await client.readContract({
    address: contractAddress as `0x${string}`,
    functionName: 'get_decision',
    args: [requestId],
  });
  return objectFromMap(record) as PaymentRecord;
}

export async function executePayment(
  account: string,
  requestId: string,
  amountWei: bigint,
) {
  if (!isContractConfigured)
    throw new Error('Contract address is not configured.');
  const client = await clientFor(account);
  const hash = await client.writeContract({
    address: contractAddress as `0x${string}`,
    functionName: 'execute_payment',
    args: [requestId],
    value: amountWei,
  });
  await waitForAccepted(client, hash);
  const record = await client.readContract({
    address: contractAddress as `0x${string}`,
    functionName: 'get_decision',
    args: [requestId],
  });
  return objectFromMap(record) as PaymentRecord;
}
