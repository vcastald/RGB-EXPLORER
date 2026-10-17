import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from
  "@modelcontextprotocol/sdk/client/stdio.js";

const transport = new StdioClientTransport({
  command: process.env.KALEIDO_MCP_COMMAND ?? "npx",
  args: ["-y", "kaleido-mcp"],
  env: {
    ...process.env,
    KALEIDO_NETWORK: process.env.KALEIDO_NETWORK ?? "signet",
    KALEIDO_SPARK: "0",
    RLN_NODE_URL:
      process.env.RLN_NODE_URL ?? "http://127.0.0.1:3901",
    KALEIDOSWAP_API_URL:
      "https://api.signet.kaleidoswap.com",
  },
});

const client = new Client({
  name: "rgb-explorer-debug",
  version: "1.0.0",
});

try {
  await client.connect(transport);

  const { tools } = await client.listTools();

  for (const name of ["rln_get_balances", "rln_list_assets"]) {
    const tool = tools.find((item) => item.name === name);

    if (!tool) {
      console.log(`Tool not found: ${name}`);
      continue;
    }

    console.log(`\n--- ${name}: schema ---`);
    console.log(JSON.stringify(tool, null, 2));

    const result = await client.callTool({
      name,
      arguments: {},
    });

    console.log(`\n--- ${name}: raw result ---`);
    console.log(JSON.stringify(result, null, 2));
  }
} finally {
  await transport.close();
}