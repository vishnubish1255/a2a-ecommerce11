"use client";

import { useState, useCallback } from "react";
import { Header } from "@/components/header";
import { IntentInput } from "@/components/intent-input";
import { ChatInterface } from "@/components/chat-interface";
import { ListingCard } from "@/components/seller-card";
import { NegotiationTimeline } from "@/components/negotiation-timeline";
import { TransactionStatus } from "@/components/transaction-status";
import type {
  SessionState,
  AgentAction,
  ParsedIntent,
  OnChainListing,
  NegotiationSession,
  EscrowState,
} from "@/lib/agents/types";

const initialEscrow: EscrowState = {
  status: "idle",
  buyerAddress: "",
  sellerAddress: "",
  amount: 0,
  txId: "",
  confirmedRound: 0,
};

const initialState: SessionState = {
  sessionId: "",
  intent: null,
  listings: [],
  negotiations: [],
  selectedDeal: null,
  escrow: initialEscrow,
  actions: [],
  phase: "idle",
  autoBuy: false,
};

export default function Home() {
  const [state, setState] = useState<SessionState>(initialState);
  const [isLoading, setIsLoading] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);

  const addActions = useCallback((newActions: AgentAction[]) => {
    setState((prev) => ({ ...prev, actions: [...prev.actions, ...newActions] }));
  }, []);

  async function callApi<T>(url: string, body: Record<string, unknown>, phase: SessionState["phase"]): Promise<T | null> {
    setState((prev) => ({ ...prev, phase }));
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      if (data.actions) addActions(data.actions);
      return data as T;
    } catch (err) {
      const msg = err instanceof Error ? err.message : "An error occurred";
      addActions([{
        id: crypto.randomUUID(),
        agent: "system",
        agentName: "System",
        type: "result",
        content: `**Error:** ${msg}`,
        timestamp: new Date().toISOString(),
      }]);
      setState((prev) => ({ ...prev, phase: "error" }));
      return null;
    }
  }

  async function handleSubmit(message: string) {
    setIsLoading(true);
    setState((prev) => ({
      ...initialState,
      autoBuy: prev.autoBuy,
      sessionId: crypto.randomUUID(),
      actions: [],
    }));

    if (!isInitialized) {
      const initResult = await callApi<{ success: boolean }>("/api/init", {}, "initializing");
      if (!initResult?.success) { setIsLoading(false); return; }
      setIsInitialized(true);

      await new Promise((r) => setTimeout(r, 2000));
    }

    const intentResult = await callApi<{ intent: ParsedIntent }>("/api/intent", { message }, "parsing");
    if (!intentResult?.intent) { setIsLoading(false); return; }
    const intent = intentResult.intent;
    setState((prev) => ({ ...prev, intent }));

    const discoverResult = await callApi<{ listings: OnChainListing[] }>("/api/discover", { intent }, "discovering");
    if (!discoverResult?.listings?.length) {
      setState((prev) => ({ ...prev, phase: "completed" }));
      setIsLoading(false);
      return;
    }
    const listings = discoverResult.listings;
    setState((prev) => ({ ...prev, listings }));

    const negotiateResult = await callApi<{
      sessions: NegotiationSession[];
      bestDeal: NegotiationSession | null;
    }>("/api/negotiate", { intent, listings }, "negotiating");
    if (!negotiateResult) { setIsLoading(false); return; }
    setState((prev) => ({
      ...prev,
      negotiations: negotiateResult.sessions,
      selectedDeal: negotiateResult.bestDeal,
    }));

    if (!negotiateResult.bestDeal) {
      setState((prev) => ({ ...prev, phase: "completed" }));
      setIsLoading(false);
      return;
    }

    if (state.autoBuy) {
      await executeTransaction(negotiateResult.bestDeal);
    } else {
      addActions([{
        id: crypto.randomUUID(),
        agent: "buyer",
        agentName: "Buyer Agent",
        type: "message",
        content: `Ready to execute real payment of **${negotiateResult.bestDeal.finalPrice} ALGO** to **${negotiateResult.bestDeal.sellerName}**. Click "Confirm Purchase" to execute on Algorand.`,
        timestamp: new Date().toISOString(),
      }]);
      setState((prev) => ({ ...prev, phase: "completed" }));
    }
    setIsLoading(false);
  }

  async function executeTransaction(deal: NegotiationSession) {
    setIsLoading(true);
    const execResult = await callApi<{ success: boolean; escrow: EscrowState }>("/api/execute", { deal }, "executing");
    if (execResult?.escrow) {
      setState((prev) => ({ ...prev, escrow: execResult.escrow }));
    }
    setState((prev) => ({ ...prev, phase: "completed" }));
    setIsLoading(false);
  }

  const hasConfirmable = state.selectedDeal && state.escrow.status === "idle" && state.phase === "completed";

  return (
    <div className="h-screen flex flex-col">
      <Header
        autoBuy={state.autoBuy}
        onToggleAutoBuy={() => setState((prev) => ({ ...prev, autoBuy: !prev.autoBuy }))}
        phase={state.phase}
      />

      <div className="flex-1 flex overflow-hidden">
        <div className="flex-1 flex flex-col min-w-0">
          <ChatInterface actions={state.actions} />

          {hasConfirmable && (
            <div className="px-4 py-3 border-t border-zinc-800 bg-emerald-500/5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-zinc-200">
                    Confirm purchase from <strong>{state.selectedDeal!.sellerName}</strong>
                  </p>
                  <p className="text-xs text-zinc-500">
                    {state.selectedDeal!.finalPrice} ALGO — real Algorand transaction
                  </p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => setState((prev) => ({ ...prev, selectedDeal: null, phase: "idle" }))}
                    className="px-4 py-2 text-xs rounded-lg bg-zinc-800 text-zinc-400 hover:bg-zinc-700 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => executeTransaction(state.selectedDeal!)}
                    className="px-4 py-2 text-xs rounded-lg bg-emerald-600 text-white font-medium hover:bg-emerald-500 transition-colors"
                  >
                    Confirm & Pay on Algorand
                  </button>
                </div>
              </div>
            </div>
          )}

          <IntentInput onSubmit={handleSubmit} isLoading={isLoading} phase={state.phase} />
        </div>

        <aside className="w-80 border-l border-zinc-800 bg-[#0c0c14] overflow-y-auto scrollbar-thin hidden lg:block">
          <div className="p-4 space-y-4">
            {state.listings.length > 0 && (
              <div className="space-y-2">
                <h3 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">
                  On-Chain Listings
                </h3>
                {state.listings.map((listing) => {
                  const negotiation = state.negotiations.find((n) => n.listingTxId === listing.txId);
                  const isSelected = state.selectedDeal?.listingTxId === listing.txId;
                  return (
                    <ListingCard
                      key={listing.txId}
                      listing={listing}
                      negotiation={negotiation}
                      isSelected={isSelected}
                    />
                  );
                })}
              </div>
            )}

            <NegotiationTimeline sessions={state.negotiations} />
            <TransactionStatus escrow={state.escrow} />

            {state.listings.length === 0 && state.negotiations.length === 0 && (
              <div className="text-center pt-8 space-y-3">
                <div className="w-12 h-12 mx-auto rounded-xl bg-zinc-800/50 border border-zinc-700/50 flex items-center justify-center">
                  <svg className="w-5 h-5 text-zinc-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                </div>
                <p className="text-xs text-zinc-600">Send a purchase intent to start</p>
                <p className="text-[10px] text-zinc-700">Requires AlgoKit LocalNet running</p>
              </div>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}
