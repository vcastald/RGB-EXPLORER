export function ask(
  question: string,
  conversationId?: string,
): Promise<string>

export function initializeAgent(): Promise<void>
export function shutdownAgent(): Promise<void>