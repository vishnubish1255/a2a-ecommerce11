"use client";

import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { BrowserProvider, JsonRpcSigner, ethers } from "ethers";

interface WalletContextState {
  address: string | null;
  signer: JsonRpcSigner | null;
  provider: BrowserProvider | null;
  isReady: boolean;
  connect: () => Promise<void>;
  disconnect: () => void;
}

const WalletContext = createContext<WalletContextState | undefined>(undefined);

export function WalletProvider({ children }: { children: ReactNode }) {
  const [address, setAddress] = useState<string | null>(null);
  const [signer, setSigner] = useState<JsonRpcSigner | null>(null);
  const [provider, setProvider] = useState<BrowserProvider | null>(null);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    // Check if wallet is already connected
    const checkConnection = async () => {
      if (typeof window !== "undefined" && window.ethereum) {
        try {
          const browserProvider = new ethers.BrowserProvider(window.ethereum);
          setProvider(browserProvider);
          const accounts = await browserProvider.listAccounts();
          if (accounts.length > 0) {
            const currentSigner = await browserProvider.getSigner();
            setAddress(accounts[0].address);
            setSigner(currentSigner);
          }
        } catch (error) {
          console.error("Failed to re-connect to wallet:", error);
        }
      }
      setIsReady(true);
    };

    checkConnection();

    if (typeof window !== "undefined" && window.ethereum) {
      window.ethereum.on("accountsChanged", handleAccountsChanged);
      window.ethereum.on("chainChanged", () => window.location.reload());
    }

    return () => {
      if (typeof window !== "undefined" && window.ethereum) {
        window.ethereum.removeListener("accountsChanged", handleAccountsChanged);
      }
    };
  }, []);

  const handleAccountsChanged = async (accounts: string[]) => {
    if (accounts.length === 0) {
      disconnect();
    } else if (address !== accounts[0]) {
      setAddress(accounts[0]);
      if (provider) {
        const newSigner = await provider.getSigner();
        setSigner(newSigner);
      }
    }
  };

  const connect = async () => {
    if (typeof window !== "undefined" && window.ethereum) {
      try {
        const browserProvider = new ethers.BrowserProvider(window.ethereum);
        setProvider(browserProvider);
        await browserProvider.send("eth_requestAccounts", []);
        const currentSigner = await browserProvider.getSigner();
        const connectedAddress = await currentSigner.getAddress();
        
        setSigner(currentSigner);
        setAddress(connectedAddress);
      } catch (error) {
        if ((error as any)?.code === 4001) {
          console.warn("User rejected the connection request.");
        } else {
          console.error("Failed to connect wallet:", error);
        }
      }
    } else {
      alert("MetaMask is not installed. Please install it to use this feature.");
    }
  };

  const disconnect = () => {
    setAddress(null);
    setSigner(null);
    // Providers don't have a strict disconnect in ethers beyond dropping state
  };

  return (
    <WalletContext.Provider value={{ address, signer, provider, isReady, connect, disconnect }}>
      {children}
    </WalletContext.Provider>
  );
}

export function useWallet() {
  const context = useContext(WalletContext);
  if (context === undefined) {
    throw new Error("useWallet must be used within a WalletProvider");
  }
  return context;
}
