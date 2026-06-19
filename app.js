/* ══════════════════════════════════════════
   NASSA CLOUD — Supabase sync via /api/project
   All Supabase credentials stay server-side.
   Browser only knows NASSA_SECRET_2026 (shared API key).
══════════════════════════════════════════ */
const CLOUD = {
  apiUrl: window.location.origin + '/api/project',
  apiKey: 'NASSA_SECRET_2026',
  user: localStorage.getItem('nassa_user') || 'shared',
  _saveTimer: null,
  _status: 'idle',

  async load() {
    try {
      CLOUD.setStatus('loading');
      const res = await fetch(`${CLOUD.apiUrl}?user=${CLOUD.user}`, {
        headers: { 'x-nassa-key': CLOUD.apiKey }
      });
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const { data, updatedAt } = await res.json();
      if (data) { CLOUD.setStatus('saved'); return { data, updatedAt }; }
      CLOUD.setStatus('idle'); return null;
    } catch(e) {
      if (!e.message.includes('404')) console.warn('[CLOUD] Load failed:', e.message);
      CLOUD.setStatus('error'); return null;
    }
  },

  scheduleSave(dataFn) {
    clearTimeout(CLOUD._saveTimer);
    CLOUD.setStatus('pending');
    CLOUD._saveTimer = setTimeout(() => CLOUD.saveNow(dataFn()), 2000);
  },

  async saveNow(projectData) {
    try {
      CLOUD.setStatus('saving');
      const res = await fetch(CLOUD.apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-nassa-key': CLOUD.apiKey },
        body: JSON.stringify({ user: CLOUD.user, data: projectData })
      });
      if (!res.ok) throw new Error('HTTP ' + res.status);
      CLOUD.setStatus('saved');
    } catch(e) {
      console.warn('[CLOUD] Save failed:', e.message);
      CLOUD.setStatus('error');
    }
  },

  setStatus(s) {
    CLOUD._status = s;
    const el = document.getElementById('cloud-status'); if (!el) return;
    const map = {
      idle:    { text: '☁ Cloud', cls: '' },
      loading: { text: '⟳ Carico…', cls: 'cloud-loading' },
      pending: { text: '✎ Modificato', cls: 'cloud-pending' },
      saving:  { text: '⟳ Salvo…', cls: 'cloud-saving' },
      saved:   { text: '✓ Salvato', cls: 'cloud-saved' },
      error:   { text: '⚠ Offline', cls: 'cloud-error' },
    };
    const m = map[s] || map.idle;
    el.textContent = m.text; el.className = 'cloud-badge ' + m.cls;
  },

  snapshot() {
    return { version:'2.0', exportedAt: new Date().toISOString(),
      clients, feeds, stories, highlights, pedPlans, notesData,
      meta: { showAllDates, showAllCopy } };
  },

  apply(data) {
    if (!data) return;
    clients = data.clients || [];
    clients.forEach(c => { if(!c.accounts) c.accounts=[]; if(!c.id) c.id='c_'+Date.now(); });
    feeds = {};
    Object.keys(data.feeds||{}).forEach(k => {
      feeds[k] = (data.feeds[k]||[]).map(item => ({
        ...item,
        url: (item.externalUrl&&item.externalUrl.startsWith('http')) ? item.externalUrl : '',
        needsReload: !(item.externalUrl&&item.externalUrl.startsWith('http')) && !!item.name
      }));
    });
    stories = {};
    Object.keys(data.stories||{}).forEach(k => {
      stories[k] = (data.stories[k]||[]).map(st => ({
        ...st,
        url: (st.externalUrl&&st.externalUrl.startsWith('http')) ? st.externalUrl : ''
      }));
    });
    highlights = data.highlights || {};
    pedPlans   = data.pedPlans   || {};
    notesData  = data.notesData  || {};
    if (data.meta) {
      showAllDates = data.meta.showAllDates !== false;
      showAllCopy  = data.meta.showAllCopy  !== false;
    }
  }
};

/* ══════════════════════════════════════════
   DROPBOX UPLOAD — via /api/dropbox-upload
   Uses DROPBOX_APP_KEY, DROPBOX_APP_SECRET, DROPBOX_REFRESH_TOKEN
   All three are Vercel env vars — never sent to browser.
══════════════════════════════════════════ */
const DROPBOX = {
  async upload(file, destPath) {
    const bar = document.getElementById('dbx-upload-bar');
    const txt = document.getElementById('dbx-upload-text');
    if (bar) bar.classList.add('visible');
    if (txt) txt.textContent = 'Caricamento su Dropbox: ' + file.name;
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('path', destPath || '/nassa/' + file.name);
      const res = await fetch('/api/dropbox-upload', {
        method: 'POST',
        headers: { 'x-nassa-key': CLOUD.apiKey },
        body: formData
      });
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const data = await res.json();
      if (bar) bar.classList.remove('visible');
      return data.shared_link || data.url || null;
    } catch(e) {
      console.warn('[DROPBOX] Upload failed:', e.message);
      if (bar) bar.classList.remove('visible');
      return null;
    }
  }
};

/* ══════════════════════════════════════════
   GLOBAL STATE
══════════════════════════════════════════ */
let clients = [];
let feeds = {};
let stories = {};
let highlights = {};
let pedPlans = {};
let notesData = {};

let feedClientIdx = -1, feedAccountIdx = -1, feedMonth = '';
let storiesClientIdx = -1, storiesAccountIdx = -1, storiesMonth = '';
let previewClientIdx = -1, previewAccountIdx = -1, previewMonth = '';
let notesClientIdx = -1, notesMonth = '';
let globalClientIdx = -1;
let previewActiveAcc = 0;

let showAllDates = true, showAllCopy = true;
let currentTab = 'studio';

let feedDragSrc = null, stDragSrc = null;
let carouselEditIdx = null, carouselTmp = [];
let sbEditIdx = null, sbTmpSlides = [];
let hlEditIdx = null, hlTmpCover = null;
let linkModalPostIdx = null, linkModalSelected = new Set();
let copySelectedItems = new Set();
let feedLinkTab = 'frame', storiesLinkTab = 'frame';
let lbItems = [], lbIdx = 0, lbSlide = 0, lbStArr = [];
let ecEditIdx = -1, ecTmpAccounts = [];

const MONTHS = ['Gennaio','Febbraio','Marzo','Aprile','Maggio','Giugno','Luglio','Agosto','Settembre','Ottobre','Novembre','Dicembre'];
let CUR_YEAR = new Date().getFullYear();
let MONTH_OPTIONS = monthsForYear(CUR_YEAR);

function monthsForYear(year) { return MONTHS.map(m => m + ' ' + year); }

/* KEY HELPERS */
function accountKey(accountId, month) { return accountId + '|||' + month; }
function getAccount(ci, ai) { return clients[ci]?.accounts?.[ai] || null; }
function accountId(ci, ai) { const a = getAccount(ci,ai); return a ? a.id : null; }
function currentFeedKey() { const aid=accountId(feedClientIdx,feedAccountIdx); return aid&&feedMonth?accountKey(aid,feedMonth):null; }
function currentFeedItems() { const k=currentFeedKey(); return k?(feeds[k]||[]):[];}
function setFeedItems(arr) { const k=currentFeedKey(); if(k) feeds[k]=arr; }
function currentStoriesKey() { const aid=accountId(storiesClientIdx,storiesAccountIdx); return aid&&storiesMonth?accountKey(aid,storiesMonth):null; }
function currentStoryItems() { const k=currentStoriesKey(); return k?(stories[k]||[]):[];}
function setStoryItems(arr) { const k=currentStoriesKey(); if(k) stories[k]=arr; }
function currentHighlights() { const aid=accountId(storiesClientIdx,storiesAccountIdx); return aid?(highlights[aid]||[]):[]; }
function setHighlights(arr) { const aid=accountId(storiesClientIdx,storiesAccountIdx); if(aid) highlights[aid]=arr; }

/* Bridge for PED compatibility */
Object.defineProperty(window,'currentClientIdx',{get(){return feedClientIdx;},set(v){feedClientIdx=v;}});
Object.defineProperty(window,'currentMonth',{get(){return feedMonth;},set(v){feedMonth=v;}});
function currentItems(){return currentFeedItems();}
function setCurrentItems(arr){setFeedItems(arr);}
function currentStories(){return currentStoryItems();}
function setCurrentStories(arr){setStoryItems(arr);}
function refresh(){refreshFeed();}
function updateStats(){updateFeedStats();}
function feedKey(cn,m){return cn+'|||'+m;}
function pedKey(cn,m){return cn+'|||'+m;}
function currentPedPlan(){if(currentClientIdx<0||!currentMonth)return[];return pedPlans[pedKey(clients[currentClientIdx].name,currentMonth)]||[];}
function setCurrentPedPlan(arr){if(currentClientIdx<0||!currentMonth)return;pedPlans[pedKey(clients[currentClientIdx].name,currentMonth)]=arr;}
function pedUID(){return Math.random().toString(36).slice(2,9);}
let pedFreqDays = new Set([0,2,4]);

/* FEED FILES - upload to Dropbox, fall back to blob URL */
function queueFeedFiles(files){
  if(feedAccountIdx<0){showToast('Seleziona cliente e account','warn');return;}
  const items=currentFeedItems();
  const newItems=Array.from(files).map(f=>({
    type:detectType(f)==='video'?'video':'pending',
    url:URL.createObjectURL(f),name:f.name,
    date:'',showDate:false,copy:'',linkedStories:[],slides:[],mimeType:f.type
  }));
  setFeedItems([...newItems,...items]);refreshFeed();
  Array.from(files).forEach(async (f,fi)=>{
    const destPath='/nassa/'+CLOUD.user+'/'+(feedMonth||'misc')+'/'+f.name;
    const sharedUrl=await DROPBOX.upload(f,destPath);
    if(sharedUrl){
      const arr=currentFeedItems();
      if(arr[fi]){arr[fi].externalUrl=sharedUrl;arr[fi].url=sharedUrl;arr[fi].isExternalLink=true;arr[fi].linkSource='dropbox';}
      setFeedItems(arr);autoSave();
    }
  });
}

function setFeedLinkTab(tab){
  feedLinkTab=tab;
  document.getElementById('fl-tab-frame').classList.toggle('active',tab==='frame');
  document.getElementById('fl-tab-other').classList.toggle('active',tab==='other');
  document.getElementById('feed-link-inp').placeholder=tab==='frame'?'Incolla link Frame.io…':'Incolla URL diretto…';
}

function addFeedLink(){
  if(feedAccountIdx<0){showToast('Seleziona cliente e account','warn');return;}
  const raw=document.getElementById('feed-link-inp').value.trim();if(!raw)return;
  const type=detectType(raw);const name=raw.split('/').pop().split('?')[0]||'link';
  const items=currentFeedItems();
  setFeedItems([{type,url:raw,externalUrl:raw,isExternalLink:true,linkSource:feedLinkTab,name,date:'',showDate:false,copy:'',linkedStories:[],slides:[]},...items]);
  document.getElementById('feed-link-inp').value='';refreshFeed();showToast('✓ Link aggiunto');
}

/* STORY FILES - upload to Dropbox */
function queueStoryFiles(files){
  if(storiesAccountIdx<0){showToast('Seleziona cliente e account','warn');return;}
  const arr=currentStoryItems();
  const newItems=Array.from(files).map(f=>({type:detectType(f),url:URL.createObjectURL(f),name:f.name,date:'',note:'',isStoryboard:false,slides:[]}));
  setStoryItems([...newItems,...arr]);refreshStories();
  Array.from(files).forEach(async(f,fi)=>{
    const destPath='/nassa/'+CLOUD.user+'/stories/'+(storiesMonth||'misc')+'/'+f.name;
    const sharedUrl=await DROPBOX.upload(f,destPath);
    if(sharedUrl){const a=currentStoryItems();if(a[fi]){a[fi].externalUrl=sharedUrl;a[fi].url=sharedUrl;a[fi].isExternalLink=true;}setStoryItems(a);autoSave();}
  });
}

function setStoriesLinkTab(tab){
  storiesLinkTab=tab;
  document.getElementById('sl-tab-frame').classList.toggle('active',tab==='frame');
  document.getElementById('sl-tab-other').classList.toggle('active',tab==='other');
  document.getElementById('stories-link-inp').placeholder=tab==='frame'?'Incolla link Frame.io…':'Incolla URL diretto…';
}

function addStoryLink(){
  if(storiesAccountIdx<0){showToast('Seleziona cliente e account','warn');return;}
  const raw=document.getElementById('stories-link-inp').value.trim();if(!raw)return;
  const type=detectType(raw);const name=raw.split('/').pop().split('?')[0]||'link';
  const arr=currentStoryItems();
  setStoryItems([{type,url:raw,externalUrl:raw,isExternalLink:true,linkSource:storiesLinkTab,name,date:'',note:'',isStoryboard:false,slides:[]},...arr]);
  document.getElementById('stories-link-inp').value='';refreshStories();showToast('✓ Link story aggiunto');
}

/* MEDIA UTILS */
function detectType(file_or_url){
  const s=typeof file_or_url==='string'?file_or_url:(file_or_url.name||'');
  if(/\.(mp4|mov|webm|avi|m4v)/i.test(s))return 'video';
  if(typeof file_or_url!=='string'&&file_or_url.type?.startsWith('video'))return 'video';
  if(file_or_url.includes?.('frame.io')||file_or_url.includes?.('f.io'))return 'video';
  return 'image';
}
function makeMedia(url,type,opts={}){
  if(!url)return null;
  if(type==='video'){const v=document.createElement('video');v.src=url;v.muted=true;v.loop=true;v.playsInline=true;v.preload='metadata';v.style.cssText='pointer-events:none;background:#111;width:100%;height:100%;object-fit:cover;display:block;';if(opts.autoplay)v.autoplay=true;if(opts.controls)v.controls=true;return v;}
  const img=document.createElement('img');img.src=url;img.alt='';return img;
}
function needsReloadPh(icon,name){const ph=document.createElement('div');ph.className='needs-reload-ph';ph.innerHTML=`<div class="nr-icon">${icon}</div><div class="nr-name">${name||'file'}</div><div class="nr-label">ricarica media</div>`;return ph;}


