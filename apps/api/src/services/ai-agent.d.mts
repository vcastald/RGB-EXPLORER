export function ask(
  question: string,
  conversationId?: string,
): Promise<string>

export function initializeAgent(): Promise<void>
export function shutdownAgent(): Promise<void>
export function configureTreasuryTools(
  paramsStore: {
    getTargetAllocation(): {
      btc: number
      xaut: number
      usdt: number
      updatedAt?: string
    }
  },
  getQuotes: () => Promise<QuotesResponse>,
): void {
  // ...
}