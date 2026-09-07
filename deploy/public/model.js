export function amount(value) {
  const n = BigInt(value), sign = n < 0n ? "−" : "", abs = n < 0n ? -n : n;
  const fraction = (abs % 10n ** 18n).toString().padStart(18, "0").replace(/0+$/, "").padEnd(3, "0");
  return `${sign}${abs / 10n ** 18n}.${fraction} GEN`;
}
export function transferFor(report, permit) {
  if (permit.status !== "SCHEDULED") return null;
  const parent = report?.steps?.find(s => s.step === `pay-${permit.claim_id}` && s.execution === "SUCCESS" && s.status === "FINALIZED");
  if (!parent) return null;
  return report?.independent_verification?.child_transfers?.find(t =>
    t.status === "FINALIZED" && t.from_address.toLowerCase() === report.contract.toLowerCase()
    && t.triggered_by === parent.transaction_hash
    && t.to_address.toLowerCase() === permit.recipient.toLowerCase()
    && BigInt(t.value) === BigInt(permit.amount_wei)) || null;
}
export function paymentState(report, permit, claim) {
  if (transferFor(report, permit)) return ["Transfer verified", "good"];
  if (permit.status === "CANCELLED") return ["Not paid", "bad"];
  if (permit.status === "SCHEDULED") return ["Scheduled · unverified", "neutral"];
  if (["DISPUTED", "UNKNOWN", "INVALID"].includes(claim.status)) return ["On hold", "warn"];
  return ["Not sent", "neutral"];
}
export function safeSource(url) {
  try { const parsed = new URL(url); return parsed.protocol === "https:" && parsed.hostname === "raw.githubusercontent.com" && parsed.pathname.startsWith("/panduro-r/Recall/") ? parsed.href : null; }
  catch { return null; }
}
export function displayName(claim) {
  if (claim.supersedes) return [claim.id === "inference-v2" ? "EU Pro alternative" : "EU Dedicated Inference", "Northstar · Replacement"];
  if (claim.id.startsWith("storage")) return ["EU Storage", "Harbor"];
  if (claim.id.startsWith("monitoring")) return ["EU Monitoring", "Beacon"];
  return ["Inference Basic", "Northstar · Original"];
}
export function fileName(url) { return String(url || "").split("/").pop(); }
export function humanize(text) { return text.toLowerCase().replaceAll("-", " ").replace(/^./, c => c.toUpperCase()); }
export function shortHash(text) { return text ? `${text.slice(0, 8)}…${text.slice(-4)}` : ""; }
