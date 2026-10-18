import { randomUUID } from "node:crypto";
import process from "node:process";

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

const NODE_URL = process.env.RLN_NODE_URL ?? "http://127.0.0.1:3901";
const NETWORK = process.env.KALEIDO_NETWORK ?? "signet";
const APPROVAL_TTL_MS = 45_000;
const DEBUG = process.env.SWAP_DEBUG === "1";

const approvals = new Map();
const swaps = new Map();

const transport = new StdioClientTransport({
  command: process.env.KALEIDO_MCP_COMMAND ?? "npx",
  args: ["-y", "kaleido-mcp"],
  env: {
    ...process.env,
    KALEIDO_SPARK: "0",
    KALEIDO_NETWORK: NETWORK,
    RLN_NODE_URL: NODE_URL,
  },
});

const client = new Client({
  name: "rgb-explorer-swap-service",
  version: "1.0.0",
});

let connected = false;
let connecting;

async function ensureConnected() {
  if (connected) return;

  if (!connecting) {
    connecting = client
      .connect(transport)
      .then(() => {
        connected = true;
      })
      .finally(() => {
        connecting = undefined;
      });
  }

  await connecting;
}

/** Tags known failures with a stable `code` so the API layer can map them. */
function classifyError(message) {
  const err = new Error(message || "MCP tool execution failed");
  if (/insufficient liquidity/i.test(message ?? "")) {
    err.code = "INSUFFICIENT_LIQUIDITY";
  } else if (/must be between/i.test(message ?? "")) {
    err.code = "AMOUNT_OUT_OF_RANGE";
  }
  return err;
}

/**
 * Converts MCP text responses into usable objects.
 * Keeps non-JSON text intact. Tool errors are thrown, never swallowed.
 */
function normalizeResult(result) {
  if (result?.isError) {
    const message = (result.content ?? [])
      .map((item) => item.text ?? "")
      .join("\n");
    throw classifyError(message);
  }

  if (result?.structuredContent != null) {
    return result.structuredContent;
  }

  const textContent = (result?.content ?? [])
    .filter((item) => item.type === "text")
    .map((item) => item.text ?? "")
    .join("\n");

  if (textContent) {
    try {
      return JSON.parse(textContent);
    } catch {
      return { text: textContent };
    }
  }

  return result;
}

async function callTool(name, args = {}) {
  await ensureConnected();

  const result = await client.callTool({ name, arguments: args });

  return normalizeResult(result);
}

function findField(value, fieldNames, depth = 0) {
  if (!value || typeof value !== "object" || depth > 8) return undefined;

  for (const key of fieldNames) {
    if (value[key] !== undefined && value[key] !== null) return value[key];
  }

  for (const child of Object.values(value)) {
    const found = findField(child, fieldNames, depth + 1);
    if (found !== undefined) return found;
  }

  return undefined;
}

function requireField(value, fieldNames, label) {
  const found = findField(value, fieldNames);

  if (found === undefined || found === "") {
    throw new Error(`Missing ${label} in MCP response`);
  }

  return found;
}

// The CLI quote shows `amount`; the MCP may expose `amount_raw`. Accept both.
// Anything that is not a safe positive integer is rejected by the caller.
function rawAmount(asset) {
  const value = asset?.amount_raw ?? asset?.amount;
  return typeof value === "string" && /^\d+$/.test(value)
    ? Number(value)
    : value;
}

function quoteExpiryMs(quote) {
  const exp = findField(quote, ["expires_at"]);
  if (typeof exp !== "number") return undefined;
  return exp < 1e12 ? exp * 1000 : exp;
}

function validateQuoteArgs(args) {
  if (!args || typeof args !== "object") {
    throw new Error("Quote arguments are required");
  }

  if (!args.from_asset_id || !args.to_asset_id) {
    throw new Error("from_asset_id and to_asset_id are required");
  }

  if (args.from_asset_id === args.to_asset_id) {
    throw new Error("Source and destination assets must differ");
  }

  const amountFields = [
    "from_amount",
    "to_amount",
    "from_amount_sat",
    "to_amount_sat",
  ];

  const supplied = amountFields.filter((field) => args[field] !== undefined);

  if (supplied.length !== 1) {
    throw new Error("Provide exactly one amount field");
  }

  const amount = args[supplied[0]];
  if (typeof amount !== "number" || !Number.isFinite(amount) || amount <= 0) {
    throw new Error("Swap amount must be a positive finite number");
  }

  const allowedLayers = new Set(["BTC_LN", "RGB_LN"]);

  for (const field of ["from_layer", "to_layer"]) {
    if (args[field] && !allowedLayers.has(args[field])) {
      throw new Error(
        `Unsupported layer ${args[field]}; this service supports BTC_LN and RGB_LN only`
      );
    }
  }

  return { ...args };
}

/**
 * Step 1: obtain a quote and prepare an approval.
 * No funds move in this step.
 */
