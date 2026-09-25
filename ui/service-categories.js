// Category boundaries are part of the saved request, not presentation-only filters.
export const CATEGORIES = {
  transcription: {label:'Transcription',name:'Transcription API',description:'Turn recorded audio into text',scope:'English, pre-recorded, single-channel transcription API.',sample:'audio'},
  speech: {label:'Speech generation',name:'Text-to-speech API',description:'Turn text into spoken audio',scope:'English text-to-speech API using standard voices. Voice cloning and voice-agent orchestration are not included.',sample:'text'},
  text: {label:'Text generation',name:'Text generation API',description:'Build chat, writing and text workflows',scope:'Text-only API requests with up to 128k input tokens per request. Standard paid inference, uncached input and all billed output (including reasoning). No tools, batch, priority, media or cache-storage charges included.',sample:'text'}
};
export const categoryOf = value => value?.category ?? 'transcription';
// Only text plans with successful saved Studio Next checks are currently enabled.
export const TEXT_ASSESSMENT_PLANS = Object.freeze(['openai-mini','mistral-small','deepseek-flash','anthropic-haiku','google-flash']);
export const assessmentAvailable = (value,plan) => ['transcription','speech'].includes(categoryOf(value))||categoryOf(value)==='text'&&TEXT_ASSESSMENT_PLANS.includes(plan?.id);
// Reading a preserved experimental result does not authorize new assessments.
export const assessmentReadable = value => ['transcription','speech','text'].includes(categoryOf(value));
export const assessmentNotice = 'This plan supports comparison, saving and evidence capture, but its GenLayer assessment is not enabled yet.';
export const extraLabel = value => categoryOf(value)==='text'?'Streaming text':categoryOf(value)==='speech'?'Streaming audio':'Speaker labels';
export function requirementKeys(category){return category==='text'?['category','inputTokens','outputTokens','budget','noTraining','streaming']:category==='speech'?['category','characters','budget','noTraining','streaming','utf8Bytes']:['hours','budget','noTraining','speakers',...(category?['category']:[])];}
export function categoryMatches(plan,req){return categoryOf(plan)===categoryOf(req);}
export function workload(req){return categoryOf(req)==='text'?`${req.inputTokens.toLocaleString('en-US')} input + ${req.outputTokens.toLocaleString('en-US')} output tokens / month`:categoryOf(req)==='speech'?`${req.characters.toLocaleString('en-US')} characters / month${req.utf8Bytes==null?'':' · '+req.utf8Bytes.toLocaleString('en-US')+' UTF-8 bytes / month'}`:`${req.hours.toLocaleString('en-US')} audio hours / month`;}
export function extraCondition(req){return categoryOf(req)!=='transcription'?(req.streaming?extraLabel(req)+' required':'Streaming not required'):(req.speakers?'Speaker labels required':'No speaker-label requirement');}
export function scopeFor(req){return CATEGORIES[categoryOf(req)].scope;}
export function priceText(plan,result){
  const usd=n=>new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',minimumFractionDigits:2,maximumFractionDigits:2}).format(n);
  if(plan.pricing==='from')return 'Quote needed';
  if(result.byteRange)return `${usd(result.estimate)}–${usd(result.upperEstimate)}`;
  return `${plan.pricing==='estimated'?'≈ ':''}${usd(result.estimate)}`;
}
export function unitPrice(plan,result){
  if(categoryOf(plan)==='text')return `$${(plan.rate*1000000).toFixed(2)} input · $${(plan.outputRate*1000000).toFixed(2)} output / million tokens`;
  if(categoryOf(plan)==='speech')return `$${(plan.rate*1000000).toFixed(2)} / million ${plan.unit==='utf8-byte'?'UTF-8 bytes':'characters'}`;
  return `$${Number(result.rate.toFixed(4))} / audio hour`;
}
export function textRequirements(value,budget){
  if(['inputTokens','outputTokens'].some(k=>!['number','string'].includes(typeof value[k])))throw Error('Enter whole monthly token counts.');
  const inputTokens=Number(value.inputTokens),outputTokens=Number(value.outputTokens);
  if([inputTokens,outputTokens].some(n=>!Number.isSafeInteger(n)||n<1||n>1000000000))throw Error('Enter 1–1,000,000,000 whole tokens for both monthly input and billed output.');
  if(typeof value.streaming!=='boolean'||typeof value.noTraining!=='boolean')throw Error('Choose your text-generation conditions.');
  return {category:'text',inputTokens,outputTokens,budget,noTraining:value.noTraining,streaming:value.streaming};
}
export function speechRequirements(value,budget){
  const characters=Number(value.characters),utf8Bytes=value.utf8Bytes==null||value.utf8Bytes===''||value.utf8Bytes==='null'?null:Number(value.utf8Bytes);
  if(!Number.isSafeInteger(characters)||characters<1||characters>100000000)throw Error('Enter 1–100,000,000 whole text characters per month.');
  if(utf8Bytes!==null&&(!Number.isSafeInteger(utf8Bytes)||utf8Bytes<characters||utf8Bytes>characters*4))throw Error('UTF-8 bytes must be between one and four times your character count. Leave blank if unknown.');
  if(typeof value.streaming!=='boolean'||typeof value.noTraining!=='boolean'||Object.hasOwn(value,'hours')||Object.hasOwn(value,'speakers'))throw Error('Choose speech-generation requirements, not audio-transcription inputs.');
  return {category:'speech',characters,budget,noTraining:value.noTraining,streaming:value.streaming,utf8Bytes};
}
export function requirementsFromParams(p){
  const boolean=k=>{if(!['true','false'].includes(p.get(k)))throw Error('Invalid requirement in this link.');return p.get(k)==='true';};
  return p.get('category')==='text'?{category:'text',inputTokens:p.get('inputTokens'),outputTokens:p.get('outputTokens'),budget:p.get('budget'),noTraining:boolean('noTraining'),streaming:boolean('streaming')}:p.get('category')==='speech'?{category:'speech',characters:p.get('characters'),budget:p.get('budget'),noTraining:boolean('noTraining'),streaming:boolean('streaming'),utf8Bytes:p.get('utf8Bytes')}:
    {...(p.has('category')?{category:p.get('category')}:{}),hours:p.get('hours'),budget:p.get('budget'),noTraining:boolean('noTraining'),speakers:boolean('speakers')};
}