/* TAB SWITCHING */
function switchTab(tab){
  currentTab=tab;
  const allTabs=['studio','notes','feed','stories','ped','cal','preview'];
  allTabs.forEach(t=>{
    const te=document.getElementById('tab-'+t);if(te)te.classList.toggle('active',t===tab);
    const st=document.getElementById('sub-tab-'+t);if(st)st.classList.toggle('active',t===tab);
    const pe=document.getElementById('page-'+t);if(pe)pe.classList.toggle('active',t===tab);
    const si=document.getElementById('si-'+t);if(si)si.classList.toggle('active',t===tab);
  });
  const subt=document.getElementById('subtopbar');if(subt)subt.classList.toggle('visible',tab!=='studio');
  const sStudio=document.getElementById('sidebar-studio');const sAdd=document.getElementById('sidebar-studio-add');const sFeed=document.getElementById('sidebar-feed');const sSt=document.getElementById('sidebar-stories');
  if(sStudio)sStudio.style.display=(tab==='studio'||tab==='notes'||tab==='ped'||tab==='cal'||tab==='preview')?'flex':'none';
  if(sAdd)sAdd.style.display='none';if(sFeed)sFeed.style.display=tab==='feed'?'flex':'none';if(sSt)sSt.style.display=tab==='stories'?'flex':'none';
  if(tab==='studio'){renderStudio();updateGlobalClientUI();}else{renderAccSwitcher();}
  if(tab==='notes'){if(notesClientIdx<0&&globalClientIdx>=0)notesClientIdx=globalClientIdx;rebuildNotesSelects();renderNotesEditor();}
  if(tab==='feed'){if(feedClientIdx<0&&globalClientIdx>=0){feedClientIdx=globalClientIdx;feedAccountIdx=clients[globalClientIdx]?.accounts?.length>=1?0:-1;}rebuildFeedSelects();renderFeedMonthPills();renderFeedGrid();updateFeedHeader();}
  if(tab==='stories'){if(storiesClientIdx<0){storiesClientIdx=globalClientIdx>=0?globalClientIdx:feedClientIdx;storiesAccountIdx=storiesClientIdx>=0&&clients[storiesClientIdx]?.accounts?.length>=1?0:-1;storiesMonth=feedMonth||MONTH_OPTIONS[new Date().getMonth()];}rebuildStoriesSelects();renderStoriesMonthPills();renderStoriesGrid();updateStoriesHeader();}
  if(tab==='ped'){if(typeof renderPED==='function')renderPED();}
  if(tab==='cal'){if(typeof renderCalendar==='function')renderCalendar();}
  if(tab==='preview'){if(previewClientIdx<0&&globalClientIdx>=0){previewClientIdx=globalClientIdx;previewAccountIdx=clients[globalClientIdx]?.accounts?.length>=1?0:-1;}syncPreviewSelectors();renderPreview();}
}
function showStudioAdd(){const sStudio=document.getElementById('sidebar-studio');const sAdd=document.getElementById('sidebar-studio-add');if(sStudio)sStudio.style.display='none';if(sAdd)sAdd.style.display='flex';}
function backToClients(){switchTab('studio');}

/* CLIENT MANAGEMENT */
function addClient(){
  const name=document.getElementById('nc-name').value.trim();if(!name){document.getElementById('nc-name').focus();return;}
  if(clients.find(c=>c.name.toLowerCase()===name.toLowerCase())){showToast('Cliente già presente','warn');return;}
  const id='c_'+Date.now();const defaultAccount={id:'a_'+Date.now(),name,platform:'Instagram'};
  clients.push({id,name,pkg:document.getElementById('nc-pkg').value,status:document.getElementById('nc-status').value,revenue:parseFloat(document.getElementById('nc-revenue').value)||0,accounts:[defaultAccount]});
  document.getElementById('nc-name').value='';document.getElementById('nc-revenue').value='';
  renderStudio();rebuildAllSelects();rebuildGlobalClientSelect();showToast('✓ Cliente aggiunto');autoSave();
}
function addAccount(){const ci=parseInt(document.getElementById('na-client').value);if(isNaN(ci)||ci<0){showToast('Seleziona un cliente','warn');return;}const name=document.getElementById('na-name').value.trim();if(!name){document.getElementById('na-name').focus();return;}const platform=document.getElementById('na-platform').value;const id='a_'+Date.now();clients[ci].accounts.push({id,name,platform});document.getElementById('na-name').value='';renderStudio();rebuildAllSelects();showToast('✓ Account aggiunto');autoSave();}
function removeClient(i){if(!confirm('Rimuovere '+clients[i].name+' e tutti i suoi dati?'))return;clients[i].accounts.forEach(acc=>{MONTH_OPTIONS.forEach(m=>{delete feeds[accountKey(acc.id,m)];delete stories[accountKey(acc.id,m)];});delete highlights[acc.id];});if(feedClientIdx===i){feedClientIdx=-1;feedAccountIdx=-1;feedMonth='';renderFeedGrid();}else if(feedClientIdx>i)feedClientIdx--;clients.splice(i,1);renderStudio();rebuildAllSelects();}
function openClientFeed(ci){globalClientIdx=ci;feedClientIdx=ci;feedAccountIdx=clients[ci].accounts.length>0?0:-1;storiesClientIdx=ci;storiesAccountIdx=feedAccountIdx;notesClientIdx=ci;if(!feedMonth)feedMonth=MONTH_OPTIONS[new Date().getMonth()];if(!storiesMonth)storiesMonth=feedMonth;updateGlobalClientUI();switchTab('feed');rebuildFeedSelects();renderFeedMonthPills();renderFeedGrid();updateFeedHeader();renderAccSwitcher();}
function openAccountFeed(ci,aid){globalClientIdx=ci;feedClientIdx=ci;feedAccountIdx=clients[ci].accounts.findIndex(a=>a.id===aid);storiesClientIdx=ci;storiesAccountIdx=feedAccountIdx;notesClientIdx=ci;if(!feedMonth)feedMonth=MONTH_OPTIONS[new Date().getMonth()];if(!storiesMonth)storiesMonth=feedMonth;updateGlobalClientUI();switchTab('feed');rebuildFeedSelects();renderFeedMonthPills();renderFeedGrid();updateFeedHeader();renderAccSwitcher();}

function renderStudio(){
  const active=clients.filter(c=>c.status==='Attivo');const totalRev=active.reduce((s,c)=>s+c.revenue,0);const totalAccounts=clients.reduce((s,c)=>s+(c.accounts?.length||0),0);const el=v=>document.getElementById(v);
  if(el('kpi-revenue'))el('kpi-revenue').textContent='€ '+totalRev.toLocaleString('it-IT');if(el('kpi-active'))el('kpi-active').textContent=active.length;if(el('kpi-accounts'))el('kpi-accounts').textContent=totalAccounts;if(el('kpi-rev-sub'))el('kpi-rev-sub').textContent='da '+active.length+(active.length===1?' cliente attivo':' clienti attivi');
  const countTxt=clients.length+' client'+(clients.length===1?'e':'i');if(el('studio-count'))el('studio-count').textContent=countTxt;
  const tbody=document.getElementById('clients-tbody');if(!tbody)return;tbody.innerHTML='';
  if(!clients.length){tbody.innerHTML='<tr><td colspan="6" style="text-align:center;color:var(--text-3);padding:24px;font-size:12px;">Nessun cliente. Aggiungine uno dal pannello.</td></tr>';return;}
  clients.forEach((c,i)=>{const dotCls={Attivo:'green','In onboarding':'blue','In pausa':'amber',Perso:'red'}[c.status]||'green';const accs=c.accounts||[];const accsHtml=accs.length===0?'<span style="color:var(--text-3);font-size:11px;">—</span>':accs.length===1&&accs[0].name===c.name?`<span class="feed-chip" onclick="openClientFeed(${i})" style="color:var(--green);border-color:var(--green-mid);">Feed →</span>`:accs.map(a=>`<span class="feed-chip" onclick="openAccountFeed(${i},'${a.id}')" title="${a.platform}">${a.name} →</span>`).join(' ');const tr=document.createElement('tr');tr.innerHTML=`<td style="font-weight:500;">${c.name}</td><td style="font-size:11px;">${accsHtml}</td><td><span class="pkg-badge">${c.pkg}</span></td><td><span class="status-dot"><span class="dot ${dotCls}"></span>${c.status}</span></td><td class="muted">€ ${c.revenue.toLocaleString('it-IT')}</td><td><div class="tr-actions"><button class="btn sm" onclick="openEditClientModal(${i})">✎ Modifica</button></div></td>`;tbody.appendChild(tr);});
}

/* SELECTS */
function rebuildAllSelects(){rebuildFeedSelects();rebuildStoriesSelects();rebuildPreviewSelects();rebuildStudioAccountSelect();rebuildNotesSelects();}
function populateClientSelect(selId,currentCi){const sel=document.getElementById(selId);if(!sel)return;sel.innerHTML='<option value="">— Cliente —</option>';clients.forEach((c,i)=>{const o=document.createElement('option');o.value=i;o.textContent=c.name;sel.appendChild(o);});if(currentCi>=0)sel.value=currentCi;}
function populateAccountSelect(selId,clientIdx,currentAi){const sel=document.getElementById(selId);if(!sel)return;if(clientIdx<0||!clients[clientIdx]?.accounts?.length){sel.style.display='none';return;}sel.style.display='';sel.innerHTML='<option value="">— Account —</option>';clients[clientIdx].accounts.forEach((a,i)=>{const o=document.createElement('option');o.value=i;o.textContent=a.name+' ('+a.platform+')';sel.appendChild(o);});if(currentAi>=0)sel.value=currentAi;}
function rebuildFeedSelects(){populateClientSelect('feed-client-sel',feedClientIdx);populateAccountSelect('feed-account-sel',feedClientIdx,feedAccountIdx);}
function rebuildStoriesSelects(){populateClientSelect('stories-client-sel',storiesClientIdx);populateAccountSelect('stories-account-sel',storiesClientIdx,storiesAccountIdx);}
function rebuildPreviewSelects(){const msel=document.getElementById('preview-month-sel');if(!msel)return;if(previewAccountIdx<0){msel.style.display='none';return;}msel.style.display='';msel.innerHTML='';MONTH_OPTIONS.forEach(m=>{const o=document.createElement('option');o.value=m;o.textContent=m;msel.appendChild(o);});if(previewMonth)msel.value=previewMonth;}
function rebuildStudioAccountSelect(){const sel=document.getElementById('na-client');if(!sel)return;sel.innerHTML='<option value="">— seleziona —</option>';clients.forEach((c,i)=>{const o=document.createElement('option');o.value=i;o.textContent=c.name;sel.appendChild(o);});}

/* FEED SELECTORS */
function onFeedClientChange(){const v=document.getElementById('feed-client-sel').value;feedClientIdx=v===''?-1:parseInt(v);feedAccountIdx=-1;const accs=feedClientIdx>=0?(clients[feedClientIdx]?.accounts||[]):[];if(accs.length===1){feedAccountIdx=0;const sel=document.getElementById('feed-account-sel');if(sel)sel.style.display='none';}else if(accs.length>1){populateAccountSelect('feed-account-sel',feedClientIdx,-1);}else{const sel=document.getElementById('feed-account-sel');if(sel)sel.style.display='none';}if(!feedMonth)feedMonth=MONTH_OPTIONS[new Date().getMonth()];renderFeedMonthPills();renderFeedGrid();updateFeedHeader();}
function onFeedAccountChange(){const v=document.getElementById('feed-account-sel').value;feedAccountIdx=v===''?-1:parseInt(v);if(!feedMonth)feedMonth=MONTH_OPTIONS[new Date().getMonth()];renderFeedMonthPills();renderFeedGrid();updateFeedHeader();}
function renderFeedMonthPills(){const c=document.getElementById('feed-month-pills');if(!c)return;c.innerHTML='';if(feedAccountIdx<0)return;let pillYear=CUR_YEAR;if(feedMonth){const y=parseInt(feedMonth.split(' ').pop());if(!isNaN(y))pillYear=y;}const ynav=document.createElement('div');ynav.className='year-nav';const prev=document.createElement('button');prev.className='year-nav-btn';prev.textContent='‹';prev.onclick=()=>{pillYear--;CUR_YEAR=pillYear;MONTH_OPTIONS=monthsForYear(pillYear);renderFeedMonthPills();};const lbl=document.createElement('span');lbl.className='year-label';lbl.textContent=pillYear;const next=document.createElement('button');next.className='year-nav-btn';next.textContent='›';next.onclick=()=>{pillYear++;CUR_YEAR=pillYear;MONTH_OPTIONS=monthsForYear(pillYear);renderFeedMonthPills();};ynav.appendChild(prev);ynav.appendChild(lbl);ynav.appendChild(next);c.appendChild(ynav);const pillsWrap=document.createElement('div');pillsWrap.className='month-pills';monthsForYear(pillYear).forEach(m=>{const p=document.createElement('button');p.className='month-pill'+(m===feedMonth?' active':'');p.textContent=m.slice(0,3);p.onclick=()=>{feedMonth=m;renderFeedMonthPills();renderFeedGrid();updateFeedHeader();};pillsWrap.appendChild(p);});c.appendChild(pillsWrap);}

/* STORIES SELECTORS */
function onStoriesClientChange(){const v=document.getElementById('stories-client-sel').value;storiesClientIdx=v===''?-1:parseInt(v);storiesAccountIdx=-1;const accs=storiesClientIdx>=0?(clients[storiesClientIdx]?.accounts||[]):[];if(accs.length===1){storiesAccountIdx=0;const sel=document.getElementById('stories-account-sel');if(sel)sel.style.display='none';}else if(accs.length>1){populateAccountSelect('stories-account-sel',storiesClientIdx,-1);}else{const sel=document.getElementById('stories-account-sel');if(sel)sel.style.display='none';}if(!storiesMonth)storiesMonth=MONTH_OPTIONS[new Date().getMonth()];renderStoriesMonthPills();renderStoriesGrid();updateStoriesHeader();}
function onStoriesAccountChange(){const v=document.getElementById('stories-account-sel').value;storiesAccountIdx=v===''?-1:parseInt(v);if(!storiesMonth)storiesMonth=MONTH_OPTIONS[new Date().getMonth()];renderStoriesMonthPills();renderStoriesGrid();updateStoriesHeader();}
function renderStoriesMonthPills(){const c=document.getElementById('stories-month-pills');if(!c)return;c.innerHTML='';if(storiesAccountIdx<0)return;let pillYear=CUR_YEAR;if(storiesMonth){const y=parseInt(storiesMonth.split(' ').pop());if(!isNaN(y))pillYear=y;}const ynav=document.createElement('div');ynav.className='year-nav';const prev=document.createElement('button');prev.className='year-nav-btn';prev.textContent='‹';prev.onclick=()=>{pillYear--;renderStoriesMonthPillsForYear(pillYear);};const lbl=document.createElement('span');lbl.className='year-label';lbl.textContent=pillYear;const next=document.createElement('button');next.className='year-nav-btn';next.textContent='›';next.onclick=()=>{pillYear++;renderStoriesMonthPillsForYear(pillYear);};ynav.appendChild(prev);ynav.appendChild(lbl);ynav.appendChild(next);c.appendChild(ynav);const pillsWrap=document.createElement('div');pillsWrap.className='month-pills';monthsForYear(pillYear).forEach(m=>{const p=document.createElement('button');p.className='month-pill'+(m===storiesMonth?' active':'');p.textContent=m.slice(0,3);p.onclick=()=>{storiesMonth=m;renderStoriesMonthPills();renderStoriesGrid();updateStoriesHeader();};pillsWrap.appendChild(p);});c.appendChild(pillsWrap);}
function renderStoriesMonthPillsForYear(year){if(storiesMonth){const oldMonth=storiesMonth.split(' ')[0];storiesMonth=oldMonth+' '+year;}renderStoriesMonthPills();}

