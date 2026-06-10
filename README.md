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
| **Libraries (self-hosted)** | **pdf.js** (client-side PDF parsing), **Chart.js**, **FontAwesome**, Inter/Outfit fonts — all vendored in `public/vendor/`, no CDNs. |

The server only acts as a proxy for *optional* external calls (live IBM price, USD/EUR rates, product
lookups); **all personal/financial data — including PDF parsing — is processed entirely in your browser**.
Because every asset is self-hosted, the page makes **zero external requests**: you can disconnect from the
internet and the upload + analysis still work. Your statements never leave your machine.

---

## Project structure

```
.
├── server.js            # Express server + API proxies (Yahoo Finance price/FX, product lookup)
├── public/              # Frontend — served statically, no build step
│   ├── index.html       # Single page with the five tabs
│   ├── app.js           # All client-side logic: calculator, PDF parsing, portfolio, goal tracker, charts
│   ├── style.css        # Dark "glassmorphism" design system
│   └── favicon.svg
├── package.json         # express (runtime); pdf-parse + playwright are devDependencies only
├── package-lock.json
├── Dockerfile           # node:20-alpine production image
├── docker-compose.yml   # Container orchestration
├── .dockerignore        # Keeps dev files out of the image
├── .gitignore
├── DEPLOY.md            # Deployment guide (Docker + Caddy reverse proxy for HTTPS)
└── README.md
```

`public/` also contains a couple of legacy assets (`debug-portfolio.js`, `porsche_gt3_rs.png`) that are
no longer used by the app.

---

## Run locally

```bash
npm install
npm start          # or: npm run dev
```

Then open **http://localhost:3002** (override with the `PORT` env var). There is no build step — the
server serves `public/` as static files.

---

## Configuration

Set via environment variables (sensible defaults are baked in):

- `PORT` — HTTP port (default `3002`).
- `SEARXNG_URL` — a self-hosted [SearXNG](https://docs.searxng.org/) instance with JSON output enabled,
  used by the Ziel-Tracker's free-text product search.

Analytics: **none** — there is no telemetry. The app loads only its own self-hosted assets.

---

## Deploy

The app is containerised and meant to run on a server. See **[`DEPLOY.md`](DEPLOY.md)** for the full
instructions (Docker image, `docker-compose.yml`, and a Caddy reverse-proxy snippet for public HTTPS).

```bash
docker compose up -d --build
```

---

## Privacy

- All statements/payslips you upload are parsed **locally in your browser** — they never reach the
  server, and nothing is persisted server-side.
- This repository contains **no personal data**. Keep your own statements/payslips out of version
  control — the `.gitignore` excludes `payslips/`; never commit brokerage statements or their extracts.
