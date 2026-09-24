const {createRequire}=require('node:module');
const path=require('node:path');
const os=require('node:os');
const fs=require('node:fs');
const assert=require('node:assert/strict');
const requireBundled=createRequire(path.join(os.homedir(),'.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/package.json'));
const {webkit,chromium,devices}=requireBundled('playwright');
const base=process.env.VOICE_QA_URL||'http://127.0.0.1:5173/voice/';
const out=path.resolve(process.env.VOICE_QA_OUTPUT||'output/playwright/mobile-viewport');
fs.mkdirSync(out,{recursive:true});
const report={url:base,checks:[],limitations:['Desktop WebKit and mobile emulation cannot reproduce every physical iPhone/Safari compositor bug.']};
function check(name,value){assert(value,name);report.checks.push(name);}
async function metrics(page){return page.evaluate(()=>{
 const rect=selector=>{const r=document.querySelector(selector).getBoundingClientRect();return {top:r.top,bottom:r.bottom,height:r.height,left:r.left,right:r.right};};
 const vv=visualViewport,search=rect('.search-area'),audioDock=rect('.audio-dock'),audio=rect('#audio');
 const searchHit=document.querySelector('.search-area').contains(document.elementFromPoint((search.left+search.right)/2,search.top+search.height/2));
 const audioHit=document.querySelector('.audio-dock').contains(document.elementFromPoint((audio.left+audio.right)/2,audio.top+audio.height/2));
 return {scrollY,innerHeight,viewportTop:vv.offsetTop,viewportBottom:vv.offsetTop+vv.height,search,audioDock,audio,searchHit,audioHit,docked:document.querySelector('.search-area').classList.contains('docked'),portaled:document.querySelector('.search-area').parentElement===document.body,scrollWidth:document.documentElement.scrollWidth};
});}
(async()=>{
 for(const [name,engine] of [['webkit',webkit],['chromium',chromium]]){
  const browser=await engine.launch({headless:true});
  try{
   const context=await browser.newContext({...devices['iPhone 13'],locale:'el-GR'});
   const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
   await page.goto(base,{waitUntil:'networkidle'});await page.locator('.topic-card').first().waitFor();
   const initial=await metrics(page);check(`${name}: search starts at its original location`,!initial.docked&&initial.portaled&&initial.search.top>250);
   for(const y of [600,1300,2100,900]){
    await page.evaluate(y=>scrollTo({top:y,behavior:'instant'}),y);
    await page.waitForFunction(y=>Math.abs(scrollY-y)<4&&document.querySelector('.search-area').classList.contains('docked'),y);
    const m=await metrics(page);
    check(`${name}: search docked at ${y}`,m.docked&&Math.abs(m.search.top-m.viewportTop)<2&&m.search.bottom<130);
    check(`${name}: audio dock anchored at ${y}`,Math.abs(m.audioDock.bottom-m.viewportBottom)<2&&m.audio.bottom<=m.viewportBottom&&m.scrollWidth<=390);
    check(`${name}: search and timeline are hit-testable at ${y}`,m.searchHit&&m.audioHit);
   }
   await page.screenshot({path:path.join(out,`${name}-scrolled.png`)});
   const controlled=await page.evaluate(()=>{
    const original=visualViewport;
    try{Object.defineProperty(window,'visualViewport',{configurable:true,value:{offsetTop:18,height:innerHeight-110}});}catch{return null;}
    dispatchEvent(new Event('resize'));
    const top=document.querySelector('.search-area').getBoundingClientRect().top;
    const bottom=document.querySelector('.audio-dock').getBoundingClientRect().bottom;
    Object.defineProperty(window,'visualViewport',{configurable:true,value:original});dispatchEvent(new Event('resize'));
    return {top,bottom,height:innerHeight};
   });
   if(controlled)check(`${name}: bars follow changed visual viewport`,Math.abs(controlled.top-18)<2&&Math.abs(controlled.bottom-(controlled.height-92))<2);
   await page.evaluate(()=>scrollTo({top:0,behavior:'instant'}));await page.waitForFunction(()=>scrollY===0&&!document.querySelector('.search-area').classList.contains('docked'));
   const returned=await metrics(page);check(`${name}: search returns to hero`,!returned.docked&&returned.search.top>250);
   check(`${name}: no browser errors`,errors.length===0);
  }finally{await browser.close();}
 }
 report.ok=true;fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
})().catch(error=>{console.error(error);process.exitCode=1;});