/* PREVIEW SELECTORS */
function syncPreviewSelectors(){previewClientIdx=globalClientIdx;previewAccountIdx=feedAccountIdx;previewMonth=feedMonth||storiesMonth||MONTH_OPTIONS[new Date().getMonth()];previewActiveAcc=feedAccountIdx>=0?feedAccountIdx:0;const msel=document.getElementById('preview-month-sel');if(msel&&previewMonth)msel.value=previewMonth;}
function onPreviewClientChange(){const v=document.getElementById('preview-client-sel').value;previewClientIdx=v===''?-1:parseInt(v);previewAccountIdx=-1;populateAccountSelect('preview-account-sel',previewClientIdx,-1);previewMonth=MONTH_OPTIONS[new Date().getMonth()];rebuildPreviewSelects();renderPreview();}
function onPreviewAccountChange(){const v=document.getElementById('preview-account-sel').value;previewAccountIdx=v===''?-1:parseInt(v);previewMonth=MONTH_OPTIONS[new Date().getMonth()];rebuildPreviewSelects();renderPreview();}

/* FEED GRID */
function refreshFeed(){renderFeedGrid();updateFeedStats();updateFeedHeader();autoSave();}

function renderFeedGrid(){
  const grid=document.getElementById('feed-grid');if(!grid)return;grid.innerHTML='';
  const items=currentFeedItems();
  if(feedAccountIdx<0){const em=document.createElement('div');em.className='feed-empty';em.innerHTML='<span class="fe-icon">👆</span><p>Seleziona <strong>cliente</strong> → <strong>account</strong> → <strong>mese</strong><br>per costruire il feed.</p>';grid.appendChild(em);return;}
  const total=Math.max(items.length+1,9);
  for(let i=0;i<total;i++){
    const wrap=document.createElement('div');wrap.className='cell-wrap';const cell=document.createElement('div');cell.className='feed-cell';
    if(i<items.length){
      const item=items[i],idx=i;
      if(item.type==='pending'){
        cell.classList.add('empty-slot');cell.style.overflow='hidden';
        const bg=document.createElement('img');bg.className='picker-bg';bg.src=item.url;cell.appendChild(bg);
        const pk=document.createElement('div');pk.className='type-picker';const lbl=document.createElement('div');lbl.className='type-picker-lbl';lbl.textContent='Tipo post';pk.appendChild(lbl);
        const btns=document.createElement('div');btns.className='type-btns';[['🖼','Foto','image'],['▶','Reel','video'],['❏❏','Caros.','carousel']].forEach(([icon,label,type])=>{const b=document.createElement('button');b.className='type-btn';b.innerHTML=`<span class="ti">${icon}</span>${label}`;b.onclick=()=>setFeedItemType(idx,type);btns.appendChild(b);});pk.appendChild(btns);
        const rm=document.createElement('button');rm.className='picker-rm';rm.textContent='✕ rimuovi';rm.onclick=()=>removeFeedItem(idx);pk.appendChild(rm);cell.appendChild(pk);wrap.appendChild(cell);
      } else {
        const coverUrl=item.type==='carousel'&&item.slides?.length?item.slides[0].url:item.url;
        if(item.needsReload&&!item.url){cell.appendChild(needsReloadPh(item.type==='video'?'▶':item.type==='carousel'?'❏❏':'🖼',item.name));}
        else if(item.type==='video'){const v=makeMedia(item.url,'video');v.onerror=()=>{cell.appendChild(needsReloadPh('▶',item.name));};cell.addEventListener('mouseenter',()=>v.play().catch(()=>{}));cell.addEventListener('mouseleave',()=>{v.pause();v.currentTime=0;});cell.appendChild(v);}
        else{const img=makeMedia(coverUrl,'image');img.onerror=()=>{img.style.display='none';cell.appendChild(needsReloadPh('🖼',item.name));};cell.appendChild(img);}
        cell.draggable=true;
        cell.addEventListener('dragstart',e=>{feedDragSrc=idx;e.dataTransfer.effectAllowed='move';setTimeout(()=>cell.classList.add('dragging'),0);});
        cell.addEventListener('dragover',e=>{e.preventDefault();if(feedDragSrc!==null&&feedDragSrc!==idx){document.querySelectorAll('.feed-cell').forEach(c=>c.classList.remove('drag-over-cell'));cell.classList.add('drag-over-cell');}});
        cell.addEventListener('drop',e=>{e.preventDefault();if(feedDragSrc!==null&&feedDragSrc!==idx){const arr=currentFeedItems();const tmp=arr[feedDragSrc];arr[feedDragSrc]=arr[idx];arr[idx]=tmp;setFeedItems(arr);}feedDragSrc=null;renderFeedGrid();});
        cell.addEventListener('dragend',()=>{feedDragSrc=null;document.querySelectorAll('.feed-cell').forEach(c=>c.classList.remove('dragging','drag-over-cell'));});
        const handle=document.createElement('div');handle.className='drag-handle';handle.innerHTML='⠿';cell.appendChild(handle);
        const num=document.createElement('span');num.className='cell-num';num.textContent=i+1;cell.appendChild(num);
        const badge=document.createElement('span');badge.className='cell-badge '+item.type;badge.textContent=item.type==='video'?'▶ REEL':item.type==='image'?'IMG':'❏❏ '+(item.slides?.length||0);cell.appendChild(badge);
        if(item.isExternalLink){const d=document.createElement('div');d.className='cell-url-dot';d.title=(item.linkSource==='dropbox'?'Dropbox':item.linkSource==='frame'?'Frame.io':'Link')+': '+(item.externalUrl||'');cell.appendChild(d);}
        if((item.linkedStories||[]).length>0){const lb=document.createElement('div');lb.className='ls-badge-cell';lb.textContent='📱 '+item.linkedStories.length;cell.appendChild(lb);}
        const showDate=showAllDates&&item.showDate;
        const db=document.createElement('div');db.className='date-bar'+(showDate?'':' hidden-bar');
        const di=document.createElement('input');di.className='date-input';di.type='text';di.value=item.date;di.placeholder='es. Lun 7 luglio';di.onclick=e=>{e.stopPropagation();openDatePicker(idx,cell);};di.oninput=e=>{currentFeedItems()[idx].date=e.target.value;};
        const dt=document.createElement('button');dt.className='date-toggle';dt.textContent=item.showDate?'✓':'✕';dt.onclick=e=>{e.stopPropagation();currentFeedItems()[idx].showDate=!currentFeedItems()[idx].showDate;renderFeedGrid();};
        db.appendChild(di);db.appendChild(dt);cell.appendChild(db);
        const dpTrigger=document.createElement('button');dpTrigger.className='date-add-btn dp-trigger-btn';dpTrigger.textContent=item.date?'📅 '+item.date.split(' ').slice(1).join(' '):'📅 data';dpTrigger.onclick=e=>{e.stopPropagation();openDatePicker(idx,cell);};cell.appendChild(dpTrigger);
        const ov=document.createElement('div');ov.className='cell-overlay';
        if(item.type==='carousel'){const eb=document.createElement('button');eb.className='ov-btn';eb.innerHTML='✏️ Slide';eb.onclick=e=>{e.stopPropagation();openCarouselModal(idx);};ov.appendChild(eb);}
        const lsb=document.createElement('button');lsb.className='ov-btn';lsb.innerHTML='📱 '+((item.linkedStories||[]).length>0?'Stories ('+item.linkedStories.length+')':'Collega stories');lsb.onclick=e=>{e.stopPropagation();openLinkStoriesModal(idx);};ov.appendChild(lsb);
        const cpb=document.createElement('button');cpb.className='ov-btn';cpb.innerHTML='📋 Copia da…';cpb.onclick=e=>{e.stopPropagation();openCopyModal('feed');};ov.appendChild(cpb);
        const del=document.createElement('button');del.className='ov-btn';del.innerHTML='🗑 Rimuovi';del.onclick=e=>{e.stopPropagation();removeFeedItem(idx);};ov.appendChild(del);
        cell.appendChild(ov);wrap.appendChild(cell);
        const cp=document.createElement('div');cp.className='copy-panel';cp.style.display=showAllCopy?'':'none';
        const cph=document.createElement('div');cph.className='copy-panel-header';const cl=document.createElement('div');cl.className='copy-label';cl.textContent='Caption';const expBtn=document.createElement('button');expBtn.className='copy-expand-btn';expBtn.textContent='▾';cph.appendChild(cl);cph.appendChild(expBtn);
        const cpanel_body=document.createElement('div');cpanel_body.className='copy-body';const ct=document.createElement('textarea');ct.placeholder='Scrivi la caption…';ct.value=item.copy||'';ct.rows=3;ct.oninput=e=>{currentFeedItems()[idx].copy=e.target.value;const prev=cp.querySelector('.copy-preview');if(prev){prev.textContent=e.target.value||'';prev.classList.toggle('empty',!e.target.value);}};cpanel_body.appendChild(ct);
        const prev=document.createElement('div');prev.className='copy-preview'+(item.copy?'':' empty');prev.textContent=item.copy||'Caption…';
        const toggleCopy=()=>{const open=expBtn.classList.toggle('open');prev.style.display=open?'none':'block';if(open)ct.focus();};cph.onclick=toggleCopy;prev.onclick=toggleCopy;
        cp.appendChild(cph);cp.appendChild(prev);cp.appendChild(cpanel_body);wrap.appendChild(cp);
      }
    } else if(i===items.length){cell.classList.add('empty-slot');addEmptyFeedListeners(cell);const sp=document.createElement('span');sp.textContent='+ aggiungi';cell.appendChild(sp);wrap.appendChild(cell);}
    else{cell.classList.add('empty-slot');addEmptyFeedListeners(cell);wrap.appendChild(cell);}
    grid.appendChild(wrap);
  }
}

function addEmptyFeedListeners(cell){cell.addEventListener('dragover',e=>{if(feedDragSrc!==null)return;if(e.dataTransfer.types.includes('Files')){e.preventDefault();cell.classList.add('file-hover');}});cell.addEventListener('dragleave',()=>cell.classList.remove('file-hover'));cell.addEventListener('drop',e=>{cell.classList.remove('file-hover');if(feedDragSrc!==null)return;e.preventDefault();if(e.dataTransfer.files.length)queueFeedFiles(e.dataTransfer.files);});}
function setFeedItemType(idx,type){const items=currentFeedItems();items[idx].type=type;if(type==='carousel'&&!items[idx].slides?.length)items[idx].slides=[{url:items[idx].url,name:items[idx].name}];setFeedItems(items);refreshFeed();if(type==='carousel')openCarouselModal(idx);}
function removeFeedItem(i){const items=currentFeedItems();if(!items[i].isExternalLink)URL.revokeObjectURL(items[i].url);(items[i].slides||[]).forEach(s=>{if(s.url&&!s.externalUrl)URL.revokeObjectURL(s.url);});items.splice(i,1);setFeedItems(items);refreshFeed();}
function updateFeedStats(){const f=currentFeedItems().filter(i=>i.type!=='pending');const s=currentStoryItems();const el=id=>document.getElementById(id);if(el('stat-tot'))el('stat-tot').textContent=f.length;if(el('stat-vid'))el('stat-vid').textContent=f.filter(i=>i.type==='video').length;if(el('stat-car'))el('stat-car').textContent=f.filter(i=>i.type==='carousel').length;if(el('stat-stories'))el('stat-stories').textContent=s.length;if(el('stat-stories-sb'))el('stat-stories-sb').textContent=s.filter(x=>x.isStoryboard).length;const aid=accountId(feedClientIdx,feedAccountIdx);if(el('stat-hl'))el('stat-hl').textContent=aid?(highlights[aid]||[]).length:0;if(el('feed-meta'))el('feed-meta').textContent=f.length+' post';const status=feedAccountIdx<0?'Seleziona cliente e account.':f.length===0?'Nessun contenuto per questo mese.':f.length+' contenut'+(f.length===1?'o pronti.':'i pronti.');if(el('feed-status'))el('feed-status').textContent=status;}
function updateFeedHeader(){const acc=getAccount(feedClientIdx,feedAccountIdx);const cn=acc?clients[feedClientIdx].name+' — '+acc.name:'Feed Preview';const mn=feedMonth;const el=id=>document.getElementById(id);if(el('feed-title'))el('feed-title').textContent=cn+(mn?' · '+mn:'');if(el('feed-tag'))el('feed-tag').textContent=mn?mn+' · 4:5':'1080×1350 · 4:5';updateFeedStats();}
function toggleAllDates(){showAllDates=!showAllDates;const b=document.getElementById('toggle-dates'),c=document.getElementById('toggle-dates-chip');if(b)b.classList.toggle('off',!showAllDates);if(c){c.textContent=showAllDates?'ON':'OFF';c.classList.toggle('off',!showAllDates);}renderFeedGrid();}
function toggleAllCopy(){showAllCopy=!showAllCopy;const b=document.getElementById('toggle-copy'),c=document.getElementById('toggle-copy-chip');if(b)b.classList.toggle('off',!showAllCopy);if(c){c.textContent=showAllCopy?'ON':'OFF';c.classList.toggle('off',!showAllCopy);}renderFeedGrid();}

/* CAROUSEL MODAL */
function openCarouselModal(idx){carouselEditIdx=idx;const item=currentFeedItems()[idx];carouselTmp=(item.slides||[]).map(s=>({...s}));renderCThumbs();openModal('carousel-modal');}
function saveCarousel(){if(!carouselTmp.length){showToast('Aggiungi almeno una slide','warn');return;}const items=currentFeedItems();items[carouselEditIdx].slides=carouselTmp.map(s=>({...s}));items[carouselEditIdx].url=carouselTmp[0].url||'';setFeedItems(items);closeModal('carousel-modal');refreshFeed();autoSave();}
function addCarouselFiles(files){Array.from(files).forEach(f=>{if(f.type.startsWith('image'))carouselTmp.push({url:URL.createObjectURL(f),name:f.name});});renderCThumbs();}
function removeCSlide(i){URL.revokeObjectURL(carouselTmp[i].url);carouselTmp.splice(i,1);renderCThumbs();}
function renderCThumbs(){const c=document.getElementById('c-thumbs');if(!c)return;c.innerHTML='';carouselTmp.forEach((s,i)=>{const th=document.createElement('div');th.className='c-thumb';const img=document.createElement('img');img.src=s.url;img.alt='';const del=document.createElement('button');del.className='c-thumb-del';del.textContent='✕';del.onclick=()=>removeCSlide(i);const num=document.createElement('span');num.className='c-thumb-num';num.textContent=i+1;th.appendChild(img);th.appendChild(del);th.appendChild(num);c.appendChild(th);});}

