
import { ask, shutdownAgent } from "./src/services/ai-agent.mjs";

try {
  const answer = await ask(
    "Check the node status and summarize the available channel information.",
    "manual-test",
  );

  console.log("\nAgent response:\n", answer);
} catch (error) {
  console.error("Test failed:", error);
  process.exitCode = 1;
} finally {
  await shutdownAgent();
}
