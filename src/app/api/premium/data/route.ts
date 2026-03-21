import { NextResponse } from "next/server";
import { getNetworkMode } from "@/lib/blockchain/algorand";

export async function GET() {
  const network = getNetworkMode();
  const timestamp = new Date().toISOString();

  return NextResponse.json({
    status: "success",
    network,
    timestamp,
    data: {
      totalListings: 5,
      categories: [
        { type: "cloud-storage", count: 2, avgPrice: 87.5 },
        { type: "api-access", count: 1, avgPrice: 50 },
        { type: "compute", count: 1, avgPrice: 120 },
        { type: "hosting", count: 1, avgPrice: 70 },
      ],
      priceRange: { min: 50, max: 120, avg: 83 },
      topSellers: [
        { name: "QuickAPI", rating: 4.8, deals: 42 },
        { name: "DataVault", rating: 4.7, deals: 38 },
        { name: "SecureHost Pro", rating: 4.6, deals: 35 },
      ],
      marketTrend: "bullish",
      recommendation: "Cloud storage services are competitively priced — negotiate for 15-20% discounts.",
    },
    x402: {
      protocol: "x402 v2",
      paymentMethod: "Algorand USDC (TestNet)",
      facilitator: "https://facilitator.goplausible.xyz",
      note: "This endpoint is gated by the x402 payment protocol. Payment is verified and settled on-chain via the facilitator.",
    },
  });
}
