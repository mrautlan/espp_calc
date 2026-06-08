# 📋 Handover — IBM ESPP Navigator & Tax Calculator

A single-page web app that helps a German IBM employee manage their **Employee Stock Purchase
Plan (ESPP)**: model the economics of buying/selling, analyse the *real* portfolio from uploaded
statements, and track progress toward a savings goal — all with correct German taxation.

This document is the source of truth for the **current** state of the code. It supersedes any
earlier description (an earlier version of this file described a "synthetic 2024 lot / FIFO pool"
balance model that has since been **removed** — see §5).

---

## 1. Tech stack & layout

| Layer | Detail |
|-------|--------|
| **Backend** | Node.js + **Express** (`server.js`). The *only* runtime npm dependency is `express`. |
| **Frontend** | Vanilla **HTML/CSS/JS** in `public/` — no build step, no framework. |
| **Libraries (CDN)** | **pdf.js** (client-side PDF parsing), **Chart.js** (charts), **FontAwesome** (icons), Google Fonts (Inter/Outfit). |
| **Styling** | Dark glassmorphism design system in `public/style.css` (CSS custom properties in `:root`). |

```
server.js                 Express server + API proxies (Yahoo Finance, FX, Amazon)
package.json              express (prod); pdf-parse + playwright are devDependencies (test-only)
public/
  index.html              Single page, 6 tabs (sections with .tab-content)
  app.js                  ~3200 lines — all client logic
  style.css               Design system + responsive rules
  porsche_gt3_rs.png      (legacy asset, still referenced as a fallback image — see §7.3)
Dockerfile, docker-compose.yml, .dockerignore, DEPLOY.md   Deployment (see §9)
payslips/                 ⚠️ the owner's PRIVATE statements/payslips — NEVER ship these
*.txt, *.pdf (root)       ⚠️ private extractions / reference data — git/Docker ignored
```

**Run locally:** `npm install && npm start` → http://localhost:3002 (port from `PORT`, default 3002).

---

## 2. The five tabs (`#tab-*`, switched in `initTabs()`)

1. **Rechner** (`#tab-calculator`) — *hypothetical/forward* ESPP calculator. Inputs (salary, savings
   rate, tax settings, sell price, holding months) → net profit after German taxes & fees.
   Can auto-fill inputs from an uploaded **payslip** PDF (`initPdfUploader` → `parsePayslipText`).
2. **Portfolio-Analyse** (`#tab-portfolio`) — the *real* portfolio from uploaded **EquatePlus** +
   **CapTrader** statements: where shares are, cost basis, a FIFO sell simulator, and buy/sell history.
   Tables are sortable (click any header; delegated sorter, see `sortPortfolioTable`).
3. **Ziel-Tracker / Sparziel-Tracker** (`#tab-porsche`) — a **general savings-goal tracker**.
   ⚠️ Internal id is still `porsche` and many functions/ids keep the `porsche*` prefix (kept on
   purpose to limit churn; **not** user-visible). The Porsche preset was removed. See §7.
4. **Reiseführer** (`#tab-guide`) — an "about this tool" overview + the 3 strategies + the
   **Aktientransfer** how-to (EquatePlus→CapTrader, formerly its own tab, merged in here).
5. **Steuern (DE)** (`#tab-taxes`) — German tax explanation, incl. the **W-8BEN** card.

A **first-visit welcome modal** (`initWelcome`, gated by `localStorage['espp_seen_welcome']`)
explains the tool once; the header **"?" button** (`#helpBtn`) re-opens it anytime. `initTabs`
falls back to `calculator` if a saved `espp_active_tab` no longer exists (e.g. the removed
`transfer` tab). The header has a live IBM price ticker (`fetchLiveStockPrice`) and the nav is a
horizontally-scrollable bar on mobile.

---

## 3. Backend API (`server.js`)

