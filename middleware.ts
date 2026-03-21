import { NextRequest, NextResponse } from "next/server";

const PAY_TO = process.env.PAY_TO || "";
const FACILITATOR_URL =
  process.env.FACILITATOR_URL || "https://facilitator.goplausible.xyz";
const ALGORAND_TESTNET_CAIP2 =
  "algorand:SGO1GKSzyE7IEPItTxCByw9x8FmnrCDexi9/cOUJOiI=";

interface RouteConfig {
  price: string;
  description: string;
}

const PROTECTED_ROUTES: Record<string, RouteConfig> = {
  "GET /api/premium/data": {
    price: "$0.001",
    description: "Premium marketplace analytics and aggregated listing data",
  },
  "POST /api/premium/analyze": {
    price: "$0.002",
    description: "AI-powered market analysis with pricing recommendations",
  },
};

function matchRoute(method: string, pathname: string): RouteConfig | null {
  const key = `${method} ${pathname}`;
  if (PROTECTED_ROUTES[key]) return PROTECTED_ROUTES[key];

  for (const [pattern, config] of Object.entries(PROTECTED_ROUTES)) {
    const [m, p] = pattern.split(" ");
    if (m !== method) continue;
    if (p.endsWith("/*") && pathname.startsWith(p.slice(0, -2))) return config;
  }
  return null;
}

export async function middleware(request: NextRequest) {
  if (!PAY_TO) return NextResponse.next();

  const method = request.method;
  const pathname = request.nextUrl.pathname;
  const routeConfig = matchRoute(method, pathname);
  if (!routeConfig) return NextResponse.next();

  const paymentHeader =
    request.headers.get("X-PAYMENT") ||
    request.headers.get("x-payment");

  if (!paymentHeader) {
    const paymentRequirements = [
      {
        scheme: "exact",
        network: ALGORAND_TESTNET_CAIP2,
        payTo: PAY_TO,
        price: routeConfig.price,
        description: routeConfig.description,
        mimeType: "application/json",
      },
    ];

    const body = JSON.stringify({
      x402Version: 2,
      accepts: paymentRequirements,
      error: "Payment Required",
    });

    return new NextResponse(body, {
      status: 402,
      headers: {
        "Content-Type": "application/json",
        "X-PAYMENT-REQUIRED": JSON.stringify({
          x402Version: 2,
          accepts: paymentRequirements,
        }),
      },
    });
  }

  try {
    const payload = JSON.parse(paymentHeader);

    const verifyRes = await fetch(`${FACILITATOR_URL}/verify`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        x402Version: payload.x402Version ?? 2,
        scheme: payload.scheme ?? "exact",
        network: payload.network ?? ALGORAND_TESTNET_CAIP2,
        payload: payload.payload,
        paymentRequirements: {
          scheme: "exact",
          network: ALGORAND_TESTNET_CAIP2,
          payTo: PAY_TO,
          maxAmountRequired: routeConfig.price,
        },
      }),
    });

    if (!verifyRes.ok) {
      const errBody = await verifyRes.text();
      return new NextResponse(
        JSON.stringify({ error: "Payment verification failed", details: errBody }),
        { status: 402, headers: { "Content-Type": "application/json" } }
      );
    }

    const verifyData = await verifyRes.json();
    if (!verifyData.isValid) {
      return new NextResponse(
        JSON.stringify({ error: "Payment invalid", reason: verifyData.reason }),
        { status: 402, headers: { "Content-Type": "application/json" } }
      );
    }

    const response = NextResponse.next();

    fetch(`${FACILITATOR_URL}/settle`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        x402Version: payload.x402Version ?? 2,
        scheme: payload.scheme ?? "exact",
        network: payload.network ?? ALGORAND_TESTNET_CAIP2,
        payload: payload.payload,
        paymentRequirements: {
          scheme: "exact",
          network: ALGORAND_TESTNET_CAIP2,
          payTo: PAY_TO,
          maxAmountRequired: routeConfig.price,
        },
      }),
    }).then(async (settleRes) => {
      if (settleRes.ok) {
        const settleData = await settleRes.json();
        console.log("[x402] Payment settled:", settleData.txId ?? "ok");
      }
    }).catch((err) => {
      console.error("[x402] Settlement error:", err);
    });

    return response;
  } catch (err) {
    return new NextResponse(
      JSON.stringify({ error: "Invalid payment header" }),
      { status: 402, headers: { "Content-Type": "application/json" } }
    );
  }
}

export const config = {
  matcher: "/api/premium/:path*",
};
