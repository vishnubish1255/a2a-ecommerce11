import { NextRequest, NextResponse } from "next/server";
import algosdk from "algosdk";
import { getClient } from "@/lib/blockchain/algorand";

export async function POST(req: NextRequest) {
  try {
    const { senderAddress, receiverAddress, amountAlgo, note } = await req.json();

    if (!senderAddress || !receiverAddress || !amountAlgo) {
      return NextResponse.json(
        { error: "senderAddress, receiverAddress, amountAlgo required" },
        { status: 400 }
      );
    }

    const algorand = getClient();
    const algod = algorand.client.algod;
    const params = await algod.getTransactionParams().do();

    const txn = algosdk.makePaymentTxnWithSuggestedParamsFromObject({
      sender: algosdk.Address.fromString(senderAddress),
      receiver: algosdk.Address.fromString(receiverAddress),
      amount: algosdk.algosToMicroalgos(amountAlgo),
      note: note ? new TextEncoder().encode(note) : undefined,
      suggestedParams: params,
    });

    const unsignedTxnB64 = Buffer.from(algosdk.encodeUnsignedTransaction(txn)).toString("base64");

    return NextResponse.json({
      unsignedTxn: unsignedTxnB64,
      txnId: txn.txID(),
      details: {
        sender: senderAddress,
        receiver: receiverAddress,
        amount: amountAlgo,
        fee: Number(txn.fee) / 1e6,
      },
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Failed to build payment txn";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
