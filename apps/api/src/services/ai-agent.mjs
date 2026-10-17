
import process from "node:process";

import {
  completion,
  cancel,
  loadModel,
  unloadModel,
  close as closeQvac,
  QWEN3_5_2B_MULTIMODAL_Q4_K_M,
} from "@qvac/sdk";

import {
  Engine,
  SkillRegistry,
  ToolRegistry,
} from "@kaleidorg/mind";

import { createQvacProvider } from "@kaleidorg/mind/qvac";
import { McpToolSource } from "@kaleidorg/mind/mcp";

const NODE_URL =
  process.env.RLN_NODE_URL ?? "http://127.0.0.1:3901";

const NETWORK = process.env.KALEIDO_NETWORK ?? "signet";

const MAX_HISTORY_MESSAGES = 6;

const ALLOWED_TOOLS = [
  "rln_get_node_info",
  "rln_get_balances",
  "rln_list_assets",
  "rln_list_channels",
  "rln_list_payments",
  "rln_list_transfers",
  "rln_list_swaps",
  "kaleidoswap_get_quote",
];
const SYSTEM_PROMPT = `
You are RGB Explorer, a read-only assistant for Bitcoin,
Lightning Network, RGB assets, and KaleidoSwap.

RULES:
- Use only the provided MCP tools for live wallet, node,
  channel, payment, transfer, and swap information.
- Treat tool results as the only source of factual data.
- Never invent balances, amounts, IDs, statuses, or timestamps.
- Never interpret a tool failure as an empty result or zero balance.
- Keep BTC, RGB assets, Lightning payments, transfers, and swaps
  conceptually distinct.
- A swap quote is not an executed swap.
- Never send funds, execute swaps, or modify the node.
- If information is missing, say what cannot be verified.
- Answer in concise, clear English.
`;

const PORTFOLIO_SKILL = `
---
name: portfolio-summary
description: Inspect wallet balances, RGB assets, and portfolio composition.
tools: rln_get_balances, rln_list_assets
triggers: balance, portfolio, holdings, assets, RGB, wallet
---

Use read-only tools to answer questions about balances and assets.
When useful, retrieve both balances and asset information.
Distinguish BTC from RGB assets.
Never invent prices or calculate unsupported fiat valuations.
`;

const NODE_SKILL = `
---
name: node-health
description: Inspect the RGB Lightning Node and its channels.
tools: rln_get_node_info, rln_list_channels
triggers: node, status, health, channels, liquidity, capacity
---

Use rln_get_node_info for node status.
Use rln_list_channels for channel capacity, liquidity, and status
when those fields are returned.
For general health requests, retrieve both when appropriate.
Report only returned information.
Distinguish unavailable information from an empty result.
`;

const SWAP_SKILL = `
---
name: swap-quote
description: Retrieve an estimated KaleidoSwap quote without executing a swap.
tools: kaleidoswap_get_quote, rln_list_assets
triggers: quote, swap, exchange, convert, trading, price estimate
---

This skill retrieves quotes only. It never executes a swap.

Identify the source asset, destination asset, and requested amount.
If asset identifiers are unknown, inspect available assets first.
If an amount or asset is missing, ask for clarification.
Follow the exact schema exposed by kaleidoswap_get_quote.
Never guess argument names or asset identifiers.
Explain that a quote is an estimate and does not execute a transaction.
`;

const TRANSFER_SKILL = `
---
name: transfer-history
description: Inspect and explain RGB Lightning Node transfer records.
tools: rln_list_transfers, rln_list_assets
triggers: transfer, transfers, RGB transfer, transfer history,
          incoming transfer, outgoing transfer, transfer status
---

Use rln_list_transfers to inspect transfer history.

Identify whether the user wants a specific transfer, incoming or
outgoing transfers, recent history, or transfer status and details.

Use only returned fields. Do not assume filters are supported unless
the tool schema confirms them.

Distinguish transfers from Bitcoin on-chain transactions, Lightning
payments, and swaps.

Report IDs, assets, amounts, counterparties, timestamps, and statuses
only when those fields are available.

Do not infer completion, settlement, or confirmation without evidence.
If no records are returned, say so. If the tool fails, report the error.
Never initiate or modify a transfer.
`;


