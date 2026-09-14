// Category boundaries are part of the saved request, not presentation-only filters.
export const CATEGORIES = {
  transcription: {label:'Transcription',name:'Transcription API',description:'Turn recorded audio into text',scope:'English, pre-recorded, single-channel transcription API.',sample:'audio'},
  speech: {label:'Speech generation',name:'Text-to-speech API',description:'Turn text into spoken audio',scope:'English text-to-speech API using standard voices. Voice cloning and voice-agent orchestration are not included.',sample:'text'}
};
export const categoryOf = value => value?.category ?? 'transcription';
export function categoryMatches(plan,req){return categoryOf(plan)===categoryOf(req);}
export function workload(req){return categoryOf(req)==='speech'?`${req.characters.toLocaleString('en-US')} characters / month${req.utf8Bytes==null?'':' · '+req.utf8Bytes.toLocaleString('en-US')+' UTF-8 bytes / month'}`:`${req.hours.toLocaleString('en-US')} audio hours / month`;}
export function extraCondition(req){return categoryOf(req)==='speech'?(req.streaming?'Streaming audio required':'Streaming not required'):(req.speakers?'Speaker labels required':'No speaker-label requirement');}
export function scopeFor(req){return CATEGORIES[categoryOf(req)].scope;}
export function priceText(plan,result){
  const usd=n=>new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',minimumFractionDigits:2,maximumFractionDigits:2}).format(n);
  if(plan.pricing==='from')return 'Quote needed';
  if(result.byteRange)return `${usd(result.estimate)}–${usd(result.upperEstimate)}`;
  return `${plan.pricing==='estimated'?'≈ ':''}${usd(result.estimate)}`;
}
export function unitPrice(plan,result){
  if(categoryOf(plan)==='speech')return `$${(plan.rate*1000000).toFixed(2)} / million ${plan.unit==='utf8-byte'?'UTF-8 bytes':'characters'}`;
  return `$${Number(result.rate.toFixed(4))} / audio hour`;
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
  return p.get('category')==='speech'?{category:'speech',characters:p.get('characters'),budget:p.get('budget'),noTraining:boolean('noTraining'),streaming:boolean('streaming'),utf8Bytes:p.get('utf8Bytes')}:
    {...(p.has('category')?{category:p.get('category')}:{}),hours:p.get('hours'),budget:p.get('budget'),noTraining:boolean('noTraining'),speakers:boolean('speakers')};
}
