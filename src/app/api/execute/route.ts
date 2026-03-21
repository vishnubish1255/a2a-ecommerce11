import { NextRequest, NextResponse } from "next/server";
import { executePayment, getBalance } from "@/lib/blockchain/algorand";
import { createAction } from "@/lib/a2a/messaging";
import type { NegotiationSession } from "@/lib/agents/types";

export async function POST(req: NextRequest) {
  try {
    const { deal } = (await req.json()) as { deal: NegotiationSession };

    if (!deal?.sellerAddress || !deal?.finalPrice) {
      return NextResponse.json({ error: "Deal details are required" }, { status: 400 });
    }

    const actions = [
      createAction(
        "buyer",
        "Buyer Agent",
        "transaction",
        `Executing real payment on Algorand LocalNet...\n**${deal.finalPrice} ALGO** to **${deal.sellerName}** (\`${deal.sellerAddress.slice(0, 12)}...\`)`
      ),
    ];

    const escrow = await executePayment(deal.sellerAddress, deal.finalPrice);

    const buyerBal = await getBalance(escrow.buyerAddress);
    const sellerBal = await getBalance(escrow.sellerAddress);

    actions.push(
      createAction(
        "system",
        "Algorand",
        "transaction",
        `**Payment Confirmed On-Chain!**\n` +
        `• **TX ID:** \`${escrow.txId}\`\n` +
        `• **Confirmed Round:** ${escrow.confirmedRound}\n` +
        `• **Amount:** ${escrow.amount} ALGO\n` +
        `• **Buyer Balance:** ${buyerBal.toFixed(4)} ALGO\n` +
        `• **Seller Balance:** ${sellerBal.toFixed(4)} ALGO`,
        { escrow, buyerBal, sellerBal }
      )
    );

    actions.push(
      createAction(
        "buyer",
        "Buyer Agent",
        "result",
        `Transaction complete! **${deal.finalPrice} ALGO** paid to **${deal.sellerName}** for "${deal.service}".\n\n` +
        `**Payment TX:** \`${escrow.txId}\`\n` +
        `**Listing TX:** \`${deal.listingTxId.slice(0, 20)}...\``
      )
    );

    return NextResponse.json({ success: true, escrow, actions });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Execution failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
