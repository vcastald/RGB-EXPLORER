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

Historical failed USDT orders are retained in private archived journals for refund tracking (see below). `merchant:status` reads only the active merchant journal, not archived history. **Do not repay or retry historical failed orders.**

Ports and node/API URLs can be configured in `.env`. Keep `.env` private. The local Fastify API has no user authentication; do not publish it.

### USDT receiving capacity (read-only backend stage)

With the API running, `GET /api/lightning/usdt/capacity` reports existing USDT channels **without calling the LSP**. To preview additional whole-USDT inbound capacity, POST `{"additionalUsdt":20}` to `/api/lightning/usdt/estimate`. It checks live LSP capabilities and returns a fee estimate for a separate receiving-only channel (50,000 LSP sats, 20,000 client sats, 20 test-USDT on the LSP side, 13,140 blocks). If the LSP times out, the estimate returns HTTP 503; retry the **lookup** later. No order or payment is created.

These backend endpoints are read-only. **Do not expose this unauthenticated local API publicly.**

### Open a test-USDT Lightning receiving channel

Prerequisites: run `npm run node:setup` and fund the current wallet with Mutinynet test BTC. The script proposes **20 USDT on the LSP side and zero USDT on your side**, with 50,000 LSP sats and 20,000 client sats. This is inbound receiving capacity, not a purchase of 20 USDT for your wallet. Actual receiving also depends on BTC carrier liquidity.

The script defaults to `https://api.mutinynet2.kaleidoswap.com`. Its provider is configured independently through `USDT_LSP_URL` in your private `.env`; changing `KALEIDO_API_URL` does not change this script's provider:

```dotenv
USDT_LSP_URL=https://api.mutinynet2.kaleidoswap.com
```

Run these steps **one at a time** in an interactive terminal:

1. **Create an order:**
   ```bash
   npm run usdt:setup
   ```
   Review the proposal and fee estimate, then type `CREATE USDT ORDER` to submit. This run does not pay the order.
2. **Review and pay the saved order:**
   ```bash
   npm run usdt:setup
   ```
   Review the final payment total and expiry, then type the displayed `PAY USDT <amount>` confirmation if acceptable. The payment includes your 20,000-sat channel allocation and the LSP fee; the miner fee is additional and not independently capped. The script requires a further 2,000-sat balance reserve, which is not a miner-fee cap.
3. **Check readiness:**
   ```bash
   npm run usdt:setup -- --status
   ```
   Repeat this status-only command while the channel opens. `COMPLETED` / `PAID` alone is not receiving readiness: require `receiveReady: true`, with the matching node channel ready and usable. Then test a small Lightning invoice using the endpoint below.

**Order history and retry safety:**

- Mutinynet2 uses `.local-app/usdt-order-mutinynet2.json`. The supported legacy provider `https://api.signet.kaleidoswap.com` uses `.local-app/usdt-order.json`. Journals contain private order credentials; never commit or publish them.
- Existing orders are resumed, not replaced. A journal belonging to another wallet/network/provider is rejected. When deliberately replacing a wallet, archive its journals under `.local-app/archived-orders/<old-node-pubkey>/` before starting a new order; never relabel an old order as belonging to the new wallet.
- This project's old-wallet merchant and USDT journals were moved to that archive. Historical failed orders still require separate refund follow-up; archiving does not refund them, and normal status commands do not read archived journals.
- **If order creation or payment times out, stop.** Do not delete the journal or lock file, create a replacement order, or resend payment. Use status and reconcile uncertain submissions with the LSP first. `FAILED` / `TO_REFUND` does not mean a refund has completed.

Fastify does not expose order/payment actions. Capacity checks and fee estimates never create or pay orders. These channel scripts are not needed for on-chain RGB receiving.

### Optional authenticated USDT channel provisioning API

This endpoint automates order creation **and payment** within an approved order-payment cap. It is disabled by default. Enable only on the trusted local backend by setting `ENABLE_CHANNEL_PROVISIONING=true` and a random `CHANNEL_ADMIN_TOKEN` of at least 32 characters in private `.env`, then restart the API. Never put the token in frontend/Vite configuration or publish it. Node setup and ports are unchanged. `USDT_LSP_URL` selects the same allowlisted providers as the script.

```bash
curl -sS -X POST http://127.0.0.1:3101/api/lightning/usdt/channels \
  -H "Authorization: Bearer $CHANNEL_ADMIN_TOKEN" \
  -H "Idempotency-Key: $(uuidgen)" \
  -H 'Content-Type: application/json' \
  -d '{"inboundUsdt":"20","clientBalanceSat":20000,"maxOrderPaymentSat":25000,"acceptUncappedMinerFee":true}'
```

Supply the token securely in your shell too; curl does not load `.env`. Keep the request's idempotency key if you need to repeat that exact request. The example cap is illustrative, not a current quote. The API fixes the LSP BTC allocation at 50,000 sats, channel lifetime at 13,140 blocks, and client USDT allocation at zero. It checks live provider limits before creating the order.

**Spending consent:** this POST authorizes payment of the final order if its total is within `maxOrderPaymentSat`; that total includes the client BTC allocation and LSP charge. Bitcoin miner fees are **additional**, paid at 2 sat/vbyte. The SDK cannot independently cap their absolute total, so `acceptUncappedMinerFee: true` is mandatory. The 2,000-sat balance reserve is not a fee cap. Do not enable/use this API if that policy is unacceptable.

The response is `202 Accepted` with an `operationId` and `Location` header. Poll the authenticated status endpoint:

```bash
curl -sS "http://127.0.0.1:3101/api/lightning/usdt/channels/OPERATION_ID" \
  -H "Authorization: Bearer $CHANNEL_ADMIN_TOKEN"
```

`QUEUED` → `VALIDATING` → `OPENING` → `READY` is the successful flow; order/payment submission states are durably written before sending. Only `READY` / `receiveReady: true` records that the matching channel was verified usable at completion, not that a test payment has settled. Use the capacity endpoint to check subsequent liquidity. Background read-only checks run every 20 seconds while the server is listening. GET returns stored progress and never submits a payment.

Safeguards and limitations:

- The same key and parameters return the same operation; changed parameters with that key return 409. Only one unresolved operation can exist. No submission is automatically retried.
- `REJECTED` means preflight failed before order submission. `ORDER_UNKNOWN`, `PAYMENT_UNKNOWN`, and `REVIEW_REQUIRED` need manual reconciliation, not another order. A restart never resumes spending; a persisted `OPENING` operation resumes read-only monitoring. There is deliberately no API to clear unresolved spending history.
- Existing active CLI journals block API provisioning, even if completed, and existing USDT channels block purchasing another. This conservative first version is for initial provisioning, not additional liquidity purchases. **Your existing paid CLI order should continue using CLI status; do not archive it merely to bypass this guard.**
- The API holds the merchant and both USDT CLI locks through opening or uncertain submission. Do not remove these locks to bypass an unresolved workflow. API operations are not displayed by CLI status commands.
- The private ledger is `.local-app/usdt-channel-operations.sqlite`. It contains order credentials; back it up securely with the wallet and never publish or delete it to retry a payment. Wallet/network/provider identity is checked. Historical CLI journals remain untouched.
- Tests use mocked SDK calls. Successful live channel opening and receiving are not guaranteed by unit tests. Other wallet spenders outside these CLI/API workflows are not coordinated by these locks.

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