/* STORIES GRID */
function refreshStories(){renderStoriesGrid();updateStoriesStats();autoSave();}
function updateStoriesStats(){
  const s=currentStoryItems();const aid=accountId(storiesClientIdx,storiesAccountIdx);const el=id=>document.getElementById(id);
  if(el('stat-st-tot'))el('stat-st-tot').textContent=s.length;
  if(el('stat-st-sb'))el('stat-st-sb').textContent=s.filter(x=>x.isStoryboard).length;
  if(el('stat-st-hl'))el('stat-st-hl').textContent=aid?(highlights[aid]||[]).length:0;
  if(el('stories-meta'))el('stories-meta').textContent=s.length+' stor'+(s.length===1?'y':'ies');
}
function updateStoriesHeader(){const acc=getAccount(storiesClientIdx,storiesAccountIdx);const cn=acc?clients[storiesClientIdx].name+' — '+acc.name:'Stories';const el=id=>document.getElementById(id);if(el('stories-title'))el('stories-title').textContent=cn+(storiesMonth?' · '+storiesMonth:'');updateStoriesStats();}

function renderStoriesGrid(){
  const grid=document.getElementById('stories-grid');const hlRow=document.getElementById('hl-row');
  if(!grid||!hlRow)return;grid.innerHTML='';hlRow.innerHTML='';
  const arr=currentStoryItems();
  if(storiesAccountIdx<0){const em=document.createElement('div');em.style.cssText='grid-column:1/-1;text-align:center;padding:40px 0;color:var(--text-3);font-size:12px;';em.textContent='📱 Seleziona cliente e account per gestire le stories.';grid.appendChild(em);}
  else{
    const total=Math.max(arr.length+1,8);
    for(let i=0;i<total;i++){
      const wrap=document.createElement('div');wrap.className='story-wrap';
      const cell=document.createElement('div');cell.className='story-cell';
      if(i<arr.length){
        const st=arr[i],idx=i;
        if(st.isStoryboard){const coverUrl=st.slides?.[0]?.url||'';if(coverUrl){const img=document.createElement('img');img.src=coverUrl;img.alt='';cell.appendChild(img);}else{const ph=document.createElement('div');ph.style.cssText='position:absolute;inset:0;background:#1a1a2e;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:6px;';ph.innerHTML='<span style="font-size:22px;">🎬</span><span style="font-size:9px;color:rgba(255,255,255,.5);">'+(st.slides?.length||0)+' slide</span>';cell.appendChild(ph);}const b=document.createElement('span');b.className='story-badge storyboard';b.textContent='🎬 '+(st.slides?.length||0);cell.appendChild(b);}
        else if(st.type==='video'){const v=makeMedia(st.url,'video');cell.addEventListener('mouseenter',()=>v.play().catch(()=>{}));cell.addEventListener('mouseleave',()=>{v.pause();v.currentTime=0;});cell.appendChild(v);const b=document.createElement('span');b.className='story-badge video';b.textContent='▶';cell.appendChild(b);}
        else if(st.url){const img=document.createElement('img');img.src=st.url;img.alt='';cell.appendChild(img);}
        const num=document.createElement('span');num.className='story-num';num.textContent=i+1;cell.appendChild(num);
        const dh=document.createElement('div');dh.className='story-drag-h';dh.innerHTML='⠿';cell.appendChild(dh);
        cell.draggable=true;
        cell.addEventListener('dragstart',e=>{stDragSrc=idx;e.dataTransfer.effectAllowed='move';setTimeout(()=>cell.classList.add('dragging'),0);});
        cell.addEventListener('dragover',e=>{e.preventDefault();if(stDragSrc!==null&&stDragSrc!==idx){document.querySelectorAll('.story-cell').forEach(c=>c.classList.remove('drag-over-st'));cell.classList.add('drag-over-st');}});
        cell.addEventListener('drop',e=>{e.preventDefault();if(stDragSrc!==null&&stDragSrc!==idx){const a=currentStoryItems();const tmp=a[stDragSrc];a[stDragSrc]=a[idx];a[idx]=tmp;setStoryItems(a);}stDragSrc=null;renderStoriesGrid();});
        cell.addEventListener('dragend',()=>{stDragSrc=null;document.querySelectorAll('.story-cell').forEach(c=>c.classList.remove('dragging','drag-over-st'));});
        const ov=document.createElement('div');ov.className='story-overlay';
        if(st.isStoryboard){const eb=document.createElement('button');eb.className='ov-btn';eb.innerHTML='✏️ Modifica';eb.onclick=e=>{e.stopPropagation();openStoryboardModal(idx);};ov.appendChild(eb);}
        const cpb=document.createElement('button');cpb.className='ov-btn';cpb.innerHTML='📋 Copia da…';cpb.onclick=e=>{e.stopPropagation();openCopyModal('stories');};ov.appendChild(cpb);
        const del=document.createElement('button');del.className='ov-btn';del.innerHTML='🗑 Rimuovi';del.onclick=e=>{e.stopPropagation();removeStoryItem(idx);};ov.appendChild(del);
        cell.appendChild(ov);wrap.appendChild(cell);
        const info=document.createElement('div');info.className='story-info';
        const di=document.createElement('input');di.className='story-date-inp';di.type='text';di.value=st.date||'';di.placeholder='Data…';di.oninput=e=>{currentStoryItems()[idx].date=e.target.value;};
        const ni=document.createElement('textarea');ni.className='story-note-inp';ni.value=st.note||'';ni.placeholder='Nota regia…';ni.oninput=e=>{currentStoryItems()[idx].note=e.target.value;};
        info.appendChild(di);info.appendChild(ni);wrap.appendChild(info);
      } else if(i===arr.length){cell.classList.add('empty-story');addEmptyStoryListeners(cell);const sp=document.createElement('span');sp.textContent='+ aggiungi';cell.appendChild(sp);wrap.appendChild(cell);}
      else{cell.classList.add('empty-story');addEmptyStoryListeners(cell);wrap.appendChild(cell);}
      grid.appendChild(wrap);
    }
    // PED stories section
    const pedMonth=storiesMonth||feedMonth||MONTH_OPTIONS[new Date().getMonth()];
    let pedItems=[],pedClientName='';
    const pedCi=storiesClientIdx>=0?storiesClientIdx:feedClientIdx;
    if(pedCi>=0&&clients[pedCi]){const cl=clients[pedCi];for(const k of Object.keys(pedPlans)){if(k.startsWith(cl.name+'|||')&&k.endsWith('|||'+pedMonth)||k===cl.name+'|||'+pedMonth){const a=(pedPlans[k]||[]).filter(s=>s.date);if(a.length){pedItems=a;pedClientName=cl.name;break;}}}}
    if(!pedItems.length){for(const k of Object.keys(pedPlans)){if(k.includes('|||'+pedMonth)){const a=(pedPlans[k]||[]).filter(s=>s.date);if(a.length){pedItems=a;pedClientName=k.split('|||')[0];break;}}}}
    if(pedItems.length>0){
      const pedSection=document.createElement('div');pedSection.className='ped-story-section';
      const pedLbl=document.createElement('div');pedLbl.className='ped-story-section-lbl';pedLbl.innerHTML='👤 PED Stories — prodotte dal cliente';pedSection.appendChild(pedLbl);
      const pedGrid=document.createElement('div');pedGrid.className='stories-grid';
      pedItems.forEach((st,pi)=>{
        const wrap=document.createElement('div');wrap.className='story-wrap';
        const cell=document.createElement('div');cell.className='ped-story-cell';cell.title='Story PED — clicca per modificare';
        const num=document.createElement('div');num.className='ped-story-num';num.textContent=pi+1;cell.appendChild(num);
        const icon=document.createElement('div');icon.className='ped-story-icon';icon.textContent=st.type==='autonoma'?'👤':'🎨';cell.appendChild(icon);
        const badge=document.createElement('div');badge.className='ped-story-type '+(st.type||'autonoma');badge.textContent=st.type==='autonoma'?'Cliente':'Template Nassa';cell.appendChild(badge);
        if(st.brief){const brief=document.createElement('div');brief.className='ped-story-brief-txt';brief.textContent=st.brief.slice(0,40);cell.appendChild(brief);}
        const dateEl=document.createElement('div');dateEl.className='ped-story-date-lbl';dateEl.textContent=fmtDate(st.date)||st.date;cell.appendChild(dateEl);
        cell.onclick=()=>switchTab('ped');wrap.appendChild(cell);
        const info=document.createElement('div');info.className='story-info';
        const di=document.createElement('div');di.style.cssText='font-size:9px;color:var(--text-2);font-weight:500;';di.textContent=(st.type==='autonoma'?'👤 Autonoma':'🎨 Template')+(st.date?' · '+fmtDate(st.date):'');info.appendChild(di);wrap.appendChild(info);
        pedGrid.appendChild(wrap);
      });
      pedSection.appendChild(pedGrid);grid.parentElement.appendChild(pedSection);
    }
  }
  // Highlights
  const hls=currentHighlights();
  hls.forEach((h,i)=>{const hw=document.createElement('div');hw.className='hl-wrap';hw.onclick=()=>openHighlightModal(i);const hc=document.createElement('div');hc.className='hl-circle';if(h.coverUrl){const img=document.createElement('img');img.src=h.coverUrl;img.alt='';hc.appendChild(img);}const hn=document.createElement('div');hn.className='hl-name';hn.textContent=h.name;hw.appendChild(hc);hw.appendChild(hn);hlRow.appendChild(hw);});
  const addHl=document.createElement('div');addHl.className='hl-add';addHl.title='Aggiungi evidenza';addHl.innerHTML='+';addHl.onclick=()=>openHighlightModal(-1);hlRow.appendChild(addHl);
}

function addEmptyStoryListeners(cell){cell.addEventListener('dragover',e=>{if(stDragSrc!==null)return;if(e.dataTransfer.types.includes('Files')){e.preventDefault();cell.classList.add('file-hover');}});cell.addEventListener('dragleave',()=>cell.classList.remove('file-hover'));cell.addEventListener('drop',e=>{cell.classList.remove('file-hover');if(stDragSrc!==null)return;e.preventDefault();if(e.dataTransfer.files.length)queueStoryFiles(e.dataTransfer.files);});}
function removeStoryItem(i){const arr=currentStoryItems();if(!arr[i].isExternalLink)URL.revokeObjectURL(arr[i].url);arr.splice(i,1);setStoryItems(arr);refreshStories();}

/* STORYBOARD MODAL */
function openStoryboardModal(idx){sbEditIdx=idx;const st=idx!==null&&idx>=0?currentStoryItems()[idx]:null;sbTmpSlides=st?.isStoryboard?(st.slides||[]).map(s=>({...s})):[];renderSbSlides();openModal('storyboard-modal');}
function saveStoryboard(){if(!sbTmpSlides.length){showToast('Aggiungi almeno una slide','warn');return;}const arr=currentStoryItems();if(sbEditIdx!==null&&sbEditIdx>=0&&sbEditIdx<arr.length){arr[sbEditIdx].slides=sbTmpSlides.map(s=>({...s}));arr[sbEditIdx].url=sbTmpSlides[0].url||'';arr[sbEditIdx].isStoryboard=true;}else{arr.push({type:'image',url:sbTmpSlides[0].url||'',name:'Storyboard',date:'',note:'',isStoryboard:true,slides:sbTmpSlides.map(s=>({...s}))});}setStoryItems(arr);closeModal('storyboard-modal');refreshStories();autoSave();}
function addSbSlide(){sbTmpSlides.push({url:'',title:'',note:''});renderSbSlides();}
function removeSbSlide(i){sbTmpSlides.splice(i,1);renderSbSlides();}
function renderSbSlides(){
  const c=document.getElementById('sb-slides');if(!c)return;c.innerHTML='';
  if(!sbTmpSlides.length){c.innerHTML='<div style="text-align:center;padding:16px;font-size:11px;color:var(--text-3);">Nessuna slide. Clicca "+ Aggiungi slide".</div>';return;}
  sbTmpSlides.forEach((sl,i)=>{
    const row=document.createElement('div');row.className='sb-slide';
    const num=document.createElement('div');num.className='sb-num';num.textContent=i+1;row.appendChild(num);
    const thumb=document.createElement('div');thumb.className='sb-thumb';thumb.style.position='relative';
    if(sl.url){const img=document.createElement('img');img.src=sl.url;img.alt='';thumb.appendChild(img);}else{const ph=document.createElement('div');ph.className='sb-thumb-add';ph.innerHTML='🖼';thumb.appendChild(ph);}
    const fi=document.createElement('input');fi.type='file';fi.accept='image/*';fi.style.cssText='position:absolute;inset:0;opacity:0;cursor:pointer;width:100%;height:100%;';
    fi.onchange=e=>{if(e.target.files[0]){sbTmpSlides[i].url=URL.createObjectURL(e.target.files[0]);renderSbSlides();}};
    thumb.appendChild(fi);row.appendChild(thumb);
    const con=document.createElement('div');con.className='sb-content';
    const ti=document.createElement('input');ti.type='text';ti.placeholder='Titolo…';ti.value=sl.title||'';ti.oninput=e=>{sbTmpSlides[i].title=e.target.value;};
    const ni=document.createElement('textarea');ni.placeholder='Nota regia…';ni.value=sl.note||'';ni.oninput=e=>{sbTmpSlides[i].note=e.target.value;};
    con.appendChild(ti);con.appendChild(ni);row.appendChild(con);
    const del=document.createElement('button');del.className='sb-del';del.innerHTML='🗑';del.onclick=()=>removeSbSlide(i);row.appendChild(del);
    c.appendChild(row);
  });
}

/* HIGHLIGHT MODAL */
function openHighlightModal(idx){hlEditIdx=idx;hlTmpCover=null;const hl=idx>=0?currentHighlights()[idx]:null;const nn=document.getElementById('hl-name');if(nn)nn.value=hl?hl.name:'';const ll=document.getElementById('hl-upload-lbl');if(ll)ll.innerHTML=hl?.coverUrl?'<strong>Clicca per cambiare copertina</strong>':'Carica copertina · <strong>clicca per sfogliare</strong>';openModal('highlight-modal');}
function setHlCover(files){if(!files[0])return;hlTmpCover=URL.createObjectURL(files[0]);const ll=document.getElementById('hl-upload-lbl');if(ll)ll.innerHTML='<strong>✓ Copertina caricata</strong>';}
function saveHighlight(){const name=(document.getElementById('hl-name')?.value||'').trim();if(!name){showToast('Inserisci un nome','warn');return;}const arr=currentHighlights();if(hlEditIdx>=0){arr[hlEditIdx].name=name;if(hlTmpCover)arr[hlEditIdx].coverUrl=hlTmpCover;}else{arr.push({name,coverUrl:hlTmpCover||''});}setHighlights(arr);closeModal('highlight-modal');refreshStories();showToast('✓ Evidenza salvata');autoSave();}

