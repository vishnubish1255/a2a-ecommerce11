import { NextRequest, NextResponse } from "next/server";
import algosdk from "algosdk";
import { getClient } from "@/lib/blockchain/algorand";

export async function POST(req: NextRequest) {
  try {
    const { senderAddress, agentAddress, score } = await req.json();
    if (!senderAddress || !agentAddress || score === undefined) {
      return NextResponse.json({ error: "senderAddress, agentAddress, score required" }, { status: 400 });
    }
    if (score < 0 || score > 100) {
      return NextResponse.json({ error: "Score must be 0-100" }, { status: 400 });
    }

    const appId = process.env.REPUTATION_APP_ID;
    if (!appId) {
      return NextResponse.json({ error: "REPUTATION_APP_ID not configured" }, { status: 500 });
    }

    const algorand = getClient();
    const algod = algorand.client.algod;
    const params = await algod.getTransactionParams().do();

    const method = algosdk.ABIMethod.fromSignature("submitFeedback(account,uint64)void");
    const selector = new Uint8Array(method.getSelector());

    const agentCodec = algosdk.ABIType.from("address");
    const scoreCodec = algosdk.ABIType.from("uint64");

    const boxName = Buffer.concat([
      Buffer.from("a"),
      algosdk.decodeAddress(agentAddress).publicKey,
    ]);

    const txn = algosdk.makeApplicationCallTxnFromObject({
      sender: algosdk.Address.fromString(senderAddress),
      appIndex: BigInt(appId),
      appArgs: [
        selector,
        agentCodec.encode(agentAddress),
        scoreCodec.encode(BigInt(score)),
      ],
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
    const msg = error instanceof Error ? error.message : "Failed to build feedback txn";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
