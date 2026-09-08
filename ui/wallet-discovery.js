// EIP-6963 metadata is supplied by extensions, not verified wallet identity.
// Only bounded data images are accepted; SVGs must be rendered through <img>.
export const DISCONNECT_KEY='recall.wallet.disconnected.v1';
export function walletIcon(value) {
  if(typeof value!=='string'||value.length>262144)return null;
  // Some extensions (including Phantom) wrap their data URI in line breaks.
  // Normalize its edges, without changing the image-type or size restrictions.
  const uri=value.trim();
  return /^data:image\/(?:png|webp|svg\+xml|jpeg|gif)(?:;charset=utf-8)?(?:;base64)?,.+$/is.test(uri)?uri:null;
}
export function registerWallet(providers,detail) {
  const info=detail?.info,provider=detail?.provider;
  if(typeof info?.uuid!=='string'||!info.uuid.trim()||info.uuid.length>128||typeof provider?.request!=='function')return null;
  // Upgrade the legacy injected entry in place; never replace a provider with
  // a different object that happens to announce the same identifier.
  const existing=[...providers].find(([,entry])=>entry.provider===provider);
  if(existing?.[1].announced||(!existing&&providers.has(info.uuid)))return null;
  const key=existing?.[0]||info.uuid;
  const name=typeof info.name==='string'?info.name.replace(/[\u0000-\u001f\u007f-\u009f\u202a-\u202e\u2066-\u2069]/g,'').trim().slice(0,80):'';
  providers.set(key,{name:name||'Browser wallet',icon:walletIcon(info.icon),provider,announced:true});
  return key;
}
export function canRestoreWallet(storage) {
  try{return storage.getItem(DISCONNECT_KEY)!=='true';}catch{return false;}
}
export function rememberDisconnect(storage,disconnected) {
  try{storage.setItem(DISCONNECT_KEY,String(disconnected));return true;}catch{return false;}
}
