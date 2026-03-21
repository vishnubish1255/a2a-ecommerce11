"use client";

import { useWallet } from "@txnlab/use-wallet-react";
import type { Wallet } from "@txnlab/use-wallet-react";
import { useState, useEffect } from "react";

function truncateAddr(addr: string): string {
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

export function WalletConnect() {
  const { wallets, activeAccount, activeWallet, isReady } = useWallet();
  const [isOpen, setIsOpen] = useState(false);
  const [balance, setBalance] = useState<number | null>(null);

  useEffect(() => {
    if (!activeAccount?.address) {
      setBalance(null);
      return;
    }
    fetch(`/api/wallet/info?address=${activeAccount.address}`)
      .then((r) => r.json())
      .then((d) => setBalance(d.balance ?? null))
      .catch(() => setBalance(null));
  }, [activeAccount?.address]);

  if (!isReady) {
    return (
      <div className="px-3 py-1.5 rounded-lg bg-zinc-800/50 border border-zinc-700/50 text-xs text-zinc-500">
        Loading...
      </div>
    );
  }

  if (activeWallet && activeAccount) {
    return (
      <div className="relative">
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/30 hover:bg-emerald-500/20 transition-colors"
        >
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          <span className="text-xs font-mono text-emerald-300">
            {truncateAddr(activeAccount.address)}
          </span>
          {balance !== null && (
            <span className="text-[10px] text-zinc-400">
              {balance.toFixed(2)} ALGO
            </span>
          )}
        </button>

        {isOpen && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
            <div className="absolute right-0 top-full mt-2 w-64 rounded-xl bg-zinc-900 border border-zinc-700 shadow-2xl z-50 overflow-hidden">
              <div className="p-3 border-b border-zinc-800">
                <p className="text-xs text-zinc-400">Connected via {activeWallet.metadata.name}</p>
                <p className="text-sm font-mono text-zinc-200 mt-1 break-all">
                  {activeAccount.address}
                </p>
                {balance !== null && (
                  <p className="text-sm text-emerald-400 font-medium mt-1">
                    {balance.toFixed(4)} ALGO
                  </p>
                )}
              </div>
              <div className="p-2">
                <button
                  onClick={() => { activeWallet.disconnect(); setIsOpen(false); }}
                  className="w-full text-left px-3 py-2 rounded-lg text-xs text-red-400 hover:bg-red-500/10 transition-colors"
                >
                  Disconnect
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    );
  }

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="px-4 py-2 rounded-lg bg-gradient-to-r from-blue-600 to-purple-600 text-white text-xs font-medium hover:from-blue-500 hover:to-purple-500 transition-all shadow-lg shadow-blue-500/20"
      >
        Connect Wallet
      </button>

      {isOpen && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
          <div className="absolute right-0 top-full mt-2 w-72 rounded-xl bg-zinc-900 border border-zinc-700 shadow-2xl z-50 overflow-hidden">
            <div className="p-3 border-b border-zinc-800">
              <p className="text-sm font-semibold text-zinc-200">Connect a Wallet</p>
              <p className="text-xs text-zinc-500 mt-0.5">Choose your preferred wallet</p>
            </div>
            <div className="p-2 space-y-1">
              {wallets.map((w: Wallet) => (
                <button
                  key={w.id}
                  onClick={() => { w.connect(); setIsOpen(false); }}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-zinc-800 transition-colors group"
                >
                  <div className="w-8 h-8 rounded-lg bg-zinc-800 group-hover:bg-zinc-700 flex items-center justify-center transition-colors overflow-hidden">
                    {w.metadata.icon && (
                      <img src={w.metadata.icon} alt={w.metadata.name} className="w-6 h-6" />
                    )}
                  </div>
                  <div className="text-left">
                    <p className="text-sm text-zinc-200">{w.metadata.name}</p>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