const TASKS = {
  portfolio: {
    tools: [
      "rln_get_balances",
      "rln_list_assets",
    ],
    instructions: `
Retrieve the relevant balances and assets.
Report the returned values and units accurately.
Do not calculate unsupported totals or fiat valuations.
`,
  },

  node: {
    tools: [
      "rln_get_node_info",
      "rln_list_channels",
    ],
    instructions: `
Inspect node status and channel information.
Report only fields returned by the tools.
`,
  },

  transfers: {
    tools: [
      "rln_list_transfers",
      "rln_list_assets",
    ],
    instructions: `
Inspect transfer records and their returned statuses.
Do not assume that a transfer is settled or completed.
`,
  },

  payments: {
    tools: ["rln_list_payments"],
    instructions: `
Inspect payment records.
Report their actual statuses without inferring success.
`,
  },

  swaps: {
    tools: ["rln_list_swaps"],
    instructions: `
Inspect swap history.
Distinguish recorded swaps from quotes and pending operations.
`,
  },

  quote: {
    tools: [
      "kaleidoswap_get_quote",
      "rln_list_assets",
    ],
    instructions: `
Retrieve a quote only when the required assets and amount
are known. Ask for missing information when necessary.
A quote does not execute a swap.
`,
  },
};

function selectTask(question) {
  const q = question.toLowerCase();

  // Check quote requests before general swap requests.
  if (
    /\b(quote|quotation|estimate|exchange rate|convert|how much would)\b/.test(q)
  ) {
    return TASKS.quote;
  }

  if (/\b(transfer|transfers|incoming transfer|outgoing transfer)\b/.test(q)) {
    return TASKS.transfers;
  }

  if (/\b(payment|payments|lightning payment)\b/.test(q)) {
    return TASKS.payments;
  }

  if (/\b(swap history|previous swaps|swap history|list swaps)\b/.test(q)) {
    return TASKS.swaps;
  }

  if (/\b(swap|exchange|trading)\b/.test(q)) {
    return TASKS.quote;
  }

  if (
    /\b(node|channel|channels|liquidity|capacity|health)\b/.test(q)
  ) {
    return TASKS.node;
  }

  if (
    /\b(balance|balances|portfolio|holdings|wallet|asset|assets|usdt|xaut)\b/.test(q)
  ) {
    return TASKS.portfolio;
  }

  return {
    tools: ALLOWED_TOOLS,
    instructions: `
Identify what can be answered using the available read-only tools.
Use only relevant tools. If the request is ambiguous, ask
a concise clarifying question.
`,
  };
}


let modelId;
let mcpConnected = false;
let qvacLoaded = false;

let kaleido;
let engine;

let initializationPromise;
let requestQueue = Promise.resolve();

const conversations = new Map();

function buildSkills() {
  const skills = new SkillRegistry();

  skills.addMarkdown(PORTFOLIO_SKILL.trim());
  skills.addMarkdown(NODE_SKILL.trim());
  skills.addMarkdown(TRANSFER_SKILL.trim());
  skills.addMarkdown(SWAP_SKILL.trim());

  return skills;
}


function buildMcpSource() {
  const env = {
    ...Object.fromEntries(
      Object.entries(process.env).filter(
        ([, value]) => typeof value === "string",
      ),
    ),
    KALEIDO_NETWORK: NETWORK,
    KALEIDO_SPARK: "0",
    RLN_NODE_URL: NODE_URL,
    KALEIDOSWAP_API_URL:
      "https://api.signet.kaleidoswap.com",
  };

  return new McpToolSource({
    id: "kaleido",
    transport: {
      kind: "stdio",
      command: process.env.KALEIDO_MCP_COMMAND ?? "npx",
      args: process.env.KALEIDO_MCP_COMMAND
        ? ["-y", "kaleido-mcp"]
        : ["-y", "kaleido-mcp"],
      env,
    },
    allow: ALLOWED_TOOLS,
  });
}