All external calls are proxied server-side (CORS / anti-bot). Yahoo calls use **`curl`** via
`child_process.exec` (so the Docker image installs curl). The Amazon endpoint uses **Node `https`
only** (no shell → no injection).

| Endpoint | Purpose |
|----------|---------|
| `GET /api/stock` | Current IBM price + EUR (legacy, used by the Rechner ticker). Returns fallback values on failure. |
| `GET /api/stock/current` | Current IBM price + USD/EUR rate (used by the Portfolio tab). |
| `GET /api/stock/historical` / `…/historical-range` | Monthly / ranged historical IBM prices. |
| `GET /api/forex/historical-range` | Historical USD/EUR. |
| `GET /api/product?url=` | **Amazon product extraction** for the goal tracker: title (og:title), image (og:image / dynamic-image / hiRes), price (priceAmount JSON / a-offscreen / JSON-LD; de+en formats). Amazon-host **allowlist** (SSRF guard). Returns `{success, blocked, title, image, price, currency}`. |

⚠️ **Amazon caveat:** Amazon rate-limits/bot-blocks repeated or datacenter-IP requests
(`blocked:true`). The frontend then keeps the manual price input usable. On a real server this may
fail often → a proper product API would be the robust fix.

---

## 4. The Rechner tab (`calculateESPP`)

Pure forward model — assumes all monthly purchases happen at the *current* price.

