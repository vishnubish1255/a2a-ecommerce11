<p align="center">
  <img src="https://img.shields.io/badge/Algorand-000000?style=for-the-badge&logo=algorand&logoColor=white" alt="Algorand" />
  <img src="https://img.shields.io/badge/TypeScript-3178C6?style=for-the-badge&logo=typescript&logoColor=white" alt="TypeScript" />
  <img src="https://img.shields.io/badge/Next.js_15-000000?style=for-the-badge&logo=next.js&logoColor=white" alt="Next.js" />
  <img src="https://img.shields.io/badge/Groq_AI-F55036?style=for-the-badge&logo=ai&logoColor=white" alt="Groq" />
  <img src="https://img.shields.io/badge/Tailwind_CSS-06B6D4?style=for-the-badge&logo=tailwindcss&logoColor=white" alt="Tailwind" />
</p>

<h1 align="center">A2A Agentic Commerce Framework</h1>

<p align="center">
  <strong>Autonomous AI agents that discover, negotiate, and transact — on the Algorand blockchain.</strong>
</p>

<p align="center">
  On-chain listings &nbsp;·&nbsp; Indexer discovery &nbsp;·&nbsp; SHA-256 ZK commitments &nbsp;·&nbsp; AI negotiation &nbsp;·&nbsp; Real payments
</p>

---

## The Problem

Today's digital commerce is fundamentally human-bottlenecked. Every purchase — from cloud storage to API access — requires a person to search, compare, negotiate, and pay. As services become increasingly commoditized and agent-driven workflows emerge, there's no infrastructure for **machines to autonomously transact with each other** on a trust-minimized, verifiable layer.

**A2A Agentic Commerce** solves this by creating an end-to-end pipeline where AI agents:

1. **Discover** services listed directly on the Algorand blockchain
2. **Verify** seller authenticity via cryptographic commitment schemes
3. **Negotiate** pricing using LLM-powered intelligence
4. **Execute** real payments — all without human intervention

> Built for the Indian market context: SME procurement automation where an agent can autonomously find and purchase the cheapest cloud storage, API gateway, or GPU compute instance.

---

## Key Features

- **Real On-Chain Listings** — Sellers publish service listings as 0-ALGO self-transactions with structured JSON in the note field. Every listing is a confirmed transaction with a verifiable `txId` and round number.

- **Algorand Indexer Discovery** — Buyer agents query the Indexer by `notePrefix` to discover listings directly from the blockchain. No off-chain databases or registries.

