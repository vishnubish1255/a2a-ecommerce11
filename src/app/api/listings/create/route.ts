import { NextRequest, NextResponse } from "next/server";
import algosdk from "algosdk";
import { createHash, randomBytes } from "crypto";
import { getClient } from "@/lib/blockchain/algorand";

export async function POST(req: NextRequest) {
  try {
    const { senderAddress, type, service, price, description } = await req.json();

    if (!senderAddress || !type || !service || !price) {
      return NextResponse.json(
        { error: "senderAddress, type, service, price required" },
        { status: 400 }
      );
    }

    const secret = randomBytes(32).toString("hex");
    const preimage = `${secret}|${senderAddress}|${price}|${description ?? ""}`;
    const commitment = createHash("sha256").update(preimage).digest("hex");

    const noteData = {
      type,
      service,
      price,
      seller: senderAddress,
      description: description ?? "",
      timestamp: Date.now(),
      zkCommitment: commitment,
    };
    const noteStr = "a2a-listing:" + JSON.stringify(noteData);

    const algorand = getClient();
    const algod = algorand.client.algod;
    const params = await algod.getTransactionParams().do();

    const txn = algosdk.makePaymentTxnWithSuggestedParamsFromObject({
      sender: algosdk.Address.fromString(senderAddress),
      receiver: algosdk.Address.fromString(senderAddress),
      amount: 0,
      note: new TextEncoder().encode(noteStr),
      suggestedParams: params,
    });

    const unsignedTxnB64 = Buffer.from(algosdk.encodeUnsignedTransaction(txn)).toString("base64");

    return NextResponse.json({
      unsignedTxn: unsignedTxnB64,
      txnId: txn.txID(),
      zkSecret: secret,
      zkCommitment: commitment,
      listing: noteData,
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Failed to build listing txn";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