/* LINK STORIES MODAL */
function openLinkStoriesModal(postIdx){
  linkModalPostIdx=postIdx;const post=currentFeedItems()[postIdx];linkModalSelected=new Set(post.linkedStories||[]);
  const grid=document.getElementById('link-modal-grid');if(!grid)return;grid.innerHTML='';
  const aid=accountId(feedClientIdx,feedAccountIdx);const key=aid&&feedMonth?accountKey(aid,feedMonth):null;const arr=key?(stories[key]||[]):[];
  const hint=document.getElementById('link-modal-hint');if(hint)hint.textContent=arr.length?'Seleziona le stories da collegare ('+arr.length+' disponibili).':'Nessuna story per questo account/mese. Caricane dalla tab Stories.';
  arr.forEach((st,i)=>{
    const th=document.createElement('div');th.className='lm-thumb'+(linkModalSelected.has(i)?' selected':'');
    th.onclick=()=>{if(linkModalSelected.has(i))linkModalSelected.delete(i);else linkModalSelected.add(i);th.classList.toggle('selected',linkModalSelected.has(i));th.querySelector('.lm-check').style.display=linkModalSelected.has(i)?'flex':'none';};
    const chk=document.createElement('div');chk.className='lm-check';chk.innerHTML='✓';chk.style.display=linkModalSelected.has(i)?'flex':'none';th.appendChild(chk);
    const coverUrl=st.isStoryboard&&st.slides?.[0]?st.slides[0].url:st.url;if(coverUrl){const img=document.createElement('img');img.src=coverUrl;img.alt='';th.appendChild(img);}
    const num=document.createElement('div');num.className='lm-num';num.textContent=i+1;th.appendChild(num);grid.appendChild(th);
  });
  openModal('link-stories-modal');
}
function saveLinkStories(){if(linkModalPostIdx===null)return;const items=currentFeedItems();items[linkModalPostIdx].linkedStories=Array.from(linkModalSelected).sort((a,b)=>a-b);setFeedItems(items);closeModal('link-stories-modal');renderFeedGrid();autoSave();}

/* COPY CONTENT MODAL */
function openCopyModal(mode){
  const sel=document.getElementById('copy-src-account');if(!sel)return;
  sel.innerHTML='<option value="">— seleziona account —</option>';
  clients.forEach((c,ci)=>{(c.accounts||[]).forEach((a,ai)=>{const o=document.createElement('option');o.value=ci+'|'+ai;o.textContent=c.name+' — '+a.name;sel.appendChild(o);});});
  document.getElementById('copy-content-list').innerHTML='<div style="text-align:center;padding:20px;font-size:11px;color:var(--text-3);">Seleziona account e mese sorgente.</div>';
  copySelectedItems=new Set();openModal('copy-content-modal');
}
function loadCopyItems(){
  const srcSel=document.getElementById('copy-src-account').value;const mSel=document.getElementById('copy-src-month').value;const msEl=document.getElementById('copy-src-month');
  if(!srcSel){msEl.innerHTML='<option value="">— seleziona mese —</option>';return;}
  const [ci,ai]=srcSel.split('|').map(Number);const acc=getAccount(ci,ai);if(!acc)return;
  if(msEl.options.length<=1||msEl.dataset.acc!==acc.id){msEl.dataset.acc=acc.id;msEl.innerHTML='<option value="">— seleziona mese —</option>';MONTH_OPTIONS.forEach(m=>{const k=accountKey(acc.id,m);if(feeds[k]?.length||stories[k]?.length){const o=document.createElement('option');o.value=m;o.textContent=m;msEl.appendChild(o);}});}
  if(!mSel)return;
  const k=accountKey(acc.id,mSel);const items=feeds[k]||[];const list=document.getElementById('copy-content-list');if(!list)return;
  list.innerHTML='';copySelectedItems=new Set();
  if(!items.length){list.innerHTML='<div style="text-align:center;padding:20px;font-size:11px;color:var(--text-3);">Nessun contenuto in questo mese.</div>';return;}
  items.filter(i=>i.type!=='pending').forEach((item,i)=>{
    const row=document.createElement('div');row.className='copy-item';row.onclick=()=>{copySelectedItems.has(i)?copySelectedItems.delete(i):copySelectedItems.add(i);row.classList.toggle('selected',copySelectedItems.has(i));};
    const thumb=document.createElement('div');thumb.className='copy-item-thumb';const coverUrl=item.type==='carousel'&&item.slides?.length?item.slides[0].url:item.url;if(coverUrl){const img=document.createElement('img');img.src=coverUrl;img.alt='';thumb.appendChild(img);}
    const info=document.createElement('div');info.className='copy-item-info';const tp=document.createElement('div');tp.className='copy-item-type';tp.textContent=item.type.toUpperCase();const nm=document.createElement('div');nm.className='copy-item-name';nm.textContent=item.copy?item.copy.slice(0,40)+'…':item.name||'(senza caption)';info.appendChild(tp);info.appendChild(nm);
    row.appendChild(thumb);row.appendChild(info);list.appendChild(row);row.dataset.idx=i;
  });
}
function executeCopy(){
  if(feedAccountIdx<0){showToast('Seleziona prima un account destinazione','warn');return;}
  const srcSel=document.getElementById('copy-src-account').value;const mSel=document.getElementById('copy-src-month').value;
  if(!srcSel||!mSel){showToast('Seleziona account e mese sorgente','warn');return;}
  const [ci,ai]=srcSel.split('|').map(Number);const acc=getAccount(ci,ai);if(!acc)return;
  const srcKey=accountKey(acc.id,mSel);const srcItems=feeds[srcKey]||[];const destItems=currentFeedItems();
  const newFromCopy=Array.from(copySelectedItems).sort((a,b)=>a-b).map(i=>srcItems[i]).filter(Boolean).map(src=>({...src,linkedStories:[],copy:src.copy||''}));
  setFeedItems([...newFromCopy,...destItems]);closeModal('copy-content-modal');refreshFeed();autoSave();showToast('✓ '+copySelectedItems.size+' contenut'+(copySelectedItems.size===1?'o':'i')+' copiati');
}

/* PREVIEW */
function renderPreview(){
  const body=document.getElementById('preview-body');if(!body)return;
  const ci=globalClientIdx>=0?globalClientIdx:previewClientIdx;const cl=ci>=0?clients[ci]:null;
  const msel=document.getElementById('preview-month-sel');const month=(msel?.value)||feedMonth||MONTH_OPTIONS[new Date().getMonth()];
  const nameEl=document.getElementById('preview-client-name');if(nameEl)nameEl.textContent=cl?cl.name:'—';
  if(msel){if(!msel.options.length||msel.dataset.client!==String(ci)){msel.dataset.client=String(ci);msel.innerHTML='';MONTH_OPTIONS.forEach(m=>{const o=document.createElement('option');o.value=m;o.textContent=m;msel.appendChild(o);});msel.value=month;msel.style.display='';}}
  if(!cl){body.innerHTML='<div class="preview-empty"><p>Seleziona un cliente per vedere l\'anteprima.</p></div>';return;}
  const accs=cl.accounts||[];body.innerHTML='';
  const header=document.createElement('div');header.className='preview-header';header.innerHTML=`<div class="preview-logo">N</div><div class="preview-htext"><h2>${cl.name}</h2><p>${month}</p></div><div class="preview-hmeta"><span class="preview-chip" id="preview-chip"></span></div>`;body.appendChild(header);
  if(accs.length>1){const tabRow=document.createElement('div');tabRow.className='preview-acc-tabs';accs.forEach((acc,ai)=>{const tab=document.createElement('div');tab.className='preview-acc-tab'+(ai===previewActiveAcc?' active':'');tab.textContent=acc.name;tab.onclick=()=>{previewActiveAcc=ai;renderPreview();};tabRow.appendChild(tab);});body.appendChild(tabRow);}
  const acc=accs[previewActiveAcc]||accs[0];if(!acc){body.appendChild(Object.assign(document.createElement('div'),{className:'preview-empty',innerHTML:'<p>Nessun account.</p>'}));return;}
  const key=accountKey(acc.id,month);const ready=(feeds[key]||[]).filter(i=>i.type!=='pending');const stArr=stories[key]||[];
  const chip=document.getElementById('preview-chip');if(chip)chip.textContent=ready.length+' contenut'+(ready.length===1?'o':'i')+(accs.length>1?' · '+acc.name:'');
  if(!ready.length){const em=document.createElement('div');em.className='preview-empty';em.innerHTML='<p>Nessun contenuto per '+acc.name+' — '+month+'.</p>';body.appendChild(em);}
  else{
    const grid=document.createElement('div');grid.className='client-grid';
    ready.forEach((item,i)=>{
      const post=document.createElement('div');post.className='client-post';
      const cell=document.createElement('div');cell.className='client-cell';cell.onclick=()=>openLb(i,ready,stArr);
      const coverUrl=item.type==='carousel'&&item.slides?.length?item.slides[0].url:item.url;
      if(item.type==='video'){const v=makeMedia(item.url,'video');cell.addEventListener('mouseenter',()=>v.play().catch(()=>{}));cell.addEventListener('mouseleave',()=>{v.pause();v.currentTime=0;});cell.appendChild(v);const b=document.createElement('span');b.className='client-badge video';b.textContent='▶ REEL';cell.appendChild(b);}
      else{const img=makeMedia(coverUrl,'image');cell.appendChild(img);if(item.type==='carousel'){const b=document.createElement('span');b.className='client-badge carousel';b.textContent='❏❏ '+(item.slides?.length||0);cell.appendChild(b);}}
      if(item.showDate&&item.date){const dp=document.createElement('div');dp.className='client-date-bar';dp.textContent=item.date;cell.appendChild(dp);}
      post.appendChild(cell);
      if(item.copy?.trim()){const cd=document.createElement('div');cd.className='client-copy';cd.innerHTML='<div class="client-copy-lbl">Caption</div>';const ct=document.createElement('div');ct.textContent=item.copy;cd.appendChild(ct);post.appendChild(cd);}
      const linked=(item.linkedStories||[]).map(si=>stArr[si]).filter(Boolean);
      if(linked.length){const strip=document.createElement('div');strip.className='ls-strip';strip.innerHTML='<div class="ls-strip-lbl">📱</div>';linked.forEach(st=>{const circ=document.createElement('div');circ.className='ls-circle';const cu=st.isStoryboard&&st.slides?.[0]?st.slides[0].url:st.url;if(cu){const img=document.createElement('img');img.src=cu;img.alt='';circ.appendChild(img);}strip.appendChild(circ);});post.appendChild(strip);}
      grid.appendChild(post);
    });
    body.appendChild(grid);
  }
  const footer=document.createElement('div');footer.className='preview-footer';footer.innerHTML='<p>Anteprima preparata da</p><div class="nassa-sig">Nassa Studio · nassastudio.it</div>';body.appendChild(footer);
}

/* LIGHTBOX */
function openLb(i,ready,stArr){lbItems=ready;lbIdx=i;lbSlide=0;lbStArr=stArr||[];renderLb();document.getElementById('lightbox').classList.add('open');}
function lbBg(e){if(e.target===document.getElementById('lightbox'))document.getElementById('lightbox').classList.remove('open');}
function lbNav(d){lbIdx=(lbIdx+d+lbItems.length)%lbItems.length;lbSlide=0;renderLb();}
function lbSlideNav(d){const item=lbItems[lbIdx];lbSlide=(lbSlide+d+item.slides.length)%item.slides.length;renderLb();}
function renderLb(){
  const inner=document.getElementById('lb-inner');if(!inner)return;inner.innerHTML='';
  const item=lbItems[lbIdx];const isMulti=lbItems.length>1;const isCarousel=item.type==='carousel'&&item.slides?.length>1;
  const showPostNav=isMulti&&!isCarousel;
  document.getElementById('lb-prev').style.display=showPostNav?'flex':'none';document.getElementById('lb-next').style.display=showPostNav?'flex':'none';
  const x=document.createElement('button');x.className='lb-close';x.innerHTML='×';x.onclick=()=>document.getElementById('lightbox').classList.remove('open');inner.appendChild(x);
  if(item.type==='carousel'){const img=document.createElement('img');img.src=item.slides[lbSlide].url;img.alt='';inner.appendChild(img);if(item.slides.length>1){const sp=document.createElement('button');sp.className='lb-slide-nav lb-slide-prev';sp.innerHTML='‹';sp.onclick=e=>{e.stopPropagation();lbSlideNav(-1);};inner.appendChild(sp);const sn=document.createElement('button');sn.className='lb-slide-nav lb-slide-next';sn.innerHTML='›';sn.onclick=e=>{e.stopPropagation();lbSlideNav(1);};inner.appendChild(sn);}}
  else if(item.type==='video'){const v=makeMedia(item.url,'video',{controls:true,autoplay:true});inner.appendChild(v);}
  else{const img=document.createElement('img');img.src=item.url;img.alt='';inner.appendChild(img);}
  const counterEl=document.getElementById('lb-counter');if(isCarousel)counterEl.textContent=(lbSlide+1)+' / '+item.slides.length+' slide';else counterEl.textContent=isMulti?(lbIdx+1)+' / '+lbItems.length:'';
  const copyEl=document.getElementById('lb-copy');if(copyEl){if(item.copy?.trim()){copyEl.textContent=item.copy;copyEl.className='lb-copy visible';}else{copyEl.textContent='';copyEl.className='lb-copy';}}
  const ssEl=document.getElementById('lb-stories-strip');if(!ssEl)return;
  const linked=(item.linkedStories||[]).map(idx=>lbStArr[idx]).filter(Boolean);
  if(linked.length){ssEl.className='lb-stories-strip visible';ssEl.innerHTML='';const lbl=document.createElement('div');lbl.className='lb-stories-lbl';lbl.textContent='Stories collegate';ssEl.appendChild(lbl);const row=document.createElement('div');row.className='lb-stories-row';linked.forEach(st=>{const th=document.createElement('div');th.className='lb-story-th';const cu=st.isStoryboard&&st.slides?.[0]?st.slides[0].url:st.url;if(cu){const img=document.createElement('img');img.src=cu;img.alt='';th.appendChild(img);}row.appendChild(th);});ssEl.appendChild(row);}else{ssEl.className='lb-stories-strip';ssEl.innerHTML='';}
}
document.addEventListener('keydown',e=>{
  const lb=document.getElementById('lightbox');if(!lb.classList.contains('open'))return;
  const item=lbItems[lbIdx];const isCarousel=item.type==='carousel'&&item.slides?.length>1;
  if(e.key==='ArrowLeft'&&!e.shiftKey){if(isCarousel)lbSlideNav(-1);else if(lbItems.length>1)lbNav(-1);}
  if(e.key==='ArrowRight'&&!e.shiftKey){if(isCarousel)lbSlideNav(1);else if(lbItems.length>1)lbNav(1);}
  if(e.key==='ArrowLeft'&&e.shiftKey&&lbItems.length>1)lbNav(-1);
  if(e.key==='ArrowRight'&&e.shiftKey&&lbItems.length>1)lbNav(1);
  if(e.key==='Escape')lb.classList.remove('open');
});

/* MODAL HELPERS */
function openModal(id){const m=document.getElementById(id);if(m)m.classList.add('open');}
function closeModal(id){const m=document.getElementById(id);if(m)m.classList.remove('open');}
document.addEventListener('click',e=>{if(e.target.classList.contains('modal-bg'))e.target.classList.remove('open');});

