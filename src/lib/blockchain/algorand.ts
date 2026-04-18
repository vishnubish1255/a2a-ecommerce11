// Mocked out algorand module to prevent build failures after removing Algorand SDKs
// The frontend has been migrated to Ethereum (ethers.js).

export type NetworkMode = "localnet" | "testnet";

export function getNetworkMode(): NetworkMode {
  return "testnet";
}

export function isTestnet(): boolean {
  return true;
}

export function getClient(): any {
  return {};
}

export function getIndexer(): any {
  return {};
}

export const SELLER_INITIAL_REPUTATIONS: Record<string, number> = {
  cloudmax:       82,
  datavault:      78,
  quickapi:       91,
  bharatcompute:  85,
  securehost:     88,
};

export async function getBalance(address: string): Promise<number> {
  return 10;
}

export async function initAccounts(): Promise<any> {
  return {
    buyer: { address: "0xMockBuyer", balance: 10 },
    sellers: {},
  };
}

export function getStoredAccounts() {
  return null;
}

export function getSellerKeys() {
  return null;
}

export async function queryAgentReputation(agentAddress: string): Promise<any> {
  return { isRegistered: true, reputation: 85, feedbackCount: 1, totalScore: 85 };
}

export async function executePayment(
  sellerAddress: string,
  amountAlgo: number
): Promise<any> {
  return {
    status: "released",
    buyerAddress: "0xMock",
    sellerAddress,
    amount: amountAlgo,
    txId: "0xMockTx",
    confirmedRound: 1,
  };
}

export function getEscrowState(): any {
  return { status: "idle", buyerAddress: "", sellerAddress: "", amount: 0, txId: "", confirmedRound: 0 };
}

export function resetState(): void {
}
