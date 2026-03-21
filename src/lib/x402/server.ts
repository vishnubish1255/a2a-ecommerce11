import { x402ResourceServer, HTTPFacilitatorClient } from "@x402-avm/core/server";
import { registerExactAvmScheme } from "@x402-avm/avm/exact/server";
import { ALGORAND_TESTNET_CAIP2 } from "@x402-avm/avm";

const FACILITATOR_URL =
  process.env.FACILITATOR_URL || "https://facilitator.goplausible.xyz";

const PAY_TO = process.env.PAY_TO || "";

let serverInstance: x402ResourceServer | null = null;

export function getX402Server(): x402ResourceServer {
  if (!serverInstance) {
    const facilitatorClient = new HTTPFacilitatorClient({
      url: FACILITATOR_URL,
    });
    serverInstance = new x402ResourceServer(facilitatorClient);
    registerExactAvmScheme(serverInstance);
  }
  return serverInstance;
}

export function getPayTo(): string {
  return PAY_TO;
}

export function getNetwork(): string {
  return ALGORAND_TESTNET_CAIP2;
}

export function isX402Configured(): boolean {
  return Boolean(process.env.PAY_TO && process.env.FACILITATOR_URL);
}

export interface RoutePaymentConfig {
  scheme: "exact";
  network: string;
  payTo: string;
  price: string;
}

export function createRouteConfig(priceUsd: string): RoutePaymentConfig {
  return {
    scheme: "exact",
    network: ALGORAND_TESTNET_CAIP2,
    payTo: PAY_TO,
    price: priceUsd,
  };
}