- **SHA-256 ZK Commitment Scheme** — Sellers generate a cryptographic commitment (`SHA-256(secret|seller|price|capabilities)`) published on-chain. Buyers verify claims by recomputing the hash against the revealed secret — providing **binding** (seller can't alter claims post-commit) and **hiding** (on-chain data reveals nothing without the secret).

- **AI-Powered Intent Parsing** — Natural language purchase requests are parsed by Groq's Llama 3.3 70B into structured intent objects (service type, budget, preferences).

- **Multi-Round Negotiation** — Agents exchange structured `offer → counter → accept` messages with AI-generated natural language responses. 1–2 round protocol with concession logic.

- **Real ALGO Payments** — After agreement, the buyer agent executes a real payment transaction on Algorand LocalNet. Returns confirmed `txId`, round, and updated balances.

- **Beautiful Terminal UI** — Rich formatted output with color-coded negotiation bubbles, progress sections, and a final transaction receipt.

---

## System Architecture

```mermaid
graph TD
    A["🧑 User Intent (Natural Language)"]:::user --> B

    subgraph AI["AI Layer — Groq Cloud"]
        B["Llama 3.3 70B<br/><i>parseIntent()</i>"]:::ai
        F["Llama 3.3 70B<br/><i>aiNegResponse()</i>"]:::ai
    end

    B -- "{ serviceType, maxBudget, prefs }" --> C

    subgraph CHAIN["Algorand Blockchain — LocalNet"]
        G["Algod<br/><code>localhost:4001</code>"]:::chain
        H["Indexer<br/><code>localhost:8980</code>"]:::chain
        I["On-Chain Listings<br/><i>0-ALGO self-txns with JSON notes</i>"]:::chain
        L["Payment Ledger<br/><i>Confirmed rounds + balances</i>"]:::chain
        G --- I
        G --- L
        H -- "searchForTransactions()<br/>notePrefix: a2a-listing:" --> I
    end

    subgraph AGENT["Agent Layer — TypeScript Runtime"]
        C["Buyer Agent<br/><i>Indexer Discovery</i>"]:::agent
        D["ZK Verifier<br/><i>SHA-256 recompute</i>"]:::crypto
        E["Negotiation Engine<br/><i>offer → counter → accept</i>"]:::agent
        K["Payment Executor<br/><i>algorand.send.payment()</i>"]:::agent
    end

    H --> C
    C -- "matched listings" --> D
    D -- "✓ commitment verified" --> E
    E <-- "structured messages" --> F
    E -- "best deal selected" --> K
    K -- "real ALGO transfer" --> G
    K --> M["✅ txId + confirmedRound"]:::result

    subgraph SELLER["Seller Agents (×5)"]
        S1["CloudMax India<br/>90 ALGO"]:::seller
        S2["DataVault<br/>85 ALGO"]:::seller
        S3["QuickAPI<br/>50 ALGO"]:::seller
        S4["BharatCompute<br/>120 ALGO"]:::seller
        S5["SecureHost Pro<br/>70 ALGO"]:::seller
    end

    SELLER -- "post listings<br/>(0-ALGO txn + ZK commitment)" --> G
    SELLER -. "reveal secret<br/>(off-chain channel)" .-> D

    classDef user fill:#6366f1,stroke:#4f46e5,color:#fff,font-weight:bold
    classDef ai fill:#f97316,stroke:#ea580c,color:#fff,font-weight:bold
    classDef chain fill:#0d9488,stroke:#0f766e,color:#fff,font-weight:bold
    classDef agent fill:#3b82f6,stroke:#2563eb,color:#fff,font-weight:bold
    classDef crypto fill:#a855f7,stroke:#9333ea,color:#fff,font-weight:bold
    classDef seller fill:#64748b,stroke:#475569,color:#fff
    classDef result fill:#22c55e,stroke:#16a34a,color:#fff,font-weight:bold
```

### Tech Stack

| Layer | Technology | Purpose |
|:------|:-----------|:--------|
| **Blockchain** | Algorand LocalNet | On-chain listings, payment execution |
| **SDK** | `algosdk` v3.2 + `algokit-utils` v8.2 | Account management, transactions, Indexer queries |
| **AI / LLM** | Groq (Llama 3.3 70B Versatile) | Intent parsing, seller negotiation responses |
| **Cryptography** | Node.js `crypto` (SHA-256) | ZK commitment scheme (create + verify) |
| **Runtime** | `tsx` (TypeScript Execute) | Direct TS execution without compilation |
| **Frontend** | Next.js 15, React 19, Tailwind CSS 4 | Web dashboard (available for future integration) |
| **Language** | TypeScript 5.8 (strict mode) | End-to-end type safety |

### Project Structure

```
a2a-commerce/
├── scripts/
│   └── run.ts                  # Main terminal runner (full pipeline)
├── src/
│   ├── app/
│   │   ├── page.tsx            # Next.js frontend dashboard
│   │   ├── layout.tsx          # Root layout
│   │   └── api/                # API routes (init, discover, negotiate, execute)
│   ├── components/             # React components (listings, negotiation, tx status)
│   └── lib/
│       ├── agents/             # Buyer/seller agent logic + types
│       ├── ai/                 # Groq LLM integration
│       ├── a2a/                # Structured messaging protocol
│       ├── blockchain/         # Algorand client, listings, ZK proofs
│       └── negotiation/        # Multi-round negotiation engine
├── package.json
├── tsconfig.json
└── .env                        # GROQ_API_KEY
```

---

## Installation & Setup

### Prerequisites

| Requirement | Version | Installation |
|:------------|:--------|:-------------|
| Node.js | 18+ | [nodejs.org](https://nodejs.org) |
| AlgoKit CLI | latest | `pipx install algokit` |
| Docker | latest | Required by AlgoKit LocalNet |

### 1. Clone & Install

```bash
git clone <repo-url> && cd a2a-commerce
npm install
```

### 2. Configure Environment

Create a `.env` file in the project root:

```env
GROQ_API_KEY=your_groq_api_key_here
```

> Get a free API key at [console.groq.com](https://console.groq.com)

### 3. Start Algorand LocalNet

```bash
algokit localnet start
```

This spins up a local Algorand node (Algod on `localhost:4001`) and Indexer (`localhost:8980`) via Docker.

### 4. Run

```bash
npx tsx scripts/run.ts "Buy cloud storage under 100 ALGO"
```

Or use the npm script:

```bash
npm run a2a -- "Buy cloud storage under 100 ALGO"
```

---

## Usage

Pass any natural language purchase intent as an argument:

```bash
# Cloud storage
npx tsx scripts/run.ts "Buy cloud storage under 100 ALGO"

# API access
npx tsx scripts/run.ts "Find API gateway service under 60 ALGO"

# GPU compute
npx tsx scripts/run.ts "I need GPU compute for ML training, budget 150 ALGO"

# Web hosting
npx tsx scripts/run.ts "Get managed hosting for my startup, budget 80 ALGO"
```

### Negotiation Protocol

```mermaid
graph LR
    A["Buyer Agent"]:::buyer -- "① OFFER<br/>65% of list price" --> B["Seller Agent"]:::seller
    B -- "② COUNTER<br/>88% of list price" --> A
    A -- "③ COUNTER<br/>midpoint of ① + ②" --> B
    B -- "④ COUNTER or ACCEPT<br/>95% of last counter" --> A
    A -- "⑤ ACCEPT<br/>final price ≤ budget" --> D["✅ Deal Reached"]:::deal

    classDef buyer fill:#3b82f6,stroke:#2563eb,color:#fff,font-weight:bold
    classDef seller fill:#f59e0b,stroke:#d97706,color:#fff,font-weight:bold
    classDef deal fill:#22c55e,stroke:#16a34a,color:#fff,font-weight:bold
```

> Each message is a structured `X402Msg` with `from`, `to`, `action`, `price`, and AI-generated `text`. Seller responses are produced by Groq Llama 3.3 70B for natural language flavor.

### Pipeline Stages

The framework executes **8 stages** sequentially:

| # | Stage | What Happens |
|:--|:------|:-------------|
| 1 | **Connect** | Connects to Algorand LocalNet, verifies node status |
| 2 | **Fund Accounts** | Creates 1 buyer (5,000 ALGO) and 5 seller accounts (100 ALGO each) |
| 3 | **Post Listings** | Each seller publishes a 0-ALGO self-txn with JSON note + SHA-256 commitment |
| 4 | **Parse Intent** | Groq LLM extracts `serviceType`, `maxBudget`, and `preferences` from natural language |
| 5 | **Indexer Discovery** | Queries Algorand Indexer by `notePrefix`, parses JSON, filters by intent |
| 6 | **ZK Verify + Negotiate** | Verifies seller commitments, then runs AI-powered offer/counter/accept rounds |
| 7 | **Select Best Deal** | Picks the cheapest accepted deal across all negotiations |
| 8 | **Execute Payment** | Sends real ALGO from buyer to seller, returns `txId` + confirmed round |

### Example Output

```
  A2A AGENTIC COMMERCE FRAMEWORK
  On-chain listings · Indexer discovery · SHA-256 ZK · Real payments
────────────────────────────────────────────────────────────────

▸ Connecting to Algorand LocalNet
  ✓ Connected — Last round: 88

▸ Fetching listings from Indexer
  ✓ Parsed 5 listings from Indexer (rounds 95–99)

▸ Found 2/5 matching listings from Indexer
  • cloudmax         "Enterprise Cloud Storage"  90 ALGO
  • datavault        "SME Cloud Storage"         85 ALGO

  Negotiating with datavault  (SME Cloud Storage, 85 ALGO)
  ✓ SHA-256 verification: recomputed hash MATCHES on-chain commitment
  Buyer Agent    [OFFER]   55 ALGO
  datavault      [COUNTER] 75 ALGO
  Buyer Agent    [COUNTER] 65 ALGO
  datavault      [COUNTER] 71 ALGO
  Buyer Agent    [ACCEPT]  71 ALGO
  Result: ✓ DEAL at 71 ALGO (saved 16%)

  ✓ Payment confirmed on-chain!
  TX ID: REWVGODJ7EB4QZX6HJOFQWQVOMNICLV2QKMZECSEQ35POSLYCDEQ
  Confirmed Round: 100

  ┌─────────────────────────────────────────────────────────┐
  │  Service:    SME Cloud Storage                          │
  │  Seller:     datavault                                  │
  │  Price:      71 ALGO                                    │
  │  Savings:    16%                                        │
  │  ZK (SHA256): Verified ✓                                │
  └─────────────────────────────────────────────────────────┘
```

---

## On-Chain Data Format

Every listing is stored in a payment transaction's `note` field:

```
a2a-listing:{"type":"cloud-storage","service":"Enterprise Cloud Storage","price":90,"seller":"cloudmax","description":"Enterprise-grade, Mumbai & Chennai DC, 99.99% uptime","timestamp":1742565600000,"zkCommitment":"91d4e7d1741a8074b9b366fc25b893c4..."}
```

| Field | Type | Description |
|:------|:-----|:------------|
| `type` | `string` | Service category (`cloud-storage`, `api-access`, `compute`, `hosting`) |
| `service` | `string` | Human-readable service name |
| `price` | `number` | Listed price in ALGO |
| `seller` | `string` | Seller identifier |
| `description` | `string` | Service capabilities |
| `timestamp` | `number` | Unix timestamp of listing creation |
| `zkCommitment` | `string` | SHA-256 commitment hash for claim verification |

---

## ZK Commitment Scheme

The framework implements a hash-based cryptographic commitment scheme for seller verification, executed across three distinct phases:

```mermaid
sequenceDiagram
    autonumber

    participant S as 🏪 Seller (Prover)
    participant BC as ⛓️ Algorand Blockchain
    participant I as 🔍 Indexer
    participant B as 🤖 Buyer Agent (Verifier)

    rect rgb(88, 28, 135)
        Note over S: SETUP PHASE
        S->>S: secret = randomBytes(32).toString('hex')
        Note right of S: 64-char hex nonce<br/>kept private off-chain
    end

    rect rgb(30, 64, 175)
        Note over S,BC: COMMIT PHASE
        S->>S: preimage = secret|seller|price|capabilities
        S->>S: commitment = SHA-256(preimage)
        Note right of S: Deterministic 256-bit hash<br/>e.g. 91d4e7d1741a8074...

        S->>BC: 0-ALGO self-payment txn
        Note over BC: note: "a2a-listing:{...zkCommitment: commitment}"
        BC-->>BC: Confirmed at round N
        BC-->>S: txId + confirmedRound
    end

    rect rgb(21, 94, 117)
        Note over I,B: DISCOVER PHASE
        B->>I: searchForTransactions(notePrefix: 'a2a-listing:')
        I->>BC: Query transaction history
        BC-->>I: Matching transactions
        I-->>B: Listings with zkCommitment hashes
    end

    rect rgb(120, 53, 15)
        Note over S,B: REVEAL + VERIFY PHASE
        S-->>B: Reveal secret (off-chain private channel)
        Note over B: Buyer now has:<br/>• commitment (from chain)<br/>• secret (from seller)<br/>• seller, price, caps (from listing)

        B->>B: recomputed = SHA-256(secret|seller|price|caps)
        
        alt recomputed === commitment
            B->>B: ✅ Verification PASSED
            Note over B: Seller's claims are authentic<br/>Proceed to negotiation
        else recomputed !== commitment
            B->>B: ❌ Verification FAILED
            Note over B: Seller tampered with claims<br/>Reject this listing
        end
    end
```

### Cryptographic Properties

| Property | Guarantee | How It Works |
|:---------|:----------|:-------------|
| **Binding** | Seller cannot change claims after committing | SHA-256 is collision-resistant — finding a different preimage that produces the same hash is computationally infeasible (2¹²⁸ operations) |
| **Hiding** | On-chain commitment reveals nothing without the secret | The 32-byte random nonce ensures the hash is uniformly distributed regardless of the input data. Without `secret`, the commitment is indistinguishable from random |
| **Integrity** | Buyer can detect any tampering | If the seller modifies price, capabilities, or any claim after committing, the recomputed hash will not match the on-chain commitment |

---

## Available Sellers (Indian Market)

| Seller | Service | Type | Price | Location |
|:-------|:--------|:-----|:------|:---------|
| CloudMax India | Enterprise Cloud Storage | `cloud-storage` | 90 ALGO | Mumbai & Chennai DC |
| DataVault | SME Cloud Storage | `cloud-storage` | 85 ALGO | Hyderabad |
| QuickAPI | API Gateway Pro | `api-access` | 50 ALGO | — |
| BharatCompute | GPU Compute Instances | `compute` | 120 ALGO | Pune (NVIDIA A100) |
| SecureHost Pro | Managed Hosting | `hosting` | 70 ALGO | Indian CDN |

---

## Roadmap

- [x] On-chain listings via 0-ALGO transactions
- [x] Algorand Indexer-based discovery
- [x] SHA-256 ZK commitment scheme
- [x] AI-powered intent parsing (Groq Llama 3.3 70B)
- [x] Multi-round negotiation with AI responses
- [x] Real ALGO payment execution on LocalNet
- [x] Rich terminal UI with formatted output
- [ ] x402 protocol integration (TestNet — USDC payments with fee abstraction)
- [ ] Next.js frontend dashboard
- [ ] Multi-agent parallel negotiation
- [ ] Seller reputation scoring
- [ ] TestNet / MainNet deployment

---

<p align="center">
  <sub>Built on <strong>Algorand</strong> — fast finality, low fees, carbon negative.</sub>
</p>
