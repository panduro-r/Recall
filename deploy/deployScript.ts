import { readFileSync } from "node:fs";
import path from "node:path";
import type { DecodedDeployData, GenLayerChain, GenLayerClient, TransactionHash } from "genlayer-js/types";
import { TransactionStatus } from "genlayer-js/types";
import { localnet } from "genlayer-js/chains";

export default async function main(client: GenLayerClient<any>) {
  const contractCode = new Uint8Array(
    readFileSync(path.resolve(process.cwd(), "contracts/intent_latch.py")),
  );
  await client.initializeConsensusSmartContract();
  const hash = await client.deployContract({ code: contractCode, args: [] });
  const receipt = await client.waitForTransactionReceipt({
    hash: hash as TransactionHash,
    status: TransactionStatus.ACCEPTED,
    retries: 200,
  });
  const address =
    (client.chain as GenLayerChain).id === localnet.id
      ? receipt.data?.contract_address
      : (receipt.txDataDecoded as DecodedDeployData)?.contractAddress;
  if (!address) {
    throw new Error("Deployment receipt did not include a contract address");
  }
  console.log(`IntentLatch deployed at: ${address}`);
}
