
import type { FastifyInstance } from 'fastify'
import { randomUUID } from 'node:crypto'
import { ask, initializeAgent } from "../services/ai-agent.mjs";

interface ChatBody {
  message: string
  conversationId?: string
}

export function registerChatRoutes(app: FastifyInstance) {
  app.post<{ Body: ChatBody }>('/api/chat', async (request, reply) => {
    const message = request.body?.message?.trim()
    const conversationId =
      request.body?.conversationId?.trim() || randomUUID()

    if (!message) {
      return reply.code(400).send({
        error: 'Il messaggio non può essere vuoto.',
      })
    }

    if (message.length > 4000) {
      return reply.code(400).send({
        error: 'Il messaggio supera il limite di 4000 caratteri.',
      })
    }

    try {
      const answer = await ask(message, conversationId)

      return {
        answer,
        conversationId,
      }
    } catch (error) {
      request.log.error({ err: error }, 'Chat agent error')

      return reply.code(500).send({
        error: 'Non è stato possibile ottenere una risposta dall’agente.',
      })
    }
  })

  app.post("/api/chat/start", async (request, reply) => {
  try {
    await initializeAgent();

    return {
      ready: true,
      message: "RGB Explorer is ready.",
    };
  } catch (error) {
    request.log.error(error);

    return reply.code(500).send({
      ready: false,
      error:
        error instanceof Error
          ? error.message
          : "Failed to initialize the AI agent.",
    });
  }
});
}