Tax logic (verified against IBM HR's German ESPP guidance):
- **15 % ESPP discount** → `Marktwert = Beitrag ÷ 0.85`.
- **§ 3 Nr. 39 EStG allowance** 2.000 €/yr (1.440 € ≤2023), scaled by years → the discount above it
  is taxed as **wage income (GwV)** at the marginal rate (`× (1+church+soli)`).
- **Capital-gains tax** on sale: cost basis = **undiscounted FMV** (the discount was already wage-taxed);
  rate **26,375 %** / 27,8186 % (8 % church) / 27,996 % (9 % church); Günstigerprüfung applied.
- **Sparer-Pauschbetrag is NOT auto-applied** — shown only as a note (depends on the user's other sales).
- **Broker "Steuer-Falle"** (`broker === 'german'`): § 43a Abs. 2 EStG — tax = `30 % × Erlös ×
  Abgeltungsteuer` (Ersatzbemessungsgrundlage), with a warning note. CapTrader ≈ 4 €, EquatePlus ≈
  $19.95 + $35 wire + 0,5 % FX + 13 €.

The "Verkaufsprozess im Detail" is a collapsible `<details>`; the live stock price auto-loads on page load.

---

## 5. Portfolio-Analyse — data model (⚠️ read this before changing balances)

**Golden rule: derive held balances from the AUTHORITATIVE reported figures, never from a
purchases-minus-transfers estimate or a synthetic-lot FIFO pool** (both gave badly wrong numbers
historically — e.g. ~40 or 78 shares when the truth was ~0.6 or ~11).

- **EquatePlus held** = sum of the Page-2 holdings lots (`parseEquatePlusHoldings` → `equatePlusHoldings`)
  of the **most recent** Plan Holdings Statement. Exact (e.g. 0.61443 as of 1 Jun 2026).
- **CapTrader held** = the "Offene Positionen" open-position quantity (and CapTrader's reported avg
  cost basis) of the latest CapTrader statement.
- **In-transit** = EquatePlus transfers-out with no matching CapTrader FOP-In (`getInTransitShares`).
- **`heldLots`** (built in `analyzePortfolio`) = the EquatePlus held lots + ONE aggregate CapTrader
  lot (qty + `averagePriceUSD`). `totalCombinedShares` = eqHeld + ctHeld. `activeLots` aliases
  `heldLots` (the `// incl. synthetic bridge` comment on it is stale — there are no synthetic lots).

**Date-awareness:** each balance is valid only as of its statement's end date. The Depot-Konsolidierung
card shows each "Stand des Statements" and renders a **red warning** (`consolidationDateWarning`) when
the two latest statements differ by > 90 days (mixing dates = wrong total).

**`simulateSale(lots, qty, sellPriceUSD, broker)`** is the shared engine (FIFO over lots, German
capital-gains tax church-aware, broker fee) used by the sell simulator AND the goal tracker. Cost
basis per lot: `purchasePriceUSD` = what paid, `fmvUSD` = tax basis.

`displayPortfolioResults` renders the bottom card as **two sections**: "EquatePlus · Käufe" (full buy
history at real per-month prices; dividends grouped + de-emphasized) and "CapTrader · Bestand &
Verkäufe" (aggregate holding with CapTrader's avg cost + a note that it was bought over months at
EquatePlus, plus the realized sells table).

---

## 6. PDF parsing (client-side, `parsePDF` dispatches by content)

Three statement formats are supported. pdf.js text per page (`pageText = items.join(' ')`), with
`cleanSpacedText` applied to heavily letter-spaced pages.

1. **CapTrader / IBKR Umsatzübersicht** (`parseCapTraderStatement`) — sells, FOP-In transfers, open
   position, **cash balances** (Cash-Bericht → `cash:{usd,eur,totalEUR}`, shown in `#capTraderCashBlock`),
   statement period (general `<Month> d, y - <Month> d, y`, German months via `parseGermanDate`).
   Handles BOTH CapTrader and **direct Interactive Brokers (IBKR)** statements — IBKR is monthly
   (not Januar-start), inserts an "Offen" column in Offene Positionen (`IBM - 11 1 …`), omits the
   per-currency EUR cash block when EUR is the only currency, and may list the broker's own "IBKR"
   stock (ignored — only IBM is parsed). Detection (`includes('Umsatzübersicht')`) already covers both.
2. **EquatePlus "Plan Holdings Statement" (2025+)** — `parseEquatePlusHoldings` (Page-2 held lots),
   `parseYearEndStatement` (Page-3 purchases + dividend reinvestments), `extractEquatePlusTransfers`.
3. **OLD Computershare "Employee Plan Statement" (pre-migration, e.g. 2024)** —
   `parseOldHoldingsStatement`. Column-stacked ledger; located via the invariant **purchase price =
   0.85 × FMV** (15 % discount), then dates/shares aligned, the "… Transfer … -N" detail read, and
   year-end held lots reconstructed via FIFO.

Detection order in `parsePDF`: CapTrader → Plan Holdings → "Employee Plan Statement"/"Balance Forward"
→ Purchase Activity (unsupported) → error.

---

## 7. Goal tracker (`#tab-porsche`, user-facing "Sparziel-Tracker")

A general goal tracker. State: `state.goal = {name, image, price, url}` (default
`{name:'Mein Sparziel', price:50000}`), persisted in localStorage `espp_goal_v1`.

7.1 **Set a goal** via the name + EUR amount inputs, OR paste an **Amazon link** (`loadGoalFromUrl` →
`/api/product`) to auto-fill name/image/price (USD→EUR via live rate). `renderGoal` syncs the UI; the
goal name is an elegant inline-title input (`.goal-name-input`).

7.2 **The math (`updateGoalTracker`)** — *prefers REAL portfolio data*:
- If statements are uploaded (`portfolioState.heldLots`): net value = `simulateSale(all held)` cashout;
  progress = cashout ÷ goal; **"shares to sell from YOUR holdings"** via `solveSharesToSell`
  (binary search → "X von Y Aktien"); if the goal exceeds holdings → projects future ESPP accumulation
  (time-to-goal).
- Else → falls back to the Rechner's hypothetical (`rechnerEconomics`, set in `calculateESPP`), with a
  subtitle hint to upload statements.
- Called from `calculateESPP` (Rechner/goal changes) and `analyzePortfolio` (so uploads refresh it).

7.3 Still keeps the radial progress, the projection chart (`updatePorscheGrowthChart`), and the
"Ziel-Prognose" card. `getTargetPrice()` is the single source of the target amount.

---

## 8. Persistence (localStorage)

| Key | Written by | Restored by |
|-----|-----------|-------------|
| `espp_active_tab` | tab clicks | `initTabs` |
| `espp_calculator_state` | `saveCalculatorState` (Rechner inputs) | `loadCalculatorState` |
| `espp_portfolio_state` | `savePortfolioState` (parsed statement data; Dates revived on load) | `loadPortfolioState` |
| `espp_goal_v1` | `saveGoal` | `initPorscheTracker` restore block |

All user data is processed **client-side only**; nothing is uploaded to or stored on the server.

---

## 9. Deployment (Docker)

Owner's machine has **no Docker** and won't get it — the app deploys on a **separate server**. Don't
try to `docker build` locally; reason about correctness and verify the app with `node server.js`.

- `Dockerfile` — `node:20-alpine`, installs `curl` (Yahoo), `npm ci --omit=dev` (express only), copies
  ONLY `server.js` + `public/` (never payslips), runs as non-root with a healthcheck.
- `docker-compose.yml` — maps `${APP_PORT:-8080}:3002`, `restart: unless-stopped`.
- `DEPLOY.md` — full instructions incl. a Caddy reverse-proxy snippet for public HTTPS.
- After any `server.js`/frontend change: rebuild → `docker compose up -d --build`. No new npm deps
  were added by the Amazon endpoint (Node `https`/`zlib` builtins).

---

## 10. Known limitations / gotchas

- **Mobile:** `html`/`body` use `overflow-x: clip` (NOT `hidden`) so off-screen tooltips don't add
  horizontal scroll while keeping the sticky header working. Don't switch to `hidden`.
- **Historical EUR/USD at purchase date** IS now applied: each held lot is tagged with the USD→EUR
  rate at its purchase date (`assignPurchaseRates` → `lot.purchaseRate`, via `/api/forex/historical-range`),
  and `simulateSale` converts the **cost basis at that purchase-day rate** while **proceeds use the
  current/sale rate** (German Anlage-KAP rule). Falls back to the current rate if FX history is
  unavailable. The CapTrader aggregate lot uses the rate at its (synthetic) date — a rough proxy,
  since per-trade dates aren't known. The EquatePlus *buy-history* table still shows EUR at the
  current rate (display-only, not part of the tax calc).
- **Amazon extraction** is best-effort and often blocked from datacenter IPs (see §3).
- **2024 EquatePlus statement is the oldest available** — purchases before 2024 aren't shown.
- **Internal naming:** the goal tab is internally `porsche*` (ids/functions/CSS). User-facing text says
  "Ziel-/Sparziel-Tracker". Renaming everything was deliberately avoided.
- `public/debug-portfolio.js` and `porsche_gt3_rs.png` are legacy and largely unused.

---

## 11. Suggested next steps

1. ~~Historical FX at purchase date for accurate EUR cost basis (Anlage KAP).~~ **DONE** — see §10.
2. **Dividend (cash) income summary** in Portfolio-Analyse (CapTrader/EquatePlus cash dividends + US
   withholding are in the statements but not yet surfaced).
3. **Robust product lookup** (proper API) to replace fragile Amazon scraping.
4. **German tax PDF export** (Anlage KAP) of the realized FIFO sales.
5. **Lot management GUI** (manually edit/add/delete parsed lots).
6. Optionally finish renaming internal `porsche*` identifiers to `goal*` for clarity.

---

*Tip for the next agent: the project has persistent memory under the session's `memory/` dir
(`portfolio-balance-model.md`, `goal-tracker.md`, `deployment-environment.md`) capturing the
hardest-won, non-obvious facts — keep them in sync when you change the balance model, goal tracker, or
deployment assumptions.*
