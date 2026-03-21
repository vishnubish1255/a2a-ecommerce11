import { NextRequest, NextResponse } from "next/server";
import { getBalance, getNetworkMode } from "@/lib/blockchain/algorand";

export async function GET(req: NextRequest) {
  try {
    const address = req.nextUrl.searchParams.get("address");
    if (!address) {
      return NextResponse.json({ error: "address query param required" }, { status: 400 });
    }

    const balance = await getBalance(address);
    const network = getNetworkMode();

    return NextResponse.json({
      address,
      balance,
      network,
      explorerUrl: network === "testnet"
        ? `https://testnet.explorer.perawallet.app/address/${address}`
        : null,
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Failed to fetch wallet info";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
