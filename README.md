# RGB EXPLORER

## Team Members

- Yann — [@malgamoe](https://github.com/malgamoe)
- Aurelio — [@aurelio9851](https://github.com/aurelio9851)
- Valentino — [@vcastald](https://github.com/vcastald)

## Project Idea

**Manage your business on RGB with AI.**

A web application that helps business owners understand and manage their RGB operations through a local AI assistant.

The assistant summarizes transactions, monitors business activity, provides insights into treasury positions, and prepares transactions for the user to review and sign.

Users can also define their preferred treasury allocation in percentages across different assets. The AI monitors the current allocation and periodically proposes or prepares swaps to bring the treasury back in line with the target distribution, subject to user approval.

The goal is to simplify RGB business management through AI-powered insights, treasury management, and human-controlled financial operations.

## Tech Stack

- **Frontend:** React + Vite
- **Backend:** Fastify
- **AI:** Local LLM
- **Integration:** RGB-compatible wallet and infrastructure

*Work completed before the hackathon is available in the `lib/` directory.*

## Prerequisites

Before starting, ensure you have the following installed on your machine:

- **Git**
- **Node.js** 20.19+ or 22.12+ (Node.js 22+ recommended) and **npm**
- **Docker & Docker Compose** (Docker Desktop on macOS/Windows, or Docker Engine + Compose on Linux). Docker must be running to host the RGB Lightning node.

---

## Quickstart: Step-by-Step Setup (From Scratch)

If you have just cloned or never installed the repository before, follow these steps in order:

### 1. Clone the repository
```bash
git clone https://github.com/vcastald/repo-git.git
cd repo-git
```

### 2. Install dependencies
Install all root and workspace dependencies (`apps/api` and `apps/web`):
```bash
npm install
```

### 3. Configure environment variables
Copy the template configuration file to `.env`:
```bash
cp .env.example .env
```
The default configuration works out-of-the-box:
- `API_PORT=3101` (Fastify backend)
- `WEB_PORT=5173` (Vite React frontend)
- `RGB_NODE_PORT=3901` (Docker RGB Lightning Node API)
- `RGB_PEER_PORT=10091` (LDK peer port)
- `RGB_PROXY_ENDPOINT=rpcs://proxy.iriswallet.com/0.2/json-rpc`

### 4. Start and initialize the RGB Lightning Node
Make sure Docker is running, then execute:
```bash
npm run node:setup
```
What this does automatically:
1. Launches the Docker container `kaleidoswap/rgb-lightning-node` in the background on port `3901`.
2. Generates a secure wallet encryption password and seed (saved locally in `.local-node/password` and `.local-node/mnemonic`).
3. Unlocks the wallet and synchronizes it with the Mutinynet custom Signet network.
4. Confirms node status: you will see `Ready: signetcustom; node pubkey: <pubkey>`.

> [!IMPORTANT]
> Keep the `.local-node/` directory safe and private. Do not delete it, as it stores your local wallet database and channel state.
> You can check node status anytime with `npm run node:status` and stop it with `npm run node:stop`.

### 5. Launch the application
Start both the backend API and frontend dev server concurrently:
```bash
npm run dev
```

This starts:
- **Fastify Backend API** on `http://127.0.0.1:3101`
- **Vite React Frontend** on `http://127.0.0.1:5173`

### 6. Open the Dashboard
Navigate to [http://127.0.0.1:5173](http://127.0.0.1:5173) in your browser.

You will see:
- **Node Connected Badge** (green) confirming connection to the local RGB Lightning node.
- **Left Column:** **Agent Chat** — AI Treasury Assistant for analyzing positions, rebalancing proposals, and insights.
- **Center Column:** **Transaction Feed** — Live list of incoming/outgoing transfers across on-chain RGB (USDT, XAUT), on-chain BTC, and Lightning payments.
- **Right Column:** **Asset PieChart & Market Quotes** — Breakdown of confirmed (`Settled`) treasury holdings and live Kaleido market rates.
- **Top Bar Actions:**
  - **Deposit Addr:** Copy your on-chain Bitcoin deposit address for Mutinynet faucet funding.
  - **Target Allocation:** Configure target treasury percentages for BTC, XAUT, and USDT.
  - **Currency Selector:** Toggle portfolio valuation between `$ USD` and `₿ BTC`.
  - **Create USDT invoice:** Generate RGB-20 on-chain USDT invoices directly from the UI with custom amounts to claim test-USDT from faucets or counterparty wallets.

---

## Development & Testing Commands

```bash
# Typecheck TypeScript across all workspaces
npm run typecheck

# Run automated tests (API routes, services, and storage)
npm test

# Build production bundle for the frontend
npm run build

# Docker Node management
npm run node:status   # Check Docker container status
npm run node:stop     # Stop the node container cleanly
```

---

## Advanced: BTC Lightning Setup & Channel Management

If starting from a fresh unfunded wallet, obtain a **Mutinynet on-chain** deposit address via the running API or UI:

```bash
curl -X POST http://127.0.0.1:3101/api/wallet/deposit-addresses
```

Each POST derives a new address. Fund it with test BTC and wait for confirmation. Existing addresses: `GET /api/wallet/deposit-addresses`; balances: `GET /api/wallet/overview`. Neither funding nor starting the wallet creates a Lightning channel.

### 2. Buy a BTC inbound channel (new wallet only)

**If you already have a BTC order, skip this step.** Our current wallet already has a completed BTC order; rerunning setup will not buy a second channel.

```bash
npm run merchant:plan        # read-only fee estimate; not the final payment total
npm run merchant:setup       # review proposal; type CREATE BTC ORDER to place one order
npm run merchant:pay -- BTC  # review actual amount/address/expiry; type PAY BTC <amount> to pay
```

`merchant:setup` creates an order but **does not pay it**. `merchant:pay` makes an on-chain test-BTC payment only after typed approval; miner fee is extra. Do not pay an expired order, repeat a payment after an error/timeout, or delete `.local-app/merchant-orders.json` to try again: it holds the order ID, access token, and payment-attempt record. Investigate uncertain results first. The workflow is **BTC only**; it does not create RGB/USDT orders.

### 3. Check readiness (safe to repeat)

```bash
npm run merchant:status     # order state plus actual BTC channel readiness
# When API is running:
curl http://127.0.0.1:3101/api/lightning/readiness
```

Look for BTC order `COMPLETED`, channel `ready: true` and `isUsable: true`, a connected peer, and positive **inbound** liquidity (API amounts are in **msat**). Order completion alone is not proof of readiness. On this wallet, a 1,000-sat inbound BTC payment was verified `Succeeded` on Mutinynet. For a new wallet, test an invoice paid by a **different Mutinynet Lightning wallet** before relying on receipts.

With the API running, create a one-hour BTC invoice (1–40,000 sats):

```bash
curl -X POST 'http://127.0.0.1:3101/api/lightning/invoices' -H 'Content-Type: application/json' -d '{"amountSat":1000,"description":"test"}'
```

This POST creates a **new** invoice each time; save the returned `invoice` and pay it from another Mutinynet wallet. Check its status (replace the placeholder):

```bash
curl -X POST 'http://127.0.0.1:3101/api/lightning/invoices/status' -H 'Content-Type: application/json' -d '{"invoice":"PASTE_RETURNED_INVOICE_HERE"}'
```

Only `{"status":"Succeeded"}` proves receipt. These local endpoints have no authentication; do not expose the API publicly.

The existing failed USDT order is retained in the private journal for refund tracking; `merchant:status` can show it. **Do not repay or retry it.**

Ports and node/API URLs can be configured in `.env`. Keep `.env` private. The local Fastify API has no user authentication; do not publish it.

### USDT receiving capacity (read-only backend stage)

With the API running, `GET /api/lightning/usdt/capacity` reports existing USDT channels **without calling the LSP**. To preview additional whole-USDT inbound capacity, POST `{"additionalUsdt":20}` to `/api/lightning/usdt/estimate`. It checks live LSP capabilities and returns a fee estimate for a separate receiving-only channel (50,000 LSP sats, 20,000 client sats, 20 test-USDT on the LSP side, 13,140 blocks). If the LSP times out, the estimate returns HTTP 503; retry the **lookup** later. No order or payment is created.

These backend endpoints are read-only. **Do not expose this unauthenticated local API publicly.**

For a **separately approved** Mutinynet test-channel purchase, the local terminal has `npm run usdt:setup`: first run reviews the proposed order and requires `CREATE USDT ORDER`; the next run reviews saved final payment terms and requires `PAY USDT <amount>` before broadcasting. `npm run usdt:setup -- --status` only observes the saved order and node USDT channels. By default it uses `https://api.mutinynet2.kaleidoswap.com` and resumes `.local-app/usdt-order-mutinynet2.json` (private, never commit), including the existing successful order. `USDT_LSP_URL` configures the USDT provider independently of BTC; estimates use the same setting. The supported legacy value `https://api.signet.kaleidoswap.com` selects its original `.local-app/usdt-order.json` without overwriting it. Do not delete the journal or lock file after uncertain order/payment submission; reconcile instead of retrying. Miner fee is additional and not independently capped. No order or payment is automatically made by checking capacity/fees. The previous failed USDT orders remain **separate** in `.local-app/merchant-orders.json` and `.local-app/usdt-order.json` and still need refund follow-up. Fastify does not expose order/payment actions; USDT invoices are available through the endpoint below.

### Create a test-USDT Lightning invoice

`POST /api/lightning/usdt/invoices` accepts a decimal-string `amountUsdt` (up to six decimals, 0.000001–1000) and optional `description` (200 characters).

```sh
curl -sS http://127.0.0.1:3101/api/lightning/usdt/invoices -H 'Content-Type: application/json' -d '{"amountUsdt":"1","description":"Test sale"}'
```

The invoice requests the specified test-USDT **plus 3,000 sats of BTC carrier**, not a fee-only BTC amount. It expires after 300 seconds. Creation requires an opened, ready, usable channel with enough USDT and BTC inbound capacity on the same channel; capacity is not reserved and settlement is not guaranteed. Returns 201 with `invoice`, `assetId`, `assetAmount` (integer units), `assetPrecision`, `amountUsdt`, `carrierSat`, and `expirySec`; invalid amounts return 400, unavailable capacity/network 409, and node failures 503. No LSP order or payment is created. This local unauthenticated API is not intended for public exposure.

### Create an on-chain test-USDT invoice

For the faucet's **RGB on-chain** form (not Lightning):

```sh
curl -sS http://127.0.0.1:3101/api/rgb/usdt/invoices -H 'Content-Type: application/json' -d '{}'
```

Copy the returned `invoice` (`rgb:…`). This requests the known Mutinynet USDT asset without fixing an amount, suitable for a fixed-size faucet claim. Optionally pass `{"amountUsdt":"0.1"}` for an exact amount (six decimal places, 0.000001–1000). Witness receiving, one confirmation, and a one-hour expiry are used. No Lightning channel or 3,000-sat Lightning carrier is required. The sender funds the on-chain transfer.

The response includes `recipientId` and `batchTransferIdx` for subsequent transfer checks; invoice creation is **not** proof of payment. Receipt requires RGB transfer refresh and on-chain settlement. The wallet must already know this USDT contract; unknown assets return 409 rather than silently creating an any-asset invoice. Configure `RGB_PROXY_ENDPOINT` for consignment transport. Node failures return 503; inspect transfers before retrying an uncertain creation. No sending or spending endpoint is exposed.

### Create an on-chain test-XAUT invoice

`POST /api/rgb/xaut/invoices` uses the Mutinynet XAUT contract `rgb:qrilKFY5-VBmdIOF-cH5ziA8-9K9MIFS-OwsjmXe-yOv3Oa8` with **9 decimal places**, witness receiving, one confirmation and a one-hour expiry.

Once XAUT is known to the wallet, request an exact amount (0.000000001–1000):

```sh
curl -sS http://127.0.0.1:3101/api/rgb/xaut/invoices -H 'Content-Type: application/json' -d '{"amountXaut":"0.01"}'
```

For a first faucet receipt when XAUT is unknown, explicitly allow an **any-asset** invoice:

```sh
curl -sS http://127.0.0.1:3101/api/rgb/xaut/invoices -H 'Content-Type: application/json' -d '{"allowAnyAsset":true}'
```

Select **XAUT** in the faucet's **RGB on-chain** form. Bootstrap invoices must omit the amount; the faucet determines its claim amount. The response reports `anyAsset: true`, `assetId: null`, and `expectedAssetId` plus a warning: **the invoice itself does not restrict the asset**. Verify the received contract after refresh before treating the transfer as XAUT. Without explicit permission, an unknown asset returns 409. If XAUT is already known, the invoice stays XAUT-specific even with this permission. No XAUT channel, payment, or send operation is created by these endpoints.

### Server-side on-chain receiving

While Fastify is listening, it checks for pending incoming RGB transfers every 20 seconds and refreshes the wallet automatically, including unknown-asset receipts. Refreshes never overlap; errors back off up to 120 seconds. Shutdown waits for an active refresh. The node must remain running and unlocked. The sender may also need to refresh before broadcasting.

New on-chain USDT/XAUT invoices save their recipient, expected contract, amount, expiry and node identity in the existing local SQLite database. Tracking survives server restarts. Check using the `recipientId` returned by invoice creation:

```sh
curl -sS -G http://127.0.0.1:3101/api/rgb/transfers/status --data-urlencode 'recipientId=PASTE_RECIPIENT_ID'
```

`paid` is true only for a settled incoming transfer with the expected contract and exact requested amount (or a positive fungible amount for amount-free invoices). The response includes actual asset, amount in base units, transaction ID, status and refresh health. Unknown-asset XAUT invoices are not considered paid merely because some asset arrived. Status queries do not trigger a refresh themselves.

Invoices created before tracking was added are still refreshed and can be inspected by recipient, but return `tracked: false` and `paid: false`: their original intent was not persisted. Do not issue another invoice or send again merely to obtain a tracked record. An invoice-creation persistence error is uncertain; inspect node transfers before retrying. This API remains local and unauthenticated; do not expose it publicly.

#### First USDT receipt on a fresh wallet

No `usdt:setup` or Lightning channel is needed for on-chain receiving. If the wallet does not know USDT yet, explicitly create an amount-free bootstrap invoice:

```sh
curl -sS http://127.0.0.1:3101/api/rgb/usdt/invoices -H 'Content-Type: application/json' -d '{"allowAnyAsset":true}'
```

Select **USDT** at the faucet. This invoice accepts **any RGB asset**; the server records the expected USDT contract and only verifies payment against that contract. Do not include `amountUsdt` with bootstrap permission. After receipt and refresh, exact-amount USDT invoices work normally. Without explicit permission, unknown USDT still returns 409 rather than silently relaxing the asset restriction.

To request an immediate on-chain RGB wallet refresh (USDT/XAUT, including unknown-asset receipts):

```sh
curl -sS -X POST http://127.0.0.1:3101/api/rgb/transfers/refresh
```

Returns `refreshed: true` and `refreshedAt` after the node call completes, or HTTP 503 on failure/uncertain completion. This shares the background refresh lock and coalesces concurrent manual requests. A successful refresh **does not mean an invoice is paid**; check its transfer status separately. Refresh processes wallet transfers and acknowledgements; it is not a read-only operation or a Lightning-payment retry. Keep this unauthenticated endpoint local.
