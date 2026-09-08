import {STORE, templates, wei, request, offer, pack, unpack, sameRequest, readDrafts} from './workspace-model.js';
import {mountCommerce} from './commerce-ui.js';

const main = document.querySelector('main');
document.querySelector('.skip').addEventListener('click', event => {
  event.preventDefault(); main.focus(); main.scrollIntoView({block:'start'});
});
let drafts = [], storageError = '', routeError = '';
let disposeCommerce = null;
try { drafts = readDrafts(localStorage); } catch (e) { storageError = e.message; }
// All user-supplied content enters the DOM as text or input values, never HTML.
function el(tag, props = {}, ...children) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(props)) {
    if (key.startsWith('on')) node.addEventListener(key.slice(2), value);
    else if (key === 'class') node.className = value;
    else if (key in node) node[key] = value;
    else node.setAttribute(key, value);
  }
  node.append(...children.filter(c => c !== null && c !== undefined));
  return node;
}
const button = (label, onclick, primary = false) => el('button', {type:'button', class:`button${primary ? ' primary' : ''}`, onclick}, label);
const note = text => el('p', {class:'next-note'}, text);
function report(error) {
  main.querySelector('.error')?.remove();
  const node = el('p', {class:'error', role:'alert', tabIndex:-1}, error.message || String(error));
  main.prepend(node); node.focus();
}
function run(fn) { return event => { try { const result = fn(event); result?.catch(report); } catch (e) { report(e); } }; }
function save(row) {
  if (storageError) throw new Error(storageError);
  const next = [row, ...drafts.filter(r => r.id !== row.id)];
  if (next.length > 50) throw new Error('This preview supports up to 50 saved requests per browser. Open an existing request instead.');
  try { localStorage.setItem(STORE, JSON.stringify(next)); }
  catch { throw new Error('Your browser could not save this request. Keep this tab open and allow site storage before continuing.'); }
  drafts = next;
}
function go(hash = '') {
  if (location.hash === hash) render(); else location.hash = hash;
}
function heading(title, status = '') {
  main.append(el('a', {href:'#', class:'breadcrumb'}, '← Purchases'),
    el('div', {class:'page-heading'}, el('h1', {}, title), status ? el('span', {class:'tag'}, status) : null));
}
function summary(req) {
  return el('div', {class:'block'}, el('h2', {}, req.title),
    el('div', {class:'summary-row'}, el('span', {}, 'Maximum budget'), el('strong', {}, `${req.budget} test GEN`)),
    el('ul', {class:'condition-list'}, ...req.conditions.map(c => el('li', {}, c))));
}
function shareLink(kind, value, label) {
  const url = `${location.origin}/workspace${pack(kind, value)}`;
  const output = el('textarea', {class:'link-output', readOnly:true, value:url, 'aria-label':label});
  const status = el('p', {class:'status-line', role:'status'});
  const copy = button('Copy link', run(async () => {
    try { await navigator.clipboard.writeText(url); status.textContent = 'Link copied. Send it directly to the other person.'; }
    catch { output.focus(); output.select(); status.textContent = 'Select and copy the link above. Your browser blocked automatic copying.'; }
  }), true);
  return el('div', {class:'block'}, el('h2', {}, label),
    el('p', {class:'subtle'}, 'Copy the link and send it directly. Anyone with it can read these public terms; it is not a signed agreement.'),
    el('div',{class:'actions'},copy,el('a',{href:url,target:'_blank',rel:'noopener',class:'button'},kind==='request'?'Preview supplier page ↗':'Open reply ↗')),
    status,el('details',{},el('summary',{},'View or copy the full link'),output));
}
function home() {
  main.append(el('div', {class:'page-heading'}, el('h1', {}, 'Purchases'), button('New purchase', () => go('#new'), true)));
  if (!drafts.length) {
    main.append(el('div', {class:'sheet empty'}, el('h2', {}, 'Agree on the conditions before you pay.'),
      el('p', {class:'subtle'}, 'Create a request, get a supplier’s terms, and compare them with what you need. No wallet is needed to start.'),
      button('Create your first request', () => go('#new'), true)));
  } else {
    const list = el('div', {});
    for (const row of drafts) list.append(el('div', {class:'list-row'},
      el('div', {}, el('a', {href:`#draft=${encodeURIComponent(row.id)}`}, row.title || 'Untitled purchase'),
        el('p', {}, row.reply ? 'Supplier reply saved · Open to check progress' : row.shared ? 'Request link created · Awaiting reply' : 'Draft · Saved in this browser')),
      el('span', {class:'amount'}, `${row.budget || '—'} test GEN`)));
    main.append(list);
  }
  main.append(note('Requests are saved only in this browser. Creating or sharing a request does not reserve money or send a transaction.'));
  main.append(el('div', {class:'actions'}, el('a', {href:'/proof'}, 'See the recorded payment example ↗')));
}
function editor(existing) {
  const row = existing ? structuredClone(existing) : {version:1,id:crypto.randomUUID(),title:'',budget:'0.050',conditions:['']};
  if (row.shared) return requestReview(row);
  heading('New purchase', 'Draft');
  const saved = el('small', {role:'status'}, existing ? 'Saved in this browser' : 'Only saved in this browser');
  let saveFailed = false;
  const persist = () => {
    try {
      save(row); saved.textContent = 'Saved in this browser'; saveFailed = false;
      if (location.hash === '#new') history.replaceState(null, '', `#draft=${row.id}`);
    }
    catch (e) { saved.textContent = e.message; saveFailed = true; }
  };
  const title = el('input', {class:'title-input', id:'purchase-title', value:row.title, placeholder:'What are you buying?', maxLength:100, required:true,
    oninput:e => { row.title = e.target.value; persist(); }});
  const budget = el('input', {class:'budget-input', id:'budget', value:row.budget, inputMode:'decimal', maxLength:8,
    oninput:e => { row.budget = e.target.value; persist(); }});
  const conditions = el('ul', {class:'conditions'});
  function renderConditions(focusLast = false) {
    conditions.replaceChildren(...row.conditions.map((value, index) => {
      const input = el('textarea', {rows:2, value, maxLength:500, placeholder:'Describe a condition the supplier must meet…', 'aria-label':`Condition ${index + 1}`,
        oninput:e => { row.conditions[index] = e.target.value; persist(); }});
      return el('li', {class:'condition'}, el('span', {class:'condition-mark', 'aria-hidden':'true'}, '✓'), input,
        el('button', {type:'button', class:'icon-button', 'aria-label':`Remove condition ${index + 1}`, onclick:() => {
          row.conditions.splice(index, 1); persist(); renderConditions();
          (conditions.querySelector('textarea') || add).focus();
        }}, '×'));
    }));
    if (focusLast) conditions.querySelector('li:last-child textarea')?.focus();
  }
  const append = value => {
    if (row.conditions.length >= 8) throw new Error('Use up to eight conditions.');
    if (row.conditions.length === 1 && !row.conditions[0].trim()) row.conditions = [value]; else row.conditions.push(value);
    persist(); renderConditions(true);
  };
  const add = el('button', {class:'text-button', type:'button', onclick:run(() => append(''))}, '+ Add a condition');
  renderConditions();
  const form = el('form', {class:'sheet', onsubmit:run(event => {
    event.preventDefault(); const checked = request(row); save({...checked});
    if (saveFailed) throw new Error('Save the request before continuing.');
    requestReview(checked);
  })},
    el('div', {class:'block'}, el('label', {class:'title-label', htmlFor:'purchase-title'}, 'Purchase name'), title,
      el('div', {class:'budget-row'}, el('label', {htmlFor:'budget'}, 'Maximum budget'), budget, el('span', {}, 'test GEN')),
      el('p', {class:'budget-note'}, 'No funds are sent or reserved. Up to 0.100 test GEN.')),
    el('div', {class:'block'}, el('h2', {}, 'Your conditions'), el('p', {class:'subtle'}, 'What must be true for you to approve this purchase?'), conditions, add,
      el('div', {class:'templates'}, el('span', {}, 'Start with'), ...Object.entries(templates).map(([name, value]) => el('button', {class:'chip', type:'button', onclick:run(() => append(value))}, name)))),
    el('div', {class:'sheet-footer'}, saved, el('button', {type:'submit', class:'button primary'}, 'Review request', el('span', {'aria-hidden':'true'}, '→'))));
  main.append(form, note('Next: review your request and send its link to a supplier. They can reply without connecting a wallet.'));
}
function requestReview(row) {
  disposeCommerce?.();disposeCommerce=null;
  main.replaceChildren(); heading(row.reply ? row.title : 'Review request', row.reply ? '' : row.shared ? 'Ready to share' : 'Draft');
  const req = request(row);
  const sheet = el('section', {class:'sheet'}, summary(req));
  if (row.reply) {
    const reply = offer(row.reply);
    sheet.append(el('div', {class:'block'}, el('h2', {}, 'Supplier offer'),
      el('div', {class:'summary-row'}, el('span', {}, 'Offer price'), el('strong', {}, `${reply.price} test GEN`)),
      el('div', {class:'summary-row'}, el('span', {}, 'Supplier wallet · Unverified'), el('strong', {}, reply.seller)),
      el('details', {}, el('summary', {}, 'Read the supplier’s terms'), el('pre', {class:'terms'}, reply.terms)),
      el('p', {class:'subtle'}, 'This saved reply is unsigned. Continue below to create an agreement, obtain supplier acceptance, and assess the terms before approving a purchase.')));
  } else if (row.shared) {
    sheet.append(shareLink('request', req, 'Send this request to your supplier'));
    sheet.append(el('div', {class:'block'}, el('h2', {}, 'Waiting for an offer'),
      el('p', {class:'subtle'}, 'Your supplier can open the link without a wallet, enter their price and terms, and send a reply link back. Open that reply in this browser.'),
      pasteReply(row)));
  } else {
    sheet.append(el('div', {class:'block'}, el('p', {class:'subtle'}, 'The supplier will see the purchase name, budget, and conditions. Sharing freezes this version so a reply can be matched to it.')));
    sheet.append(el('div', {class:'sheet-footer'}, button('Edit request', () => { main.replaceChildren(); editor(row); }),
      button('Create supplier link →', run(() => { const shared = {...req, shared:true}; save(shared); go(`#draft=${req.id}`); }), true)));
  }
  if(row.reply){
    const saved=el('details',{class:'saved-offer'},el('summary',{},`Offer: ${offer(row.reply).price} test GEN · View request and supplier terms`),sheet);
    main.append(saved);
  }else main.append(sheet);
  if(row.reply){const flow=el('div',{class:'commerce-flow'});main.append(flow);disposeCommerce=mountCommerce(flow,{el,button,row});}
  if (row.shared || row.reply) main.append(el('div', {class:'actions'}, button('Duplicate as a new draft', run(() => {
    const copy = {...req,id:crypto.randomUUID()}; save(copy); go(`#draft=${copy.id}`);
  }))));
}
function pasteReply(row) {
  const input = el('textarea', {rows:2, placeholder:'Paste the supplier’s reply link', 'aria-label':'Supplier reply link'});
  return el('form', {onsubmit:run(event => {
    event.preventDefault(); const url = new URL(input.value.trim());
    if (url.origin !== location.origin || url.pathname !== '/workspace') throw new Error('Use a Recall supplier reply link from this site.');
    const shared = unpack(url.hash);
    if (shared.kind !== 'offer' || !sameRequest(row, shared.value.request)) throw new Error('This reply is for a different request or its conditions were changed. Ask for a corrected reply.');
    acceptReply(shared.value);
  })}, el('label', {class:'field'}, el('span', {}, 'Already have a reply?'), input), el('div', {class:'actions'}, el('button', {type:'submit', class:'button'}, 'Review supplier reply')));
}
function supplier(req) {
  heading('Respond to a request', 'Supplier');
  const savedKey = `recall.reply.${req.id}`;
  let cached = {};
  try { cached = JSON.parse(sessionStorage.getItem(savedKey) || '{}'); } catch { /* Never trust or require storage to view a request. */ }
  const fields = {};
  function field(name, label, props, help) {
    const {multiline, ...attributes} = props;
    const node = el(multiline ? 'textarea' : 'input', {...attributes, id:`supplier-${name}`, 'aria-describedby':`help-${name}`, value:typeof cached[name] === 'string' ? cached[name] : '', required:true,
      oninput:() => {
        try { sessionStorage.setItem(savedKey, JSON.stringify(Object.fromEntries(Object.entries(fields).map(([key, n]) => [key, n.value])))); }
        catch { status.textContent = 'Your browser cannot save reply drafts. Keep this tab open until you copy your reply link.'; }
      }});
    fields[name] = node;
    return el('div', {class:'field'}, el('label', {htmlFor:`supplier-${name}`}, label), node, help ? el('small', {id:`help-${name}`}, help) : null);
  }
  const status = el('p', {class:'status-line', role:'status'});
  const form = el('form', {class:'sheet', onsubmit:run(event => {
    event.preventDefault(); const reply = offer({request:req, ...Object.fromEntries(Object.entries(fields).map(([key, n]) => [key, n.value]))});
    main.replaceChildren(); heading('Your reply is ready', 'Unsigned reply');
    main.append(el('section', {class:'sheet'}, summary(req), shareLink('offer', reply, 'Send your reply to the buyer'),
      el('div', {class:'sheet-footer'}, el('small', {}, 'No wallet signature or payment has been requested.'), button('Edit reply', () => { main.replaceChildren(); supplier(req); }))));
  })}, summary(req), el('div', {class:'block'}, el('h2', {}, 'Your offer'),
    field('price', 'Your price · test GEN', {inputMode:'decimal', maxLength:8, placeholder:'0.040'}, `Must not exceed ${req.budget} test GEN.`),
    field('seller', 'Supplier’s public wallet address', {maxLength:42, placeholder:'0x…', spellcheck:false}, 'This will identify the supplier. Never enter a private key or seed phrase.'),
    field('terms', 'Supporting terms', {multiline:true, rows:7, maxLength:6000, minLength:30, placeholder:'Paste the offer’s terms, including commitments and exceptions relevant to the buyer’s conditions…'}, 'Public text only. 30–6,000 characters. A reply link is not a signed agreement.'), status),
    el('div', {class:'sheet-footer'}, el('small', {}, 'You will get a link to send back.'), el('button', {type:'submit', class:'button primary'}, 'Create reply link →')));
  main.append(el('p', {class:'notice'}, 'This is an unsigned request supplied through a link. Confirm the buyer and request with the person who sent it.'), form);
}
function acceptReply(reply) {
  const row = drafts.find(r => r.id === reply.request.id);
  if (!row) throw new Error('The matching request is not saved in this browser. Open the reply in the browser where you created the request. Nothing has been imported.');
  if (!row.shared || !sameRequest(row, reply.request)) throw new Error('The reply does not match your shared request. Its name, budget, or conditions may have changed. Nothing has been imported.');
  // Preview first. Opening an unsigned link never replaces an existing reply.
  main.replaceChildren(); heading('Review incoming reply', 'Unsigned');
  main.append(el('section', {class:'sheet'}, summary(reply.request), el('div', {class:'block'},
    el('div', {class:'summary-row'}, el('span', {}, 'Offer price'), el('strong', {}, `${reply.price} test GEN`)),
    el('div', {class:'summary-row'}, el('span', {}, 'Supplier wallet · Unverified'), el('strong', {}, reply.seller)),
    el('pre', {class:'terms'}, reply.terms)), el('div', {class:'sheet-footer'}, el('small', {}, row.reply ? 'Saving will replace the unsigned reply saved here.' : 'Matches the request saved in this browser.'),
    button('Save supplier reply', run(() => { save({...row, reply}); go(`#draft=${row.id}`); }), true))));
}
function render() {
  disposeCommerce?.();disposeCommerce=null;
  main.replaceChildren();
  try {
    if (storageError) throw new Error(storageError);
    const hash = location.hash;
    if (hash.startsWith('#agreement=')) {
      const deployment=hash.slice(11);
      if(!/^0x[a-f0-9]{64}$/i.test(deployment))throw new Error('Use the complete Studio agreement link.');
      heading('Purchase');const flow=el('div',{class:'commerce-flow'});main.append(flow);
      disposeCommerce=mountCommerce(flow,{el,button,deployment});
    } else if (hash.startsWith('#share=')) {
      const shared = unpack(hash);
      if (shared.kind === 'request') supplier(shared.value); else acceptReply(shared.value);
    } else if (hash === '#new') editor();
    else if (hash.startsWith('#draft=')) {
      const id = decodeURIComponent(hash.slice(7)), row = drafts.find(r => r.id === id);
      if (!row) throw new Error('This draft is not saved in this browser. Return to Purchases to create or open a request.');
      editor(row);
    } else if (!hash || hash === '#') home();
    else throw new Error('This Recall link is not recognized. Return to Purchases.');
  } catch (e) {
    main.append(el('a', {href:'#', class:'breadcrumb'}, '← Purchases')); report(e);
  }
  main.focus({preventScroll:true}); window.scrollTo(0, 0);
}
window.addEventListener('hashchange', render);
window.addEventListener('storage', e => {
  if (e.key === STORE || e.key === null) {
    try { drafts = readDrafts(localStorage); storageError = ''; }
    catch (error) { storageError = error.message; }
    // Do not silently overwrite a form being edited in this tab.
    routeError = 'Requests changed in another tab. Reload before editing further.';
    storageError = routeError; report(new Error(routeError));
  }
});
render();
