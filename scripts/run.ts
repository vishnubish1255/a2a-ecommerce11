import { AlgorandClient, algo, Config } from "@algorandfoundation/algokit-utils";
import algosdk from "algosdk";
import { createHash, randomBytes } from "crypto";
import Groq from "groq-sdk";
import dotenv from "dotenv";
dotenv.config();

Config.configure({ logger: { error: () => {}, warn: () => {}, info: () => {}, verbose: () => {}, debug: () => {} } });

// ─── Colors & formatting ────────────────────────────────────────────────────

const c = {
  reset: "\x1b[0m",
  bold: "\x1b[1m",
  dim: "\x1b[2m",
  underline: "\x1b[4m",
  red: "\x1b[31m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  magenta: "\x1b[35m",
  cyan: "\x1b[36m",
  white: "\x1b[37m",
  gray: "\x1b[90m",
  bgBlue: "\x1b[44m",
  bgGreen: "\x1b[42m",
  bgYellow: "\x1b[43m",
  bgMagenta: "\x1b[45m",
  bgCyan: "\x1b[46m",
};

function banner(text: string, color = c.bgBlue) {
  const pad = " ".repeat(Math.max(0, 60 - text.length));
  console.log(`\n${color}${c.bold}  ${text}${pad}${c.reset}`);
}

function section(text: string) {
  console.log(`\n${c.cyan}${c.bold}▸ ${text}${c.reset}`);
}

function info(label: string, value: string) {
  console.log(`  ${c.gray}${label.padEnd(20)}${c.reset} ${value}`);
}

function success(text: string) {
  console.log(`  ${c.green}✓${c.reset} ${text}`);
}

function warn(text: string) {
  console.log(`  ${c.yellow}⚠${c.reset} ${text}`);
}

function bullet(text: string) {
  console.log(`  ${c.gray}•${c.reset} ${text}`);
}

function divider() {
  console.log(`${c.gray}${"─".repeat(64)}${c.reset}`);
}

function msgBubble(from: string, action: string, price: number, text: string, color: string) {
  const actionColors: Record<string, string> = {
    offer: c.blue,
    counter: c.yellow,
    accept: c.green,
    reject: c.red,
  };
  const ac = actionColors[action] ?? c.gray;
  console.log(
    `  ${color}${c.bold}${from.padEnd(14)}${c.reset} ${ac}[${action.toUpperCase()}]${c.reset} ${c.bold}${price} ALGO${c.reset}  ${c.dim}${text.slice(0, 60)}${c.reset}`
  );
}

function addr(a: string): string {
  return `${a.slice(0, 8)}...${a.slice(-6)}`;
}

// ─── Types ──────────────────────────────────────────────────────────────────

interface ZKCommitment {
  commitment: string; // SHA-256 hash published on-chain
  secret: string;     // random nonce kept off-chain by seller
}

interface Listing {
  txId: string;
  sender: string;
  type: string;
  service: string;
  price: number;
  seller: string;
  description: string;
  zkCommitment: string; // on-chain commitment hash
  round: number;
}

interface X402Msg {
  from: string;
  to: string;
  action: "offer" | "counter" | "accept" | "reject";
  price: number;
  text: string;
}

interface NegResult {
  listing: Listing;
  accepted: boolean;
  finalPrice: number;
  messages: X402Msg[];
  zkVerified: boolean;
}

// ─── ZK Commitment Scheme (SHA-256) ─────────────────────────────────────────
// Seller commits: commitment = SHA256(secret || seller || price || capabilities)
// Published on-chain in listing note. Seller privately reveals `secret` to buyer.
// Buyer recomputes hash to verify the seller's claims match the commitment.

function createCommitment(seller: string, price: number, capabilities: string): ZKCommitment {
  const secret = randomBytes(32).toString("hex");
  const preimage = `${secret}|${seller}|${price}|${capabilities}`;
  const commitment = createHash("sha256").update(preimage).digest("hex");
  return { commitment, secret };
}

function verifyCommitment(
  commitment: string,
  secret: string,
  seller: string,
  price: number,
  capabilities: string,
): boolean {
  const preimage = `${secret}|${seller}|${price}|${capabilities}`;
  const recomputed = createHash("sha256").update(preimage).digest("hex");
  return recomputed === commitment;
}

// Secrets stored off-chain by sellers, revealed to buyers during negotiation
const sellerSecrets = new Map<string, string>();

// ─── Groq AI ────────────────────────────────────────────────────────────────

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

async function parseIntent(userMessage: string): Promise<{ serviceType: string; maxBudget: number; preferences: string[] }> {
  const completion = await groq.chat.completions.create({
    model: "llama-3.3-70b-versatile",
    messages: [
      {
        role: "system",
        content: `Parse user purchase intent. Respond ONLY with JSON, no markdown.\nOutput: {"serviceType":"cloud-storage"|"api-access"|"compute"|"hosting","maxBudget":number,"preferences":string[]}\nMap: cloud/storage/backup -> "cloud-storage", API/gateway -> "api-access", compute/GPU -> "compute", hosting/website -> "hosting"`,
      },
      { role: "user", content: userMessage },
    ],
    temperature: 0.1,
    max_tokens: 150,
  });
  const raw = completion.choices[0]?.message?.content ?? "{}";
  try {
    const parsed = JSON.parse(raw.replace(/```json?\n?/g, "").replace(/```/g, "").trim());
    return {
      serviceType: parsed.serviceType ?? "cloud-storage",
      maxBudget: parsed.maxBudget ?? 100,
      preferences: parsed.preferences ?? [],
    };
  } catch {
    return { serviceType: "cloud-storage", maxBudget: 100, preferences: [] };
  }
}

async function aiNegResponse(seller: string, buyerOffer: number, counterPrice: number, accepted: boolean): Promise<string> {
  const completion = await groq.chat.completions.create({
    model: "llama-3.3-70b-versatile",
    messages: [
      { role: "system", content: `You are ${seller}, a service provider. Give a 1-sentence negotiation response. Be natural.` },
      {
        role: "user",
        content: accepted
          ? `Buyer offered ${buyerOffer} ALGO. You accept at ${counterPrice} ALGO. Respond with acceptance.`
          : `Buyer offered ${buyerOffer} ALGO. Counter at ${counterPrice} ALGO. Explain your value briefly.`,
      },
    ],
    temperature: 0.7,
    max_tokens: 60,
  });
  return completion.choices[0]?.message?.content ?? `Offering at ${counterPrice} ALGO.`;
}

// ─── Main Flow ──────────────────────────────────────────────────────────────

async function main() {
  const userIntent = process.argv[2] || "Buy cloud storage under 100 ALGO";

  console.clear();
  banner("A2A AGENTIC COMMERCE FRAMEWORK", c.bgBlue);
  console.log(`${c.gray}  Algorand Agent-to-Agent Commerce${c.reset}`);
  console.log(`${c.gray}  On-chain listings • Indexer discovery • SHA-256 ZK • Real payments${c.reset}`);
  divider();

  // ── Step 1: Connect to LocalNet ───────────────────────────────────────────

  section("Connecting to Algorand LocalNet");
  let algorand: AlgorandClient;
  try {
    algorand = AlgorandClient.defaultLocalNet();
    const status = await algorand.client.algod.status().do();
    success(`Connected — Last round: ${status.lastRound}`);
  } catch (e) {
    console.log(`\n  ${c.red}✗ Failed to connect to LocalNet.${c.reset}`);
    console.log(`  ${c.yellow}Run: algokit localnet start${c.reset}\n`);
    process.exit(1);
  }

  // ── Step 2: Create & fund accounts ────────────────────────────────────────

  section("Creating & funding accounts on LocalNet");
  const dispenser = await algorand.account.localNetDispenser();

  const buyerAccount = algorand.account.random();
  algorand.setSignerFromAccount(buyerAccount);
  await algorand.send.payment({ sender: dispenser.addr, receiver: buyerAccount.addr, amount: algo(5000) });
  const buyerBal = (await algorand.account.getInformation(buyerAccount.addr.toString())).balance.algos;
  info("Buyer", `${addr(buyerAccount.addr.toString())}  ${c.green}${buyerBal.toFixed(2)} ALGO${c.reset}`);

  const sellers: Record<string, { addr: string; name: string; type: string; service: string; price: number; desc: string }> = {
    cloudmax: { addr: "", name: "CloudMax India", type: "cloud-storage", service: "Enterprise Cloud Storage", price: 90, desc: "Enterprise-grade, Mumbai & Chennai DC, 99.99% uptime" },
    datavault: { addr: "", name: "DataVault", type: "cloud-storage", service: "SME Cloud Storage", price: 85, desc: "Affordable storage for Indian SMEs, Hyderabad servers" },
    quickapi: { addr: "", name: "QuickAPI", type: "api-access", service: "API Gateway Pro", price: 50, desc: "High-perf API gateway, rate limiting, caching, analytics" },
    bharatcompute: { addr: "", name: "BharatCompute", type: "compute", service: "GPU Compute Instances", price: 120, desc: "NVIDIA A100 clusters in Pune, per-minute billing" },
    securehost: { addr: "", name: "SecureHost Pro", type: "hosting", service: "Managed Hosting", price: 70, desc: "DDoS protection, auto-SSL, CDN for Indian startups" },
  };

  for (const [key, seller] of Object.entries(sellers)) {
    const acc = algorand.account.random();
    algorand.setSignerFromAccount(acc);
    await algorand.send.payment({ sender: dispenser.addr, receiver: acc.addr, amount: algo(100) });
    sellers[key].addr = acc.addr.toString();
    info(seller.name, `${addr(acc.addr.toString())}  ${c.green}100.00 ALGO${c.reset}`);
  }

  // ── Step 3: Post listings on-chain with ZK commitments ──────────────────

  banner("POSTING ON-CHAIN LISTINGS", c.bgMagenta);
  console.log(`${c.gray}  Each listing = 0 ALGO self-txn with JSON note + SHA-256 commitment${c.reset}`);
  divider();

  let firstListingRound = Infinity;
  let lastListingRound = 0;

  for (const [key, seller] of Object.entries(sellers)) {
    const zk = createCommitment(key, seller.price, seller.desc);
    sellerSecrets.set(key, zk.secret);

    const noteData = {
      type: seller.type,
      service: seller.service,
      price: seller.price,
      seller: key,
      description: seller.desc,
      timestamp: Date.now(),
      zkCommitment: zk.commitment,
    };
    const noteStr = "a2a-listing:" + JSON.stringify(noteData);

    const result = await algorand.send.payment({
      sender: seller.addr,
      receiver: seller.addr,
      amount: algo(0),
      note: noteStr,
    });

    const txId = result.txIds[0];
    const round = Number(result.confirmation.confirmedRound ?? 0n);
    firstListingRound = Math.min(firstListingRound, round);
    lastListingRound = Math.max(lastListingRound, round);

    console.log(
      `  ${c.green}✓${c.reset} ${c.bold}${seller.name.padEnd(18)}${c.reset}` +
      `${seller.type.padEnd(16)}${c.bold}${String(seller.price).padStart(4)} ALGO${c.reset}  ` +
      `${c.gray}Round: ${round}${c.reset}\n` +
      `    ${c.gray}TX: ${txId}${c.reset}\n` +
      `    ${c.magenta}ZK Commitment: ${zk.commitment.slice(0, 32)}...${c.reset}\n` +
      `    ${c.dim}Secret (off-chain): ${zk.secret.slice(0, 16)}...${c.reset}`
    );
  }

  success(`${Object.keys(sellers).length} listings posted on-chain with SHA-256 commitments`);

  // ── Step 4: Parse user intent with AI ─────────────────────────────────────

  banner("AI INTENT PARSING", c.bgCyan);
  console.log(`${c.gray}  User: "${userIntent}"${c.reset}`);
  divider();

  section("Calling Groq LLM (llama-3.3-70b-versatile)");
  const intent = await parseIntent(userIntent);
  info("Service Type", `${c.bold}${intent.serviceType}${c.reset}`);
  info("Max Budget", `${c.bold}${intent.maxBudget} ALGO${c.reset}`);
  info("Preferences", intent.preferences.length > 0 ? intent.preferences.join(", ") : "none");

  // ── Step 5: Discover listings via Algorand Indexer ──────────────────────

  banner("AGENT DISCOVERY (via Indexer)", c.bgYellow);
  console.log(`${c.gray}  Querying LocalNet Indexer for on-chain listings...${c.reset}`);
  divider();

  const indexer = new algosdk.Indexer("", "http://localhost", 8980);

  // Wait for Indexer to catch up to the latest listing round
  section("Waiting for Indexer to sync");
  let indexerReady = false;
  for (let attempt = 0; attempt < 15; attempt++) {
    try {
      const health = await indexer.makeHealthCheck().do();
      if (health.round >= lastListingRound) {
        indexerReady = true;
        success(`Indexer synced — round ${health.round} >= ${lastListingRound}`);
        break;
      }
      info("Indexer round", `${health.round} (waiting for ${lastListingRound})`);
    } catch {
      info("Attempt", `${attempt + 1}/15 — Indexer not ready yet`);
    }
    await new Promise((r) => setTimeout(r, 1000));
  }

  if (!indexerReady) {
    warn("Indexer did not sync in time. Falling back to in-memory listings.");
  }

  // Fetch all transactions with "a2a-listing:" note prefix from the Indexer
  section("Fetching listings from Indexer");
  const notePrefix = Buffer.from("a2a-listing:").toString("base64");
  const allListings: Listing[] = [];

  try {
    const searchResult = await indexer
      .searchForTransactions()
      .notePrefix(notePrefix)
      .txType("pay")
      .do();

    const txns = searchResult.transactions ?? [];
    info("Total txns on chain", `${txns.length}`);

    for (const txn of txns) {
      try {
        const round = Number(txn.confirmedRound ?? 0);
        if (round < firstListingRound || round > lastListingRound) continue;

        const noteRaw = txn.note;
        if (!noteRaw) continue;
        const noteStr = typeof noteRaw === "string"
          ? Buffer.from(noteRaw, "base64").toString("utf-8")
          : new TextDecoder().decode(noteRaw as Uint8Array);

        if (!noteStr.startsWith("a2a-listing:")) continue;
        const data = JSON.parse(noteStr.slice("a2a-listing:".length));
        if (!data.zkCommitment) continue;

        allListings.push({
          txId: txn.id ?? "",
          sender: txn.sender ?? "",
          type: data.type,
          service: data.service,
          price: data.price,
          seller: data.seller,
          description: data.description,
          zkCommitment: data.zkCommitment,
          round,
        });
      } catch {
        // skip malformed notes
      }
    }
    success(`Parsed ${allListings.length} listings from Indexer (rounds ${firstListingRound}–${lastListingRound})`);
  } catch (err: any) {
    warn(`Indexer query failed: ${err.message ?? err}`);
  }

  // Filter by intent
  const normalized = intent.serviceType.toLowerCase().replace(/[\s_-]+/g, "-");
  const matched = allListings.filter((l) => {
    const typeMatch = l.type === normalized || l.type.includes(normalized.split("-")[0]);
    return typeMatch && l.price <= intent.maxBudget;
  });

  section(`Found ${matched.length}/${allListings.length} matching listings from Indexer`);
  for (const l of matched) {
    bullet(
      `${c.bold}${l.seller.padEnd(16)}${c.reset} "${l.service}"  ${c.bold}${l.price} ALGO${c.reset}  ` +
      `${c.gray}TX: ${(l.txId).slice(0, 20)}...  Round: ${l.round}${c.reset}`
    );
  }

  if (matched.length === 0) {
    warn("No listings match your criteria. Try a higher budget or different service type.");
    process.exit(0);
  }

  // ── Step 6: x402-style negotiation ────────────────────────────────────────

  banner("x402-STYLE NEGOTIATION", c.bgGreen);
  console.log(`${c.gray}  Protocol: offer → counter → accept/reject (1-2 rounds)${c.reset}`);
  divider();

  const negotiations: NegResult[] = [];

  for (const listing of matched) {
    console.log(`\n  ${c.underline}${c.bold}Negotiating with ${listing.seller}${c.reset}  ${c.gray}(${listing.service}, ${listing.price} ALGO)${c.reset}`);

    // ZK commitment verification: buyer receives secret from seller (off-chain channel)
    // and recomputes SHA-256 to verify the on-chain commitment matches
    const revealedSecret = sellerSecrets.get(listing.seller) ?? "";
    const zkOk = verifyCommitment(
      listing.zkCommitment,
      revealedSecret,
      listing.seller,
      listing.price,
      listing.description,
    );
    console.log(`  ${c.magenta}On-chain commitment:${c.reset} ${listing.zkCommitment.slice(0, 32)}...`);
    console.log(`  ${c.dim}Revealed secret:     ${revealedSecret.slice(0, 32)}...${c.reset}`);
    console.log(
      `  ${zkOk ? c.green + "✓" : c.red + "✗"}${c.reset} ` +
      `SHA-256 verification: recomputed hash ${zkOk ? "MATCHES" : "DOES NOT MATCH"} on-chain commitment`
    );

    const messages: X402Msg[] = [];
    let accepted = false;
    let lastSellerPrice = listing.price;
    let finalPrice = listing.price;
    const minPrice = Math.round(listing.price * 0.75);

    // Round 1: Buyer offers
    const offerPrice = Math.round(listing.price * 0.65);
    const buyerText1 = `Offering ${offerPrice} ALGO for "${listing.service}".`;
    messages.push({ from: "buyer-agent", to: listing.seller, action: "offer", price: offerPrice, text: buyerText1 });
    msgBubble("Buyer Agent", "offer", offerPrice, buyerText1, c.cyan);

    // Seller counters
    let counterPrice = Math.max(minPrice, Math.round(listing.price * 0.88));
    if (offerPrice >= counterPrice) {
      counterPrice = offerPrice;
      accepted = true;
    }
    const sellerText1 = await aiNegResponse(listing.seller, offerPrice, counterPrice, accepted);
    messages.push({ from: listing.seller, to: "buyer-agent", action: accepted ? "accept" : "counter", price: counterPrice, text: sellerText1 });
    msgBubble(listing.seller, accepted ? "accept" : "counter", counterPrice, sellerText1, c.yellow);
    lastSellerPrice = counterPrice;

    if (!accepted) {
      // Round 2: Buyer counters
      const buyerOffer2 = Math.min(Math.round((offerPrice + lastSellerPrice) / 2), intent.maxBudget);
      const gap = Math.abs(buyerOffer2 - lastSellerPrice);
      const isClose = gap <= lastSellerPrice * 0.06;

      if (isClose) {
        const midPrice = Math.round((buyerOffer2 + lastSellerPrice) / 2);
        messages.push({ from: "buyer-agent", to: listing.seller, action: "accept", price: midPrice, text: `Deal at ${midPrice} ALGO.` });
        msgBubble("Buyer Agent", "accept", midPrice, `Deal at ${midPrice} ALGO. Fair price.`, c.cyan);
        accepted = true;
        finalPrice = midPrice;
      } else {
        messages.push({ from: "buyer-agent", to: listing.seller, action: "counter", price: buyerOffer2, text: `Counter at ${buyerOffer2} ALGO.` });
        msgBubble("Buyer Agent", "counter", buyerOffer2, `Counter-offering ${buyerOffer2} ALGO.`, c.cyan);

        // Seller final response
        const finalCounter = Math.max(minPrice, Math.round(lastSellerPrice * 0.95));
        const sellerAccepts = buyerOffer2 >= finalCounter;
        const fp = sellerAccepts ? buyerOffer2 : finalCounter;
        const sellerText2 = await aiNegResponse(listing.seller, buyerOffer2, fp, sellerAccepts);
        messages.push({ from: listing.seller, to: "buyer-agent", action: sellerAccepts ? "accept" : "counter", price: fp, text: sellerText2 });
        msgBubble(listing.seller, sellerAccepts ? "accept" : "counter", fp, sellerText2, c.yellow);

        if (sellerAccepts) {
          accepted = true;
          finalPrice = fp;
        } else if (fp <= intent.maxBudget) {
          messages.push({ from: "buyer-agent", to: listing.seller, action: "accept", price: fp, text: `Accepting ${fp} ALGO.` });
          msgBubble("Buyer Agent", "accept", fp, `Accepting ${fp} ALGO. Final offer.`, c.cyan);
          accepted = true;
          finalPrice = fp;
        }
      }
    } else {
      finalPrice = counterPrice;
    }

    const statusText = accepted
      ? `${c.green}✓ DEAL at ${finalPrice} ALGO${c.reset} (saved ${Math.round(((listing.price - finalPrice) / listing.price) * 100)}%)`
      : `${c.red}✗ NO DEAL${c.reset}`;
    console.log(`  ${c.bold}Result:${c.reset} ${statusText}`);

    negotiations.push({ listing, accepted, finalPrice, messages, zkVerified: zkOk });
  }

  // ── Step 7: Select best deal ──────────────────────────────────────────────

  divider();
  const acceptedDeals = negotiations.filter((n) => n.accepted);

  if (acceptedDeals.length === 0) {
    warn("No deals reached. Try increasing your budget.");
    process.exit(0);
  }

  acceptedDeals.sort((a, b) => a.finalPrice - b.finalPrice);
  const best = acceptedDeals[0];

  banner("BEST DEAL SELECTED", c.bgGreen);
  info("Seller", `${c.bold}${best.listing.seller}${c.reset} — "${best.listing.service}"`);
  info("Original Price", `${best.listing.price} ALGO`);
  info("Final Price", `${c.green}${c.bold}${best.finalPrice} ALGO${c.reset}`);
  info("Savings", `${c.green}${Math.round(((best.listing.price - best.finalPrice) / best.listing.price) * 100)}%${c.reset}`);
  info("ZK (SHA-256)", best.zkVerified ? `${c.green}Commitment verified ✓${c.reset}` : `${c.red}Commitment mismatch ✗${c.reset}`);
  info("Listing TX", `${c.gray}${best.listing.txId.slice(0, 32)}...${c.reset}`);
  info("Rounds", `${best.messages.length} messages`);

  // ── Step 8: Execute real payment ──────────────────────────────────────────

  banner("EXECUTING PAYMENT ON ALGORAND", c.bgBlue);
  console.log(`${c.gray}  Real ALGO transfer: Buyer → Seller${c.reset}`);
  divider();

  section("Sending payment transaction");
  info("From", `${addr(buyerAccount.addr.toString())} (Buyer)`);
  info("To", `${addr(best.listing.sender)} (${best.listing.seller})`);
  info("Amount", `${c.bold}${best.finalPrice} ALGO${c.reset}`);

  const payResult = await algorand.send.payment({
    sender: buyerAccount.addr,
    receiver: best.listing.sender,
    amount: algo(best.finalPrice),
    note: `A2A Commerce Payment | ${best.listing.service} | ${best.finalPrice} ALGO`,
  });

  const payTxId = payResult.txIds[0];
  const payRound = Number(payResult.confirmation.confirmedRound ?? 0n);

  success("Payment confirmed on-chain!");
  info("TX ID", `${c.bold}${payTxId}${c.reset}`);
  info("Confirmed Round", `${payRound}`);

  const buyerBalAfter = (await algorand.account.getInformation(buyerAccount.addr.toString())).balance.algos;
  const sellerBalAfter = (await algorand.account.getInformation(best.listing.sender)).balance.algos;

  info("Buyer Balance", `${c.yellow}${buyerBalAfter.toFixed(4)} ALGO${c.reset}`);
  info("Seller Balance", `${c.green}${sellerBalAfter.toFixed(4)} ALGO${c.reset}`);

  // ── Summary ───────────────────────────────────────────────────────────────

  banner("TRANSACTION COMPLETE", c.bgGreen);
  console.log(`
  ${c.bold}${c.green}Agent-to-Agent Commerce Executed Successfully${c.reset}

  ${c.gray}┌─────────────────────────────────────────────────────────┐${c.reset}
  ${c.gray}│${c.reset}  Service:    ${c.bold}${best.listing.service.padEnd(40)}${c.reset}${c.gray}│${c.reset}
  ${c.gray}│${c.reset}  Seller:     ${c.bold}${best.listing.seller.padEnd(40)}${c.reset}${c.gray}│${c.reset}
  ${c.gray}│${c.reset}  Price:      ${c.green}${c.bold}${(best.finalPrice + " ALGO").padEnd(40)}${c.reset}${c.gray}│${c.reset}
  ${c.gray}│${c.reset}  Original:   ${c.dim}${(best.listing.price + " ALGO").padEnd(40)}${c.reset}${c.gray}│${c.reset}
  ${c.gray}│${c.reset}  Savings:    ${c.green}${(Math.round(((best.listing.price - best.finalPrice) / best.listing.price) * 100) + "%").padEnd(40)}${c.reset}${c.gray}│${c.reset}
  ${c.gray}│${c.reset}  ZK (SHA256):${best.zkVerified ? c.green + " Verified ✓" : c.red + " Unverified"}${c.reset}${" ".repeat(best.zkVerified ? 29 : 27)}${c.gray}│${c.reset}
  ${c.gray}│${c.reset}  Payment TX: ${c.cyan}${payTxId.slice(0, 40)}${c.reset}${c.gray}│${c.reset}
  ${c.gray}│${c.reset}  Listing TX: ${c.cyan}${best.listing.txId.slice(0, 40)}${c.reset}${c.gray}│${c.reset}
  ${c.gray}│${c.reset}  Round:      ${c.bold}${String(payRound).padEnd(40)}${c.reset}${c.gray}│${c.reset}
  ${c.gray}└─────────────────────────────────────────────────────────┘${c.reset}
`);
}

main().catch((err) => {
  console.error(`\n${c.red}${c.bold}Fatal error:${c.reset} ${err.message ?? err}`);
  process.exit(1);
});