/* ════════ CALENDARIO ════════ */
let calView='month',calDate=new Date();
const GIORNIW=['Lun','Mar','Mer','Gio','Ven','Sab','Dom'];
const MESI_IT=['Gennaio','Febbraio','Marzo','Aprile','Maggio','Giugno','Luglio','Agosto','Settembre','Ottobre','Novembre','Dicembre'];
function setCalView(v){calView=v;document.getElementById('cal-btn-month').classList.toggle('active',v==='month');document.getElementById('cal-btn-week').classList.toggle('active',v==='week');renderCalendar();}
function calNav(dir){if(calView==='month')calDate.setMonth(calDate.getMonth()+dir);else calDate.setDate(calDate.getDate()+dir*7);calDate=new Date(calDate);renderCalendar();}
function calGoToday(){calDate=new Date();renderCalendar();}
function isoDate(y,m,d){return y+'-'+(m<10?'0':'')+m+'-'+(d<10?'0':'')+d;}
function todayISO(){const n=new Date();return isoDate(n.getFullYear(),n.getMonth()+1,n.getDate());}

function calGetAllEvents(){
  const events={};const addEv=(ds,ev)=>{if(!events[ds])events[ds]=[];events[ds].push(ev);};
  clients.forEach((cl,ci)=>{
    (cl.accounts||[]).forEach(acc=>{
      MONTH_OPTIONS.forEach(mo=>{
        const key=acc.id+'|||'+mo;
        (feeds[key]||[]).filter(it=>it.type!=='pending'&&it.date).forEach((it,ii)=>{addEv(it.date,{type:'feed',label:it.copy?it.copy.slice(0,20):(it.type==='video'?'Reel':'Post'),thumb:it.type==='carousel'&&it.slides?.[0]?it.slides[0].url:it.url,vidUrl:it.type==='video'?it.url:null,item:it,clientIdx:ci,clientName:cl.name+' — '+acc.name,month:mo,feedIdx:ii});});
        (stories[key]||[]).filter(st=>st.date).forEach((st,si)=>{addEv(st.date,{type:'story',label:st.isStoryboard?'Storyboard':(st.type==='video'?'Reel story':'Story'),thumb:st.isStoryboard&&st.slides?.[0]?st.slides[0].url:st.url,vidUrl:st.type==='video'&&!st.isStoryboard?st.url:null,item:st,clientIdx:ci,clientName:cl.name+' — '+acc.name,month:mo,stIdx:si});});
      });
    });
    MONTH_OPTIONS.forEach(mo=>{const pkey=pedKey(cl.name,mo);(pedPlans[pkey]||[]).forEach((st)=>{if(!st.date)return;const lbl=(st.type==='autonoma'?'👤 ':'🎨 ')+(st.brief?st.brief.slice(0,18):'Story pianificata');addEv(st.date,{type:'ped',label:lbl,thumb:null,item:st,clientIdx:ci,clientName:cl.name,month:mo,pedType:st.type});});});
  });
  return events;
}

function renderCalendar(){
  const body=document.getElementById('cal-body');if(!body)return;
  const lbl=document.getElementById('cal-month-label');const events=calGetAllEvents();const today=todayISO();
  if(calView==='month'){
    const y=calDate.getFullYear(),m=calDate.getMonth();if(lbl)lbl.textContent=MESI_IT[m]+' '+y;
    const firstDay=new Date(y,m,1);let startDow=firstDay.getDay();startDow=startDow===0?6:startDow-1;
    const daysInMonth=new Date(y,m+1,0).getDate();const daysInPrev=new Date(y,m,0).getDate();
    let html='<div class="cal-month-grid">';GIORNIW.forEach(g=>{html+=`<div class="cal-day-header">${g}</div>`;});
    let day=1,nextDay=1;const totalCells=Math.ceil((startDow+daysInMonth)/7)*7;
    for(let i=0;i<totalCells;i++){
      let cellY=y,cellM=m+1,cellD,isOther=false;
      if(i<startDow){cellD=daysInPrev-startDow+i+1;cellM=m===0?12:m;cellY=m===0?y-1:y;isOther=true;}
      else if(day>daysInMonth){cellD=nextDay++;cellM=m+2>12?1:m+2;cellY=m+2>12?y+1:y;isOther=true;}
      else{cellD=day++;}
      const dateStr=isoDate(cellY,cellM,cellD);const isToday=dateStr===today;const evs=events[dateStr]||[];
      html+=`<div class="cal-day${isOther?' other-month':''}${isToday?' today':''}" onclick="openCalPanel('${dateStr}')">`;
      html+=`<div class="cal-day-num">${cellD}</div><div class="cal-events">`;
      evs.slice(0,3).forEach(ev=>{const cls=ev.type==='feed'?'feed-post':ev.type==='story'?'story-item':ev.type==='ped'?(ev.pedType==='template'?'ped-template':'ped-autonoma'):'highlight-item';const dot=ev.type==='ped'?(ev.pedType==='template'?'🎨':'👤'):'';html+=`<div class="cal-event ${cls}" onclick="event.stopPropagation();openCalPanel('${dateStr}')"><span>${dot}</span><span class="cal-event-label">${ev.clientName}: ${ev.label}</span></div>`;});
      if(evs.length>3)html+=`<div class="cal-event-more">+${evs.length-3} altri</div>`;
      html+='</div></div>';
    }
    html+='</div>';body.innerHTML=html;
  } else {
    const curr=new Date(calDate);const dow=curr.getDay();const diff=dow===0?-6:1-dow;curr.setDate(curr.getDate()+diff);
    if(lbl)lbl.textContent='Settimana del '+curr.getDate()+' '+MESI_IT[curr.getMonth()];
    const weekDays=[];for(let i=0;i<7;i++){const d=new Date(curr);d.setDate(d.getDate()+i);weekDays.push(d);}
    let html='<div class="cal-week-wrap">';html+='<div class="cal-week-header" style="border-right:1px solid var(--border);border-bottom:1px solid var(--border);"></div>';
    weekDays.forEach(d=>{const ds=isoDate(d.getFullYear(),d.getMonth()+1,d.getDate());const isT=ds===today;html+=`<div class="cal-week-header${isT?' today':''}"><div class="wh-day">${GIORNIW[weekDays.indexOf(d)]}</div><div class="wh-num">${d.getDate()}</div></div>`;});
    const HOURS=[];for(let h=8;h<=22;h++)HOURS.push(h);
    const weekEvMap={};weekDays.forEach(d=>{const ds=isoDate(d.getFullYear(),d.getMonth()+1,d.getDate());weekEvMap[ds]=events[ds]||[];});
    html+='<div class="cal-time-col">';HOURS.forEach(h=>{html+=`<div class="cal-time-slot"><span class="cal-time-label">${h}:00</span></div>`;});html+='</div>';
    weekDays.forEach(d=>{const ds=isoDate(d.getFullYear(),d.getMonth()+1,d.getDate());const dayEvs=weekEvMap[ds]||[];html+='<div class="cal-week-col">';HOURS.forEach(()=>{html+='<div class="cal-week-slot"></div>';});dayEvs.forEach((ev,ei)=>{const top=4+ei*40;const cls=ev.type==='feed'?'feed-post':ev.type==='story'?'story-item':ev.type==='ped'?(ev.pedType==='template'?'ped-template':'ped-autonoma'):'highlight-item';const dot=ev.type==='ped'?(ev.pedType==='template'?'🎨':'👤'):'';html+=`<div class="cal-week-event ${cls}" style="top:${top}px;height:34px;" onclick="openCalPanel('${ds}')"><span>${dot}</span><span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;flex:1;">${ev.clientName}: ${ev.label}</span></div>`;});html+='</div>';});
    html+='</div>';body.innerHTML=html;
  }
}

function openCalPanel(dateStr){
  const events=calGetAllEvents();const evs=events[dateStr]||[];
  const panel=document.getElementById('cal-day-panel');if(!panel)return;
  const head=document.getElementById('cal-panel-date');const body=document.getElementById('cal-panel-body');if(!head||!body)return;
  const[y,mo,d]=dateStr.split('-');const dt=new Date(parseInt(y),parseInt(mo)-1,parseInt(d));
  const gg=['Domenica','Lunedì','Martedì','Mercoledì','Giovedì','Venerdì','Sabato'];
  head.textContent=gg[dt.getDay()]+' '+parseInt(d)+' '+MESI_IT[parseInt(mo)-1]+' '+y;
  body.innerHTML='';
  if(!evs.length){body.innerHTML='<p style="font-size:12px;color:var(--text-3);text-align:center;padding:20px;">Nessun contenuto programmato.</p>';panel.classList.add('open');return;}
  const feeds_=evs.filter(e=>e.type==='feed');const stories_=evs.filter(e=>e.type==='story');const hl_=evs.filter(e=>e.type==='highlight');const pedAuto_=evs.filter(e=>e.type==='ped'&&e.pedType==='autonoma');const pedTmpl_=evs.filter(e=>e.type==='ped'&&e.pedType==='template');
  const renderSection=(list,label,typeClass)=>{if(!list.length)return;const sec=document.createElement('div');const sl=document.createElement('div');sl.className='cal-panel-section';sl.textContent=label;sec.appendChild(sl);list.forEach(ev=>{const row=document.createElement('div');row.className='cal-panel-item';const thumb=document.createElement('div');thumb.className='cal-panel-thumb'+(typeClass==='story'?' story':'');if(ev.vidUrl){const v=document.createElement('video');v.src=ev.vidUrl;v.muted=true;v.playsInline=true;v.preload='metadata';v.style.cssText='width:100%;height:100%;object-fit:cover;';thumb.appendChild(v);}else if(ev.thumb){const img=document.createElement('img');img.src=ev.thumb;img.alt='';thumb.appendChild(img);}const info=document.createElement('div');info.className='cal-panel-info';const type_=document.createElement('div');type_.className=`cal-panel-type ${typeClass}`;type_.textContent=label.replace(/[📄📱⭐👤🎨] /,'');info.appendChild(type_);const cp=document.createElement('div');cp.className='cal-panel-copy';cp.textContent=ev.item.brief||ev.item.copy||ev.item.note||ev.item.name||ev.label||'—';info.appendChild(cp);if(ev.clientName){const cl_=document.createElement('div');cl_.style.cssText='font-size:10px;color:var(--text-3);margin-top:2px;';cl_.textContent=ev.clientName;info.appendChild(cl_);}if(ev.type==='feed'||ev.type==='story'||ev.type==='ped'){const tabDest=ev.type==='feed'?'feed':ev.type==='story'?'stories':'ped';const go=document.createElement('div');go.className='cal-panel-goto';go.innerHTML='→ Vai a '+(ev.type==='feed'?'Feed':ev.type==='story'?'Stories':'PED Stories');go.onclick=e=>{e.stopPropagation();switchTab(tabDest);closeCalPanel();};info.appendChild(go);}row.appendChild(thumb);row.appendChild(info);if(ev.type==='feed'&&ev.item)row.onclick=()=>{openLb(0,[ev.item]);};sec.appendChild(row);});body.appendChild(sec);};
  renderSection(feeds_,'📄 Post feed','feed');renderSection(stories_,'📱 Stories','story');renderSection(hl_,'⭐ In evidenza','highlight');renderSection(pedAuto_,'👤 PED Autonoma','feed');renderSection(pedTmpl_,'🎨 PED Template','story');
  panel.classList.add('open');
}
function closeCalPanel(){const p=document.getElementById('cal-day-panel');if(p)p.classList.remove('open');}

/* ════════ PED STORIES ════════ */
function renderPED(){
  const hasClient=currentClientIdx>=0&&currentMonth;const cn=hasClient?clients[currentClientIdx].name:'—';const mn=currentMonth||'—';
  const titleEl=document.getElementById('ped-title');const metaEl=document.getElementById('ped-meta');const clientLbl=document.getElementById('ped-client-label');const emptyEl=document.getElementById('ped-empty');const freqBlock=document.getElementById('ped-freq-block');const calLbl=document.getElementById('ped-cal-label');
  if(titleEl)titleEl.textContent=hasClient?cn+' — PED Stories':'PED Stories';if(clientLbl)clientLbl.textContent=hasClient?cn+' · '+mn:'— seleziona cliente nel Feed';if(calLbl)calLbl.textContent=mn;
  if(!hasClient){if(emptyEl)emptyEl.style.display='flex';if(freqBlock)freqBlock.style.display='none';renderPEDCal();return;}
  if(emptyEl)emptyEl.style.display='none';if(freqBlock)freqBlock.style.display='block';
  renderFreqDays();renderPEDCards();renderPEDCal();
  const plan=currentPedPlan();if(metaEl)metaEl.textContent=plan.length+' stor'+(plan.length===1?'y':'ies')+' pianificat'+(plan.length===1?'a':'e');
}

function renderFreqDays(){
  const wrap=document.getElementById('ped-freq-days');if(!wrap)return;
  const labels=['L','M','M','G','V','S','D'];wrap.innerHTML='';
  labels.forEach((lbl,i)=>{const btn=document.createElement('button');btn.className='freq-day-btn'+(pedFreqDays.has(i)?' active':'');btn.textContent=lbl;btn.title=['Lunedì','Martedì','Mercoledì','Giovedì','Venerdì','Sabato','Domenica'][i];btn.onclick=()=>{if(pedFreqDays.has(i))pedFreqDays.delete(i);else pedFreqDays.add(i);renderFreqDays();};wrap.appendChild(btn);});
}

function pedGenerate(){
  if(currentClientIdx<0||!currentMonth)return;if(pedFreqDays.size===0){alert('Seleziona almeno un giorno.');return;}
  const[moName,y]=currentMonth.split(' ');const moIdx=MESI_IT.indexOf(moName);if(moIdx<0)return;const year=parseInt(y);const daysInMonth=new Date(year,moIdx+1,0).getDate();
  const existing=currentPedPlan();const existingDates=new Set(existing.map(s=>s.date));const newPlan=[...existing];
  for(let d=1;d<=daysInMonth;d++){const dt=new Date(year,moIdx,d);let dow=dt.getDay();dow=dow===0?6:dow-1;const iso=isoDate(year,moIdx+1,d);if(pedFreqDays.has(dow)&&!existingDates.has(iso)){newPlan.push({date:iso,type:'autonoma',brief:'',templateRef:'',id:pedUID()});}}
  newPlan.sort((a,b)=>a.date.localeCompare(b.date));setCurrentPedPlan(newPlan);renderPED();
}
function pedClear(){if(!confirm('Svuotare il piano del mese?'))return;setCurrentPedPlan([]);renderPED();}

