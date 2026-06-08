# IBM ESPP Navigator & Steuer-Rechner

A single-page web app that helps a German **IBM employee** make sense of their **Employee Stock
Purchase Plan (ESPP)** — model the economics of buying and selling, analyse the *real* portfolio from
uploaded statements, and track progress toward a savings goal — all with correct German taxation.

> ⚠️ **Privacy first:** every statement and payslip you upload is parsed **entirely in your browser**.
> Nothing is uploaded to or stored on a server.

---

## Features

The app has five tabs:

- **Rechner** — a forward calculator: enter salary, savings rate, tax profile, sell price and holding
  period and see your **net profit after German taxes & fees**. Inputs can be auto-filled from an
  uploaded **payslip** PDF.
- **Portfolio-Analyse** — upload your real **EquatePlus** and **CapTrader / Interactive Brokers (IBKR)**
  statements to see your actual holdings, cost basis (converted at the FX rate on each purchase date),
  current value, cash balance, and net proceeds if sold now — plus a FIFO sell simulator and a sortable
  buy/sell history.
- **Ziel-Tracker** — set a savings goal (or load a product by link / free-text search) and see how many
  shares you'd need to sell, or how long you'd still need to save.
- **Reiseführer** — an overview of the tool, three strategies for handling your ESPP shares, and the
  EquatePlus → CapTrader/IBKR transfer guide.
- **Steuern (DE)** — how the ESPP is taxed in Germany (discount, allowance, capital-gains tax, W-8BEN).

Correct German tax logic is built in: the **15 % ESPP discount**, the **§ 3 Nr. 39 EStG** allowance,
wage tax on the discount above it, **Abgeltungsteuer** on capital gains (church-tax aware), broker
fees, and the historical USD/EUR rate at the purchase date.

---

## Tech stack

| Layer | Detail |
|-------|--------|
| **Backend** | Node.js + **Express** (`server.js`). Only runtime dependency is `express`. |
| **Frontend** | Vanilla **HTML/CSS/JS** in `public/` — no build step, no framework. |
| **Libraries (CDN)** | **pdf.js** (client-side PDF parsing), **Chart.js**, **FontAwesome**, Google Fonts. |

The server only acts as a proxy for external calls (live IBM price, USD/EUR rates, product lookups);
all personal/financial data is processed client-side.

---

## Run locally

```bash
npm install
npm start
```

Then open **http://localhost:3002** (override with the `PORT` env var).

---

## Deploy

The app is containerised and meant to run on a server. See **[`DEPLOY.md`](DEPLOY.md)** for the full
instructions (Docker image, `docker-compose.yml`, and a Caddy reverse-proxy snippet for public HTTPS).

```bash
docker compose up -d --build
```

Two integrations expect a reachable host (set via env vars, defaults baked in):

- `SEARXNG_URL` — a self-hosted [SearXNG](https://docs.searxng.org/) instance (JSON output enabled),
  used for the Ziel-Tracker's free-text product search.
- Umami analytics — the snippet in `public/index.html` points at a self-hosted Umami instance.

---

## Privacy & sensitive files

- All uploaded statements/payslips are parsed **locally in the browser** — they never reach the server.
- The `payslips/` directory and the root `*.txt` / `*.pdf` files contain the owner's **private**
  statements and payslips. They are **git-ignored and Docker-ignored** and must **never be shipped**.

---

## Documentation

`HANDOVER.md` is the source of truth for the internal architecture — the data model, PDF parsing for
each statement format, the tax calculations, persistence, and deployment details. Read it before
changing balance/tax logic.
