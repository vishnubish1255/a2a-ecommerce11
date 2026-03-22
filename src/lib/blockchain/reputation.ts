/**
 * Server-side reputation helpers.
 *
 * These functions sign transactions with in-memory keys (seller keys or the
 * buyer/system key) — only used during init / post-execute automation.
 * All user-initiated reputation calls (register, feedback) still go through the
 * wallet-signing flow (unsigned txn → frontend → signed txn → /api/wallet/submit).
 */

import algosdk from "algosdk";
import { getClient, getSellerKeys, SELLER_INITIAL_REPUTATIONS } from "./algorand";

const APP_ID_ENV = () => {
  const id = process.env.REPUTATION_APP_ID;
  if (!id) throw new Error("REPUTATION_APP_ID not configured");
  return BigInt(id);
};

function boxNameFor(address: string): Uint8Array {
  return Buffer.concat([
    Buffer.from("a"),
    algosdk.decodeAddress(address).publicKey,
  ]);
}

async function isRegistered(address: string): Promise<boolean> {
  try {
    const algod = getClient().client.algod;
    await algod.getApplicationBoxByName(APP_ID_ENV(), boxNameFor(address)).do();
    return true;
  } catch {
    return false;
  }
}

/** Register a single seller agent on-chain using their stored keypair. */
async function registerAgent(sellerName: string): Promise<string | null> {
  const keys = getSellerKeys();
  if (!keys?.[sellerName]) return null;

  const { sk, addr } = keys[sellerName];
  const appId = APP_ID_ENV();
  const algod = getClient().client.algod;
  const params = await algod.getTransactionParams().do();

  const selector = new Uint8Array(
    algosdk.ABIMethod.fromSignature("registerAgent()void").getSelector()
  );

  const txn = algosdk.makeApplicationCallTxnFromObject({
    sender: algosdk.Address.fromString(addr),
    appIndex: appId,
    appArgs: [selector],
    boxes: [{ appIndex: appId, name: boxNameFor(addr) }],
    onComplete: algosdk.OnApplicationComplete.NoOpOC,
    suggestedParams: params,
  });

  const signed = txn.signTxn(sk);
  const { txid } = await algod.sendRawTransaction(signed).do();
  await algosdk.waitForConfirmation(algod, txid, 4);
  return txid;
}

/** Submit feedback for a seller using the buyer/system key. */
async function submitFeedback(
  fromAddress: string,
  fromSk: Uint8Array,
  agentAddress: string,
  score: number
): Promise<string | null> {
  const appId = APP_ID_ENV();
  const algod = getClient().client.algod;
  const params = await algod.getTransactionParams().do();

  // Contract uses (address,uint64) — address = 32-byte ABI-encoded public key
  const selector = new Uint8Array(
    algosdk.ABIMethod.fromSignature("submitFeedback(address,uint64)void").getSelector()
  );

  const txn = algosdk.makeApplicationCallTxnFromObject({
    sender: algosdk.Address.fromString(fromAddress),
    appIndex: appId,
    appArgs: [
      selector,
      algosdk.ABIType.from("address").encode(agentAddress),
      algosdk.ABIType.from("uint64").encode(BigInt(score)),
    ],
    boxes: [{ appIndex: appId, name: boxNameFor(agentAddress) }],
    onComplete: algosdk.OnApplicationComplete.NoOpOC,
    suggestedParams: params,
  });

  const signed = txn.signTxn(fromSk);
  const { txid } = await algod.sendRawTransaction(signed).do();
  await algosdk.waitForConfirmation(algod, txid, 4);
  return txid;
}

export interface ReputationSeedResult {
  seller: string;
  address: string;
  score: number;
  registerTxId: string | null;
  feedbackTxId: string | null;
  alreadyRegistered: boolean;
}

/**
 * Seed all seller agents with initial reputation scores.
 * Called once during /api/init. Skips sellers already registered.
 *
 * @param buyerAddr   The system/buyer address that signs the feedback txns.
 * @param buyerSk     The buyer's secret key (in-memory, set during initAccounts).
 */
export async function seedAgentReputations(
  buyerAddr: string,
  buyerSk: Uint8Array
): Promise<ReputationSeedResult[]> {
  const keys = getSellerKeys();
  if (!keys) throw new Error("Seller keys not in memory — call initAccounts first");

  const results: ReputationSeedResult[] = [];

  for (const [name, initialScore] of Object.entries(SELLER_INITIAL_REPUTATIONS)) {
    const sellerKey = keys[name];
    if (!sellerKey) continue;

    const { addr } = sellerKey;
    const alreadyRegistered = await isRegistered(addr);

    let registerTxId: string | null = null;
    let feedbackTxId: string | null = null;

    try {
      if (!alreadyRegistered) {
        registerTxId = await registerAgent(name);
      }

      // Always submit the initial score — even if registered (re-seeds on new init)
      feedbackTxId = await submitFeedback(buyerAddr, buyerSk, addr, initialScore);

      results.push({ seller: name, address: addr, score: initialScore, registerTxId, feedbackTxId, alreadyRegistered });
    } catch (err) {
      // Don't abort the whole init if one seller fails
      results.push({
        seller: name, address: addr, score: initialScore,
        registerTxId, feedbackTxId: null,
        alreadyRegistered,
      });
      console.error(`[reputation] Failed to seed ${name}:`, err);
    }
  }

  return results;
}

/**
 * Submit a server-side reputation update for a seller after a completed deal.
 * score > 50 = positive reinforcement, score < 50 = penalty.
 */
export async function autoUpdateReputation(
  buyerAddr: string,
  buyerSk: Uint8Array,
  sellerAddress: string,
  score: number
): Promise<string | null> {
  if (!(await isRegistered(sellerAddress))) return null;
  return submitFeedback(buyerAddr, buyerSk, sellerAddress, score);
}
