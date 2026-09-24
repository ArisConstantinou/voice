const $ = selector => document.querySelector(selector);
const esc = value => String(value).replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const norm = value => String(value).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase('el').replace(/ς/g,'σ');
const time = seconds => { const s = Math.max(0,Math.floor(seconds)); return s >= 3600 ? `${Math.floor(s/3600)}:${String(Math.floor(s/60)%60).padStart(2,'0')}:${String(s%60).padStart(2,'0')}` : `${Math.floor(s/60)}:${String(s%60).padStart(2,'0')}`; };
let archive, transcript, waveform = [], records = [], results = [], shown = 20, currentQuery = '', excerpt = null, recognition = null, speechToken = 0, follow = false, currentChapter = 0, toastTimer;
const audio = $('#audio');
const reader = $('#reader');
const aliases = [['rcd','ρελε','ρελέ'],['rcbo','αρσιμπο'],['πριζ','socket','outlet'],['γειω','earth','earthing'],['φωτισ','light'],['πινακ','board','db'],['προσφορ','quot','estim'],['καλωδ','cable'],['κυκλωμ','circuit']];
const searchHome = $('#search-home');
const searchArea = $('.search-area');
let docked = false;
function updateSearchDock(){
  const shouldDock = searchHome.getBoundingClientRect().top < 0;
  if(shouldDock === docked) return;
  docked = shouldDock;
  if(docked){
    searchHome.style.height = `${searchHome.getBoundingClientRect().height}px`;
    document.body.append(searchArea);
    searchArea.classList.add('docked');
  }else{
    searchArea.classList.remove('docked');
    searchHome.append(searchArea);
    searchHome.style.height = '';
  }
}
window.addEventListener('scroll',updateSearchDock,{passive:true});
window.addEventListener('resize',updateSearchDock);
requestAnimationFrame(updateSearchDock);
function toast(text){ $('#toast').textContent = text; $('#toast').hidden = false; clearTimeout(toastTimer); toastTimer = setTimeout(()=>$('#toast').hidden = true,5000); }
function stopSpeech(){ speechToken++; window.speechSynthesis?.cancel(); }
function speak(text){
  if(!('speechSynthesis' in window)){toast('Η συνθετική ανάγνωση δεν υποστηρίζεται σε αυτόν τον browser.');return;}
  stopSpeech(); audio.pause();
  const token = speechToken;
  const sentences = text.match(/[^.!?;·\n]+[.!?;·\n]*/g) || [text];
  const chunks = sentences.flatMap(s => s.match(/.{1,220}(?:\s|$)/g) || [s]);
  const voices = speechSynthesis.getVoices();
  const greekVoice = voices.find(v=>v.lang.toLowerCase().startsWith('el'));
  toast(greekVoice ? 'Συνθετική ανάγνωση — όχι η φωνή του ομιλητή.' : 'Δεν εντοπίστηκε ελληνική φωνή. Η προφορά εξαρτάται από τη συσκευή.');
  function next(){ if(token !== speechToken || !chunks.length) return; const u = new SpeechSynthesisUtterance(chunks.shift()); u.lang='el-GR'; if(greekVoice)u.voice=greekVoice; u.rate=.94; u.onend=next; u.onerror=e=>{if(e.error!=='canceled'&&e.error!=='interrupted')toast('Η ανάγνωση διακόπηκε από τη συσκευή.');}; speechSynthesis.speak(u); }
  next();
}
async function play(start=0,end=null,title='Η συζήτηση'){
  stopSpeech(); excerpt = end ? {start,end} : null;
  $('#now-title').textContent=title; $('#now-subtitle').textContent=end ? `${time(start)}–${time(end)} · Αυθεντικός ήχος` : 'Electrical · Αυθεντικός ήχος';
  $('#stop-excerpt').hidden=!excerpt;
  audio.currentTime=start;
  try{await audio.play();}catch{toast('Πάτησε αναπαραγωγή στον player. Αν δεν φορτώνει, έλεγξε τη σύνδεση.');}
}
audio.addEventListener('error',()=>toast('Δεν ήταν δυνατή η φόρτωση της ηχογράφησης. Δοκίμασε ξανά όταν υπάρχει σύνδεση.'));
audio.addEventListener('play',stopSpeech);
audio.addEventListener('timeupdate',()=>{
  const gap=transcript?.redactions?.find(r=>audio.currentTime>=r.start && audio.currentTime<r.end);
  if(gap){audio.currentTime=gap.end;toast('Η ιδιωτική παρένθεση παραλείφθηκε. Συνεχίζουμε τη συζήτηση.');return;}
  if(excerpt && audio.currentTime >= excerpt.end){audio.pause();excerpt=null;$('#stop-excerpt').hidden=true;$('#now-subtitle').textContent='Το απόσπασμα ολοκληρώθηκε';}
  if(follow && transcript){const chapter=Math.floor(audio.currentTime/600);if(chapter!==currentChapter){currentChapter=chapter;$('#chapter-select').value=chapter;renderTranscript();}}
  if(!transcript)return;
  const active = transcript.segments.find(s=>s.start<=audio.currentTime && s.end>audio.currentTime);
  const old=$('.transcript-line.active');if(old?.dataset.id===String(active?.id))return;old?.classList.remove('active');
  const line=active && $(`.transcript-line[data-id="${active.id}"]`);line?.classList.add('active');
  if(follow && line){const box=$('#transcript-lines');box.scrollTop=line.offsetTop-box.offsetTop-box.clientHeight/3;}
});
audio.addEventListener('seeking',()=>{if(excerpt&&(audio.currentTime<excerpt.start-.5||audio.currentTime>excerpt.end+.5)){excerpt=null;$('#stop-excerpt').hidden=true;$('#now-subtitle').textContent='Electrical · Αυθεντικός ήχος';}});
$('#speed').addEventListener('change',e=>audio.playbackRate=Number(e.target.value));
$('#stop-excerpt').addEventListener('click',()=>{excerpt=null;$('#stop-excerpt').hidden=true;$('#now-subtitle').textContent='Electrical · Αυθεντικός ήχος';});
$('#follow-audio').addEventListener('click',e=>{follow=!follow;e.currentTarget.setAttribute('aria-pressed',String(follow));if(follow){currentChapter=Math.floor(audio.currentTime/600);$('#chapter-select').value=currentChapter;renderTranscript();}});
$('#chapter-select').addEventListener('change',e=>{currentChapter=Number(e.target.value);renderTranscript();});
const reducedMotion = matchMedia('(prefers-reduced-motion:reduce)');
let manualMotionPause = false;
try{manualMotionPause=localStorage.getItem('voice-motion')==='off';}catch{}
function motionStopped(){return manualMotionPause || reducedMotion.matches;}
function syncMotionButton(){
 const paused=motionStopped(),button=$('#motion');
 document.body.classList.toggle('no-motion',paused);
 button.setAttribute('aria-pressed',String(paused));
 button.setAttribute('aria-label',reducedMotion.matches?'Κίνηση απενεργοποιημένη από τις ρυθμίσεις της συσκευής':paused?'Συνέχιση τροχιών':'Παύση τροχιών');
 button.title=reducedMotion.matches?'Μειωμένη κίνηση από τη συσκευή':paused?'Συνέχιση τροχιών':'Παύση τροχιών';
 button.querySelector('.motion-icon').textContent=paused?'▷':'Ⅱ';
 button.querySelector('.motion-copy').textContent=paused?'Τροχιές σε παύση':'Τροχιές σε κίνηση';
}
$('#motion').addEventListener('click',()=>{
 if(reducedMotion.matches){toast('Η συσκευή ζητά μειωμένη κίνηση.');return;}
 manualMotionPause=!manualMotionPause;
 try{localStorage.setItem('voice-motion',manualMotionPause?'off':'on');}catch{}
 syncMotionButton();
});
reducedMotion.addEventListener?.('change',syncMotionButton);
syncMotionButton();
let orbitStarted=false, orbitElapsed=0, orbitPrevious=0;
function startOrbits(positions){
 if(orbitStarted)return;
 orbitStarted=true;
 const planets=[...document.querySelectorAll('.planet-link')].map((button,i)=>{
  const inner=i===5, rx=inner?23:35, ry=inner?22:34;
  const [x,y]=positions[i];
  return {button,rx,ry,phase:Math.atan2((y-52)/ry,(x-50)/rx),period:inner?125000:180000};
 });
 function frame(now){
  const delta=Math.min(now-orbitPrevious,50);orbitPrevious=now;
  if(!document.hidden && !motionStopped() && delta>0){
   orbitElapsed+=delta;
   const bounds=$('#galaxy').getBoundingClientRect();
   if(bounds.bottom>0 && bounds.top<innerHeight)for(const p of planets){
    const angle=p.phase+orbitElapsed*2*Math.PI/p.period;
    p.button.style.left='50%';
    p.button.style.top='52%';
    p.button.style.transform=`translate(-50%,-50%) translate3d(${(p.rx/100)*bounds.width*Math.cos(angle)}px,${(p.ry/100)*bounds.height*Math.sin(angle)}px,0)`;
   }
  }
  requestAnimationFrame(frame);
 }
 requestAnimationFrame(frame);
}
let seed=173;const random=()=>{seed=(seed*16807)%2147483647;return(seed-1)/2147483646;};
$('.starfield').innerHTML=Array.from({length:75},()=>`<span style="left:${random()*100}%;top:${random()*100}%;animation-delay:${random()*5}s"></span>`).join('');
function refs(ranges){return ranges.map(r=>`<button class="text-button" data-action="play" data-start="${r[0]}" data-end="${r[1]}">▷ ${time(r[0])}–${time(r[1])}</button>`).join('');}
function sourceLinks(sources=[]){return sources.length?`<div class="reader-section source-links"><h3>Διασταύρωση με επίσημες πηγές</h3>${sources.map(s=>`<p><a href="${esc(s.url)}" target="_blank" rel="noopener noreferrer">${esc(s.title)} ↗</a></p>`).join('')}</div>`:'';}
function paragraphs(parts){return parts.map(p=>`<p>${esc(p)}</p>`).join('');}
function waveformSvg(start,end){if(!waveform.length)return '';return `<svg class="memory-waveform" viewBox="0 0 270 32" aria-hidden="true">${Array.from({length:45},(_,i)=>{const from=Math.floor(start+(end-start)*i/45),to=Math.max(from+1,Math.floor(start+(end-start)*(i+1)/45));const samples=waveform.slice(from,to);const level=samples.length?samples.reduce((a,b)=>a+b,0)/samples.length:0;const h=2+level*27;return `<rect x="${i*6}" y="${(32-h)/2}" width="2.5" height="${h}" rx="1.25"/>`;}).join('')}</svg>`;}
function renderTopics(category='all'){
  const topics=archive.topics.filter(t=>category==='all'||t.category===category);
  if(reader.parentElement===$('#topic-grid'))closeReader(false);
  $('#topic-grid').innerHTML=topics.map(t=>`<article class="topic-card" style="--accent:${t.color}"><div class="card-top"><span class="card-symbol" aria-hidden="true">${t.symbol}</span><span class="card-index">${String(archive.topics.indexOf(t)+1).padStart(2,'0')} / ${esc(t.label)}</span></div><h3>${esc(t.title)}</h3><p>${esc(t.summary)}</p><div class="card-bottom"><span>${t.ranges.length} ηχητικές αναφορές</span><button data-action="open" data-kind="topic" data-id="${t.id}">Εξερεύνηση ↗</button></div></article>`).join('');
}
function renderArchive(){
 const positions=[[37,19],[76,26],[86,63],[53,88],[16,64],[66,66],[19,33],[72,83]];
 $('#planets').innerHTML=archive.topics.map((t,i)=>`<button class="planet-link" data-action="open" data-kind="topic" data-id="${t.id}" style="left:${positions[i%8][0]}%;top:${positions[i%8][1]}%;--color:${t.color};--size:${[37,47,36,30,45,25,25,23][i%8]}px;--delay:-${i}s" aria-label="Θέμα: ${esc(t.title)}"><span class="planet-ball" aria-hidden="true"></span><span>${esc(t.shortTitle)}</span></button>`).join('');
 startOrbits(positions);
 const stars=[[51,12],[91,41],[31,77],[6,44],[67,71],[9,84]];
 $('#memory-stars').innerHTML=archive.memories.slice(0,6).map((m,i)=>`<button class="memory-map-star" style="left:${stars[i][0]}%;top:${stars[i][1]}%" data-action="open" data-kind="memory" data-id="${m.id}" aria-label="Ανάμνηση: ${esc(m.title)}" title="${esc(m.title)}"><span aria-hidden="true">✦</span></button>`).join('');
 const categories=[...new Set(archive.topics.map(t=>t.category))];
 $('#filters').innerHTML=['all',...categories].map((c,i)=>`<button class="filter" data-filter="${esc(c)}" aria-pressed="${i===0}">${c==='all'?'Όλοι οι κόσμοι':esc(c)}</button>`).join('');
 $('#filters').addEventListener('click',e=>{const button=e.target.closest('[data-filter]');if(!button)return;$('#filters').querySelectorAll('button').forEach(b=>b.setAttribute('aria-pressed',String(b===button)));renderTopics(button.dataset.filter);});
 $('#archive-stats').textContent=`${archive.topics.length} θεματικοί κόσμοι · ${archive.memories.length} αναμνήσεις · 2ω 04λ ήχου`;
 $('#suggestions').innerHTML=archive.suggestions.map(s=>`<button data-query="${esc(s)}">${esc(s)} ↗</button>`).join('');
 renderTopics();
 $('#memory-grid').innerHTML=archive.memories.map((m,i)=>`<article class="memory-card"><span class="memory-label">ΑΣΤΕΡΙ ${String(i+1).padStart(2,'0')} · ${time(m.start)}</span><span class="memory-star" aria-hidden="true">${i%2?'✧':'✦'}</span><h3>${esc(m.title)}</h3><p>${esc(m.summary)}</p>${waveformSvg(m.start,m.end)}<div class="card-bottom"><button data-action="play" data-start="${m.start}" data-end="${m.end}" data-title="${esc(m.title)}">▷ Άκου την ιστορία · ${time(m.end-m.start)}</button><button data-action="open" data-kind="memory" data-id="${m.id}">Διάβασε ↗</button></div></article>`).join('');
 $('#lesson-list').innerHTML=archive.lessons.map((l,i)=>`<details class="lesson" id="lesson-${l.id}"><summary><span class="lesson-number">${String(i+1).padStart(2,'0')}</span>${esc(l.title)}</summary><div class="lesson-body">${paragraphs(l.body)}<h4>Τι κρατάμε</h4><ul>${l.takeaways.map(t=>`<li>${esc(t)}</li>`).join('')}</ul><h4>Σκέψου το στην πράξη</h4><p>${esc(l.question)}</p><h4>Σύνδεση με τη συζήτηση</h4><div class="reader-refs">${refs(l.ranges)}</div>${sourceLinks(l.sources)}<div class="lesson-actions"><button class="outline-button" data-action="speak" data-kind="lesson" data-id="${l.id}">◖ Συνθετική ανάγνωση</button><button class="quiet-button" data-action="stop-speech">Διακοπή ανάγνωσης</button></div></div></details>`).join('');
 $('#chapter-select').innerHTML=Array.from({length:Math.ceil(transcript.duration/600)},(_,i)=>`<option value="${i}">${time(i*600)} – ${time(Math.min((i+1)*600,transcript.duration))}</option>`).join('');
 renderTranscript();
}
function renderTranscript(){
 const segments=transcript.segments.filter(s=>s.start>=currentChapter*600 && s.start<(currentChapter+1)*600);
 $('#transcript-lines').innerHTML=segments.map(s=>`<div class="transcript-line" data-id="${s.id}"><button data-action="play" data-start="${s.start}" aria-label="Αναπαραγωγή από ${time(s.start)}">${time(s.start)}</button><p>${esc(s.text)}${s.uncertain?'<span class="uncertain" title="Χαμηλότερη βεβαιότητα αυτόματης αναγνώρισης">◇ Έλεγξε τον ήχο</span>':''}</p></div>`).join('');
 $('#transcript-lines').scrollTop=0;
}
function buildIndex(){
 const make=(kind,item,text)=>({kind,id:item.id,item,text,normalized:norm(text)});
 records=[...archive.topics.map(t=>make('topic',t,[t.title,t.shortTitle,t.summary,...t.tags,...t.detail].join(' '))),...archive.memories.map(m=>make('memory',m,[m.title,m.summary,...m.body,m.transcript,m.lesson,...m.tags].join(' '))),...archive.lessons.map(l=>make('lesson',l,[l.title,...l.body,...l.takeaways,l.question,...(l.sources||[]).map(s=>s.title)].join(' '))),...transcript.segments.filter(s=>!s.redacted).map(s=>make('transcript',s,s.text))];
}
function tokenVariants(token){const group=aliases.find(a=>a.some(x=>norm(x)===token||(norm(x).length>=4&&token.startsWith(norm(x)))));return group?[token,...group.map(norm)]:[token];}
function highlight(text){
 const tokens=norm(currentQuery).trim().split(/\s+/).filter(Boolean), n=norm(text), spans=[];
 for(const token of tokens){for(const variant of tokenVariants(token)){let pos=n.indexOf(variant);while(pos!==-1){spans.push([pos,pos+variant.length]);pos=n.indexOf(variant,pos+variant.length);}}}
 spans.sort((a,b)=>a[0]-b[0]);let cursor=0,out='';for(const [start,end]of spans){if(start<cursor)continue;out+=esc(text.slice(cursor,start))+`<mark>${esc(text.slice(start,end))}</mark>`;cursor=end;}return out+esc(text.slice(cursor));
}
function snippet(record){const text=record.text;if(text.length<330)return text;const tokens=norm(currentQuery).trim().split(/\s+/);let index=record.normalized.indexOf(tokens[0]);index=Math.max(0,index-90);return (index?'…':'')+text.slice(index,index+330)+(index+330<text.length?'…':'');}
function search(){
 currentQuery=$('#search').value.trim(); shown=20;
 $('#results-section').hidden=!currentQuery;
 if(!currentQuery){results=[];$('#results').innerHTML='';return;}
 const tokens=norm(currentQuery).split(/\s+/).filter(Boolean);
 results=records.filter(r=>tokens.every(t=>tokenVariants(t).some(v=>r.normalized.includes(v))));
 results.sort((a,b)=>{const score=r=>(r.kind==='transcript'?0:3)+(norm(r.item.title||'').includes(norm(currentQuery))?8:0)+(r.normalized.includes(norm(currentQuery))?2:0);return score(b)-score(a);});
 renderResults();
 if(docked){
  const top=$('#results-section').getBoundingClientRect().top;
  if(top<75||top>innerHeight-140)$('#results-section').scrollIntoView({behavior:motionStopped()?'instant':'smooth',block:'start'});
 }
}
const kindNames={topic:'ΘΕΜΑ',memory:'ΑΝΑΜΝΗΣΗ',lesson:'ΤΙ ΜΑΘΑΜΕ',transcript:'ΑΥΘΕΝΤΙΚΟΣ ΗΧΟΣ'};
function renderResults(){
 if(reader.parentElement===$('#results'))closeReader(false);
 $('#result-count').textContent=`${results.length} αποτελέσματα για «${currentQuery}» — θέματα, ιστορίες, σημειώσεις και μεταγραφή.`;
 $('#results').innerHTML=results.length?results.slice(0,shown).map(r=>{const start=r.item.start??r.item.ranges?.[0]?.[0];const title=r.item.title||`Στη συζήτηση · ${time(start)}`;return `<article class="result-item"><span class="result-meta">${kindNames[r.kind]}${start!==undefined?`<br>${time(start)}`:''}</span><div><h3>${highlight(title)}</h3><p>${highlight(snippet(r))}</p></div><div class="result-actions">${start!==undefined?`<button class="text-button" data-action="play" data-start="${start}" data-end="${r.item.end||''}" data-title="${esc(title)}">▷ Άκου</button>`:''}<button class="text-button" data-action="open" data-kind="${r.kind}" data-id="${r.id}">Ανάλυση ↗</button></div></article>`;}).join(''):'<p class="source-note">Δεν βρέθηκε αυτή η διατύπωση. Δοκίμασε μια μικρότερη λέξη ή διαφορετική γραφή. Οι κωδικοί μπορεί να έχουν αποδοθεί φωνητικά στην αυτόματη μεταγραφή.</p>';
 $('#more-results').hidden=shown>=results.length;
}
$('#more-results').addEventListener('click',()=>{shown+=20;renderResults();});
let searchTimer;$('#search').addEventListener('input',()=>{clearTimeout(searchTimer);searchTimer=setTimeout(search,100);});
$('#search-form').addEventListener('submit',e=>{e.preventDefault();search();if(currentQuery)$('#results-section').scrollIntoView({behavior:'smooth'});});
$('#clear-search').addEventListener('click',()=>{$('#search').value='';search();$('#search').focus();});
document.addEventListener('keydown',e=>{
 if(e.key==='Escape'&&!reader.hidden){closeReader();return;}
 if(e.key==='/'&&!/INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName)){e.preventDefault();$('#search').focus();}
});
function recordFor(kind,id){return records.find(r=>r.kind===kind&&String(r.id)===String(id));}
function spokenText(record){const i=record.item;if(record.kind==='topic')return [i.title,i.summary,...i.detail].join('\n');if(record.kind==='memory')return [i.title,...i.body,i.lesson].join('\n');if(record.kind==='lesson')return [i.title,...i.body,...i.takeaways,i.question].join('\n');return i.text;}
let readerTrigger=null;
function closeReader(restoreFocus=true){
 if(reader.hidden)return;
 reader.hidden=true;
 const trigger=readerTrigger;
 trigger?.setAttribute('aria-expanded','false');
 readerTrigger=null;
 document.querySelector('main').append(reader);
 stopSpeech();
 if(restoreFocus&&trigger?.isConnected)trigger.focus({preventScroll:true});
}
function gridRowAnchor(grid,card,selector){
 const cards=[...grid.querySelectorAll(`:scope > ${selector}`)];
 const index=cards.indexOf(card);
 if(index<0)return grid;
 const columns=getComputedStyle(grid).gridTemplateColumns.split(' ').length;
 return cards[Math.min(cards.length-1,Math.floor(index/columns+1)*columns-1)];
}
function readerAnchor(kind,id,trigger){
 const result=trigger?.closest('.result-item');
 if(result)return result;
 if(kind==='topic'){
  const grid=$('#topic-grid');
  const card=[...grid.querySelectorAll(':scope > .topic-card')].find(c=>c.querySelector('[data-action="open"]')?.dataset.id===id);
  return card?gridRowAnchor(grid,card,'.topic-card'):grid;
 }
 if(kind==='memory'){
  const grid=$('#memory-grid');
  const card=[...grid.querySelectorAll(':scope > .memory-card')].find(c=>c.querySelector('[data-action="open"]')?.dataset.id===id);
  return card?gridRowAnchor(grid,card,'.memory-card'):grid;
 }
 if(kind==='lesson')return document.getElementById(`lesson-${id}`) || $('#lesson-list');
 return $('#transcript-lines');
}
function openRecord(kind,id,trigger=null){
 const record=recordFor(kind,id);if(!record)return;
 if(!reader.hidden && reader.dataset.kind===kind && reader.dataset.id===String(id) && readerTrigger===trigger){closeReader();return;}
 const anchor=readerAnchor(kind,id,trigger);
 closeReader(false);
 readerTrigger=trigger;
 trigger?.setAttribute('aria-expanded','true');
 const item=record.item;$('#reader-kind').textContent=kindNames[kind];
 let html=`<h2 class="reader-title" id="reader-title">${esc(item.title||`Στη συζήτηση · ${time(item.start)}`)}</h2>`;
 const start=item.start??item.ranges?.[0]?.[0],end=item.end??item.ranges?.[0]?.[1];
 html+=`<div class="reader-actions">${start!==undefined?`<button class="outline-button warm" data-action="play" data-start="${start}" data-end="${end||''}" data-title="${esc(item.title||'Απόσπασμα συζήτησης')}">▷ Αυθεντικός ήχος · ${time(start)}</button>`:''}<button class="outline-button" data-action="speak" data-kind="${kind}" data-id="${id}">◖ Συνθετική ανάγνωση</button><button class="quiet-button" data-action="stop-speech">Διακοπή</button><button class="quiet-button" data-action="copy" data-kind="${kind}" data-id="${id}">Σύνδεσμος ↗</button></div>`;
 if(kind==='topic'){
  html+=`<p class="reader-lead">${esc(item.summary)}</p><div class="tag-line">${item.tags.map(t=>`<span>#${esc(t)}</span>`).join('')}</div><div class="reader-section"><h3>Αναλυτική ανάγνωση</h3>${paragraphs(item.detail)}</div><div class="reader-section"><h3>Σημεία στη συζήτηση</h3><div class="reader-refs">${refs(item.ranges)}</div></div>`;
 }else if(kind==='memory'){
  html+=`<p class="reader-lead">${esc(item.summary)}</p><div class="reader-section"><h3>Η ιστορία</h3>${paragraphs(item.body)}<h3>Τι μας αφήνει</h3><p>${esc(item.lesson)}</p></div><div class="reader-section"><h3>Απόσπασμα αυτόματης μεταγραφής</h3><blockquote>${esc(item.transcript)}</blockquote><p class="source-note">Σύνοψη και μεταγραφή παρουσιάζονται χωριστά. Η απόδοση των λέξεων χρειάζεται έλεγχο απέναντι στον ήχο.</p></div>`;
 }else if(kind==='lesson'){
  html+=`<div class="reader-section">${paragraphs(item.body)}<h3>Τι κρατάμε</h3><ul>${item.takeaways.map(t=>`<li>${esc(t)}</li>`).join('')}</ul><h3>Σκέψου το στην πράξη</h3><p>${esc(item.question)}</p><div class="reader-refs">${refs(item.ranges)}</div></div>`;
 }else{
  const around=transcript.segments.filter(s=>s.end>=Math.max(0,item.start-35)&&s.start<=item.end+35);
  html+=`<p class="reader-lead">${esc(item.text)}</p><p class="source-note">Αυτόματη μεταγραφή${item.uncertain?' · Χαμηλότερη βεβαιότητα αναγνώρισης':''}. Το συμφραζόμενο και ο ήχος είναι απαραίτητα για να ερμηνεύσεις αριθμούς ή τεχνικούς όρους.</p><div class="reader-section"><h3>Τι ειπώθηκε πριν και μετά</h3>${around.map(s=>`<blockquote><button class="quiet-button" data-action="play" data-start="${s.start}">${time(s.start)} ▷</button> ${esc(s.text)}</blockquote>`).join('')}</div>`;
  const context=norm(around.map(s=>s.text).join(' '));
  const themes=archive.topics.map(t=>({topic:t,score:(t.ranges.some(r=>item.start>=r[0]&&item.start<=r[1])?8:0)+t.tags.filter(tag=>context.includes(norm(tag))).length})).filter(t=>t.score>0).sort((a,b)=>b.score-a.score).slice(0,2);
  if(themes.length)html+=`<div class="reader-section"><h3>Θεματική σύνδεση και ερμηνεία</h3><p class="source-note">Σύνδεση με βάση το χρονικό σημείο και τις λέξεις του αποσπάσματος. Οι ακόλουθες εξηγήσεις είναι συντακτικές σημειώσεις, όχι νέα λόγια του ομιλητή.</p>${themes.map(({topic:t})=>`<h3>${esc(t.title)}</h3>${paragraphs(t.detail)}<button class="text-button" data-action="open" data-kind="topic" data-id="${t.id}">Όλο το θέμα ↗</button>`).join('')}</div>`;
 }
 html+=sourceLinks(item.sources);
 const ranges=item.ranges||[[item.start,item.end]];
 const related=archive.lessons.filter(l=>kind!=='lesson'||l.id!==id).filter(l=>l.ranges.some(r=>ranges.some(a=>a[0]<=r[1]+45&&a[1]>=r[0]-45)));
 if(related.length)html+=`<div class="reader-section"><h3>Για βαθύτερη κατανόηση</h3><div class="reader-refs">${related.map(l=>`<button class="text-button" data-action="open" data-kind="lesson" data-id="${l.id}">${esc(l.title)} ↗</button>`).join('')}</div></div>`;
 $('#reader-content').innerHTML=html;
 reader.dataset.kind=kind;reader.dataset.id=id;
 if(anchor.id==='topic-grid'||anchor.id==='memory-grid'||anchor.id==='lesson-list')anchor.append(reader);
 else anchor.after(reader);
 reader.hidden=false;
 requestAnimationFrame(()=>reader.scrollIntoView({behavior:motionStopped()?'instant':'smooth',block:'start'}));
}
$('#close-reader').addEventListener('click',()=>closeReader());
$('#close-reader-bottom').addEventListener('click',()=>closeReader());
document.addEventListener('click',e=>{
 const query=e.target.closest('[data-query]');if(query){$('#search').value=query.dataset.query;search();$('#results-section').scrollIntoView({behavior:'smooth'});return;}
 const button=e.target.closest('[data-action]');if(!button)return;
 const d=button.dataset;
 if(d.action==='focus-search'){$('#search').focus();$('#search').scrollIntoView({behavior:'smooth',block:'center'});}
 if(d.action==='play')play(Number(d.start),Number(d.end)||null,d.title||'Απόσπασμα συζήτησης');
 if(d.action==='open')openRecord(d.kind,d.id,button);
 if(d.action==='speak'){const r=recordFor(d.kind,d.id);if(r)speak(spokenText(r));}
 if(d.action==='stop-speech')stopSpeech();
 if(d.action==='copy'){const url=new URL(location.href);url.hash='';url.searchParams.set('kind',d.kind);url.searchParams.set('id',d.id);navigator.clipboard?.writeText(url.href).then(()=>toast('Ο σύνδεσμος αντιγράφηκε.')).catch(()=>toast('Δεν επιτράπηκε η αντιγραφή από τον browser.'));}
});
$('#voice-search').addEventListener('click',()=>{
 if(recognition){recognition.stop();return;}
 const SpeechRecognition=window.SpeechRecognition||window.webkitSpeechRecognition;
 if(!SpeechRecognition){$('#voice-status').textContent='Η φωνητική αναζήτηση δεν υποστηρίζεται σε αυτόν τον browser. Μπορείς να γράψεις ή να χρησιμοποιήσεις την υπαγόρευση του πληκτρολογίου.';return;}
 stopSpeech();audio.pause();recognition=new SpeechRecognition();recognition.lang='el-GR';recognition.interimResults=true;recognition.continuous=false;
 $('#voice-status').textContent='Η αναγνώριση φωνής του browser μπορεί να χρησιμοποιεί διαδικτυακή υπηρεσία. Μίλησε μόλις επιτρέψεις το μικρόφωνο.';
 recognition.onstart=()=>{$('#voice-search').classList.add('listening');$('#voice-search').setAttribute('aria-label','Διακοπή φωνητικής αναζήτησης');};
 recognition.onresult=e=>{$('#search').value=Array.from(e.results).map(r=>r[0].transcript).join(' ');search();$('#voice-status').textContent='Η φωνή σου έγινε αναζήτηση. Μπορείς να διορθώσεις το κείμενο.';};
 recognition.onerror=e=>{$('#voice-status').textContent=({'not-allowed':'Δεν επιτράπηκε το μικρόφωνο. Ενεργοποίησέ το από τις ρυθμίσεις του browser ή γράψε την αναζήτηση.','no-speech':'Δεν ακούστηκε ομιλία. Πάτησε ξανά το μικρόφωνο ή γράψε.','network':'Η υπηρεσία αναγνώρισης δεν συνδέθηκε. Η αναζήτηση κειμένου παραμένει διαθέσιμη.','audio-capture':'Δεν βρέθηκε διαθέσιμο μικρόφωνο.'})[e.error]||'Η αναγνώριση σταμάτησε. Μπορείς να ξαναδοκιμάσεις ή να γράψεις.';};
 recognition.onend=()=>{recognition=null;$('#voice-search').classList.remove('listening');$('#voice-search').setAttribute('aria-label','Φωνητική αναζήτηση');};
 try{recognition.start();}catch{recognition=null;$('#voice-status').textContent='Η αναγνώριση δεν ξεκίνησε. Δοκίμασε ξανά ή γράψε την αναζήτηση.';}
});
try{
 const responses=await Promise.all([fetch('./data/archive.json'),fetch('./data/transcript.json'),fetch('./data/waveform.json')]);
 if(responses.some(r=>!r.ok))throw new Error('Archive unavailable');
 [archive,transcript,waveform]=await Promise.all(responses.map(r=>r.json()));
 buildIndex();renderArchive();
 const params=new URLSearchParams(location.search);if(params.get('kind')&&params.get('id'))openRecord(params.get('kind'),params.get('id'));
 if(params.has('q')){$('#search').value=params.get('q');search();}
}catch(error){$('#load-error').hidden=false;$('#archive-stats').textContent='Το αρχείο δεν φορτώθηκε';console.error(error);}
