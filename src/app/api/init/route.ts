import { NextResponse } from "next/server";
import { initAccounts } from "@/lib/blockchain/algorand";
import { postListingsOnChain } from "@/lib/blockchain/listings";
import { createAction } from "@/lib/a2a/messaging";

export async function POST() {
  try {
    const actions = [
      createAction("system", "Algorand", "transaction", "Connecting to Algorand LocalNet..."),
    ];

    const accounts = await initAccounts();
    actions.push(
      createAction(
        "system",
        "Algorand",
        "transaction",
        `Accounts created on LocalNet:\n` +
        `• **Buyer:** \`${accounts.buyer.address.slice(0, 12)}...${accounts.buyer.address.slice(-6)}\` (${accounts.buyer.balance.toFixed(2)} ALGO)\n` +
        `• **Sellers:** ${Object.keys(accounts.sellers).length} accounts funded`,
        { accounts }
      )
    );

    actions.push(
      createAction("system", "Algorand", "transaction", "Posting service listings on-chain via 0 ALGO transactions...")
    );

    const listingTxIds = await postListingsOnChain();
    actions.push(
      createAction(
        "system",
        "Algorand",
        "result",
        `**${listingTxIds.length} listings** posted on-chain!\n` +
        listingTxIds.map((tx, i) => `• Listing ${i + 1}: \`${tx.slice(0, 20)}...\``).join("\n"),
        { listingTxIds }
      )
    );

    return NextResponse.json({ success: true, accounts, listingTxIds, actions });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Init failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