async function initializeAgentInternal() {
  console.log("Connecting to Kaleido MCP...");

  kaleido = buildMcpSource();
  await kaleido.connect();
  mcpConnected = true;

  const tools = new ToolRegistry([kaleido]);

  console.log("Available read-only tools:", ALLOWED_TOOLS);

  console.log("Loading Qwen 3.5 2B...");

  modelId  = await loadModel({
  modelSrc: QWEN3_5_2B_MULTIMODAL_Q4_K_M,
  modelConfig: {
    ctx_size: 8192,
    tools: true,
    reasoning_budget: 0,
  },
  onProgress(progress) {
    if (progress.percentage < 100) {
      process.stderr.write(
        `\rLoading model: ${progress.percentage.toFixed(0)}%`,
      );
    } else {
      process.stderr.write("\n");
    }
  },
});

  qvacLoaded = true;

  const provider = createQvacProvider({
  completion,
  cancel,
  getModelId: () => modelId,
  defaultTemperature: 0.1,
  defaultMaxTokens: 1536,
  maxThinkingTokens: 0,
});

  engine = new Engine({
    provider,
    tools,
    compressToolOutput: true,
  });

  console.log("RGB Explorer powered by Kaleido Mind is ready.");
}

export function initializeAgent() {
  if (!initializationPromise) {
    initializationPromise = initializeAgentInternal().catch(
      async (error) => {
        initializationPromise = undefined;

        try {
          await closeResources();
        } catch (cleanupError) {
          console.error("Agent cleanup failed:", cleanupError);
        }

        throw error;
      },
    );
  }

  return initializationPromise;
}

async function askInternal(question, conversationId) {
  await initializeAgent();

  const task = selectTask(question);
  const history = (
    conversations.get(conversationId) ?? []
  ).slice(-MAX_HISTORY_MESSAGES);

  const messages = [
    {
      role: "system",
      content: `${SYSTEM_PROMPT}

CURRENT TASK:
${task.instructions}`,
    },
    ...history,
    {
      role: "user",
      content: question,
    },
  ];

  console.log("[AGENT] Task:", task);
  console.log("[AGENT] Allowed tools:", task.tools);
  console.log("[AGENT] Starting inference...");

  const start = Date.now();

  const result = await engine.runAgentic(messages, {
    allowedTools: task.tools,
  });

  console.log("[AGENT] Inference completed in", Date.now() - start, "ms");
  console.log("[AGENT] Result:", result);

  const answer = result?.text?.trim();

  if (!answer) {
    throw new Error("No response was generated by the AI agent.");
  }

  const updatedHistory = [
    ...history,
    { role: "user", content: question },
    { role: "assistant", content: answer },
  ].slice(-6);

  conversations.set(conversationId, updatedHistory);

  return answer;
}

export function ask(question, conversationId = "default") {

  console.log("Question", question)
  if (typeof question !== "string" || !question.trim()) {
    return Promise.reject(new Error("A non-empty question is required."));
  }

  const normalizedQuestion = question.trim();

  // QVAC inference is serialized to avoid overlapping model requests.
  const request = requestQueue.then(() =>
    askInternal(normalizedQuestion, conversationId),
  );

  // A failed request must not block subsequent requests.
  requestQueue = request.then(
    () => undefined,
    () => undefined,
  );

  return request;
}

async function closeResources() {
  if (mcpConnected && kaleido) {
    mcpConnected = false;

    try {
      await kaleido.close();
    } catch (error) {
      console.error("Error closing Kaleido MCP:", error);
    }
  }

  if (qvacLoaded && modelId) {
    const id = modelId;

    qvacLoaded = false;
    modelId = undefined;

    try {
      await unloadModel({
        modelId: id,
        clearStorage: false,
      });
    } catch (error) {
      console.error("Error unloading QVAC model:", error);
    }
  }

  engine = undefined;

  try {
    await closeQvac();
  } catch {
    // QVAC may already be closed.
  }
}

export async function shutdownAgent() {
  // Wait for requests already queued before closing the model.
  await requestQueue;

  // Also handle shutdown during initialization.
  if (initializationPromise) {
    try {
      await initializationPromise;
    } catch {
      // Initialization failure has already been handled.
    }
  }

  await closeResources();

  conversations.clear();
  initializationPromise = undefined;
}
