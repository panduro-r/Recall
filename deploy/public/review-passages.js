// Presentation only. Never replace the saved citation, source text or fingerprint.
// A reading passage may extend to nearby line boundaries to finish clipped words.
// It must remain one contiguous slice of the captured document, including caveats.
export function passageContext(quote, source) {
  const at=typeof source==='string'&&typeof quote==='string'&&quote.length?source.indexOf(quote):-1;
  if(at<0)return {text:quote||'',expanded:false,leading:false,trailing:false,matched:false};
  const end=at+quote.length,previous=at>0?source.lastIndexOf('\n',at-1)+1:0;
  const following=source.indexOf('\n',end),lineEnd=following<0?source.length:following;
  let start=at,stop=end;
  if(at-previous<=240)start=previous;
  else while(start>0&&at-start<80&&!/\s/u.test(source[start-1]))start--;
  if(lineEnd-end<=240)stop=lineEnd;
  else while(stop<source.length&&stop-end<80&&!/\s/u.test(source[stop]))stop++;
  return {text:source.slice(start,stop),expanded:start!==at||stop!==end,
    leading:start>0&&source[start-1]!=='\n',trailing:stop<source.length&&source[stop]!=='\n',matched:true};
}

// A deliberately small plain-text reading view, not an HTML/Markdown executor.
// Link labels remain text. Only the separately validated document URL is linked.
// Unsupported syntax is left visible and the exact saved quote is always exposed.
export function passageBlocks(text) {
  const readable=String(text).replace(/<br\s*\/?\s*>/gi,'\n')
    .replace(/!?\[([^\]\n]*)\]\((?:[^()\n]|\([^()\n]*\))*\)/g,(_,label)=>label.replace(/\u200b/g,''))
    .replace(/\*\*([^*\n]+)\*\*/g,'$1').replace(/__([^_\n]+)__/g,'$1')
    .replace(/`([^`\n]+)`/g,'$1');
  const blocks=[];
  let fenced=false;
  for(const line of readable.split(/\r?\n/)){
    if(/^\s*(```|~~~)/.test(line)){fenced=!fenced;continue;}
    if(!line.trim())continue;
    const heading=!fenced&&line.match(/^\s*#{1,6}\s+(.+)$/);
    const item=!fenced&&line.match(/^\s*[-*+]\s+(.+)$/);
    blocks.push({type:fenced?'code':heading?'heading':item?'item':'paragraph',text:heading?.[1]||item?.[1]||line.trim()});
  }
  return blocks;
}

export function citationGroups(citations, documents) {
  const groups=new Map();
  for(const citation of citations){
    const document=documents.find(d=>d.id===citation.source);
    if(!document)continue; // Session validation handles missing sources before render.
    if(!groups.has(document.id))groups.set(document.id,{document,citations:[]});
    groups.get(document.id).citations.push(citation);
  }
  return [...groups.values()];
}
