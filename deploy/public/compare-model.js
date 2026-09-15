import {CATEGORIES,categoryOf,categoryMatches,speechRequirements,textRequirements,requirementKeys,requirementsFromParams,scopeFor,workload,extraCondition,priceText} from './service-categories.js';
export const SAVED_KEY = 'recall.shortlist.v1';
export function reviewDate(catalog, plan) {return plan.reviewedAt ?? catalog.reviewedAt;}
export function validateCatalog(catalog) {
  const https = value => {try {const u = new URL(value);return u.protocol === 'https:' && !u.username && !u.password && !u.port;}catch{return false;}};
  const date = value => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && new Date(value+'T00:00:00Z').toISOString().slice(0,10) === value;
  if (!catalog || catalog.version !== 1 || !date(catalog.reviewedAt) || !Array.isArray(catalog.plans) || !catalog.plans.length || catalog.plans.length > 50 || !catalog.sources || typeof catalog.sources !== 'object') throw Error('Invalid provider catalog');
  const ids = new Set();
  if (catalog.reviewSourceHistory !== undefined && (!catalog.reviewSourceHistory || typeof catalog.reviewSourceHistory !== 'object' || Array.isArray(catalog.reviewSourceHistory))) throw Error('Invalid source history');
  for (const plan of catalog.plans) {
    const billing=categoryOf(plan)==='text'?plan?.unit==='token':categoryOf(plan)==='speech'?['character','utf8-byte'].includes(plan?.unit):categoryOf(plan)==='transcription'&&['hour','minute'].includes(plan?.unit);
    if (!plan || !['id','provider','name','plan','initials','trainingLabel','trainingNote','priceNote','next'].every(k=>typeof plan[k] === 'string' && plan[k].trim()) || !/^[a-z0-9-]+$/.test(plan.id) || !/^[a-z0-9-]+$/.test(plan.provider) || ids.has(plan.id) || !https(plan.url) || !date(reviewDate(catalog,plan)) || !Number.isFinite(plan.rate) || plan.rate <= 0 || !billing || !['metered','from','estimated'].includes(plan.pricing) || !['excluded','optout','default-training','unknown'].includes(plan.training) || !(plan.diarization === null || Number.isFinite(plan.diarization) && plan.diarization >= 0) || !Array.isArray(plan.sources) || !plan.sources.length || plan.sources.length > 4 || new Set(plan.sources).size !== plan.sources.length) throw Error('Invalid provider plan');
    if(['speech','text'].includes(categoryOf(plan))&&![true,false,null].includes(plan.streaming))throw Error('Invalid streaming capability');
    if(categoryOf(plan)==='text'&&(!Number.isFinite(plan.outputRate)||plan.outputRate<=0))throw Error('Invalid output token rate');
    const history = catalog.reviewSourceHistory?.[plan.id] ?? [];
    if (!Array.isArray(history) || history.length > 8) throw Error('Invalid source history');
    for (const sourceSet of [plan.sources,...history]) {
      if (!Array.isArray(sourceSet) || !sourceSet.length || sourceSet.length > 4 || new Set(sourceSet).size !== sourceSet.length) throw Error('Invalid source history');
      for (const key of sourceSet) {
        const source = typeof key === 'string' && Object.hasOwn(catalog.sources,key) && catalog.sources[key];
        if (!source || source.provider !== plan.provider || typeof source.label !== 'string' || !source.label || !https(source.url)) throw Error('Invalid provider source');
      }
    }
    ids.add(plan.id);
  }
  return catalog;
}
export function requirements(value) {
  if(!value||typeof value!=='object'||!Object.hasOwn(CATEGORIES,categoryOf(value))||Object.hasOwn(value,'category')&&!Object.hasOwn(CATEGORIES,value.category))throw Error('Choose a supported service category.');
  const allowed=requirementKeys(categoryOf(value));
  if(Object.keys(value).some(k=>!allowed.includes(k))||['budget','hours','characters','utf8Bytes','inputTokens','outputTokens'].some(k=>typeof value[k]==='boolean'))throw Error('Choose category-specific requirements.');
  const hours = Number(value.hours), budget = Number(value.budget);
  if (!Number.isFinite(budget) || budget < 1 || budget > 1000000 || Math.abs(Math.round(budget * 100) - budget * 100) > 0.000001) throw Error('Enter a monthly USD budget from $1 to $1,000,000, with up to two decimal places.');
  if(categoryOf(value)==='speech')return speechRequirements(value,budget);
  if(categoryOf(value)==='text')return textRequirements(value,budget);
  if(Object.hasOwn(value,'characters')||Object.hasOwn(value,'streaming')||Object.hasOwn(value,'utf8Bytes'))throw Error('Choose transcription requirements.');
  if (!Number.isFinite(hours) || hours < 1 || hours > 100000 || !Number.isInteger(hours)) throw Error('Enter 1–100,000 whole audio hours per month.');
  if (typeof value.noTraining !== 'boolean' || typeof value.speakers !== 'boolean') throw Error('Choose your requirements.');
  return {hours, budget, noTraining:value.noTraining, speakers:value.speakers};
}
export function comparisonLink(req,planId,from='review') {
  if(planId!==undefined&&(typeof planId!=='string'||!/^[a-z0-9-]{1,100}$/.test(planId)))throw Error('Invalid comparison plan.');
  if(!['review','saved'].includes(from))throw Error('Invalid comparison source.');
  return '/compare#'+new URLSearchParams({from,...requirements(req),...(planId?{plan:planId}:{})});
}
export function comparisonContext(fragment) {
  if(typeof fragment!=='string'||fragment.length>1200)throw Error('The comparison link is invalid.');
  const params=new URLSearchParams(fragment.replace(/^#/,''));
  if(!params.size)return null;
  const from=params.get('from'),isComparison=from==='comparison';
  const keys=['from',...requirementKeys(params.get('category')),...(params.has('plan')?['plan']:[]),...(isComparison?['view',...(params.has('alternative')?['alternative']:[])]:[])];
  if(!['comparison','review','saved'].includes(from)||params.size!==keys.length||keys.some(k=>params.getAll(k).length!==1)||
    params.has('plan')&&!/^[a-z0-9-]{1,100}$/.test(params.get('plan')))throw Error('The comparison link has invalid requirements. Check the form before comparing.');
  const req=requirements(requirementsFromParams(params));
  if(isComparison){
    const plans=[params.get('plan'),...(params.has('alternative')?[params.get('alternative')]:[])];
    comparisonViewLink(req,plans,params.get('view'));
    return {requirements:req,planId:plans[0],from,plans,view:params.get('view')};
  }
  return {requirements:req,planId:params.get('plan'),from};
}
export function comparisonViewLink(req,plans,view='compare') {
  if(!Array.isArray(plans)||plans.length<1||plans.length>2||new Set(plans).size!==plans.length||plans.some(p=>typeof p!=='string'||!/^[a-z0-9-]{1,100}$/.test(p))||!['browse','compare'].includes(view))throw Error('The comparison selection is invalid.');
  return '/compare#'+new URLSearchParams({from:'comparison',...requirements(req),plan:plans[0],...(plans[1]?{alternative:plans[1]}:{}),view});
}
export function withComparisonReturn(reviewHref,returnTo) {
  if(typeof reviewHref!=='string'||!reviewHref.startsWith('/review#')||typeof returnTo!=='string'||!returnTo.startsWith('/compare#')||comparisonContext(returnTo.slice(9))?.from!=='comparison')throw Error('Invalid comparison return link.');
  const params=new URLSearchParams(reviewHref.slice(8));params.set('back',returnTo);
  return '/review#'+params;
}
export function comparisonReturn(fragment,catalog,planId,req) {
  try{
    if(typeof fragment!=='string'||fragment.length>4000||!planId)return null;
    const params=new URLSearchParams(fragment.replace(/^#/,'')),back=params.get('back');
    if(params.getAll('back').length!==1||!back?.startsWith('/compare#'))return null;
    const context=comparisonContext(back.slice(9));
    if(context?.from!=='comparison'||!catalog.plans.some(p=>p.id===planId&&categoryMatches(p,req))||context.plans.some(id=>!catalog.plans.some(p=>p.id===id&&categoryMatches(p,req)))||
      context.view==='compare'&&!context.plans.includes(planId)||JSON.stringify(context.requirements)!==JSON.stringify(requirements(req)))return null;
    return comparisonViewLink(context.requirements,context.plans,context.view);
  }catch{return null;}
}
export function comparisonSelection(fragment) {
  return comparisonContext(fragment)?.requirements??null;
}
export function comparisonPair(catalog,req,preferred=[],now=Date.now()) {
  const available=ranked(catalog,requirements(req),now).map(r=>r.plan.id),pair=[];
  for(const id of [...preferred,...available])if(available.includes(id)&&!pair.includes(id)&&pair.length<2)pair.push(id);
  return pair;
}
export function isStale(catalog, now = Date.now()) {
  const date = Date.parse(catalog.reviewedAt + 'T00:00:00Z');
  return !Number.isFinite(date) || now - date > 7 * 86400000 || now < date;
}
export function assess(plan, req, stale = false) {
  if(!categoryMatches(plan,req))throw Error('Compare plans within the same service category.');
  const speech=categoryOf(req)==='speech',text=categoryOf(req)==='text';
  const byteRange=speech&&plan.unit==='utf8-byte'&&req.utf8Bytes==null;
  const streamingUnknown=(speech||text)&&req.streaming&&plan.streaming!==true;
  const rate = plan.rate * (plan.unit === 'minute' ? 60 : 1);
  const labelsUnknown = req.speakers && plan.diarization === null;
  const knownRate = rate + (req.speakers ? (plan.diarization || 0) : 0);
  const volume=text?req.inputTokens:speech?(plan.unit==='utf8-byte'?(req.utf8Bytes??req.characters):req.characters):req.hours;
  const inputCost=volume*knownRate,outputCost=text?req.outputTokens*plan.outputRate:0;
  const estimate = Math.round((inputCost+outputCost) * 100) / 100;
  const upperEstimate=byteRange?Math.round(req.characters*4*knownRate*100)/100:estimate;
  const trainingUnknown=req.noTraining&&plan.training==='unknown';
  const trainingBlocked = req.noTraining && plan.training === 'default-training';
  const trainingConditional = req.noTraining && plan.training === 'optout';
  const uncertainPrice = plan.pricing !== 'metered' || trainingConditional || labelsUnknown || trainingUnknown || byteRange || streamingUnknown;
  const overBudget = !uncertainPrice && estimate > req.budget;
  const status = trainingBlocked ? 'not-fit' : overBudget ? 'over-budget' : stale || uncertainPrice ? 'confirm' : 'fit';
  const labels = {'not-fit':'Not suitable as configured','over-budget':'Over your budget',confirm:'Confirmation needed',fit:'Within budget'};
  const costLabel = byteRange?'UTF-8 size range · not a quote':plan.pricing === 'estimated' ? 'Approximate token-based cost' : uncertainPrice ? 'Illustrative base cost only' : 'Estimated usage cost';
  return {estimate,upperEstimate,byteRange,trainingUnknown,streamingUnknown,rate:knownRate,uncertainPrice,status,label:labels[status],costLabel,trainingBlocked,trainingConditional,labelsUnknown,stale,...(text?{inputCost,outputCost}:{}),
    budgetLabel:uncertainPrice ? 'Final cost not confirmed' : overBudget ? `$${(estimate - req.budget).toFixed(2)} over budget` : `$${(req.budget - estimate).toFixed(2)} below budget`};
}
export function ranked(catalog, req, now = Date.now()) {
  const order = {fit:0,confirm:1,'over-budget':2,'not-fit':3};
  return catalog.plans.filter(plan=>categoryMatches(plan,req)).map(plan => ({plan, result:assess(plan, req, isStale({reviewedAt:reviewDate(catalog,plan)}, now))})).sort((a,b) =>
    order[a.result.status] - order[b.result.status] || (a.plan.training === 'excluded' ? -1 : 0) - (b.plan.training === 'excluded' ? -1 : 0) || a.result.estimate - b.result.estimate);
}
export function readSaved(raw, catalog) {
  if (!raw) return [];
  const rows = JSON.parse(raw);
  if (!Array.isArray(rows) || rows.length > 20) throw Error('The saved shortlist could not be read. Existing purchases have not changed.');
  return rows.map(row => {
    if (!row || !catalog.plans.some(p => p.id === row.planId) || typeof row.savedAt !== 'string' || !Number.isFinite(Date.parse(row.savedAt))) throw Error('A saved option is invalid. Existing purchases have not changed.');
    const req=requirements(row.requirements);if(!catalog.plans.some(p=>p.id===row.planId&&categoryMatches(p,req)))throw Error('Saved category mismatch.');
    return {planId:row.planId,savedAt:row.savedAt,requirements:req};
  });
}
export function savedOptionState(rows,planId,req) {
  const row=rows.find(r=>r.planId===planId);
  return !row?'new':JSON.stringify(requirements(row.requirements))===JSON.stringify(requirements(req))?'saved':'update';
}
export function withSavedOption(raw,catalog,planId,req,now=new Date().toISOString()) {
  const rows=readSaved(raw,catalog),selected=requirements(req);
  if(!catalog.plans.some(p=>p.id===planId&&categoryMatches(p,selected))||!Number.isFinite(Date.parse(now)))throw Error('This option cannot be saved.');
  if(savedOptionState(rows,planId,selected)==='saved')return rows;
  const next=[{planId,requirements:selected,savedAt:now},...rows.filter(r=>r.planId!==planId)];
  if(next.length>20)throw Error('Your shortlist is full. Remove an option before saving another.');
  return next;
}
export function nextStep(plan, req) {
  if(categoryOf(req)==='text'&&!req.noTraining)return 'Confirm the model, billing tier, tokenizer and total billed output including reasoning. Test representative non-sensitive prompts before committing.';
  if(categoryOf(req)==='speech'&&!req.noTraining)return 'Confirm your billing unit, voice eligibility and any usage restrictions. Test representative non-sensitive text with the provider before committing.';
  return req.noTraining ? plan.next : plan.pricing === 'from' ? 'Confirm your actual rate and upfront usage commitment before purchasing.' : 'Confirm the selected configuration and billing rate, and test representative non-sensitive audio before purchasing.';
}
export function brief(catalog, plan, req, result, sourceChecks = {}) {
  return `RECALL · BUYING BRIEF\n${plan.name} — ${plan.plan}\n\n${scopeFor(req)}\nWorkload: ${workload(req)}\nBudget: USD ${req.budget.toFixed(2)}/month\nNo model training required: ${req.noTraining ? 'Yes' : 'No'}\n${extraCondition(req)}\n\n${result.label}\n${result.costLabel}: ${priceText(plan,result)}/month\n${result.budgetLabel}\n${plan.priceNote}\n${plan.trainingNote}\nNext: ${nextStep(plan,req)}\n\nCatalog pricing and policy reviewed: ${reviewDate(catalog,plan)}. This date does not change when pages are fetched.\n${plan.sources.map(key => {const s = catalog.sources[key], check = sourceChecks[key];return `${s.label}: ${s.url}${check ? `\nPage check: ${check.status}, ${check.checkedAt}${check.sha256 ? `, SHA-256 ${check.sha256}` : ''}` : '\nNot fetched during this visit.'}`;}).join('\n\n')}\n\nEstimates exclude taxes, free credits, unselected add-ons, implementation and volume discounts. Test output quality with representative non-sensitive input. Catalog matching is rules-based, not a GenLayer assessment, a compliance certification, or proof of delivery. Source retrieval does not revalidate policy meaning.\n\nNo order, provider contact, payment, or wallet action was made. Recall is not integrated with this provider’s checkout. Purchase separately through the provider after resolving the open conditions.\n`;
}
