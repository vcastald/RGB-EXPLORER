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
