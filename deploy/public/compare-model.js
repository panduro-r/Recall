export const SAVED_KEY = 'recall.shortlist.v1';
export function requirements(value) {
  const hours = Number(value.hours), budget = Number(value.budget);
  if (!Number.isFinite(hours) || hours < 1 || hours > 100000 || !Number.isInteger(hours)) throw Error('Enter 1–100,000 whole audio hours per month.');
  if (!Number.isFinite(budget) || budget < 1 || budget > 1000000 || Math.abs(Math.round(budget * 100) - budget * 100) > 0.000001) throw Error('Enter a monthly USD budget from $1 to $1,000,000, with up to two decimal places.');
  if (typeof value.noTraining !== 'boolean' || typeof value.speakers !== 'boolean') throw Error('Choose your requirements.');
  return {hours, budget, noTraining:value.noTraining, speakers:value.speakers};
}
export function isStale(catalog, now = Date.now()) {
  const date = Date.parse(catalog.reviewedAt + 'T00:00:00Z');
  return !Number.isFinite(date) || now - date > 7 * 86400000 || now < date;
}
export function assess(plan, req, stale = false) {
  const rate = plan.rate * (plan.unit === 'minute' ? 60 : 1);
  const labelsUnknown = req.speakers && plan.diarization === null;
  const knownRate = rate + (req.speakers ? (plan.diarization || 0) : 0);
  const estimate = Math.round(req.hours * knownRate * 100) / 100;
  const trainingBlocked = req.noTraining && plan.training === 'default-training';
  const trainingConditional = req.noTraining && plan.training === 'optout';
  const uncertainPrice = plan.pricing === 'from' || trainingConditional || labelsUnknown;
  const overBudget = !uncertainPrice && estimate > req.budget;
  const status = trainingBlocked ? 'not-fit' : overBudget ? 'over-budget' : stale || uncertainPrice ? 'confirm' : 'fit';
  const labels = {'not-fit':'Not suitable as configured','over-budget':'Over your budget',confirm:'Confirmation needed',fit:'Within budget'};
  return {estimate,rate:knownRate,uncertainPrice,status,label:labels[status],trainingBlocked,trainingConditional,labelsUnknown,stale,
    budgetLabel:uncertainPrice ? 'Final cost not confirmed' : overBudget ? `$${(estimate - req.budget).toFixed(2)} over budget` : `$${(req.budget - estimate).toFixed(2)} below budget`};
}
export function ranked(catalog, req, now = Date.now()) {
  const order = {fit:0,confirm:1,'over-budget':2,'not-fit':3};
  return catalog.plans.map(plan => ({plan, result:assess(plan, req, isStale(catalog, now))})).sort((a,b) =>
    order[a.result.status] - order[b.result.status] || (a.plan.training === 'excluded' ? -1 : 0) - (b.plan.training === 'excluded' ? -1 : 0) || a.result.estimate - b.result.estimate);
}
export function readSaved(raw, catalog) {
  if (!raw) return [];
  const rows = JSON.parse(raw);
  if (!Array.isArray(rows) || rows.length > 20) throw Error('The saved shortlist could not be read. Existing purchases have not changed.');
  return rows.map(row => {
    if (!row || !catalog.plans.some(p => p.id === row.planId) || typeof row.savedAt !== 'string' || !Number.isFinite(Date.parse(row.savedAt))) throw Error('A saved option is invalid. Existing purchases have not changed.');
    return {planId:row.planId,savedAt:row.savedAt,requirements:requirements(row.requirements)};
  });
}
export function nextStep(plan, req) {
  return req.noTraining ? plan.next : plan.pricing === 'from' ? 'Confirm your actual rate and upfront usage commitment before purchasing.' : 'Confirm the selected configuration and billing rate, and test representative non-sensitive audio before purchasing.';
}
export function brief(catalog, plan, req, result, sourceChecks = {}) {
  return `RECALL · BUYING BRIEF\n${plan.name} — ${plan.plan}\n\nEnglish, pre-recorded, single-channel transcription API\nAudio: ${req.hours} hours/month\nBudget: USD ${req.budget.toFixed(2)}/month\nNo model training required: ${req.noTraining ? 'Yes' : 'No'}\nSpeaker labels required: ${req.speakers ? 'Yes' : 'No'}\n\n${result.label}\n${result.uncertainPrice ? 'Illustrative base cost only' : 'Estimated usage cost'}: USD ${result.estimate.toFixed(2)}/month\n${result.budgetLabel}\n${plan.priceNote}\n${plan.trainingNote}\nNext: ${nextStep(plan,req)}\n\nSources reviewed: ${catalog.reviewedAt}. This date does not change when pages are fetched.\n${plan.sources.map(key => {const s = catalog.sources[key], check = sourceChecks[key];return `${s.label}: ${s.url}${check ? `\nPage check: ${check.status}, ${check.checkedAt}${check.sha256 ? `, SHA-256 ${check.sha256}` : ''}` : '\nNot fetched during this visit.'}`;}).join('\n\n')}\n\nEstimates exclude taxes, free credits, unselected add-ons, implementation and volume discounts. Test accuracy on representative non-sensitive audio. Catalog matching is rules-based, not a GenLayer assessment, a compliance certification, or proof of delivery. Source retrieval does not revalidate policy meaning.\n\nNo order, provider contact, payment, or wallet action was made. Recall is not integrated with this provider’s checkout. Purchase separately through the provider after resolving the open conditions.\n`;
}