function renderPEDCards(){
  const wrap=document.getElementById('ped-cards');if(!wrap)return;wrap.innerHTML='';
  const plan=currentPedPlan();
  if(!plan.length){wrap.innerHTML='<p style="font-size:11px;color:var(--text-3);text-align:center;padding:16px;">Nessuna story pianificata.<br>Scegli i giorni e clicca <strong>Genera piano</strong>.</p>';return;}
  plan.forEach((st,i)=>{
    const card=document.createElement('div');card.className='ped-story-card';
    const head=document.createElement('div');head.className='ped-story-card-head';
    const dateEl=document.createElement('div');dateEl.className='ped-story-date';dateEl.textContent=fmtDate(st.date)||st.date;
    const typeSel=document.createElement('select');typeSel.className='ped-story-type-sel';[['autonoma','👤 Autonoma'],['template','🎨 Template']].forEach(([v,l])=>{const o=document.createElement('option');o.value=v;o.textContent=l;if(v===st.type)o.selected=true;typeSel.appendChild(o);});typeSel.onchange=e=>{currentPedPlan()[i].type=e.target.value;renderPEDCards();renderPEDCal();};
    const badge=document.createElement('span');badge.className='ped-type-badge';badge.textContent=st.type==='autonoma'?'👤':'🎨';
    const del=document.createElement('button');del.className='ped-story-del';del.innerHTML='🗑';del.onclick=()=>{const p=currentPedPlan();p.splice(i,1);setCurrentPedPlan(p);renderPED();};
    head.appendChild(dateEl);head.appendChild(typeSel);head.appendChild(badge);head.appendChild(del);
    const body=document.createElement('div');body.className='ped-story-body';
    const brief=document.createElement('textarea');brief.className='ped-story-brief';brief.placeholder=st.type==='autonoma'?'Brief per il cliente: cosa girare, dove, come…':'Descrizione contenuto / copy…';brief.value=st.brief||'';brief.oninput=e=>{currentPedPlan()[i].brief=e.target.value;};body.appendChild(brief);
    if(st.type==='template'){const tmpl=document.createElement('input');tmpl.type='text';tmpl.className='ped-story-template';tmpl.placeholder='Link o nome template (Canva, Adobe Express…)';tmpl.value=st.templateRef||'';tmpl.oninput=e=>{currentPedPlan()[i].templateRef=e.target.value;};body.appendChild(tmpl);}
    card.appendChild(head);card.appendChild(body);wrap.appendChild(card);
  });
}

function renderPEDCal(){
  const headEl=document.getElementById('ped-cal-head');const gridEl=document.getElementById('ped-cal-grid');if(!headEl||!gridEl)return;
  headEl.innerHTML='';['L','M','M','G','V','S','D'].forEach(g=>{const d=document.createElement('div');d.className='ped-cal-dh';d.textContent=g;headEl.appendChild(d);});
  gridEl.innerHTML='';if(currentClientIdx<0||!currentMonth)return;
  const[moName,y]=currentMonth.split(' ');const moIdx=MESI_IT.indexOf(moName);if(moIdx<0)return;const year=parseInt(y);
  const firstDay=new Date(year,moIdx,1);let startDow=firstDay.getDay();startDow=startDow===0?6:startDow-1;
  const daysInMonth=new Date(year,moIdx+1,0).getDate();const daysInPrev=new Date(year,moIdx,0).getDate();const today=todayISO();
  const pedMap={};currentPedPlan().forEach(s=>{if(!pedMap[s.date])pedMap[s.date]=[];pedMap[s.date].push(s);});
  const feedMap={};if(feedClientIdx>=0&&feedAccountIdx>=0){const acc=getAccount(feedClientIdx,feedAccountIdx);const fkey=acc?acc.id+'|||'+(feedMonth||currentMonth):null;if(fkey)(feeds[fkey]||[]).filter(it=>it.type!=='pending'&&it.date).forEach(it=>{if(!feedMap[it.date])feedMap[it.date]=[];feedMap[it.date].push(it);});}
  const totalCells=Math.ceil((startDow+daysInMonth)/7)*7;let day=1,nextDay=1;
  for(let i=0;i<totalCells;i++){
    let cellY=year,cellM=moIdx+1,cellD,isOther=false;
    if(i<startDow){cellD=daysInPrev-startDow+i+1;cellM=moIdx===0?12:moIdx;cellY=moIdx===0?year-1:year;isOther=true;}
    else if(day>daysInMonth){cellD=nextDay++;cellM=moIdx+2>12?1:moIdx+2;cellY=moIdx+2>12?year+1:year;isOther=true;}
    else{cellD=day++;}
    const ds=isoDate(cellY,cellM,cellD);const isToday=ds===today;
    const cell=document.createElement('div');cell.className='ped-cal-day'+(isOther?' other':'')+(isToday?' today':'');
    const num=document.createElement('div');num.className='ped-cal-day-num';num.textContent=cellD;cell.appendChild(num);
    const evs=document.createElement('div');evs.className='ped-cal-events';
    (feedMap[ds]||[]).forEach(it=>{const e=document.createElement('div');e.className='ped-cal-ev feed';e.textContent='📸 '+(it.type==='video'?'Reel':'Post');evs.appendChild(e);});
    (pedMap[ds]||[]).forEach(s=>{const e=document.createElement('div');e.className='ped-cal-ev '+s.type;e.textContent=(s.type==='autonoma'?'👤':'🎨')+' Story';evs.appendChild(e);});
    cell.appendChild(evs);if((pedMap[ds]||[]).length){cell.title=(pedMap[ds]||[]).map(s=>s.brief||'(brief vuoto)').join(' | ');cell.style.cursor='pointer';}
    gridEl.appendChild(cell);
  }
}

/* PIANO TESTO */
function rebuildNotesSelects(){
  const csel=document.getElementById('notes-client-sel');if(!csel)return;const prev=csel.value;csel.innerHTML='<option value="">— Cliente —</option>';clients.forEach((c,i)=>{const o=document.createElement('option');o.value=i;o.textContent=c.name;csel.appendChild(o);});if(prev)csel.value=prev;
  const msel=document.getElementById('notes-month-sel');if(!msel)return;if(notesClientIdx<0){msel.style.display='none';return;}msel.style.display='';const prevM=msel.value;msel.innerHTML='';MONTH_OPTIONS.forEach(m=>{const o=document.createElement('option');o.value=m;o.textContent=m;msel.appendChild(o);});if(prevM)msel.value=prevM;else if(notesMonth)msel.value=notesMonth;else{msel.value=MONTH_OPTIONS[new Date().getMonth()];notesMonth=msel.value;}
}
function onNotesClientChange(){const v=document.getElementById('notes-client-sel').value;notesClientIdx=v===''?-1:parseInt(v);notesMonth=MONTH_OPTIONS[new Date().getMonth()];rebuildNotesSelects();renderNotesEditor();}
function renderNotesEditor(){const msel=document.getElementById('notes-month-sel');if(msel&&msel.value)notesMonth=msel.value;const ed=document.getElementById('notes-editor');if(!ed)return;if(notesClientIdx<0){ed.value='';ed.placeholder='Seleziona un cliente per iniziare a scrivere il piano.';return;}const cl=clients[notesClientIdx];if(!cl)return;const key=cl.name+'|||'+notesMonth;ed.value=notesData[key]||'';ed.placeholder='Piano editoriale '+cl.name+' — '+notesMonth+'\n\nScrivi qui il piano del mese...';}
function saveNotesText(){const ed=document.getElementById('notes-editor');if(!ed||notesClientIdx<0)return;const cl=clients[notesClientIdx];if(!cl)return;const msel=document.getElementById('notes-month-sel');if(msel&&msel.value)notesMonth=msel.value;const key=cl.name+'|||'+notesMonth;notesData[key]=ed.value;autoSave();}

/* DATE FORMAT */
function fmtDate(iso){if(!iso)return'';const[y,m,d]=iso.split('-');if(!y||!m||!d)return iso;const giorni=['Dom','Lun','Mar','Mer','Gio','Ven','Sab'];const mesi=['Gen','Feb','Mar','Apr','Mag','Giu','Lug','Ago','Set','Ott','Nov','Dic'];const dt=new Date(parseInt(y),parseInt(m)-1,parseInt(d));return giorni[dt.getDay()]+' '+parseInt(d)+' '+mesi[parseInt(m)-1];}
function formatItalianDate(year,month,day){const weekdays=['Dom','Lun','Mar','Mer','Gio','Ven','Sab'];const months=['gennaio','febbraio','marzo','aprile','maggio','giugno','luglio','agosto','settembre','ottobre','novembre','dicembre'];const dow=new Date(year,month,day).getDay();return weekdays[dow]+' '+day+' '+months[month];}
function parseItalianDate(str){if(!str)return null;const iso=str.match(/(\d{4})-(\d{2})-(\d{2})/);if(iso)return new Date(parseInt(iso[1]),parseInt(iso[2])-1,parseInt(iso[3]));return null;}

/* DATE PICKER */
let dpOpenIdx=null,dpYear=new Date().getFullYear(),dpMonth=new Date().getMonth();
const WEEKDAYS=['L','M','M','G','V','S','D'];
const MONTH_NAMES=['Gennaio','Febbraio','Marzo','Aprile','Maggio','Giugno','Luglio','Agosto','Settembre','Ottobre','Novembre','Dicembre'];

function openDatePicker(idx,anchorEl){
  closeDatePicker();dpOpenIdx=idx;
  const item=currentFeedItems()[idx];
  const fm=feedMonth?feedMonth.split(' '):null;
  if(fm){dpMonth=MONTHS.indexOf(fm[0]);dpYear=parseInt(fm[1]);if(dpMonth<0){dpMonth=new Date().getMonth();dpYear=new Date().getFullYear();}}
  else{dpMonth=new Date().getMonth();dpYear=new Date().getFullYear();}
  if(item.date){const parsed=parseItalianDate(item.date);if(parsed){dpMonth=parsed.getMonth();dpYear=parsed.getFullYear();}}
  let popup=document.getElementById('global-date-picker');
  if(!popup){popup=document.createElement('div');popup.id='global-date-picker';popup.className='date-picker-popup';document.body.appendChild(popup);}
  const rect=anchorEl.getBoundingClientRect();popup.style.top=(rect.top-6)+'px';popup.style.left=rect.left+'px';popup.style.width=Math.max(rect.width,220)+'px';
  renderDatePickerContent(idx,popup);popup.classList.add('open');
  const popH=popup.offsetHeight;if(rect.top-popH-6<0)popup.style.top=(rect.bottom+6)+'px';else popup.style.top=(rect.top-popH-6)+'px';
}
function closeDatePicker(){const popup=document.getElementById('global-date-picker');if(popup)popup.classList.remove('open');dpOpenIdx=null;}
function renderDatePickerContent(idx,popup){
  popup.innerHTML='';
  const hdr=document.createElement('div');hdr.className='dp-header';
  const prev=document.createElement('button');prev.className='dp-nav';prev.textContent='‹';prev.onclick=e=>{e.stopPropagation();dpMonth--;if(dpMonth<0){dpMonth=11;dpYear--;}renderDatePickerContent(idx,popup);};
  const lbl=document.createElement('div');lbl.className='dp-header-label';lbl.textContent=MONTH_NAMES[dpMonth]+' '+dpYear;
  const next=document.createElement('button');next.className='dp-nav';next.textContent='›';next.onclick=e=>{e.stopPropagation();dpMonth++;if(dpMonth>11){dpMonth=0;dpYear++;}renderDatePickerContent(idx,popup);};
  hdr.appendChild(prev);hdr.appendChild(lbl);hdr.appendChild(next);popup.appendChild(hdr);
  const wds=document.createElement('div');wds.className='dp-weekdays';WEEKDAYS.forEach(d=>{const wd=document.createElement('div');wd.className='dp-wd';wd.textContent=d;wds.appendChild(wd);});popup.appendChild(wds);
  const grid=document.createElement('div');grid.className='dp-days';
  const firstDay=new Date(dpYear,dpMonth,1).getDay();const daysInMonth=new Date(dpYear,dpMonth+1,0).getDate();const offset=firstDay===0?6:firstDay-1;const today=new Date();const item=currentFeedItems()[idx];const selectedDate=item.date?item.date:null;
  for(let i=0;i<offset;i++){const emp=document.createElement('button');emp.className='dp-day empty';emp.disabled=true;grid.appendChild(emp);}
  for(let d=1;d<=daysInMonth;d++){
    const btn=document.createElement('button');btn.className='dp-day';btn.textContent=d;
    const italianStr=formatItalianDate(dpYear,dpMonth,d);
    if(today.getDate()===d&&today.getMonth()===dpMonth&&today.getFullYear()===dpYear)btn.classList.add('today');
    if(selectedDate===italianStr)btn.classList.add('selected');
    btn.onclick=e=>{
      e.stopPropagation();const items=currentFeedItems();const item=items[idx];item.date=italianStr;item.showDate=true;
      const dateMese=MONTHS[dpMonth]+' '+dpYear;
      if(dateMese!==feedMonth&&feedMonth){const destKey=accountId(feedClientIdx,feedAccountIdx)+'|||'+dateMese;if(!feeds[destKey])feeds[destKey]=[];feeds[destKey]=[{...item},...(feeds[destKey]||[])];items.splice(idx,1);setFeedItems(items);closeDatePicker();renderFeedGrid();showToast('✓ Post spostato in '+dateMese);}
      else{setFeedItems(items);renderFeedGrid();renderDatePickerContent(idx,document.getElementById('global-date-picker'));}autoSave();
    };
    grid.appendChild(btn);
  }
  popup.appendChild(grid);
  const clear=document.createElement('button');clear.className='dp-clear';clear.textContent='✕ Rimuovi data';clear.onclick=e=>{e.stopPropagation();const items=currentFeedItems();items[idx].date='';items[idx].showDate=false;setFeedItems(items);popup.classList.remove('open');dpOpenIdx=null;renderFeedGrid();};popup.appendChild(clear);
}
document.addEventListener('click',e=>{if(!e.target.closest('#global-date-picker')&&!e.target.closest('.dp-trigger-btn')&&!e.target.closest('.date-input'))closeDatePicker();},true);

