// Isolated localhost only. May follow saved-reviews-browser.js to include synthetic findings.
async function testComparisonReport(){
  if(location.hostname!=='127.0.0.1'||location.pathname!=='/compare')throw Error('Isolated local comparison required');
  const checks=[],assert=(ok,label)=>{if(!ok)throw Error(label);checks.push(label);};
  const wait=async fn=>{for(let i=0;i<250;i++){if(fn())return;await new Promise(r=>setTimeout(r,20));}throw Error('Timed out');};
  const dialog=document.querySelector('#option-dialog');if(dialog.open)dialog.close();
  const form=document.querySelector('#requirements');form.hours.value='100';form.budget.value='50';form.noTraining.checked=true;form.speakers.checked=false;form.requestSubmit();
  const choose=(i,id)=>{const s=document.querySelector('#compare-plan-'+i);s.value=id;s.dispatchEvent(new Event('change',{bubbles:true}));};
  choose(0,'speechmatics-standard');choose(1,'assembly-pro');
  assert(document.querySelector('.pair-decision').textContent.includes('open pricing'),'Summary identifies conditional prices');
  const before=JSON.stringify(Object.entries(localStorage));let apiCalls=0,blob,filename;
  const nativeFetch=fetch,nativeURL=URL.createObjectURL,nativeClick=HTMLAnchorElement.prototype.click;
  window.fetch=(url,options)=>{if(String(url).includes('/api/')||options?.method&&options.method!=='GET'){apiCalls++;throw Error('No provider or Studio calls allowed');}return nativeFetch(url,options);};
  URL.createObjectURL=value=>{blob=value;return nativeURL(value);};
  HTMLAnchorElement.prototype.click=function(){if(this.download){filename=this.download;return;}return nativeClick.call(this);};
  try{
    // The report uses applied input, not edits that have not been compared.
    form.hours.value='999';form.dispatchEvent(new Event('input',{bubbles:true}));
    document.querySelector('#export-comparison').click();await wait(()=>blob&&!document.querySelector('#export-comparison').disabled);
    const html=await blob.text(),doc=new DOMParser().parseFromString(html,'text/html');
    assert(filename.startsWith('recall-comparison-speechmatics-standard-vs-assembly-pro-')&&filename.endsWith('.html'),'Explicit printable HTML download');
    assert(doc.querySelector('.requirements').textContent.includes('100 audio hours')&&!doc.querySelector('.requirements').textContent.includes('999'),'Only applied requirements exported');
    assert(doc.querySelectorAll('thead th').length===3&&doc.querySelectorAll('section.option').length===2,'Both selected providers included');
    assert(doc.body.textContent.includes('illustrative base cost only')&&doc.body.textContent.includes('opt-out'),'Unpriced privacy configuration remains conditional');
    assert(doc.body.textContent.includes('Catalog sources · reviewed')&&doc.body.textContent.includes('Report created'),'Catalog and report dates are separate');
    assert(doc.querySelectorAll('script,img,iframe,form,input,link').length===0,'Offline report has no active content or remote assets');
    assert([...doc.querySelectorAll('a')].every(a=>a.getAttribute('href').startsWith('https://')),'Only public HTTPS source links');
    assert(!html.includes('/review#')&&!html.includes('0x'+'7'.repeat(40)),'Local IDs and connected account omitted');
    assert(doc.querySelector('style').textContent.includes('@media print'),'Printable layout included');
    assert(JSON.stringify(Object.entries(localStorage))===before&&!apiCalls,'No storage mutation, wallet or API action');
    assert(document.querySelector('#report-status').textContent.includes('Report ready'),'Download feedback is visible');
    assert(document.documentElement.scrollWidth<=innerWidth,'Comparison has no horizontal overflow');
    sessionStorage.setItem('recall.qa.reportHTML',html);
    const saved=JSON.parse(localStorage.getItem('recall.provider-reviews.v1')||'[]');
    if(saved.some(r=>r.session)){
      assert(doc.querySelectorAll('section.assessment .finding').length===2,'Matched synthetic findings included only for Speechmatics');
      assert(doc.querySelector('.assessment blockquote').firstChild.textContent===saved.find(r=>r.session).session.state.results[0].citations[0].quote,'Supporting quotation preserved exactly');
    }
    // An unreadable journal is reported as unavailable, not ignored in favor of old findings.
    const key='recall.provider-review-transactions.v1',old=localStorage.getItem(key);localStorage.setItem(key,'broken');blob=null;
    document.querySelector('#export-comparison').click();await wait(()=>blob&&!document.querySelector('#export-comparison').disabled);
    assert((await blob.text()).includes('Saved review status unavailable'),'Export rereads records and rejects damaged history');
    if(old===null)localStorage.removeItem(key);else localStorage.setItem(key,old);
    assert(JSON.stringify(Object.entries(localStorage))===before,'QA fixture restored after corrupt-record test');
    return {passed:true,checks,apiCalls,bytes:html.length,findings:doc.querySelectorAll('.finding').length};
  }finally{window.fetch=nativeFetch;URL.createObjectURL=nativeURL;HTMLAnchorElement.prototype.click=nativeClick;}
}

async function readExportedComparisonReport(){
  if(location.hostname!=='127.0.0.1')throw Error('Isolated localhost only');
  const html=sessionStorage.getItem('recall.qa.reportHTML');if(!html)throw Error('Export fixture missing');
  // Save these exact exported bytes as a local .html QA artifact and open that file.
  // A blob preview inherits the app's stricter CSP, unlike the downloaded file.
  return html;
}
