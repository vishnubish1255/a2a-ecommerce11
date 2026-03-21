import { NextRequest, NextResponse } from "next/server";
import algosdk from "algosdk";
import { getClient } from "@/lib/blockchain/algorand";

export async function POST(req: NextRequest) {
  try {
    const { senderAddress } = await req.json();
    if (!senderAddress) {
      return NextResponse.json({ error: "senderAddress required" }, { status: 400 });
    }

    const appId = process.env.REPUTATION_APP_ID;
    if (!appId) {
      return NextResponse.json({ error: "REPUTATION_APP_ID not configured" }, { status: 500 });
    }

    const algorand = getClient();
    const algod = algorand.client.algod;
    const params = await algod.getTransactionParams().do();

    const selector = new Uint8Array(
      algosdk.ABIMethod.fromSignature("registerAgent()void").getSelector()
    );

    const boxName = Buffer.concat([
      Buffer.from("a"),
      algosdk.decodeAddress(senderAddress).publicKey,
    ]);

    const txn = algosdk.makeApplicationCallTxnFromObject({
      sender: algosdk.Address.fromString(senderAddress),
      appIndex: BigInt(appId),
      appArgs: [selector],
      boxes: [{ appIndex: BigInt(appId), name: boxName }],
      onComplete: algosdk.OnApplicationComplete.NoOpOC,
      suggestedParams: params,
    });

    const unsignedTxnB64 = Buffer.from(algosdk.encodeUnsignedTransaction(txn)).toString("base64");

    return NextResponse.json({
      unsignedTxn: unsignedTxnB64,
      txnId: txn.txID(),
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Failed to build register txn";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
