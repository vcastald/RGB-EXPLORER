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
npm run dev
```

Open http://127.0.0.1:5173. Vite proxies `/api` to Fastify on http://127.0.0.1:3101. The sample endpoint is `GET /api/health`.

```bash
npm run typecheck  # check both workspaces
npm test           # API smoke test
npm run build      # frontend bundle in apps/web/dist
```

Tailwind CSS v4 is configured via the Vite plugin and `apps/web/src/style.css`. The frontend and backend run as separate processes; production hosting/proxy configuration is not included.

## Local Mutinynet wallet (one per developer)

Requires Docker Desktop (with Compose) and Node.js 22+. The pinned KaleidoSwap 0.10.1 image supports both Linux amd64 and arm64 through Docker's multi-platform image index. On a new clone:

```bash
npm install
npm run node:setup
```

This starts one isolated RGB Lightning node and initializes **one new wallet per machine**. Re-running `npm run node:setup` after a restart unlocks the **same** wallet; it will not initialize another if setup is incomplete. Check `npm run node:status`; stop without deleting wallet data using `npm run node:stop`.

Fastify exposes `GET /api/node/status` (HTTP 200 with `{ "online": true, "pubkey": "..." }`, or HTTP 503 with `{ "online": false }`). Set `RGB_NODE_URL` on the API process to override the default node address.

The node API is at `http://127.0.0.1:3901` (Lightning peer port `10091`). It runs on KaleidoSwap's Mutinynet (`SignetCustom`) with transaction sync via `https://esplora.signet.kaleidoswap.com`. It is **not yet connected to the Fastify UI** and has no funds or channels. Avoid port 3901/10091 if already occupied; the port settings in Compose and the setup script must match.

**Back up immediately:** `.local-node/mnemonic` contains the secret recovery phrase; `.local-node/password` is the wallet password. Save these securely and never share or commit them. The mnemonic alone **cannot restore RGB/Lightning channel state**: preserve/back up the entire `.local-node/data` directory too, with the node stopped. `.local-node/` is gitignored. The node's unauthenticated API is bound to localhost only; do not expose it to the internet. This is a test-network setup, not a production wallet. Do not delete `.local-node/` to fix a setup error; inspect it first.
