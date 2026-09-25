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
 const vv=visualViewport,search=rect('.search-area'),audioDock=rect('.audio-dock'),player=rect('.mobile-player'),toggle=rect('#player-toggle');
 const searchHit=document.querySelector('.search-area').contains(document.elementFromPoint((search.left+search.right)/2,search.top+search.height/2));
 const playerHit=document.elementFromPoint((toggle.left+toggle.right)/2,toggle.top+toggle.height/2)===document.querySelector('#player-toggle');
 return {scrollY,innerHeight,viewportTop:vv.offsetTop,viewportBottom:vv.offsetTop+vv.height,search,audioDock,player,toggle,searchHit,playerHit,docked:document.querySelector('.search-area').classList.contains('docked'),portaled:document.querySelector('.search-area').parentElement===document.body,scrollWidth:document.documentElement.scrollWidth};
});}
(async()=>{
 for(const [name,engine] of [['webkit',webkit],['chromium',chromium]]){
  const browser=await engine.launch({headless:true});
  try{
   const context=await browser.newContext({...devices['iPhone 13'],locale:'el-GR'});
   const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
   await page.goto(base,{waitUntil:'networkidle'});await page.locator('.topic-card').first().waitFor();
   const initial=await metrics(page);check(`${name}: search starts at its original location`,!initial.docked&&initial.portaled&&initial.search.top>250);
   check(`${name}: mobile player and story button have full touch targets`,await page.evaluate(()=>['#player-toggle','#player-back','#player-forward','#player-mute','#player-seek','#speed','.memory-card .story-play'].every(selector=>document.querySelector(selector).getBoundingClientRect().height>=44)));
   check(`${name}: mute and speed share the compact header`,await page.evaluate(()=>{const mute=document.querySelector('#player-mute').getBoundingClientRect(),speed=document.querySelector('#speed').getBoundingClientRect(),timeline=document.querySelector('.mobile-player-timeline').getBoundingClientRect(),dock=document.querySelector('.audio-dock').getBoundingClientRect();return Math.abs((mute.top+mute.bottom)/2-(speed.top+speed.bottom)/2)<2&&mute.bottom<timeline.top&&dock.height<=200;}));
   check(`${name}: transport is centered below timeline`,await page.evaluate(()=>{const timeline=document.querySelector('.mobile-player-timeline').getBoundingClientRect(),actions=document.querySelector('.mobile-player-actions').getBoundingClientRect(),toggle=document.querySelector('#player-toggle').getBoundingClientRect();return actions.top>=timeline.bottom-1&&Math.abs((toggle.left+toggle.right)/2-(timeline.left+timeline.right)/2)<2;}));
   check(`${name}: skip controls show ten seconds`,await page.evaluate(()=>['#player-back','#player-forward'].every(selector=>{const button=document.querySelector(selector);return button.textContent.includes('10')&&button.getAttribute('aria-label').includes('10');})));
   for(const y of [600,1300,2100,900]){
    await page.evaluate(y=>scrollTo({top:y,behavior:'instant'}),y);
    await page.waitForFunction(y=>Math.abs(scrollY-y)<4&&document.querySelector('.search-area').classList.contains('docked'),y);
    const m=await metrics(page);
    check(`${name}: search docked at ${y}`,m.docked&&Math.abs(m.search.top-m.viewportTop)<2&&m.search.bottom<130);
    check(`${name}: audio dock anchored at ${y}`,Math.abs(m.audioDock.bottom-m.viewportBottom)<2&&m.player.bottom<=m.viewportBottom&&m.scrollWidth<=390);
    check(`${name}: search and player are hit-testable at ${y}`,m.searchHit&&m.playerHit);
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
   await page.locator('#audio').evaluate(e=>e.muted=true);
   await page.locator('#player-mute').click();
   check(`${name}: mute control restores sound`,await page.locator('#audio').evaluate(e=>!e.muted));
   await page.locator('#player-mute').click();
   check(`${name}: mute control silences sound`,await page.locator('#audio').evaluate(e=>e.muted));
   await page.evaluate(()=>{const button=document.querySelectorAll('.memory-card .story-play')[1];scrollTo({top:button.getBoundingClientRect().top+scrollY-innerHeight+270,behavior:'instant'});});
   await page.locator('.memory-card .story-play').nth(1).click();
   await page.waitForFunction(()=>{const a=document.querySelector('#audio');return !a.paused&&a.readyState>=2;});
   check(`${name}: story button starts its excerpt`,await page.locator('#now-title').innerText().then(t=>t.includes('Σαράντα ένα χρόνια')));
   await page.screenshot({path:path.join(out,`${name}-story-playing.png`)});
   await page.locator('#player-toggle').click();
   check(`${name}: large play control pauses`,await page.locator('#audio').evaluate(e=>e.paused));
   await page.locator('#player-toggle').click();
   await page.waitForFunction(()=>!document.querySelector('#audio').paused);
   check(`${name}: large play control resumes`,true);
   await page.locator('#audio').evaluate(e=>e.currentTime=6808);
   const beforeSkip=await page.locator('#audio').evaluate(e=>e.currentTime);
   await page.locator('#player-back').click();
   const afterBack=await page.locator('#audio').evaluate(e=>e.currentTime);
   check(`${name}: back control seeks 10 seconds`,Math.abs(beforeSkip-afterBack-10)<1);
   await page.locator('#player-forward').click();
   const afterForward=await page.locator('#audio').evaluate(e=>e.currentTime);
   check(`${name}: forward control seeks 10 seconds`,Math.abs(afterForward-afterBack-10)<1);
   await page.locator('#stop-excerpt').click();
   check(`${name}: full audio restores from excerpt`,await page.locator('#stop-excerpt').evaluate(e=>e.hidden));
   await page.locator('#player-seek').evaluate(e=>{e.value=String(Number(e.max)/2);e.dispatchEvent(new Event('change',{bubbles:true}));});
   check(`${name}: timeline seeks full recording`,await page.locator('#audio').evaluate(e=>Math.abs(e.currentTime-e.duration/2)<2));
   await page.locator('#speed').selectOption('1.5');
   check(`${name}: speed selector updates playback`,await page.locator('#audio').evaluate(e=>e.playbackRate===1.5));
   await page.screenshot({path:path.join(out,`${name}-player.png`)});
   await page.setViewportSize({width:320,height:700});
   check(`${name}: narrow phone transport stays centered without overlap`,await page.evaluate(()=>{const rect=id=>document.querySelector(id).getBoundingClientRect(),back=rect('#player-back'),toggle=rect('#player-toggle'),forward=rect('#player-forward'),timeline=rect('.mobile-player-timeline'),actions=rect('.mobile-player-actions'),mute=rect('#player-mute'),speed=rect('.speed-label');return document.documentElement.scrollWidth<=320&&actions.top>=timeline.bottom-1&&Math.abs((toggle.left+toggle.right)/2-(timeline.left+timeline.right)/2)<2&&back.right<toggle.left&&toggle.right<forward.left&&mute.right<speed.left;}));
   check(`${name}: no browser errors`,errors.length===0);
  }finally{await browser.close();}
 }
 report.ok=true;fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
})().catch(error=>{console.error(error);process.exitCode=1;});
