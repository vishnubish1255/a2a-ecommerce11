import { x402Client } from "@x402-avm/core/client";
import { registerExactAvmScheme } from "@x402-avm/avm/exact/client";
import { wrapFetchWithPayment } from "@x402-avm/fetch";
import type { ClientAvmSigner } from "@x402-avm/avm";
import algosdk from "algosdk";

export function createAvmSigner(base64PrivateKey: string): ClientAvmSigner {
  const secretKey = Buffer.from(base64PrivateKey, "base64");
  const address = algosdk.encodeAddress(secretKey.slice(32));

  return {
    address,
    signTransactions: async (
      txns: Uint8Array[],
      indexesToSign?: number[]
    ): Promise<(Uint8Array | null)[]> => {
      return txns.map((txn, i) => {
        if (indexesToSign && !indexesToSign.includes(i)) return null;
        const decoded = algosdk.decodeUnsignedTransaction(txn);
        const signed = algosdk.signTransaction(decoded, secretKey);
        return signed.blob;
      });
    },
  };
}

export function createX402Client(signer: ClientAvmSigner): x402Client {
  const client = new x402Client();
  registerExactAvmScheme(client, { signer });
  return client;
}

export function createPaymentFetch(signer: ClientAvmSigner): typeof fetch {
  const client = createX402Client(signer);
  return wrapFetchWithPayment(fetch, client);
}

export function createPaymentFetchFromKey(
  base64PrivateKey: string
): typeof fetch {
  const signer = createAvmSigner(base64PrivateKey);
  return createPaymentFetch(signer);
}