export async function prepareSwap(quoteArgs) {
  const validatedArgs = validateQuoteArgs(quoteArgs);

  const quote = await callTool("kaleidoswap_get_quote", validatedArgs);

  if (DEBUG) {
    console.log("[SWAP DEBUG] args:", validatedArgs);
    console.log("[SWAP DEBUG] quote:", JSON.stringify(quote, null, 2));
  }

  const rfqId = requireField(quote, ["rfq_id"], "rfq_id");
  const fromAmountRaw = rawAmount(findField(quote, ["from_asset"]));
  const toAmountRaw = rawAmount(findField(quote, ["to_asset"]));

  if (
    !Number.isSafeInteger(fromAmountRaw) ||
    fromAmountRaw <= 0 ||
    !Number.isSafeInteger(toAmountRaw) ||
    toAmountRaw <= 0
  ) {
    throw new Error(
      "Quote does not contain valid from_asset/to_asset amounts (amount_raw or amount)"
    );
  }

  // The approval can never outlive the quote itself.
  const now = Date.now();
  const quoteExp = quoteExpiryMs(quote);
  const expiresAt = Math.min(now + APPROVAL_TTL_MS, quoteExp ?? Infinity);

  const approvalId = randomUUID();

  approvals.set(approvalId, {
    id: approvalId,
    quoteArgs: validatedArgs,
    quote,
    rfqId,
    fromAmountRaw,
    toAmountRaw,
    fromAssetId: validatedArgs.from_asset_id,
    toAssetId: validatedArgs.to_asset_id,
    createdAt: now,
    expiresAt,
    state: "awaiting_confirmation",
  });

  return {
    approvalId,
    expiresAt: new Date(expiresAt).toISOString(),
    quote,
    executed: false,
    requiresUserConfirmation: true,
  };
}

/**
 * Step 2: explicitly execute an approved quote.
 *
 * The client must send only the approval ID, not arbitrary
 * swapstring, payment_hash or raw amount values.
 */
export async function executeApprovedSwap(approvalId) {
  const approval = approvals.get(approvalId);

  if (!approval) {
    throw new Error("Approval not found or already consumed");
  }

  if (approval.state !== "awaiting_confirmation") {
    throw new Error(`Approval is ${approval.state}`);
  }

  if (Date.now() >= approval.expiresAt) {
    approval.state = "expired";
    throw new Error("Quote expired. Prepare a new quote.");
  }

  // Consume the approval before any operation that can spend funds.
  approval.state = "executing";

  let swapRecord;

  try {
    const nodeInfo = await callTool("rln_get_node_info");

    const takerPubkey = requireField(
      nodeInfo,
      ["pubkey", "node_pubkey", "public_key"],
      "node public key"
    );

    // Raw amounts from the quote, unchanged.
    const init = await callTool("kaleidoswap_atomic_init", {
      rfq_id: approval.rfqId,
      from_asset_id: approval.fromAssetId,
      from_amount_raw: approval.fromAmountRaw,
      to_asset_id: approval.toAssetId,
      to_amount_raw: approval.toAmountRaw,
    });

    const swapstring = requireField(init, ["swapstring"], "swapstring");
    const paymentHash = requireField(init, ["payment_hash"], "payment_hash");
    const accessToken = requireField(init, ["access_token"], "access_token");

    swapRecord = {
      approvalId,
      paymentHash,
      accessToken,
      swapstring,
      state: "initialized",
      createdAt: new Date().toISOString(),
    };

    swaps.set(paymentHash, swapRecord);

    // Whitelist the incoming HTLC on the RLN node.
    await callTool("rln_atomic_taker", { swapstring });
    swapRecord.state = "taker_authorized";

    // Request execution from KaleidoSwap.
    const execution = await callTool("kaleidoswap_atomic_execute", {
      swapstring,
      taker_pubkey: takerPubkey,
      payment_hash: paymentHash,
    });

    swapRecord.state = "submitted";
    swapRecord.execution = execution;
    approval.state = "executed";

    // Initial status check. Poll again later if still pending.
    try {
      const status = await callTool("kaleidoswap_atomic_status", {
        payment_hash: paymentHash,
        access_token: accessToken,
      });

      swapRecord.status = status;
      swapRecord.state = "status_checked";
    } catch (error) {
      // Execution may already have been submitted. Do not blindly
      // restart the swap just because the status request failed.
      swapRecord.statusError = error.message;
    }

    return {
      approvalId,
      paymentHash,
      execution: swapRecord.execution,
      status: swapRecord.status ?? null,
      statusError: swapRecord.statusError ?? null,
    };
  } catch (error) {
    approval.state = "failed";

    if (swapRecord) {
      swapRecord.error = error.message;
      swapRecord.state = "needs_reconciliation";
    }

    throw error;
  }
}

/**
 * Read the latest status for an existing swap.
 */
export async function getSwapStatus(paymentHash) {
  const swap = swaps.get(paymentHash);

  if (!swap) {
    throw new Error(
      "Swap not found in this process. Persistent storage is not configured."
    );
  }

  const status = await callTool("kaleidoswap_atomic_status", {
    payment_hash: swap.paymentHash,
    access_token: swap.accessToken,
  });

  swap.status = status;
  swap.lastCheckedAt = new Date().toISOString();

  return { paymentHash, status };
}

export async function getSwapHistory() {
  return [...swaps.values()].map((swap) => ({
    paymentHash: swap.paymentHash,
    state: swap.state,
    createdAt: swap.createdAt,
    status: swap.status ?? null,
    error: swap.error ?? null,
  }));
}

export async function closeSwapService() {
  if (connected) {
    connected = false;
    await client.close();
  }
}