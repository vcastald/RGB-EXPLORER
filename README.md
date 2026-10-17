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

Look for BTC order `COMPLETED`, channel `ready: true` and `isUsable: true`, a connected peer, and positive **inbound** liquidity (API amounts are in **msat**). Order completion alone is not proof of readiness. Our BTC channel last passed these checks, but you must still test a small BTC Lightning invoice paid by a **different Mutinynet Lightning wallet** before relying on receipts. Invoice creation and payment-status backend endpoints are **not implemented yet**.

The existing failed USDT order is retained in the private journal for refund tracking; `merchant:status` can show it. **Do not repay or retry it.**

Ports and node/API URLs can be configured in `.env`. Keep `.env` private. The local Fastify API has no user authentication; do not publish it.
