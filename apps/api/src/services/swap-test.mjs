import {
  prepareSwap,
  executeApprovedSwap,
  getSwapStatus,
  closeSwapService,
} from "./swap-services.mjs";

const XAUT = "rgb:qrilKFY5-VBmdIOF-cH5ziA8-9K9MIFS-OwsjmXe-yOv3Oa8";
const execute = process.argv.includes("--execute");

try {
  const p = await prepareSwap({
    from_asset_id: "BTC",
    to_asset_id: XAUT,
    from_amount_sat: 5000,
    from_layer: "BTC_LN",
    to_layer: "RGB_LN",
  });
  console.log("QUOTE OK:", p.approvalId, "scade", p.expiresAt);

  if (!execute) {
    console.log("Solo quotazione: nessun fondo mosso.");
  } else {
    const r = await executeApprovedSwap(p.approvalId);
    console.log("EXECUTE:", JSON.stringify(r, null, 2));
    console.log("STATUS:", JSON.stringify(await getSwapStatus(r.paymentHash), null, 2));
  }
} catch (e) {
  console.error("FALLITO:", e.code ?? "", e.message);
  process.exitCode = 1;
} finally {
  await closeSwapService();
}