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

## Local development

Requires Node.js 20.19+ (or 22.12+) and npm.

```bash
npm install
cp .env.example .env  # first time only; edit ports if needed
npm run dev
```

Open http://127.0.0.1:5173 (or `WEB_PORT` from `.env`). Vite proxies `/api` to Fastify on `API_PORT` from the same root `.env`. The sample endpoint is `GET /api/health`.

```bash
npm run typecheck  # check both workspaces
npm test           # API and merchant-script tests
npm run build      # frontend bundle in apps/web/dist
```

Tailwind CSS v4 is configured via the Vite plugin and `apps/web/src/style.css`. The frontend and backend run as separate processes; production hosting/proxy configuration is not included.

## BTC Lightning on Mutinynet

Requires Docker Desktop, Node.js 22+, and **Mutinynet test BTC**. This is a local test wallet, not a production payment service. Setup uses KaleidoSDK and the Docker RGB Lightning Node; it does not use the Kaleido CLI.

### 1. Start the wallet (once per machine)

```bash
npm install
cp .env.example .env        # first time only
npm run node:setup          # creates wallet once; later runs unlock the same wallet
npm run node:status
```

Back up `.local-node/mnemonic`, `.local-node/password`, and the full `.local-node/data` directory (copy node data while stopped). **The mnemonic alone cannot restore Lightning channel state.** Keep these files private; never expose the local node API or Fastify to the internet. `npm run node:stop` stops the node without deleting it. Do not delete `.local-node/` to troubleshoot.

If starting from an unfunded wallet, run the API with `npm run dev` and get a **Mutinynet on-chain** deposit address:

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
