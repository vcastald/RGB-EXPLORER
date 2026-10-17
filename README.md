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
npm test           # API smoke test
npm run build      # frontend bundle in apps/web/dist
```

Tailwind CSS v4 is configured via the Vite plugin and `apps/web/src/style.css`. The frontend and backend run as separate processes; production hosting/proxy configuration is not included.

## Local Mutinynet wallet (one per developer)

Requires Docker Desktop (with Compose) and Node.js 22+. Copy `.env.example` to `.env` first (if you haven't already). The pinned KaleidoSwap 0.10.1 image supports both Linux amd64 and arm64 through Docker's multi-platform image index. On a new clone:

```bash
npm install
npm run node:setup
```

This starts one isolated RGB Lightning node and initializes **one new wallet per machine**. Re-running `npm run node:setup` after a restart unlocks the **same** wallet; it will not initialize another if setup is incomplete. Check `npm run node:status`; stop without deleting wallet data using `npm run node:stop`.

Fastify exposes `GET /api/node/status` (HTTP 200 with `{ "online": true, "pubkey": "..." }`, or HTTP 503 with `{ "online": false }`). Set `RGB_NODE_URL` on the API process to override the default node address.

By default the node API is at `http://127.0.0.1:3901` (Lightning peer port `10091`). Change `RGB_NODE_PORT` and `RGB_PEER_PORT` in `.env` before creating a node if those ports are taken; Docker Compose, setup and Fastify read these values. `RGB_NODE_URL` optionally overrides Fastify's node target only. Do not change node ports after creating a wallet without first stopping the container and checking your setup. It runs on KaleidoSwap's Mutinynet (`SignetCustom`) with transaction sync via `https://esplora.signet.kaleidoswap.com`. It is **not yet connected to the Fastify UI** and has no funds or channels. Keep `.env` local; `.env.example` contains only safe defaults.

**Back up immediately:** `.local-node/mnemonic` contains the secret recovery phrase; `.local-node/password` is the wallet password. Save these securely and never share or commit them. The mnemonic alone **cannot restore RGB/Lightning channel state**: preserve/back up the entire `.local-node/data` directory too, with the node stopped. `.local-node/` is gitignored. The node's unauthenticated API is bound to localhost only; do not expose it to the internet. This is a test-network setup, not a production wallet. Do not delete `.local-node/` to fix a setup error; inspect it first.

## Read-only wallet overview API

`GET /api/wallet/overview` returns `{ observedAt, network, height, pubkey, btc, assets, channels }`. `btc.vanilla` and `btc.colored` are satoshi balances (`settled`, `future`, `spendable`); `btc.cached: false` means the request syncs the BTC wallet to find recent deposits; the request can take longer if the indexer is slow. `assets` contains `{ schema, assetId, ticker, name, precision, balance }` and `channels` contains `{ channelId, peerPubkey, status, usable, capacitySat, localBalanceSat, assetId }`. When the node is unavailable or locked, it returns HTTP 503 `{ "error": "Node unavailable" }` (no partial snapshot). The endpoint does not include payment history yet.

```bash
curl http://127.0.0.1:3101/api/wallet/overview
```

Fastify decorates the app with a KaleidoSwap service from `apps/api/src/services/kaleido.ts`; the route lives in `apps/api/src/routes/wallet.ts`. Offline tests inject a fake service or SDK node; the curl command exercises the live node. No frontend changes are needed.

## Generate a BTC deposit address

With the Mutinynet node running and unlocked, request an address from the backend:

```bash
curl -X POST http://127.0.0.1:3101/api/wallet/deposit-addresses
```

Returns HTTP 201 `{ "address": "...", "network": "SignetCustom", "nodePubkey": "...", "createdAt": "..." }`. **Each POST requests a fresh address** from the same wallet; use it for the first deposit or for subsequent deposits. It does not contact a faucet, fund the wallet, or create a Lightning channel. Addresses are recorded in a local SQLite database (`APP_DB_PATH` in `.env`, default `.local-app/addresses.sqlite`). List recorded addresses for the current wallet with `curl http://127.0.0.1:3101/api/wallet/deposit-addresses`. This database is an app-side record, **not a wallet backup**: node-generated addresses may exist even if saving fails or the process crashes. HTTP 503 means the node is unavailable or not on Mutinynet; HTTP 500 on storage failure means do not blindly retry the request. Only send **Mutinynet test BTC** to these addresses; back up the wallet's node data before funding it. This local dev endpoint has no user authentication—do not expose Fastify publicly.
