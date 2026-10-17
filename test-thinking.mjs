import {
  loadModel,
  completion,
  unloadModel,
  QWEN3_5_2B_MULTIMODAL_Q4_K_M,
} from "@qvac/sdk";
import process from "node:process";
let modelId;

try {
  modelId = await loadModel({
    modelSrc: QWEN3_5_2B_MULTIMODAL_Q4_K_M,
    modelConfig: {
      ctx_size: 8192,
      reasoning_budget: 0, // abilita il reasoning per il test
    },
  });

  const run = completion({
    modelId,
    history: [
      {
        role: "user",
        content: "Spiega in tre passaggi perché 17 è un numero primo.",
      },
    ],
    captureThinking: true,
    generationParams: {
      reasoning_budget: -1,
    },
  });

  for await (const event of run.events) {
    if (event.type === "thinkingDelta") {
      process.stdout.write(`[THINKING] ${event.text}`);
    }

    if (event.type === "contentDelta") {
      process.stdout.write(event.text);
    }

    if (event.type === "toolCall") {
      console.log("\n[TOOL CALL]", event.call);
    }

    if (event.type === "toolError") {
      console.error("\n[TOOL ERROR]", event.error);
    }
  }

  console.log("\n");

} catch (error) {
  console.error(error);
} finally {
  if (modelId) {
    await unloadModel({ modelId, clearStorage: false });
  }
}