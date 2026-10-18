
export interface SwapQuoteArgs {
  from_asset_id: string;
  to_asset_id: string;
  from_layer?: "BTC_LN" | "RGB_LN";
  to_layer?: "BTC_LN" | "RGB_LN";
  from_amount?: number;
  to_amount?: number;
  from_amount_sat?: number;
  to_amount_sat?: number;
}

export function prepareSwap(
  quoteArgs: SwapQuoteArgs
): Promise<{
  approvalId: string;
  expiresAt: string;
  quote: unknown;
  executed: false;
  requiresUserConfirmation: true;
}>;

export function executeApprovedSwap(
  approvalId: string
): Promise<{
  approvalId: string;
  paymentHash: string;
  execution: unknown;
  status: unknown;
  statusError: string | null;
}>;

export function getSwapStatus(
  paymentHash: string
): Promise<{
  paymentHash: string;
  status: unknown;
}>;

export function getSwapHistory(): Promise<
  Array<{
    paymentHash: string;
    state: string;
    createdAt: string;
    status: unknown;
    error: string | null;
  }>
>;

export function closeSwapService(): Promise<void>;
