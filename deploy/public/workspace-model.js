// Share links contain public, unsigned text. They never prove wallet ownership.
export const MAX_LINK = 32000;
export const STORE = 'recall.requests.v1';
export const templates = {
  'Data location': 'All customer data must be processed and stored only in the EU, with no non-EU failover or support access.',
  'No model training': 'Customer inputs and outputs must not be used to train or improve any model.',
  'Delivery date': 'The supplier must deliver the agreed work by [enter a date and time zone].',
};
const fail = message => { throw new Error(message); };
const str = (s, min, max, label) => typeof s === 'string' && s.trim().length >= min && s.trim().length <= max ? s.trim() : fail(`Check ${label}.`);
export function wei(value) {
  if (!/^(?:0|0?\.\d{1,6})$/.test(value)) fail('Enter a budget above zero and at most 0.100 test GEN (up to six decimal places).');
  const [whole, fraction = ''] = value.split('.');
  const result = BigInt(whole || '0') * 10n ** 18n + BigInt(fraction.padEnd(18, '0'));
  if (result <= 0n || result > 10n ** 17n) fail('Use an amount above zero, up to 0.100 test GEN.');
  return result.toString();
}
export function formatWei(value) {
  const digits = BigInt(value).toString().padStart(19, '0');
  return `${digits.slice(0, -18)}.${digits.slice(-18).replace(/0+$/, '') || '000'}`;
}
export function address(value) {
  const s = typeof value === 'string' ? value.trim() : '';
  if (!/^0x[0-9a-fA-F]{40}$/.test(s) || /^0x0{40}$/.test(s)) fail('Enter a nonzero public wallet address: 0x followed by 40 hex characters.');
  return s;
}
export function request(value) {
  if (!value || value.version !== 1 || !/^[a-zA-Z0-9-]{8,64}$/.test(value.id)) fail('This request link is invalid. Ask the buyer for a new one.');
  const title = str(value.title, 3, 100, 'the purchase name (3–100 characters)');
  if (!Array.isArray(value.conditions) || !value.conditions.length || value.conditions.length > 8) fail('Add one to eight conditions.');
  const conditions = value.conditions.map(s => str(s, 10, 500, 'each condition (10–500 characters)'));
  if (conditions.join('\n').length > 1000 || conditions.some(s => /\[enter /i.test(s))) fail('Complete the conditions, using at most 1,000 characters in total.');
  wei(value.budget);
  return {version: 1, id: value.id, title, budget: value.budget, conditions};
}
export function offer(value) {
  if (!value) fail('This supplier reply is incomplete.');
  const req = request(value.request), seller = address(value.seller), price = wei(value.price);
  if (BigInt(price) > BigInt(wei(req.budget))) fail('The offer exceeds the request budget.');
  const terms = str(value.terms, 30, 6000, 'supplier terms (30–6,000 characters)');
  if (new TextEncoder().encode(terms).length > 18000) fail('The supplier terms are too large.');
  return {request: req, seller, price: value.price, terms};
}
export function pack(kind, value) {
  const checked = kind === 'request' ? request(value) : kind === 'offer' ? offer(value) : fail('Unknown link type.');
  const bytes = new TextEncoder().encode(JSON.stringify({kind, value: checked}));
  const encoded = btoa(Array.from(bytes, c => String.fromCharCode(c)).join('')).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '');
  if (encoded.length > MAX_LINK) fail('This link is too large. Shorten the terms before sharing.');
  return `#share=${encoded}`;
}
export function unpack(hash) {
  const encoded = hash.replace(/^#share=/, '');
  if (!hash.startsWith('#share=') || !/^[\w-]+$/.test(encoded) || encoded.length > MAX_LINK) fail('This share link is invalid or incomplete.');
  let parsed;
  try {
    parsed = JSON.parse(new TextDecoder('utf-8', {fatal: true}).decode(Uint8Array.from(atob(encoded.replaceAll('-', '+').replaceAll('_', '/')), c => c.charCodeAt(0))));
  } catch { fail('This share link is invalid or incomplete.'); }
  return {kind: parsed.kind, value: parsed.kind === 'request' ? request(parsed.value) : parsed.kind === 'offer' ? offer(parsed.value) : fail('Unknown link type.')};
}
export function sameRequest(a, b) { return JSON.stringify(request(a)) === JSON.stringify(request(b)); }
export function readDrafts(storage) {
  const raw = storage.getItem(STORE);
  if (!raw) return [];
  let rows;
  try { rows = JSON.parse(raw); } catch { fail('Saved requests could not be read. Existing browser data has not been overwritten.'); }
  if (!Array.isArray(rows) || rows.length > 50 || rows.some(r => !r || typeof r.id !== 'string')) fail('Saved requests could not be read. Existing browser data has not been overwritten.');
  return rows;
}