/* EDIT CLIENT */
function openEditClientModal(ci){ecEditIdx=ci;const cl=clients[ci];if(!cl)return;document.getElementById('ec-name').value=cl.name;document.getElementById('ec-pkg').value=cl.pkg;document.getElementById('ec-status').value=cl.status;document.getElementById('ec-revenue').value=cl.revenue||'';document.getElementById('edit-client-title').textContent='Modifica — '+cl.name;ecTmpAccounts=(cl.accounts||[]).map(a=>({...a}));renderEcAccounts();openModal('edit-client-modal');}
function renderEcAccounts(){
  const list=document.getElementById('ec-accounts-list');if(!list)return;list.innerHTML='';
  if(!ecTmpAccounts.length){list.innerHTML='<div style="font-size:11px;color:var(--text-3);padding:4px 0;">Nessun account. Aggiungine uno sotto.</div>';return;}
  ecTmpAccounts.forEach((acc,i)=>{
    const row=document.createElement('div');row.className='ec-acc-row';const main=document.createElement('div');main.className='ec-acc-main';
    const nameInp=document.createElement('input');nameInp.className='ec-acc-name-inp';nameInp.value=acc.name;nameInp.placeholder='Nome account';nameInp.oninput=e=>{ecTmpAccounts[i].name=e.target.value;};
    const platSel=document.createElement('select');platSel.className='ec-acc-plat-inp';['Instagram','Facebook','TikTok','LinkedIn','YouTube','Altro'].forEach(p=>{const o=document.createElement('option');o.value=p;o.textContent=p;if(p===acc.platform)o.selected=true;platSel.appendChild(o);});platSel.onchange=e=>{ecTmpAccounts[i].platform=e.target.value;};
    main.appendChild(nameInp);main.appendChild(platSel);
    const del=document.createElement('button');del.className='ec-acc-del';del.innerHTML='🗑';del.title='Rimuovi account';del.onclick=()=>{if(!confirm('Rimuovere account "'+acc.name+'"? I dati feed e stories saranno eliminati.'))return;ecTmpAccounts.splice(i,1);renderEcAccounts();};
    row.appendChild(main);row.appendChild(del);list.appendChild(row);
  });
}
function ecAddAccount(){const name=document.getElementById('ec-new-acc-name').value.trim();const platform=document.getElementById('ec-new-acc-platform').value;if(!name){document.getElementById('ec-new-acc-name').focus();return;}ecTmpAccounts.push({id:'a_'+Date.now(),name,platform});document.getElementById('ec-new-acc-name').value='';renderEcAccounts();}
function ecSave(){
  if(ecEditIdx<0)return;const name=document.getElementById('ec-name').value.trim();if(!name){document.getElementById('ec-name').focus();return;}
  const cl=clients[ecEditIdx];const oldName=cl.name;cl.name=name;cl.pkg=document.getElementById('ec-pkg').value;cl.status=document.getElementById('ec-status').value;cl.revenue=parseFloat(document.getElementById('ec-revenue').value)||0;
  const oldAccIds=new Set((cl.accounts||[]).map(a=>a.id));const newAccIds=new Set(ecTmpAccounts.map(a=>a.id));
  oldAccIds.forEach(aid=>{if(!newAccIds.has(aid)){MONTH_OPTIONS.forEach(m=>{delete feeds[aid+'|||'+m];delete stories[aid+'|||'+m];});delete highlights[aid];}});
  cl.accounts=ecTmpAccounts.map(a=>({...a}));
  if(oldName!==name){MONTH_OPTIONS.forEach(m=>{const oldKey=oldName+'|||'+m;const newKey=name+'|||'+m;if(pedPlans[oldKey]){pedPlans[newKey]=pedPlans[oldKey];delete pedPlans[oldKey];}if(notesData[oldKey]){notesData[newKey]=notesData[oldKey];delete notesData[oldKey];}});}
  if(globalClientIdx===ecEditIdx){feedClientIdx=ecEditIdx;feedAccountIdx=cl.accounts.length>0?Math.min(feedAccountIdx,cl.accounts.length-1):-1;storiesClientIdx=ecEditIdx;storiesAccountIdx=feedAccountIdx;updateGlobalClientUI();}
  closeModal('edit-client-modal');renderStudio();rebuildAllSelects();rebuildGlobalClientSelect();showToast('✓ Cliente aggiornato');autoSave();
}
function ecDeleteClient(){if(ecEditIdx<0)return;const cl=clients[ecEditIdx];if(!confirm('Eliminare '+cl.name+' e tutti i suoi dati? Azione irreversibile.'))return;closeModal('edit-client-modal');removeClient(ecEditIdx);}

/* EXPORT / IMPORT */
function exportProject(){
  function san(arr){return(arr||[]).map(item=>({type:item.type,name:item.name||'',date:item.date||'',showDate:item.showDate||false,copy:item.copy||'',linkedStories:item.linkedStories||[],isStoryboard:item.isStoryboard||false,isExternalLink:item.isExternalLink||false,linkSource:item.linkSource||'',externalUrl:item.externalUrl||'',slides:(item.slides||[]).map(s=>({title:s.title||'',note:s.note||'',name:s.name||'',externalUrl:s.externalUrl||''}))}));}
  function sanSt(arr){return(arr||[]).map(st=>({type:st.type,name:st.name||'',date:st.date||'',note:st.note||'',isStoryboard:st.isStoryboard||false,isExternalLink:st.isExternalLink||false,linkSource:st.linkSource||'',externalUrl:st.externalUrl||'',slides:(st.slides||[]).map(s=>({title:s.title||'',note:s.note||'',name:s.name||'',externalUrl:s.externalUrl||''}))}));}
  const ef={};Object.keys(feeds).forEach(k=>{ef[k]=san(feeds[k]);});const es={};Object.keys(stories).forEach(k=>{es[k]=sanSt(stories[k]);});
  const eh={};Object.keys(highlights).forEach(k=>{eh[k]=(highlights[k]||[]).map(h=>({name:h.name,coverUrl:(h.coverUrl&&h.coverUrl.startsWith('http'))?h.coverUrl:''}));});
  const data={version:'2.0',exportedAt:new Date().toISOString(),clients,feeds:ef,stories:es,highlights:eh,pedPlans,notesData,meta:{showAllDates,showAllCopy}};
  const blob=new Blob([JSON.stringify(data,null,2)],{type:'application/json'});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download='nassa-progetto-'+new Date().toISOString().slice(0,10)+'.json';a.click();URL.revokeObjectURL(url);showToast('✓ Progetto esportato');
}
function importProject(){document.getElementById('import-input').click();}
function loadProjectFile(input){
  const file=input.files[0];if(!file)return;const reader=new FileReader();
  reader.onload=e=>{
    try{
      const data=JSON.parse(e.target.result);if(!data.version||!data.clients)throw new Error('File non valido');
      clients=data.clients||[];clients.forEach(c=>{if(!c.accounts)c.accounts=[];if(!c.id)c.id='c_'+Date.now()+'_'+Math.random();});
      feeds={};Object.keys(data.feeds||{}).forEach(k=>{feeds[k]=(data.feeds[k]||[]).map(item=>({...item,url:(item.externalUrl&&item.externalUrl.startsWith('http'))?item.externalUrl:'',needsReload:!(item.externalUrl&&item.externalUrl.startsWith('http'))&&!!item.name,slides:(item.slides||[]).map(s=>({...s,url:(s.externalUrl&&s.externalUrl.startsWith('http'))?s.externalUrl:''}))}))}); 
      stories={};Object.keys(data.stories||{}).forEach(k=>{stories[k]=(data.stories[k]||[]).map(st=>({...st,url:(st.externalUrl&&st.externalUrl.startsWith('http'))?st.externalUrl:'',needsReload:!(st.externalUrl&&st.externalUrl.startsWith('http'))&&!!st.name,slides:(st.slides||[]).map(s=>({...s,url:(s.externalUrl&&s.externalUrl.startsWith('http'))?s.externalUrl:''}))}))}); 
      highlights={};Object.keys(data.highlights||{}).forEach(k=>{highlights[k]=(data.highlights[k]||[]).map(h=>({name:h.name,coverUrl:(h.coverUrl&&h.coverUrl.startsWith('http'))?h.coverUrl:''}));});
      pedPlans={};Object.keys(data.pedPlans||{}).forEach(k=>{pedPlans[k]=data.pedPlans[k]||[];});
      notesData=data.notesData||{};
      if(data.meta){showAllDates=data.meta.showAllDates!==false;showAllCopy=data.meta.showAllCopy!==false;}
      feedClientIdx=-1;feedAccountIdx=-1;feedMonth='';storiesClientIdx=-1;storiesAccountIdx=-1;storiesMonth='';previewClientIdx=-1;previewAccountIdx=-1;previewMonth='';
      renderStudio();rebuildAllSelects();rebuildNotesSelects();rebuildGlobalClientSelect();renderFeedGrid();renderStoriesGrid();updateFeedHeader();updateStoriesHeader();
      showToast('✓ Importato — '+clients.length+' client'+(clients.length===1?'e':'i'));
    }catch(err){alert('Errore importazione: '+err.message);}
    input.value='';
  };
  reader.readAsText(file);
}

/* TOAST */
function showToast(msg,type){const t=document.getElementById('toast');if(!t)return;t.textContent=msg;t.className='toast'+(type==='warn'?' warn':'');setTimeout(()=>t.classList.add('show'),10);setTimeout(()=>t.classList.remove('show'),2800);}

/* GLOBAL CLIENT SELECTION */
function setGlobalClient(val){
  globalClientIdx=val===''?-1:parseInt(val);
  if(globalClientIdx<0){feedClientIdx=-1;feedAccountIdx=-1;storiesClientIdx=-1;storiesAccountIdx=-1;notesClientIdx=-1;updateGlobalClientUI();return;}
  const cl=clients[globalClientIdx];if(!cl)return;
  const defaultAccIdx=cl.accounts?.length>=1?0:-1;
  feedClientIdx=globalClientIdx;feedAccountIdx=defaultAccIdx;if(!feedMonth)feedMonth=MONTH_OPTIONS[new Date().getMonth()];
  storiesClientIdx=globalClientIdx;storiesAccountIdx=defaultAccIdx;if(!storiesMonth)storiesMonth=feedMonth;
  notesClientIdx=globalClientIdx;if(!notesMonth)notesMonth=feedMonth;
  updateGlobalClientUI();
  if(currentTab==='feed'){rebuildFeedSelects();renderFeedMonthPills();renderFeedGrid();updateFeedHeader();}
  else if(currentTab==='stories'){rebuildStoriesSelects();renderStoriesMonthPills();renderStoriesGrid();updateStoriesHeader();}
  else if(currentTab==='notes'){rebuildNotesSelects();renderNotesEditor();}
  else if(currentTab==='ped'){if(typeof renderPED==='function')renderPED();}
  else if(currentTab==='cal'){if(typeof renderCalendar==='function')renderCalendar();}
  else if(currentTab==='preview'){previewClientIdx=globalClientIdx;previewAccountIdx=defaultAccIdx;syncPreviewSelectors();renderPreview();}
}

function updateGlobalClientUI(){
  const cl=globalClientIdx>=0?clients[globalClientIdx]:null;
  const subt=document.getElementById('subtopbar');const nameEl=document.getElementById('subtopbar-name');const pkgEl=document.getElementById('subtopbar-pkg');
  if(subt)subt.classList.toggle('visible',!!cl&&currentTab!=='studio');if(nameEl)nameEl.textContent=cl?cl.name:'—';if(pkgEl)pkgEl.textContent=cl?cl.pkg:'';
  renderAccSwitcher();
}

function renderAccSwitcher(){
  const sw=document.getElementById('acc-switcher');const btns=document.getElementById('acc-btns');if(!sw||!btns)return;
  const cl=globalClientIdx>=0?clients[globalClientIdx]:null;const accs=cl?.accounts||[];
  if(accs.length<2){sw.style.display='none';return;}sw.style.display='flex';btns.innerHTML='';
  accs.forEach((acc,ai)=>{const btn=document.createElement('button');btn.className='acc-btn'+(ai===feedAccountIdx?' active':'');btn.innerHTML='<span class="acc-dot"></span>'+acc.name;btn.title=acc.platform;btn.onclick=()=>switchAccount(ai);btns.appendChild(btn);});
}

function switchAccount(accountIdx){
  if(globalClientIdx<0)return;feedAccountIdx=accountIdx;storiesAccountIdx=accountIdx;renderAccSwitcher();
  if(currentTab==='feed'){rebuildFeedSelects();renderFeedMonthPills();renderFeedGrid();updateFeedHeader();}
  else if(currentTab==='stories'){rebuildStoriesSelects();renderStoriesMonthPills();renderStoriesGrid();updateStoriesHeader();}
  else if(currentTab==='preview'){previewAccountIdx=accountIdx;syncPreviewSelectors();renderPreview();}
  showToast('Account: '+clients[globalClientIdx].accounts[accountIdx].name);
}

function rebuildGlobalClientSelect(){updateGlobalClientUI();}

/* CLOUD SYNC UI */
function toggleUserSwitcher(){const sw=document.getElementById('user-switcher');if(!sw)return;sw.classList.toggle('open');sw.querySelectorAll('.user-btn').forEach(b=>{b.classList.toggle('active',b.getAttribute('onclick').includes("'"+CLOUD.user+"'"));});}
document.addEventListener('click',e=>{const sw=document.getElementById('user-switcher');if(sw&&!e.target.closest('#user-switcher')&&!e.target.closest('#user-avatar')&&)sw.classList.remove('open');});

async function switchUser(username){CLOUD.user=username;localStorage.setItem('nassa_user',username);const av=document.getElementById('user-avatar');if(av)av.textContent=username.slice(0,2).toUpperCase();document.getElementById('user-switcher')?.classList.remove('open');await loadFromCloud();}

async function loadFromCloud(){const result=await CLOUD.load();if(result?.data){CLOUD.apply(result.data);feedClientIdx=-1;feedAccountIdx=-1;feedMonth='';storiesClientIdx=-1;storiesAccountIdx=-1;storiesMonth='';previewClientIdx=-1;previewAccountIdx=-1;previewMonth='';renderStudio();rebuildAllSelects();rebuildGlobalClientSelect();renderFeedGrid();renderStoriesGrid();updateFeedHeader();updateStoriesHeader();showToast('✓ Dati caricati dal cloud');}else{CLOUD.setStatus('idle');}}

function autoSave(){CLOUD.scheduleSave(()=>CLOUD.snapshot());}

/* INIT */
function init(){
  const fdz=document.getElementById('feed-drop-zone');if(fdz){fdz.addEventListener('dragover',e=>{e.preventDefault();fdz.classList.add('drag-over');});fdz.addEventListener('dragleave',e=>{if(!fdz.contains(e.relatedTarget))fdz.classList.remove('drag-over');});fdz.addEventListener('drop',e=>{e.preventDefault();fdz.classList.remove('drag-over');queueFeedFiles(e.dataTransfer.files);});}
  const sdz=document.getElementById('stories-drop-zone');if(sdz){sdz.addEventListener('dragover',e=>{e.preventDefault();sdz.classList.add('drag-over');});sdz.addEventListener('dragleave',e=>{if(!sdz.contains(e.relatedTarget))sdz.classList.remove('drag-over');});sdz.addEventListener('drop',e=>{e.preventDefault();sdz.classList.remove('drag-over');queueStoryFiles(e.dataTransfer.files);});}
  const cuzEl=document.getElementById('c-upload-zone');if(cuzEl){cuzEl.addEventListener('dragover',e=>{e.preventDefault();cuzEl.classList.add('drag-over');});cuzEl.addEventListener('dragleave',()=>cuzEl.classList.remove('drag-over'));cuzEl.addEventListener('drop',e=>{e.preventDefault();cuzEl.classList.remove('drag-over');addCarouselFiles(e.dataTransfer.files);});}
  const hluz=document.getElementById('hl-upload-zone');if(hluz){hluz.addEventListener('dragover',e=>{e.preventDefault();hluz.classList.add('drag-over');});hluz.addEventListener('dragleave',()=>hluz.classList.remove('drag-over'));hluz.addEventListener('drop',e=>{e.preventDefault();hluz.classList.remove('drag-over');setHlCover(e.dataTransfer.files);});}
  renderStudio();rebuildAllSelects();renderFeedGrid();renderStoriesGrid();updateFeedHeader();updateStoriesHeader();
}

document.addEventListener('DOMContentLoaded',async()=>{
  init();const av=document.getElementById('user-avatar');if(av)av.textContent=CLOUD.user.slice(0,2).toUpperCase();
  await loadFromCloud();
});
