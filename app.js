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
  _booting: false,

  async load() {
    try {
      CLOUD.setStatus('loading');
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 15000);
      const res = await fetch(`${CLOUD.apiUrl}?user=${CLOUD.user}`, {
        headers: { 'x-nassa-key': CLOUD.apiKey },
        signal: controller.signal
      });
      clearTimeout(timeout);
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const { data, updatedAt } = await res.json();
      if (data) { CLOUD.setStatus('saved'); return { data, updatedAt }; }
      CLOUD.setStatus('idle'); return null;
    } catch(e) {
      if (e.name === 'AbortError') {
        console.warn('[CLOUD] Load timeout — retrying once...');
        try {
          CLOUD.setStatus('loading');
          const res2 = await fetch(`${CLOUD.apiUrl}?user=${CLOUD.user}`, { headers: { 'x-nassa-key': CLOUD.apiKey } });
          if (!res2.ok) throw new Error('HTTP ' + res2.status);
          const { data, updatedAt } = await res2.json();
          if (data) { CLOUD.setStatus('saved'); return { data, updatedAt }; }
          CLOUD.setStatus('idle'); return null;
        } catch(e2) { CLOUD.setStatus('error'); return null; }
      }
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
      clients, feeds, stories, highlights, pedPlans, notesData, pilastri, adsCampaigns,
      meta: { showAllDates, showAllCopy, pedFreqDays: Array.from(pedFreqDays) } };
  },

  apply(data) {
    if (!data) return;
    clients = data.clients || [];
    adsCampaigns = data.adsCampaigns || {};
    clients.forEach(c => { if(!c.accounts) c.accounts=[]; if(!c.id) c.id='c_'+Date.now(); });
    feeds = {};
    Object.keys(data.feeds||{}).forEach(k => {
      feeds[k] = (data.feeds[k]||[]).map(item => {
        const hasUrl = item.externalUrl&&item.externalUrl.startsWith('http');
        return {
          ...item,
          // Fix type: if pending but has a valid URL, restore as image
          type: (item.type==='pending' && hasUrl) ? 'image' : item.type,
          url: hasUrl ? item.externalUrl : '',
          needsReload: !hasUrl && !!item.name,
          // Restore slide URLs from externalUrl
          slides: (item.slides||[]).map(s=>({...s, url:(s.externalUrl&&s.externalUrl.startsWith('http'))?s.externalUrl:s.url||''}))
        };
      });
    });
    stories = {};
    Object.keys(data.stories||{}).forEach(k => {
      stories[k] = (data.stories[k]||[]).map(st => ({
        ...st,
        url: (st.externalUrl&&st.externalUrl.startsWith('http')) ? st.externalUrl : '',
        // Restore storyboard slide URLs
        slides: (st.slides||[]).map(s=>({...s, url:(s.externalUrl&&s.externalUrl.startsWith('http'))?s.externalUrl:s.url||''}))
      }));
    });
    highlights = data.highlights || {};
    pedPlans   = data.pedPlans   || {};
    notesData  = data.notesData  || {};
    pilastri   = data.pilastri   || {};
    if (data.meta) {
      showAllDates = data.meta.showAllDates !== false;
      showAllCopy  = data.meta.showAllCopy  !== false;
      if (Array.isArray(data.meta.pedFreqDays)) pedFreqDays = new Set(data.meta.pedFreqDays);
    }
  }
};

/* ══════════════════════════════════════════
   DROPBOX UPLOAD — via /api/dropbox-upload
   Uses DROPBOX_APP_KEY, DROPBOX_APP_SECRET, DROPBOX_REFRESH_TOKEN
   All three are Vercel env vars — never sent to browser.
══════════════════════════════════════════ */
const DROPBOX = {
  uploading: 0,
  async upload(file, destPath) {
    DROPBOX.uploading++;
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
      DROPBOX.uploading=Math.max(0,DROPBOX.uploading-1);
      return data.shared_link || data.url || null;
    } catch(e) {
      console.warn('[DROPBOX] Upload failed:', e.message);
      if (bar) bar.classList.remove('visible');
      DROPBOX.uploading=Math.max(0,DROPBOX.uploading-1);
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

/* Platform → format mapping */
const PLATFORM_FORMAT = {
  'Instagram':  {ratio:'4/5', label:'Instagram · 4:5',  cols:4, cssRatio:'4/5'},
  'Facebook':   {ratio:'1/1', label:'Facebook · 1:1',   cols:4, cssRatio:'1/1'},
  'LinkedIn':   {ratio:'1/1', label:'LinkedIn · 1:1',   cols:4, cssRatio:'1/1'},
  'YouTube':    {ratio:'16/9',label:'YouTube · 16:9',   cols:3, cssRatio:'16/9'},
  'TikTok':     {ratio:'9/16',label:'TikTok · 9:16',    cols:5, cssRatio:'9/16'},
  'Altro':      {ratio:'4/5', label:'4:5',              cols:4, cssRatio:'4/5'},
};
function getPlatformFormat(){
  const acc=getAccount(feedClientIdx,feedAccountIdx);
  return PLATFORM_FORMAT[acc?.platform]||PLATFORM_FORMAT['Instagram'];
}
function updateFeedFormat(){
  const fmt=getPlatformFormat();
  // Update badge
  const badge=document.getElementById('feed-fmt-badge');
  if(badge)badge.textContent=fmt.label;
  // Update grid columns and cell aspect ratio
  const grid=document.getElementById('feed-grid');
  if(grid){
    grid.style.gridTemplateColumns='repeat('+fmt.cols+',1fr)';
    // Update CSS variable for cell aspect ratio
    grid.style.setProperty('--cell-ratio',fmt.cssRatio);
  }
  // Update cell-wrap aspect ratio via CSS var
  document.documentElement.style.setProperty('--feed-cell-ratio',fmt.cssRatio);
}

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
  // Reset file input so same file can be re-selected
  const inp=document.getElementById('feed-file-input');if(inp)inp.value='';
  const filesArr=Array.from(files);
  // Add all new items first, then upload each one
  const items=currentFeedItems();
  const newItems=filesArr.map(f=>({
    type:detectType(f)==='video'?'video':'pending',
    url:URL.createObjectURL(f),name:f.name,
    date:'',showDate:false,copy:'',linkedStories:[],slides:[],mimeType:f.type,
    _uploadId: f.name+'_'+Date.now() // unique id to track this specific upload
  }));
  setFeedItems([...newItems,...items]);refreshFeed();
  // Upload each file to Dropbox sequentially to avoid race conditions
  (async()=>{
    for(const f of filesArr){
      const destPath='/nassa/'+CLOUD.user+'/'+(feedMonth||'misc')+'/'+f.name;
      const sharedUrl=await DROPBOX.upload(f,destPath);
      if(sharedUrl){
        const arr=currentFeedItems();
        // Find by name AND no externalUrl yet (not yet uploaded)
        const match=arr.findIndex(it=>it.name===f.name&&!it.externalUrl);
        if(match>=0){
          // FIX 4: revoke the local blob URL now that remote URL is confirmed
          if(arr[match].url&&arr[match].url.startsWith('blob:')) URL.revokeObjectURL(arr[match].url);
          arr[match].externalUrl=sharedUrl;arr[match].url=sharedUrl;
          arr[match].isExternalLink=true;arr[match].linkSource='dropbox';
          arr[match].needsReload=false;delete arr[match]._uploadId;
        }
        setFeedItems(arr);refreshFeed()
      }
    }
  })();
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
  const inp=document.getElementById('stories-file-input');if(inp)inp.value='';
  const filesArr=Array.from(files);
  const arr=currentStoryItems();
  const newItems=filesArr.map(f=>({type:detectType(f),url:URL.createObjectURL(f),name:f.name,date:'',note:'',isStoryboard:false,slides:[]}));
  setStoryItems([...newItems,...arr]);refreshStories();
  (async()=>{
    for(const f of filesArr){
      const destPath='/nassa/'+CLOUD.user+'/stories/'+(storiesMonth||'misc')+'/'+f.name;
      const sharedUrl=await DROPBOX.upload(f,destPath);
      if(sharedUrl){const a=currentStoryItems();const match=a.findIndex(it=>it.name===f.name&&!it.externalUrl);if(match>=0){
        // FIX 4: revoke blob after remote URL confirmed
        if(a[match].url&&a[match].url.startsWith('blob:'))URL.revokeObjectURL(a[match].url);
        a[match].externalUrl=sharedUrl;a[match].url=sharedUrl;a[match].isExternalLink=true;a[match].needsReload=false;}setStoryItems(a);refreshStories();}
    }
  })();
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
function needsReloadPh(icon,name,reuploadFn){
  const ph=document.createElement('div');ph.className='needs-reload-ph';
  ph.innerHTML=`<div class="nr-icon">${icon}</div><div class="nr-name">${name||'file'}</div><div class="nr-label">ricarica media</div>`;
  if(reuploadFn){
    const inp=document.createElement('input');inp.type='file';inp.accept='image/*,video/*';
    inp.style.cssText='position:absolute;inset:0;opacity:0;cursor:pointer;width:100%;height:100%;';
    inp.onchange=e=>{if(e.target.files[0])reuploadFn(e.target.files[0]);};
    const btn=document.createElement('div');btn.className='nr-reupload';btn.textContent='↑ Ricarica file';
    ph.appendChild(btn);ph.appendChild(inp);ph.style.cursor='pointer';
  }
  return ph;
}


/* TAB SWITCHING */
function switchTab(tab){
  currentTab=tab;
  const allTabs=['studio','notes','pilastri','feed','stories','ped','cal','preview','ads'];
  allTabs.forEach(t=>{
    const te=document.getElementById('tab-'+t);if(te)te.classList.toggle('active',t===tab);
    const st=document.getElementById('sub-tab-'+t);if(st)st.classList.toggle('active',t===tab);
    const pe=document.getElementById('page-'+t);if(pe)pe.classList.toggle('active',t===tab);
    const si=document.getElementById('si-'+t);if(si)si.classList.toggle('active',t===tab);
    // Update main nav icon sidebar
    const sn=document.getElementById('si-'+t);if(sn)sn.classList.toggle('active',t===tab);
  });
  const subt=document.getElementById('subtopbar');if(subt)subt.classList.toggle('visible',tab!=='studio');
  const sStudio=document.getElementById('sidebar-studio');const sAdd=document.getElementById('sidebar-studio-add');const sFeed=document.getElementById('sidebar-feed');const sSt=document.getElementById('sidebar-stories');
  if(sStudio)sStudio.style.display='none';if(sAdd)sAdd.style.display='none';if(sFeed)sFeed.style.display='none';if(sSt)sSt.style.display='none';
  if(tab==='studio'){renderStudio();updateGlobalClientUI();}else{renderAccSwitcher();}
  if(tab==='notes'){if(notesClientIdx<0&&globalClientIdx>=0)notesClientIdx=globalClientIdx;rebuildNotesSelects();renderNotesEditor();}
  if(tab==='feed'){if(feedClientIdx<0&&globalClientIdx>=0){feedClientIdx=globalClientIdx;feedAccountIdx=clients[globalClientIdx]?.accounts?.length>=1?0:-1;}rebuildFeedSelects();renderFeedMonthPills();renderFeedGrid();updateFeedHeader();updateFeedFormat();}
  if(tab==='stories'){if(storiesClientIdx<0){storiesClientIdx=globalClientIdx>=0?globalClientIdx:feedClientIdx;storiesAccountIdx=storiesClientIdx>=0&&clients[storiesClientIdx]?.accounts?.length>=1?0:-1;storiesMonth=feedMonth||MONTH_OPTIONS[new Date().getMonth()];}rebuildStoriesSelects();renderStoriesMonthPills();renderStoriesGrid();updateStoriesHeader();renderAccSwitcher();}
  if(tab==='ped'){
    // BUG #1 FIX: sync feedClientIdx/Month from globalClientIdx if not set
    // UGC uses currentClientIdx (alias feedClientIdx) and currentMonth (alias feedMonth)
    if(feedClientIdx<0&&globalClientIdx>=0){
      feedClientIdx=globalClientIdx;
      feedAccountIdx=clients[globalClientIdx]?.accounts?.length>0?0:-1;
    }
    if(!feedMonth)feedMonth=MONTH_OPTIONS[new Date().getMonth()];
    if(typeof renderPED==='function')renderPED();
  }
  if(tab==='pilastri'){renderPilastri();}
  if(tab==='cal'){if(typeof renderCalendar==='function')renderCalendar();}
  if(tab==='preview'){if(previewClientIdx<0&&globalClientIdx>=0){previewClientIdx=globalClientIdx;previewAccountIdx=clients[globalClientIdx]?.accounts?.length>=1?0:-1;}syncPreviewSelectors();renderPreview();}
}
function showStudioAdd(){openModal('add-client-modal');rebuildStudioAccountSelect();}
function backToClients(){switchTab('studio');}

/* CLIENT MANAGEMENT */
function addClient(){
  const name=document.getElementById('nc-name').value.trim();if(!name){document.getElementById('nc-name').focus();return;}
  if(clients.find(c=>c.name.toLowerCase()===name.toLowerCase())){showToast('Cliente già presente','warn');return;}
  const id='c_'+Date.now();const defaultAccount={id:'a_'+Date.now(),name,platform:'Instagram'};const defaultBrand={primary:'#1a3c5e',secondary:'#c8a96e',bg:'#f5f0e8',text:'#111111'};
  clients.push({id,name,pkg:document.getElementById('nc-pkg').value,status:document.getElementById('nc-status').value,revenue:parseFloat(document.getElementById('nc-revenue').value)||0,accounts:[defaultAccount]});
  document.getElementById('nc-name').value='';document.getElementById('nc-revenue').value='';
  renderStudio();rebuildAllSelects();rebuildGlobalClientSelect();showToast('✓ Cliente aggiunto');autoSave();
  // Return to client list automatically
  closeModal('add-client-modal');
}
function addAccount(){const ci=parseInt(document.getElementById('na-client').value);if(isNaN(ci)||ci<0){showToast('Seleziona un cliente','warn');return;}const name=document.getElementById('na-name').value.trim();if(!name){document.getElementById('na-name').focus();return;}const platform=document.getElementById('na-platform').value;const id='a_'+Date.now();clients[ci].accounts.push({id,name,platform});document.getElementById('na-name').value='';renderStudio();rebuildAllSelects();showToast('✓ Account aggiunto');autoSave();}
function removeClient(i){if(!confirm('Rimuovere '+clients[i].name+' e tutti i suoi dati?'))return;clients[i].accounts.forEach(acc=>{// Delete ALL years of data, not just current MONTH_OPTIONS
Object.keys(feeds).filter(k=>k.startsWith(acc.id+'|||')).forEach(k=>delete feeds[k]);Object.keys(stories).filter(k=>k.startsWith(acc.id+'|||')).forEach(k=>delete stories[k]);delete highlights[acc.id];});// Delete PED plans and notes for this client
Object.keys(pedPlans).filter(k=>k.startsWith(clients[i].name+'|||')).forEach(k=>delete pedPlans[k]);Object.keys(notesData).filter(k=>k.startsWith(clients[i].name+'|||')).forEach(k=>delete notesData[k]);if(feedClientIdx===i){feedClientIdx=-1;feedAccountIdx=-1;feedMonth='';renderFeedGrid();}else if(feedClientIdx>i)feedClientIdx--;clients.splice(i,1);renderStudio();rebuildAllSelects();autoSave();}
function openClientFeed(ci){globalClientIdx=ci;feedClientIdx=ci;feedAccountIdx=clients[ci].accounts.length>0?0:-1;storiesClientIdx=ci;storiesAccountIdx=feedAccountIdx;notesClientIdx=ci;if(!feedMonth)feedMonth=MONTH_OPTIONS[new Date().getMonth()];if(!storiesMonth)storiesMonth=feedMonth;updateGlobalClientUI();switchTab('feed');rebuildFeedSelects();renderFeedMonthPills();renderFeedGrid();updateFeedHeader();renderAccSwitcher();}
function openAccountFeed(ci,aid){globalClientIdx=ci;feedClientIdx=ci;feedAccountIdx=clients[ci].accounts.findIndex(a=>a.id===aid);storiesClientIdx=ci;storiesAccountIdx=feedAccountIdx;notesClientIdx=ci;if(!feedMonth)feedMonth=MONTH_OPTIONS[new Date().getMonth()];if(!storiesMonth)storiesMonth=feedMonth;updateGlobalClientUI();switchTab('feed');rebuildFeedSelects();renderFeedMonthPills();renderFeedGrid();updateFeedHeader();renderAccSwitcher();}

function renderStudio(){
  const active=clients.filter(c=>c.status==='Attivo');const totalRev=active.reduce((s,c)=>s+c.revenue,0);const totalAccounts=clients.reduce((s,c)=>s+(c.accounts?.length||0),0);const el=v=>document.getElementById(v);
  if(el('kpi-revenue'))el('kpi-revenue').textContent='€ '+totalRev.toLocaleString('it-IT');if(el('kpi-active'))el('kpi-active').textContent=active.length;if(el('kpi-accounts'))el('kpi-accounts').textContent=totalAccounts;if(el('kpi-rev-sub'))el('kpi-rev-sub').textContent='da '+active.length+(active.length===1?' cliente attivo':' clienti attivi');
  const countTxt=clients.length+' client'+(clients.length===1?'e':'i');if(el('studio-count'))el('studio-count').textContent=countTxt;
  const tbody=document.getElementById('clients-tbody');if(!tbody)return;tbody.innerHTML='';
  if(!clients.length){tbody.innerHTML='<tr><td colspan="6" style="text-align:center;color:var(--text-3);padding:24px;font-size:12px;">Nessun cliente. Aggiungine uno dal pannello.</td></tr>';return;}
  clients.forEach((c,i)=>{const dotCls={Attivo:'green','In onboarding':'blue','In pausa':'amber',Perso:'red'}[c.status]||'green';const accs=c.accounts||[];const accsHtml=accs.length===0?'<span style="color:var(--text-3);font-size:11px;">—</span>':accs.length===1&&accs[0].name===c.name?`<span class="feed-chip" onclick="openClientFeed(${i})" style="color:#111;border-color:var(--green-mid);">Feed →</span>`:accs.map(a=>`<span class="feed-chip" onclick="openAccountFeed(${i},'${a.id}')" title="${a.platform}">${a.name} →</span>`).join(' ');const tr=document.createElement('tr');tr.innerHTML=`<td style="font-weight:500;">${c.name}</td><td style="font-size:11px;">${accsHtml}</td><td><span class="pkg-badge">${c.pkg}</span></td><td><span class="status-dot"><span class="dot ${dotCls}"></span>${c.status}</span></td><td class="muted">€ ${c.revenue.toLocaleString('it-IT')}</td><td><div class="tr-actions"><button class="btn sm" onclick="openEditClientModal(${i})">✎ Modifica</button><button class="btn sm danger" onclick="removeClient(${i})">🗑 Elimina</button></div></td>`;tbody.appendChild(tr);});
}

/* SELECTS */
function rebuildAllSelects(){rebuildFeedSelects();rebuildStoriesSelects();rebuildPreviewSelects();rebuildStudioAccountSelect();rebuildNotesSelects();}
function populateClientSelect(selId,currentCi){const sel=document.getElementById(selId);if(!sel)return;sel.innerHTML='<option value="">— Cliente —</option>';clients.forEach((c,i)=>{const o=document.createElement('option');o.value=i;o.textContent=c.name;sel.appendChild(o);});if(currentCi>=0)sel.value=currentCi;}
function populateAccountSelect(selId,clientIdx,currentAi){
  const sel=document.getElementById(selId);if(!sel)return;
  const cl=clients[clientIdx];const accs=cl?.accounts||[];
  if(clientIdx<0||!accs.length){sel.style.display='none';return;}
  // OPZIONE A: 1 account → nasconde selector, auto-seleziona
  if(accs.length===1){
    sel.style.display='none';
    // Auto-select the only account if not set
    if(selId==='feed-account-sel'&&feedAccountIdx<0)feedAccountIdx=0;
    if(selId==='stories-account-sel'&&storiesAccountIdx<0)storiesAccountIdx=0;
    return;
  }
  // 2+ account → mostra selector con solo piattaforma/nome
  sel.style.display='';sel.innerHTML='';
  accs.forEach((a,i)=>{
    const o=document.createElement('option');o.value=i;
    o.textContent=a.name===cl.name?a.platform:a.name+' · '+a.platform;
    sel.appendChild(o);
  });
  if(currentAi>=0)sel.value=currentAi;
}
function rebuildFeedSelects(){
  // Client fixed from global context — only populate account selector
  populateClientSelect('feed-client-sel',feedClientIdx); // hidden, JS compat
  populateAccountSelect('feed-account-sel',feedClientIdx,feedAccountIdx);
}
function rebuildStoriesSelects(){
  // Keep hidden client select in sync
  populateClientSelect('stories-client-sel',storiesClientIdx);
  // Account selector only
  populateAccountSelect('stories-account-sel',storiesClientIdx,storiesAccountIdx);
}
function rebuildPreviewSelects(){
  const msel=document.getElementById('preview-month-sel');if(!msel)return;
  if(previewAccountIdx<0){msel.style.display='none';return;}
  // Build month list from actual data across ALL years
  const cl=clients[previewClientIdx>=0?previewClientIdx:globalClientIdx];
  const acc=cl?.accounts?.[previewActiveAcc]||cl?.accounts?.[0];
  let months=[];
  if(acc){
    const prefix=acc.id+'|||';
    const feedMonths=Object.keys(feeds).filter(k=>k.startsWith(prefix)&&(feeds[k]||[]).filter(i=>i.type!=='pending').length>0).map(k=>k.replace(prefix,''));
    const storyMonths=Object.keys(stories).filter(k=>k.startsWith(prefix)&&(stories[k]||[]).length>0).map(k=>k.replace(prefix,''));
    months=[...new Set([...feedMonths,...storyMonths])].sort((a,b)=>{
      const pa=a.split(' ');const pb=b.split(' ');
      const ya=parseInt(pa[1])||0;const yb=parseInt(pb[1])||0;
      if(ya!==yb)return ya-yb;
      return MONTHS.indexOf(pa[0])-MONTHS.indexOf(pb[0]);
    });
  }
  if(!months.length)months=MONTH_OPTIONS; // fallback
  msel.style.display='';msel.innerHTML='';
  months.forEach(m=>{const o=document.createElement('option');o.value=m;o.textContent=m;msel.appendChild(o);});
  if(previewMonth&&months.includes(previewMonth))msel.value=previewMonth;
  else if(months.length){msel.value=months[months.length-1];previewMonth=msel.value;}
}
function rebuildStudioAccountSelect(){const sel=document.getElementById('na-client');if(!sel)return;sel.innerHTML='<option value="">— seleziona —</option>';clients.forEach((c,i)=>{const o=document.createElement('option');o.value=i;o.textContent=c.name;sel.appendChild(o);});}

/* FEED SELECTORS */
function onFeedClientChange(){const v=document.getElementById('feed-client-sel').value;feedClientIdx=v===''?-1:parseInt(v);feedAccountIdx=-1;populateAccountSelect('feed-account-sel',feedClientIdx,-1);if(!feedMonth)feedMonth=MONTH_OPTIONS[new Date().getMonth()];renderFeedMonthPills();renderFeedGrid();updateFeedHeader();}
function onFeedAccountChange(){const v=document.getElementById('feed-account-sel').value;feedAccountIdx=v===''?-1:parseInt(v);if(!feedMonth)feedMonth=MONTH_OPTIONS[new Date().getMonth()];renderFeedMonthPills();renderFeedGrid();updateFeedHeader();}
function renderFeedMonthPills(){const c=document.getElementById('feed-month-pills')||document.querySelector('.feed-month-pills-inline');if(!c)return;c.innerHTML='';if(feedAccountIdx<0)return;let pillYear=CUR_YEAR;if(feedMonth){const y=parseInt(feedMonth.split(' ').pop());if(!isNaN(y))pillYear=y;}const ynav=document.createElement('div');ynav.className='year-nav';const prev=document.createElement('button');prev.className='year-nav-btn';prev.textContent='‹';prev.onclick=()=>{pillYear--;CUR_YEAR=pillYear;MONTH_OPTIONS=monthsForYear(pillYear);renderFeedMonthPills();};const lbl=document.createElement('span');lbl.className='year-label';lbl.textContent=pillYear;const next=document.createElement('button');next.className='year-nav-btn';next.textContent='›';next.onclick=()=>{pillYear++;CUR_YEAR=pillYear;MONTH_OPTIONS=monthsForYear(pillYear);renderFeedMonthPills();};ynav.appendChild(prev);ynav.appendChild(lbl);ynav.appendChild(next);c.appendChild(ynav);const pillsWrap=document.createElement('div');pillsWrap.className='month-pills';monthsForYear(pillYear).forEach(m=>{const p=document.createElement('button');p.className='month-pill'+(m===feedMonth?' active':'');p.textContent=m.slice(0,3);p.onclick=()=>{feedMonth=m;renderFeedMonthPills();renderFeedGrid();updateFeedHeader();};pillsWrap.appendChild(p);});c.appendChild(pillsWrap);}

/* STORIES SELECTORS */
function onStoriesClientChange(){const v=document.getElementById('stories-client-sel').value;storiesClientIdx=v===''?-1:parseInt(v);storiesAccountIdx=-1;populateAccountSelect('stories-account-sel',storiesClientIdx,-1);if(!storiesMonth)storiesMonth=MONTH_OPTIONS[new Date().getMonth()];renderStoriesMonthPills();renderStoriesGrid();updateStoriesHeader();}
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
  const grid=document.getElementById('feed-grid');if(!grid)return;grid.innerHTML='';updateFeedFormat();
  // FIX 5: drag delegation — listeners attached once to grid, not per-cell
  // (removed at innerHTML='' above, re-added here)
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
        if(item.needsReload&&!item.url){
          const _icon=item.type==='video'?'▶':item.type==='carousel'?'❏❏':'🖼';
          const _rfn=async(file)=>{
            const destPath='/nassa/'+CLOUD.user+'/'+(feedMonth||'misc')+'/'+file.name;
            showToast('⟳ Caricamento…');
            const url=await DROPBOX.upload(file,destPath);
            if(url){currentFeedItems()[idx].url=url;currentFeedItems()[idx].externalUrl=url;currentFeedItems()[idx].isExternalLink=true;currentFeedItems()[idx].needsReload=false;if(currentFeedItems()[idx].type==='pending')currentFeedItems()[idx].type='image';setFeedItems(currentFeedItems());refreshFeed();showToast('✓ Media ricaricato');}
            else showToast('Errore upload','warn');
          };
          const ph=needsReloadPh(_icon,item.name,_rfn);
          // Give the file input highest z-index so overlay never blocks it
          ph.style.zIndex='10';
          cell.appendChild(ph);
          // For needsReload: only show delete button, NO full overlay (would block reupload)
          const delOnly=document.createElement('div');delOnly.className='nr-del-btn';
          delOnly.innerHTML='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/></svg>';delOnly.title='Rimuovi';
          delOnly.onclick=e=>{e.stopPropagation();removeFeedItem(idx);};
          cell.appendChild(delOnly);
        }
        else if(item.type==='video'){const v=makeMedia(item.url,'video');v.onerror=()=>{cell.appendChild(needsReloadPh('▶',item.name));};cell.addEventListener('mouseenter',()=>v.play().catch(()=>{}));cell.addEventListener('mouseleave',()=>{v.pause();v.currentTime=0;});cell.appendChild(v);}
        else{const img=makeMedia(coverUrl,'image');img.onerror=()=>{img.style.display='none';cell.appendChild(needsReloadPh('🖼',item.name));};cell.appendChild(img);}
        // drag via event delegation — mark the cell
        cell.draggable=true;
        cell.dataset.dragIdx=idx;

        // SVG icons as strings
        const SVG_DOTS='<svg viewBox="0 0 24 24" width="14" height="14"><circle cx="9" cy="5" r="1.2" fill="#fff"/><circle cx="9" cy="12" r="1.2" fill="#fff"/><circle cx="9" cy="19" r="1.2" fill="#fff"/><circle cx="15" cy="5" r="1.2" fill="#fff"/><circle cx="15" cy="12" r="1.2" fill="#fff"/><circle cx="15" cy="19" r="1.2" fill="#fff"/></svg>';
        const SVG_CAL='<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>';

        // ── Editorial card background ──
        const badge=document.createElement('div');
        if(item.type==='editorial'){
          const cols=item.editorialColors||{bg:'#f5f0e8',text:'#111',accent:'#1a3c5e',logo:'#0dff00',logoText:'#111'};
          cell.style.background=cols.bg;cell.style.color=cols.text;cell.style.aspectRatio=_fmt.cssRatio;
          const titleHtml=item.editorialAccent&&item.editorialTitle?.includes(item.editorialAccent)
            ?item.editorialTitle.replace(item.editorialAccent,`<span style="color:${cols.accent};">${item.editorialAccent}</span>`)
            :item.editorialTitle||'';
          const cardInner=document.createElement('div');
          cardInner.style.cssText='position:absolute;inset:0;padding:12px 11px 44px;display:flex;flex-direction:column;font-family:var(--font);';
          cardInner.innerHTML=`<div style="font-size:11px;font-weight:700;letter-spacing:.8px;text-transform:uppercase;opacity:.45;margin-bottom:6px;">${item.editorialEyebrow||''}</div><div style="font-weight:800;line-height:1.1;letter-spacing:-1px;font-size:17px;flex:1;">${titleHtml}</div><div style="height:1px;background:currentColor;opacity:.15;margin:6px 0;"></div><div style="font-size:11px;opacity:.55;line-height:1.4;">${(item.editorialCopy||'').slice(0,80)}</div>`;
          cell.appendChild(cardInner);
          badge.className='cell-badge editorial';
          badge.innerHTML='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>Card';
        } else {
          badge.className='cell-badge '+(item.type||'pending');
          badge.innerHTML={
            image:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>Foto',
            video:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polygon points="5 3 19 12 5 21 5 3"/></svg>Reel',
            carousel:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="6" width="14" height="14" rx="2"/><path d="M22 6h-2a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2"/></svg>Caros.'+(item.slides?.length?' '+item.slides.length:''),
          }[item.type]||'—';
        }

        // ── TOP BAR: drag + number + badge, in a flex row with gradient ──
        const topBar=document.createElement('div');topBar.className='cell-top-bar';
        const handle=document.createElement('div');handle.className='drag-handle';handle.innerHTML=SVG_DOTS;
        const num=document.createElement('span');num.className='cell-num';num.textContent=i+1;
        topBar.appendChild(handle);topBar.appendChild(num);topBar.appendChild(badge);
        cell.appendChild(topBar);

        // Extra badges
        if(item.isExternalLink){const d=document.createElement('div');d.className='cell-url-dot';d.title=(item.linkSource==='dropbox'?'Dropbox':item.linkSource==='frame'?'Frame.io':'Link')+': '+(item.externalUrl||'');cell.appendChild(d);}
        if((item.linkedStories||[]).length>0){const lb=document.createElement('div');lb.className='ls-badge-cell';lb.textContent='📱 '+item.linkedStories.length;cell.appendChild(lb);}

        // ── BOTTOM BAR: date with gradient, always at bottom ──
        const showDate=showAllDates&&item.showDate;
        const db=document.createElement('div');db.className='date-bar'+(showDate?'':' hidden-bar');
        const calWrap=document.createElement('span');calWrap.innerHTML=SVG_CAL;calWrap.style.cssText='display:flex;align-items:center;flex-shrink:0;';
        const di=document.createElement('input');di.className='date-input';di.type='text';di.value=item.date||'';di.placeholder='data…';
        di.onclick=e=>{e.stopPropagation();openDatePicker(idx,cell);};
        di.oninput=e=>{currentFeedItems()[idx].date=e.target.value;};
        const dt=document.createElement('button');dt.className='date-toggle';dt.textContent=item.showDate?'✓':'✕';
        dt.onclick=e=>{e.stopPropagation();currentFeedItems()[idx].showDate=!currentFeedItems()[idx].showDate;renderFeedGrid();};
        db.appendChild(calWrap);db.appendChild(di);db.appendChild(dt);cell.appendChild(db);

        // Date add button (hover, no date set)
        const dpTrigger=document.createElement('button');dpTrigger.className='date-add-btn dp-trigger-btn';
        const calWrap2=document.createElement('span');calWrap2.innerHTML=SVG_CAL;calWrap2.style.cssText='display:flex;align-items:center;';
        dpTrigger.appendChild(calWrap2);dpTrigger.appendChild(document.createTextNode(item.date?' '+item.date.split(' ').slice(1).join(' '):'+ data'));
        dpTrigger.onclick=e=>{e.stopPropagation();openDatePicker(idx,cell);};cell.appendChild(dpTrigger);

        // ── OVERLAY: bottom sheet inside the cell ──
        const ov=document.createElement('div');ov.className='cell-overlay';
        const sheet=document.createElement('div');sheet.className='ov-sheet';
        const mkBtn=(cls,svgPath,label,fn)=>{
          const b=document.createElement('button');b.className='ov-btn '+cls;
          b.innerHTML='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">'+svgPath+'</svg>'+label;
          b.onclick=e=>{e.stopPropagation();fn();};return b;
        };
        const mkDiv=()=>{const d=document.createElement('div');d.className='ov-divider';return d;};
        if(item.type==='carousel'){
          sheet.appendChild(mkBtn('ob-slide','<rect x="2" y="6" width="14" height="14" rx="2"/><path d="M22 6h-2a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2"/>','Modifica slide',()=>openCarouselModal(idx)));
          sheet.appendChild(mkDiv());
        }
        sheet.appendChild(mkBtn('ob-stories','<rect x="7" y="2" width="10" height="20" rx="2"/>',((item.linkedStories||[]).length>0?'Stories ('+item.linkedStories.length+')':'Collega stories'),()=>openLinkStoriesModal(idx)));
        sheet.appendChild(mkDiv());
        sheet.appendChild(mkBtn('ob-copy','<rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>','Copia da…',()=>openCopyModal('feed')));
        sheet.appendChild(mkDiv());
        sheet.appendChild(mkBtn('ob-delete','<polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/>','Rimuovi',()=>removeFeedItem(idx)));
        ov.appendChild(sheet);cell.appendChild(ov);wrap.appendChild(cell);
        const cp=document.createElement('div');cp.className='copy-panel';cp.style.display=showAllCopy?'':'none';
        const cph=document.createElement('div');cph.className='copy-panel-header';const cl=document.createElement('div');cl.className='copy-label';cl.textContent='Caption';const expBtn=document.createElement('button');expBtn.className='copy-expand-btn';expBtn.textContent='▾';cph.appendChild(cl);cph.appendChild(expBtn);
        const cpanel_body=document.createElement('div');cpanel_body.className='copy-body';const ct=document.createElement('textarea');ct.placeholder='Scrivi la caption…';ct.value=item.copy||'';ct.rows=3;ct.oninput=e=>{currentFeedItems()[idx].copy=e.target.value;const prev=cp.querySelector('.copy-preview');if(prev){prev.textContent=e.target.value||'';prev.classList.toggle('empty',!e.target.value);}};cpanel_body.appendChild(ct);
        const prev=document.createElement('div');prev.className='copy-preview'+(item.copy?'':' empty');prev.textContent=item.copy||'Caption…';
        const toggleCopy=()=>{
          const open=expBtn.classList.toggle('open');
          cpanel_body.classList.toggle('open',open);
          prev.style.display=open?'none':'block';
          if(open)setTimeout(()=>ct.focus(),0);
        };
        cph.onclick=toggleCopy;prev.onclick=toggleCopy;
        // If item already has copy, start expanded
        if(item.copy){cpanel_body.classList.add('open');expBtn.classList.add('open');prev.style.display='none';}
        cp.appendChild(cph);cp.appendChild(prev);cp.appendChild(cpanel_body);wrap.appendChild(cp);
      }
    } else if(i===items.length){cell.classList.add('empty-slot');addEmptyFeedListeners(cell);const sp=document.createElement('span');sp.textContent='+ aggiungi';cell.appendChild(sp);wrap.appendChild(cell);}
    else{cell.classList.add('empty-slot');addEmptyFeedListeners(cell);wrap.appendChild(cell);}
    grid.appendChild(wrap);
  }
  // FIX 5: Attach drag events ONCE on grid via delegation (not per-cell)
  // This replaces N*4 listeners with just 4 total
  grid.addEventListener('dragstart',e=>{
    const cell=e.target.closest('[data-drag-idx]');if(!cell)return;
    feedDragSrc=parseInt(cell.dataset.dragIdx);
    e.dataTransfer.effectAllowed='move';
    setTimeout(()=>cell.classList.add('dragging'),0);
  });
  grid.addEventListener('dragover',e=>{
    e.preventDefault();
    const cell=e.target.closest('[data-drag-idx]');if(!cell)return;
    const idx=parseInt(cell.dataset.dragIdx);
    if(feedDragSrc!==null&&feedDragSrc!==idx){
      grid.querySelectorAll('.feed-cell').forEach(c=>c.classList.remove('drag-over-cell'));
      cell.classList.add('drag-over-cell');
    }
  });
  grid.addEventListener('drop',e=>{
    e.preventDefault();
    const cell=e.target.closest('[data-drag-idx]');if(!cell)return;
    const idx=parseInt(cell.dataset.dragIdx);
    if(feedDragSrc!==null&&feedDragSrc!==idx){
      const arr=currentFeedItems();const tmp=arr[feedDragSrc];arr[feedDragSrc]=arr[idx];arr[idx]=tmp;
      setFeedItems(arr);autoSave();
    }
    feedDragSrc=null;renderFeedGrid();
  });
  grid.addEventListener('dragend',()=>{
    feedDragSrc=null;
    grid.querySelectorAll('.feed-cell').forEach(c=>c.classList.remove('dragging','drag-over-cell'));
  });
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
async function saveCarousel(){
  if(!carouselTmp.length){showToast('Aggiungi almeno una slide','warn');return;}
  showToast('⟳ Caricamento slide su Dropbox…');
  // Upload any blob URLs to Dropbox
  for(let i=0;i<carouselTmp.length;i++){
    const s=carouselTmp[i];
    if(s.url&&s.url.startsWith('blob:')){
      try{
        const resp=await fetch(s.url);const blob=await resp.blob();
        const file=new File([blob],s.name||('slide_'+i+'.jpg'),{type:blob.type});
        const destPath='/nassa/'+CLOUD.user+'/'+(feedMonth||'misc')+'/carousel/'+file.name;
        const url=await DROPBOX.upload(file,destPath);
        if(url){carouselTmp[i].url=url;carouselTmp[i].externalUrl=url;}
      }catch(e){console.warn('Carousel slide upload failed',e);}
    }
  }
  const items=currentFeedItems();
  items[carouselEditIdx].slides=carouselTmp.map(s=>({...s}));
  items[carouselEditIdx].url=carouselTmp[0].url||'';
  setFeedItems(items);closeModal('carousel-modal');refreshFeed()
  showToast('✓ Carosello salvato');
}
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
        // FIX 5: drag via delegation on stories grid
        cell.draggable=true;
        cell.dataset.stDragIdx=idx;
        const ov=document.createElement('div');ov.className='story-overlay';
        if(st.isStoryboard){const eb=document.createElement('button');eb.className='ov-btn ob-edit';eb.innerHTML='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg> Modifica';eb.onclick=e=>{e.stopPropagation();openStoryboardModal(idx);};ov.appendChild(eb);}
        const cpb=document.createElement('button');cpb.className='ov-btn ob-copy';cpb.innerHTML='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg> Copia da…';cpb.onclick=e=>{e.stopPropagation();openCopyModal('stories');};ov.appendChild(cpb);
        const del=document.createElement('button');del.className='ov-btn ob-delete';del.innerHTML='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/></svg> Rimuovi';del.onclick=e=>{e.stopPropagation();removeStoryItem(idx);};ov.appendChild(del);
        cell.appendChild(ov);wrap.appendChild(cell);
        const info=document.createElement('div');info.className='story-info';
        const di=document.createElement('input');di.className='story-date-inp';di.type='text';di.value=st.date||'';di.placeholder='Data…';di.oninput=e=>{currentStoryItems()[idx].date=e.target.value;};
        const ni=document.createElement('textarea');ni.className='story-note-inp';ni.value=st.note||'';ni.placeholder='Nota regia…';ni.oninput=e=>{currentStoryItems()[idx].note=e.target.value;};
        info.appendChild(di);info.appendChild(ni);wrap.appendChild(info);
      } else if(i===arr.length){cell.classList.add('empty-story');addEmptyStoryListeners(cell);const sp=document.createElement('span');sp.textContent='+ aggiungi';cell.appendChild(sp);wrap.appendChild(cell);}
      else{cell.classList.add('empty-story');addEmptyStoryListeners(cell);wrap.appendChild(cell);}
      grid.appendChild(wrap);
    }
    // FIX 5: Stories drag delegation — 4 listeners on grid instead of N*4 on cells
    grid.addEventListener('dragstart',e=>{
      const cell=e.target.closest('[data-st-drag-idx]');if(!cell)return;
      stDragSrc=parseInt(cell.dataset.stDragIdx);e.dataTransfer.effectAllowed='move';
      setTimeout(()=>cell.classList.add('dragging'),0);
    });
    grid.addEventListener('dragover',e=>{
      e.preventDefault();
      const cell=e.target.closest('[data-st-drag-idx]');if(!cell)return;
      const idx=parseInt(cell.dataset.stDragIdx);
      if(stDragSrc!==null&&stDragSrc!==idx){
        grid.querySelectorAll('.story-cell').forEach(c=>c.classList.remove('drag-over-st'));
        cell.classList.add('drag-over-st');
      }
    });
    grid.addEventListener('drop',e=>{
      e.preventDefault();
      const cell=e.target.closest('[data-st-drag-idx]');if(!cell)return;
      const idx=parseInt(cell.dataset.stDragIdx);
      if(stDragSrc!==null&&stDragSrc!==idx){
        const a=currentStoryItems();const tmp=a[stDragSrc];a[stDragSrc]=a[idx];a[idx]=tmp;
        setStoryItems(a);autoSave();
      }
      stDragSrc=null;renderStoriesGrid();
    });
    grid.addEventListener('dragend',()=>{
      stDragSrc=null;
      grid.querySelectorAll('.story-cell').forEach(c=>c.classList.remove('dragging','drag-over-st'));
    });
    // PED stories section
    const pedMonth=storiesMonth||feedMonth||MONTH_OPTIONS[new Date().getMonth()];
    let pedItems=[],pedClientName='';
    const pedCi=storiesClientIdx>=0?storiesClientIdx:feedClientIdx;
    if(pedCi>=0&&clients[pedCi]){const cl=clients[pedCi];for(const k of Object.keys(pedPlans)){if(k.startsWith(cl.name+'|||')&&k.endsWith('|||'+pedMonth)||k===cl.name+'|||'+pedMonth){const a=(pedPlans[k]||[]).filter(s=>s.date);if(a.length){pedItems=a;pedClientName=cl.name;break;}}}}
    if(!pedItems.length){for(const k of Object.keys(pedPlans)){if(k.includes('|||'+pedMonth)){const a=(pedPlans[k]||[]).filter(s=>s.date);if(a.length){pedItems=a;pedClientName=k.split('|||')[0];break;}}}}
    if(pedItems.length>0){
      const pedSection=document.createElement('div');pedSection.className='ped-story-section';
      const pedLbl=document.createElement('div');pedLbl.className='ped-story-section-lbl';
      pedLbl.innerHTML='UGC — piano del mese';
      pedSection.appendChild(pedLbl);
      const pedGrid=document.createElement('div');pedGrid.className='stories-grid';
      pedItems.forEach((st,pi)=>{
        const wrap=document.createElement('div');wrap.className='story-wrap';
        const cell=document.createElement('div');
        cell.className='ped-story-cell '+(st.type||'autonoma');
        cell.title=(st.type==='autonoma'?'👤 Autonoma':'🎨 Template Nassa')+(st.brief?' — '+st.brief:'');

        // If has uploaded media → show it like a normal story
        if(st.url&&st.url.startsWith('http')){
          if(st.type==='video'){
            const v=makeMedia(st.url,'video');
            if(v){cell.addEventListener('mouseenter',()=>v.play().catch(()=>{}));cell.addEventListener('mouseleave',()=>{v.pause();v.currentTime=0;});cell.appendChild(v);}
          } else {
            const img=document.createElement('img');img.src=st.url;img.alt='';img.style.cssText='position:absolute;inset:0;width:100%;height:100%;object-fit:cover;';cell.appendChild(img);
          }
          // Type badge overlay on top of image
          const badge=document.createElement('div');badge.className='ped-story-type-overlay '+(st.type||'autonoma');
          badge.innerHTML=st.type==='autonoma'?'<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>':'<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M9 21V9"/></svg>';cell.appendChild(badge);
        } else {
          // No media yet — show upload prompt with category color
          const icon=document.createElement('div');icon.className='ped-story-icon';icon.innerHTML=st.type==='autonoma'?'<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>':'<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M9 21V9"/></svg>';cell.appendChild(icon);
          if(st.brief){const brief=document.createElement('div');brief.className='ped-story-brief-txt';brief.textContent=st.brief.slice(0,40);cell.appendChild(brief);}
          // Upload button
          const upBtn=document.createElement('div');upBtn.className='ped-upload-btn';upBtn.innerHTML='<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg> Carica media';
          const upInp=document.createElement('input');upInp.type='file';upInp.accept='image/*,video/*';
          upInp.style.cssText='position:absolute;inset:0;opacity:0;cursor:pointer;width:100%;height:100%;z-index:10;';
          upInp.onchange=async(e)=>{
            const file=e.target.files[0];if(!file)return;
            showToast('⟳ Caricamento…');
            const destPath='/nassa/'+CLOUD.user+'/ped-stories/'+pedMonth+'/'+file.name;
            const url=await DROPBOX.upload(file,destPath);
            if(url){
              // Update the PED plan entry with the uploaded URL
              const planKey=pedClientName+'|||'+pedMonth;
              const plan=pedPlans[planKey]||[];
              const idx=plan.findIndex(s=>s.id===st.id);
              if(idx>=0){plan[idx].url=url;plan[idx].mediaType=detectType(file);
                // Also flag media type for detection
                plan[idx].type_media=file.type.startsWith('video')?'video':'image';
              }
              pedPlans[planKey]=plan;
              // BUG #2 FIX: was calling renderStoriesGrid() — should call renderPED()
              autoSave();renderPED();renderCalendar();
              showToast('✓ Media caricato');
            } else showToast('Errore upload','warn');
          };
          cell.appendChild(upBtn);cell.appendChild(upInp);
        }

        // Number badge
        const num=document.createElement('div');num.className='ped-story-num '+(st.type||'autonoma');num.textContent=pi+1;cell.appendChild(num);
        // Date label
        const dateEl=document.createElement('div');dateEl.className='ped-story-date-lbl';dateEl.textContent=fmtDate(st.date)||st.date;cell.appendChild(dateEl);
        // Click to go to PED tab (unless clicking upload input)
        cell.onclick=(e)=>{if(e.target.tagName==='INPUT')return;switchTab('ped');};
        wrap.appendChild(cell);

        // Info row below cell
        const info=document.createElement('div');info.className='story-info ped-info';
        const di=document.createElement('div');di.style.cssText='font-size:9px;font-weight:600;';
        di.style.color=st.type==='autonoma'?'var(--amber)':'var(--green)';
        di.textContent=(st.type==='autonoma'?'👤 Autonoma':'🎨 Template')+(st.date?' · '+fmtDate(st.date):'');
        info.appendChild(di);
        if(st.brief){const bn=document.createElement('div');bn.style.cssText='font-size:9px;color:var(--text-3);margin-top:1px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;';bn.textContent=st.brief;info.appendChild(bn);}
        wrap.appendChild(info);
        pedGrid.appendChild(wrap);
      });
      pedSection.appendChild(pedGrid);
      // Remove any existing PED section before appending to avoid duplicates
      const oldPed=grid.parentElement.querySelector('.ped-story-section');if(oldPed)oldPed.remove();
      grid.parentElement.appendChild(pedSection);
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
let storiesPanelOpen=false;
function toggleStoriesPanel(){
  storiesPanelOpen=!storiesPanelOpen;
  const panel=document.getElementById('stories-ctx-panel');
  const icon=document.getElementById('stories-expand-icon');
  const btn=document.getElementById('stories-expand-btn');
  if(panel){
    panel.classList.toggle('open',storiesPanelOpen);
    if(storiesPanelOpen&&btn){
      const r=btn.closest('.feed-ctx-bar').getBoundingClientRect();
      panel.style.top=r.bottom+'px';
    }
  }
  if(icon)icon.innerHTML=storiesPanelOpen
    ?'<polyline points="18 15 12 9 6 15"/>'
    :'<polyline points="6 9 12 15 18 9"/>';
}

function openStoryboardModal(idx){
  if(storiesClientIdx<0&&globalClientIdx>=0){
    storiesClientIdx=globalClientIdx;
    storiesAccountIdx=clients[globalClientIdx]?.accounts?.length>0?0:-1;
  }
  if(!storiesMonth)storiesMonth=feedMonth||MONTH_OPTIONS[new Date().getMonth()];
  sbEditIdx=idx;
  const st=idx!==null&&idx>=0?currentStoryItems()[idx]:null;
  // Init slides — preserve existing or start fresh
  sbTmpSlides=st?.isStoryboard&&st.slides?.length
    ?(st.slides||[]).map(s=>({...s,blobUrl:'',_file:null}))
    :[{url:'',blobUrl:'',num:'1.',eye:'',title:'',note:'',_file:null}];
  sbCurSlide=0;sbBg='lined';sbColor='#2563eb';sbFmt='feed';
  openModal('storyboard-modal');
  // Reset to editor tab
  ['editor','parser','cassetto'].forEach(t=>{
    const p=document.getElementById('sb-panel-'+t);if(p)p.style.display=t==='editor'?'':'none';
  });
  document.querySelectorAll('.sb-tab').forEach(b=>b.classList.toggle('active',b.id==='sb-tab-editor'));
  // Render after modal is visible — use rAF for reliable timing
  requestAnimationFrame(()=>{
    requestAnimationFrame(()=>{
      renderSbBuilder();
      const fmtBtn=document.querySelector('.sb-fmt-btn[data-fmt="feed"]');
      if(fmtBtn)sbSetFmt('feed',fmtBtn);
      const pnum=document.getElementById('sb-p-num');
      if(pnum)pnum.style.color=sbColor;
    });
  });
}
async function saveStoryboard(){
  if(!sbTmpSlides.length){showToast('Aggiungi almeno una slide','warn');return;}
  // Guard: sync stories context from global if not set
  if(storiesClientIdx<0&&globalClientIdx>=0){
    storiesClientIdx=globalClientIdx;
    storiesAccountIdx=clients[globalClientIdx]?.accounts?.length>0?0:-1;
  }
  if(!storiesMonth)storiesMonth=feedMonth||MONTH_OPTIONS[new Date().getMonth()];
  if(storiesAccountIdx<0){showToast('Seleziona cliente e account','warn');return;}
  showToast('⟳ Caricamento slide su Dropbox…');
  for(let i=0;i<sbTmpSlides.length;i++){
    const s=sbTmpSlides[i];
    if(s.url&&s.url.startsWith('blob:')){
      try{
        const resp=await fetch(s.url);const blob=await resp.blob();
        const file=new File([blob],s.name||('sb_slide_'+i+'.jpg'),{type:blob.type});
        const destPath='/nassa/'+CLOUD.user+'/storyboard/'+file.name;
        const url=await DROPBOX.upload(file,destPath);
        if(url){sbTmpSlides[i].url=url;sbTmpSlides[i].externalUrl=url;}
      }catch(e){console.warn('Storyboard slide upload failed',e);}
    }
  }
  // Clean slides before saving (remove blob URLs and file refs)
  const cleanSlides=sbTmpSlides.map(s=>({
    url:s.externalUrl||s.url||'',externalUrl:s.externalUrl||'',
    num:s.num||'',eye:s.eye||'',title:s.title||'',note:s.note||'',name:s.name||''
  }));
  const arr=currentStoryItems();
  if(sbEditIdx!==null&&sbEditIdx>=0&&sbEditIdx<arr.length){
    arr[sbEditIdx].slides=cleanSlides;
    arr[sbEditIdx].url=cleanSlides[0]?.url||'';arr[sbEditIdx].isStoryboard=true;
  }else{
    arr.push({type:'image',url:cleanSlides[0]?.url||'',name:'Storyboard',date:'',note:'',isStoryboard:true,slides:cleanSlides});
  }
  setStoryItems(arr);closeModal('storyboard-modal');refreshStories()
  showToast('✓ Storyboard salvato');
}

/* ════ SLIDE BUILDER ════ */
let sbCurSlide=0,sbBg='lined',sbColor='#2563eb',sbFmt='feed';

function renderSbBuilder(){renderSbThumbs();loadSbSlide(sbCurSlide);updateSbCount();}

function renderSbThumbs(){
  const t=document.getElementById('sb-thumbs');if(!t)return;t.innerHTML='';
  sbTmpSlides.forEach((sl,i)=>{
    const d=document.createElement('div');
    d.className='sb-thumb-card'+(i===sbCurSlide?' active':'');
    d.innerHTML='<div class="sb-thumb-num">'+(sl.num||i+1+'.')+'</div><div class="sb-thumb-title">'+(sl.title||'Senza titolo')+'</div>';
    d.onclick=()=>{sbCurSlide=i;renderSbBuilder();};
    const del=document.createElement('button');
    del.style.cssText='position:absolute;top:3px;right:3px;background:none;border:none;cursor:pointer;color:var(--text-3);font-size:10px;display:none;padding:2px;';
    del.textContent='✕';del.onclick=e=>{e.stopPropagation();sbTmpSlides.splice(i,1);if(sbCurSlide>=sbTmpSlides.length)sbCurSlide=sbTmpSlides.length-1;renderSbBuilder();};
    d.style.position='relative';
    d.onmouseenter=()=>{del.style.display='block';};
    d.onmouseleave=()=>{del.style.display='none';};
    d.appendChild(del);t.appendChild(d);
  });
}

function loadSbSlide(i){
  const sl=sbTmpSlides[i]||{};
  ['sb-f-num','sb-f-eye','sb-f-tit','sb-f-cop'].forEach((id,j)=>{
    const el=document.getElementById(id);
    if(el)el.value=[sl.num,sl.eye,sl.title,sl.note][j]||'';
  });
  const zone=document.getElementById('sb-img-preview');
  const img=document.getElementById('sb-img-el');
  if(zone&&img){const src=sl.blobUrl||sl.url||'';if(src){img.src=src;zone.style.display='block';}else{zone.style.display='none';}}
  updateSbPreview();
}

function sbSync(){
  if(!sbTmpSlides[sbCurSlide])return;
  const sl=sbTmpSlides[sbCurSlide];
  const g=id=>document.getElementById(id)?.value||'';
  sl.num=g('sb-f-num');sl.eye=g('sb-f-eye');sl.title=g('sb-f-tit');sl.note=g('sb-f-cop');
  updateSbPreview();renderSbThumbs();
}

function updateSbPreview(){
  const sl=sbTmpSlides[sbCurSlide]||{};
  const s=(id,v)=>{const el=document.getElementById(id);if(el)el.textContent=v||'';};
  s('sb-p-num',sl.num||'1.');s('sb-p-eye',sl.eye||'');s('sb-p-tit',sl.title||'Titolo');s('sb-p-cop',sl.note||'');
  const ci=document.getElementById('sb-canvas-img');
  if(ci){const src=sl.blobUrl||sl.url||'';if(src){ci.style.display='block';ci.innerHTML='<img src="'+src+'" style="width:100%;height:100%;object-fit:cover;"/>';}else{ci.style.display='none';}}
}

function updateSbCount(){
  const el=document.getElementById('sb-slide-count');
  if(el)el.textContent='Slide '+(sbCurSlide+1)+' di '+sbTmpSlides.length;
}

function sbSetImage(file){
  if(!file)return;
  if(sbTmpSlides[sbCurSlide]?.blobUrl)URL.revokeObjectURL(sbTmpSlides[sbCurSlide].blobUrl);
  const url=URL.createObjectURL(file);
  sbTmpSlides[sbCurSlide].blobUrl=url;sbTmpSlides[sbCurSlide]._file=file;sbTmpSlides[sbCurSlide].name=file.name;
  loadSbSlide(sbCurSlide);
}

function sbClearImage(){
  if(sbTmpSlides[sbCurSlide]?.blobUrl)URL.revokeObjectURL(sbTmpSlides[sbCurSlide].blobUrl);
  sbTmpSlides[sbCurSlide].blobUrl='';sbTmpSlides[sbCurSlide].url='';
  loadSbSlide(sbCurSlide);
}

function sbSetBg(bg,el){
  sbBg=bg;
  const cv=document.getElementById('sb-canvas');if(cv)cv.className='sb-canvas '+bg;
  document.querySelectorAll('.sb-bg-btn').forEach(b=>b.classList.toggle('active',b.dataset.bg===bg));
}

function sbSetColor(col,el){
  sbColor=col;
  const pn=document.getElementById('sb-p-num');if(pn)pn.style.color=col;
  document.querySelectorAll('.sb-color-dot').forEach(d=>d.classList.toggle('active',d.dataset.c===col));
}

function sbSetFmt(fmt,el){
  sbFmt=fmt;
  const cv=document.getElementById('sb-canvas');if(!cv)return;
  const sizes={stories:'width:95px;aspect-ratio:9/16',feed:'width:120px;aspect-ratio:4/5',square:'width:140px;aspect-ratio:1/1'};
  cv.style.cssText=(sizes[fmt]||sizes.feed)+';border-radius:var(--r);';
  document.querySelectorAll('.sb-fmt-btn').forEach(b=>b.classList.toggle('active',b.dataset.fmt===fmt));
}

function sbDownloadPNG(){showToast('Usa screenshot del browser per esportare la slide','warn');}


function addSbSlide(){sbTmpSlides.push({url:'',blobUrl:'',num:(sbTmpSlides.length+1)+'.',eye:'',title:'',note:'',_file:null});sbCurSlide=sbTmpSlides.length-1;renderSbBuilder();}
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


/* ══ SB TAB SWITCHER ══ */
function sbSwitchTab(tab,el){
  ['editor','parser','cassetto'].forEach(t=>{
    const panel=document.getElementById('sb-panel-'+t);
    if(panel)panel.style.display=t===tab?'':'none';
  });
  document.querySelectorAll('.sb-tab').forEach(b=>b.classList.toggle('active',b.id==='sb-tab-'+tab));
  if(tab==='cassetto')renderSbCassetto();
}

/* ══ PARSER NOTE ══ */
function sbParseNote(){
  const raw=document.getElementById('sb-parser-input')?.value?.trim();
  if(!raw){showToast('Incolla prima una nota','warn');return;}
  const lines=raw.split('\n').map(l=>l.trim()).filter(l=>l.length>0);
  let num='',eye='',tit='',cop='';
  lines.forEach(l=>{
    if(/^\[NUM\]/i.test(l))     num=l.replace(/^\[NUM\]\s*/i,'');
    else if(/^\[OCCHIELLO\]/i.test(l)) eye=l.replace(/^\[OCCHIELLO\]\s*/i,'');
    else if(/^\[TITOLO\]/i.test(l))    tit=l.replace(/^\[TITOLO\]\s*/i,'');
    else if(/^\[COPY\]/i.test(l))      cop=l.replace(/^\[COPY\]\s*/i,'');
  });
  // Fallback: no tags — use line order
  if(!num&&!eye&&!tit&&!cop&&lines.length>=2){eye=lines[0];tit=lines[1];cop=lines.slice(2).join(' ');}
  if(!sbTmpSlides[sbCurSlide])return;
  const sl=sbTmpSlides[sbCurSlide];
  if(num)sl.num=num;if(eye)sl.eye=eye;if(tit)sl.title=tit;if(cop)sl.note=cop;
  loadSbSlide(sbCurSlide);renderSbThumbs();
  sbSwitchTab('editor',document.getElementById('sb-tab-editor'));
  showToast('✓ Slide compilata dal parser');
}

function sbFillParserExample(){
  const ta=document.getElementById('sb-parser-input');
  if(ta)ta.value='[NUM] 1.\n[OCCHIELLO] Strategia\n[TITOLO] Documenta tutto\n[COPY] Cattura screenshot, timestamp e file. La prova di quando hai creato è la tua difesa migliore.';
}

/* ══ CASSETTO (bozze storyboard) ══ */
let sbCassetto=JSON.parse(localStorage.getItem('sb_cassetto')||'[]');

function sbSaveToCassetto(){
  if(!sbTmpSlides.length){showToast('Nessuna slide da salvare','warn');return;}
  const name=prompt('Nome bozza:','Bozza '+(sbCassetto.length+1));
  if(!name)return;
  const entry={id:Date.now(),name,savedAt:new Date().toISOString(),
    slides:sbTmpSlides.map(s=>({num:s.num||'',eye:s.eye||'',title:s.title||'',note:s.note||'',url:s.url||''}))};
  sbCassetto.unshift(entry);
  try{localStorage.setItem('sb_cassetto',JSON.stringify(sbCassetto));}catch(e){}
  renderSbCassetto();
  showToast('✓ Bozza salvata nel cassetto');
}

function sbLoadFromCassetto(id){
  const entry=sbCassetto.find(e=>e.id===id);if(!entry)return;
  if(!confirm('Sostituire le slide correnti con questa bozza?'))return;
  sbTmpSlides=entry.slides.map(s=>({...s,blobUrl:'',_file:null}));
  sbCurSlide=0;
  renderSbBuilder();
  sbSwitchTab('editor',document.getElementById('sb-tab-editor'));
  showToast('✓ Bozza caricata');
}

function sbDeleteFromCassetto(id){
  sbCassetto=sbCassetto.filter(e=>e.id!==id);
  try{localStorage.setItem('sb_cassetto',JSON.stringify(sbCassetto));}catch(e){}
  renderSbCassetto();
}

function renderSbCassetto(){
  const c=document.getElementById('sb-cassetto-list');if(!c)return;
  if(!sbCassetto.length){
    c.innerHTML='<div class="sb-cass-empty">Nessuna bozza salvata.<br>Clicca "+ Salva corrente" per iniziare.</div>';return;
  }
  c.innerHTML='';
  sbCassetto.forEach(entry=>{
    const d=document.createElement('div');d.className='sb-cassetto-item';
    const dt=new Date(entry.savedAt);
    const dateStr=dt.toLocaleDateString('it-IT',{day:'numeric',month:'short'})+' '+dt.toLocaleTimeString('it-IT',{hour:'2-digit',minute:'2-digit'});
    d.innerHTML=`<div><div class="sb-cass-name">${entry.name}</div><div class="sb-cass-meta">${entry.slides.length} slide · ${dateStr}</div></div><div class="sb-cass-actions"><button class="sb-cass-btn" onclick="sbLoadFromCassetto(${entry.id})">Carica</button><button class="sb-cass-btn" style="color:var(--red);" onclick="sbDeleteFromCassetto(${entry.id})">✕</button></div>`;
    c.appendChild(d);
  });
}

/* HIGHLIGHT MODAL */
function openHighlightModal(idx){hlEditIdx=idx;hlTmpCover=null;const hl=idx>=0?currentHighlights()[idx]:null;const nn=document.getElementById('hl-name');if(nn)nn.value=hl?hl.name:'';const ll=document.getElementById('hl-upload-lbl');if(ll)ll.innerHTML=hl?.coverUrl?'<strong>Clicca per cambiare copertina</strong>':'Carica copertina · <strong>clicca per sfogliare</strong>';openModal('highlight-modal');}
function setHlCover(files){if(!files[0])return;hlTmpCover=URL.createObjectURL(files[0]);const ll=document.getElementById('hl-upload-lbl');if(ll)ll.innerHTML='<strong>✓ Copertina caricata</strong>';}
async function saveHighlight(){
  const name=(document.getElementById('hl-name')?.value||'').trim();
  if(!name){showToast('Inserisci un nome','warn');return;}
  let coverUrl=hlTmpCover||'';
  // Upload cover to Dropbox if it's a blob URL
  if(coverUrl.startsWith('blob:')){
    try{
      showToast('⟳ Caricamento copertina…');
      const resp=await fetch(coverUrl);const blob=await resp.blob();
      const file=new File([blob],'highlight_'+name.replace(/\s+/g,'_')+'.jpg',{type:blob.type});
      const destPath='/nassa/'+CLOUD.user+'/highlights/'+file.name;
      const uploaded=await DROPBOX.upload(file,destPath);
      if(uploaded)coverUrl=uploaded;
    }catch(e){console.warn('Highlight cover upload failed',e);}
  }
  const arr=currentHighlights();
  if(hlEditIdx>=0){arr[hlEditIdx].name=name;if(hlTmpCover)arr[hlEditIdx].coverUrl=coverUrl;}
  else{arr.push({name,coverUrl});}
  setHighlights(arr);closeModal('highlight-modal');refreshStories();showToast('✓ Evidenza salvata');autoSave();
}

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
  if(msEl.options.length<=1||msEl.dataset.acc!==acc.id){
    msEl.dataset.acc=acc.id;msEl.innerHTML='<option value="">— seleziona mese —</option>';
    // Show ALL months with data across all years
    const prefix=acc.id+'|||';
    const allMonths=[...new Set([...Object.keys(feeds),...Object.keys(stories)].filter(k=>k.startsWith(prefix)).map(k=>k.replace(prefix,'')))].filter(m=>{const k=accountKey(acc.id,m);return(feeds[k]?.filter(i=>i.type!=='pending').length||stories[k]?.length);}).sort((a,b)=>{const pa=a.split(' '),pb=b.split(' ');const ya=parseInt(pa[1])||0,yb=parseInt(pb[1])||0;if(ya!==yb)return ya-yb;return MONTHS.indexOf(pa[0])-MONTHS.indexOf(pb[0]);});
    allMonths.forEach(m=>{const o=document.createElement('option');o.value=m;o.textContent=m;msEl.appendChild(o);});
  }
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
  setFeedItems([...newFromCopy,...destItems]);closeModal('copy-content-modal');refreshFeed();showToast('✓ '+copySelectedItems.size+' contenut'+(copySelectedItems.size===1?'o':'i')+' copiati');
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
      const cell=document.createElement('div');cell.className='client-cell';
      // Use pointer cursor always so click is obvious even on empty cells
      cell.style.cursor='pointer';
      cell.onclick=()=>openLb(i,ready,stArr);
      const coverUrl=item.type==='carousel'&&item.slides?.length?item.slides[0].url:item.url;
      if(item.type==='video'){
        const v=makeMedia(item.url,'video');
        if(v){cell.addEventListener('mouseenter',()=>v.play().catch(()=>{}));cell.addEventListener('mouseleave',()=>{v.pause();v.currentTime=0;});cell.appendChild(v);}
        else{const ph=document.createElement('div');ph.style.cssText='width:100%;height:100%;background:#1a1a1a;display:flex;align-items:center;justify-content:center;color:#555;font-size:24px;';ph.textContent='▶';cell.appendChild(ph);}
        const b=document.createElement('span');b.className='client-badge video';b.textContent='▶ REEL';cell.appendChild(b);
      } else {
        const img=makeMedia(coverUrl,'image');
        if(img){
          // Prevent img from blocking click events
          img.style.pointerEvents='none';
          cell.appendChild(img);
        } else {
          // Placeholder for missing image - still clickable
          const ph=document.createElement('div');ph.style.cssText='width:100%;height:100%;background:#e2e2e4;display:flex;align-items:center;justify-content:center;color:#aaa;font-size:24px;';ph.textContent='🖼';cell.appendChild(ph);
        }
        if(item.type==='carousel'){const b=document.createElement('span');b.className='client-badge carousel';b.textContent='❏❏ '+(item.slides?.length||0);cell.appendChild(b);}
      }
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
function lbSlideNav(d){const item=lbItems[lbIdx];if(!item?.slides?.length)return;lbSlide=(lbSlide+d+item.slides.length)%item.slides.length;renderLb();}
function renderLb(){
  const inner=document.getElementById('lb-inner');if(!inner)return;inner.innerHTML='';
  const item=lbItems[lbIdx];const isMulti=lbItems.length>1;const isCarousel=item.type==='carousel'&&item.slides?.length>1;
  const showPostNav=isMulti&&!isCarousel;
  document.getElementById('lb-prev').style.display=showPostNav?'flex':'none';document.getElementById('lb-next').style.display=showPostNav?'flex':'none';
  const x=document.createElement('button');x.className='lb-close';x.innerHTML='×';x.onclick=()=>document.getElementById('lightbox').classList.remove('open');inner.appendChild(x);
  if(item.type==='carousel'&&item.slides?.length){
    const slideUrl=item.slides[lbSlide]?.url||item.url||'';
    if(slideUrl){const img=document.createElement('img');img.src=slideUrl;img.alt='';inner.appendChild(img);}
    else{const ph=document.createElement('div');ph.style.cssText='color:#555;font-size:48px;text-align:center;padding:40px;';ph.textContent='🖼';inner.appendChild(ph);}
    if(item.slides.length>1){
      const sp=document.createElement('button');sp.className='lb-slide-nav lb-slide-prev';sp.innerHTML='‹';sp.onclick=e=>{e.stopPropagation();lbSlideNav(-1);};inner.appendChild(sp);
      const sn=document.createElement('button');sn.className='lb-slide-nav lb-slide-next';sn.innerHTML='›';sn.onclick=e=>{e.stopPropagation();lbSlideNav(1);};inner.appendChild(sn);
    }
  } else if(item.type==='video'){
    const v=makeMedia(item.url,'video',{controls:true,autoplay:true});
    if(v)inner.appendChild(v);
  } else {
    const url=item.url||item.externalUrl||'';
    if(url){const img=document.createElement('img');img.src=url;img.alt='';inner.appendChild(img);}
    else{const ph=document.createElement('div');ph.style.cssText='color:#555;font-size:48px;text-align:center;padding:40px;';ph.textContent='🖼';inner.appendChild(ph);}
  }
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
  // Filter by globalClientIdx — only show current client's events
  const allFeedKeys=Object.keys(feeds);const allStoryKeys=Object.keys(stories);
  const clientList=globalClientIdx>=0
    ?[[clients[globalClientIdx],globalClientIdx]]  // solo cliente corrente
    :clients.map((cl,ci)=>[cl,ci]);                // nessun cliente selezionato: mostra tutti
  clientList.forEach(([cl,ci])=>{
    (cl.accounts||[]).forEach(acc=>{
      // Get all months that have data for this account
      const accKeys=allFeedKeys.filter(k=>k.startsWith(acc.id+'|||'));
      const accStKeys=allStoryKeys.filter(k=>k.startsWith(acc.id+'|||'));
      const allMonths=new Set([...accKeys,...accStKeys].map(k=>k.split('|||')[1]));
      allMonths.forEach(mo=>{
        const key=acc.id+'|||'+mo;
        (feeds[key]||[]).filter(it=>it.type!=='pending'&&it.date).forEach((it,ii)=>{const ds=italianToISO(it.date);if(!ds)return;addEv(ds,{type:'feed',label:it.copy?it.copy.slice(0,20):(it.type==='video'?'Reel':'Post'),thumb:it.type==='carousel'&&it.slides?.[0]?it.slides[0].url:it.url,vidUrl:it.type==='video'?it.url:null,item:it,clientIdx:ci,clientName:cl.name+' — '+acc.name,month:mo,feedIdx:ii});});
        (stories[key]||[]).filter(st=>st.date).forEach((st,si)=>{const ds=italianToISO(st.date);if(!ds)return;addEv(ds,{type:'story',label:st.isStoryboard?'Storyboard':(st.type==='video'?'Reel story':'Story'),thumb:st.isStoryboard&&st.slides?.[0]?st.slides[0].url:st.url,vidUrl:st.type==='video'&&!st.isStoryboard?st.url:null,item:st,clientIdx:ci,clientName:cl.name+' — '+acc.name,month:mo,stIdx:si});});
      });
    });
    // PED plans - scan all keys
    Object.keys(pedPlans).filter(k=>k.startsWith(cl.name+'|||')).forEach(pkey=>{
      const mo=pkey.split('|||')[1];
      (pedPlans[pkey]||[]).forEach((st)=>{if(!st.date)return;const lbl=(st.type==='autonoma'?'👤 ':'🎨 ')+(st.brief?st.brief.slice(0,18):'Story pianificata');addEv(st.date,{type:'ped',label:lbl,thumb:null,item:st,clientIdx:ci,clientName:cl.name,month:mo,pedType:st.type});});
    });
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
    let html='<div class="cal-teatro-grid">';
    // Day headers
    GIORNIW.forEach(g=>{html+=`<div class="cal-teatro-header">${g}</div>`;});
    let day=1,nextDay=1;const totalCells=Math.ceil((startDow+daysInMonth)/7)*7;
    for(let i=0;i<totalCells;i++){
      let cellY=y,cellM=m+1,cellD,isOther=false;
      if(i<startDow){cellD=daysInPrev-startDow+i+1;cellM=m===0?12:m;cellY=m===0?y-1:y;isOther=true;}
      else if(day>daysInMonth){cellD=nextDay++;cellM=m+2>12?1:m+2;cellY=m+2>12?y+1:y;isOther=true;}
      else{cellD=day++;}
      const dateStr=isoDate(cellY,cellM,cellD);const isToday=dateStr===today;const evs=events[dateStr]||[];
      html+=`<div class="cal-teatro-day${isOther?' cal-other':''}${isToday?' cal-today':''}${evs.length?' cal-has-events':''}" onclick="openCalPanel('${dateStr}')">`;
      // Day number + weekday
      const dowIdx=(new Date(cellY,cellM-1,cellD).getDay()+6)%7;
      html+=`<div class="ctd-header"><div class="ctd-num">${cellD}</div><div class="ctd-dow">${GIORNIW[dowIdx]}</div></div>`;
      // Separator line — only if has events
      if(evs.length) html+=`<div class="ctd-sep"></div>`;
      // Events
      if(evs.length){
        html+=`<div class="ctd-events">`;
        const MAX=2;
        evs.slice(0,MAX).forEach(ev=>{
          const isStory=ev.type==='story';
          const isPed=ev.type==='ped';
          const thumbRatio=isStory?'9/16':'4/5';
          let badgeCls='',badgeTxt='';
          if(ev.type==='feed'){
            if(ev.item?.type==='video'){badgeCls='cal-badge-reel';badgeTxt='Reel';}
            else if(ev.item?.type==='carousel'){badgeCls='cal-badge-car';badgeTxt='Caros.';}
            else{badgeCls='cal-badge-foto';badgeTxt='Foto';}
          } else if(isStory){badgeCls='cal-badge-story';badgeTxt='Story';}
          else if(isPed){badgeCls='cal-badge-ugc';badgeTxt='UGC';}
          const thumbSrc=ev.thumb||'';
          const thumbInner=thumbSrc
            ?`<img src="${thumbSrc}" style="width:100%;height:100%;object-fit:cover;" onerror="this.style.display='none'"/>`
            :`<span style="font-size:10px;color:var(--text-3);">${isPed?(ev.pedType==='autonoma'?'👤':'🎨'):'📷'}</span>`;
          const clientShort=ev.clientName.split(' — ')[0].split(' ').slice(0,2).join(' ');
          const labelTxt=ev.item?.copy?ev.item.copy.slice(0,22):(ev.item?.brief?ev.item.brief.slice(0,22):ev.label||'—');
          html+=`<div class="ctd-event">
            <div class="ctd-thumb${isStory?' ctd-thumb-story':''}">${thumbInner}</div>
            <div class="ctd-info">
              <div class="ctd-client">${clientShort}</div>
              <div class="ctd-label">${labelTxt}</div>
              <span class="ctd-badge ${badgeCls}">${badgeTxt}</span>
            </div>
          </div>`;
        });
        if(evs.length>MAX)html+=`<div class="ctd-more">+${evs.length-MAX} altri</div>`;
        html+=`</div>`;
      }
      html+='</div>';
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
    weekDays.forEach(d=>{const ds=isoDate(d.getFullYear(),d.getMonth()+1,d.getDate());const dayEvs=weekEvMap[ds]||[];html+='<div class="cal-week-col">';HOURS.forEach(()=>{html+='<div class="cal-week-slot"></div>';});dayEvs.forEach((ev,ei)=>{
  const top=4+ei*40;
  const cls=ev.type==='feed'?'feed-post':ev.type==='story'?'story-item':ev.type==='ped'?(ev.pedType==='template'?'ped-template':'ped-autonoma'):'highlight-item';
  const dot=ev.type==='ped'?(ev.pedType==='template'?'🎨':'👤'):'';
  const thumbHtml=ev.thumb?`<img src="${ev.thumb}" class="cal-ev-thumb-week" onerror="this.style.display='none'" />`:(dot?`<span>${dot}</span>`:`<span>${ev.type==='feed'?'🖼':'📱'}</span>`);
  html+=`<div class="cal-week-event ${cls}" style="top:${top}px;height:34px;" onclick="openCalPanel('${ds}')">${thumbHtml}<span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;flex:1;">${ev.clientName.split(' — ')[0]}: ${ev.label}</span></div>`;
});html+='</div>';});
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
  const renderSection=(list,label,typeClass)=>{if(!list.length)return;const sec=document.createElement('div');const sl=document.createElement('div');sl.className='cal-panel-section';sl.textContent=label;sec.appendChild(sl);list.forEach(ev=>{const row=document.createElement('div');row.className='cal-panel-item';const thumb=document.createElement('div');thumb.className='cal-panel-thumb'+(typeClass==='story'?' story':'');if(ev.vidUrl){const v=document.createElement('video');v.src=ev.vidUrl;v.muted=true;v.playsInline=true;v.preload='metadata';v.style.cssText='width:100%;height:100%;object-fit:cover;';thumb.appendChild(v);}else if(ev.thumb){const img=document.createElement('img');img.src=ev.thumb;img.alt='';thumb.appendChild(img);}const info=document.createElement('div');info.className='cal-panel-info';const type_=document.createElement('div');type_.className=`cal-panel-type ${typeClass}`;type_.textContent=label.replace(/[📄📱⭐👤🎨] /,'');info.appendChild(type_);const cp=document.createElement('div');cp.className='cal-panel-copy';cp.textContent=ev.item.brief||ev.item.copy||ev.item.note||ev.item.name||ev.label||'—';info.appendChild(cp);if(ev.clientName){const cl_=document.createElement('div');cl_.style.cssText='font-size:10px;color:var(--text-3);margin-top:2px;';cl_.textContent=ev.clientName;info.appendChild(cl_);}if(ev.type==='feed'||ev.type==='story'||ev.type==='ped'){const tabDest=ev.type==='feed'?'feed':ev.type==='story'?'stories':'ped';const go=document.createElement('div');go.className='cal-panel-goto';go.innerHTML='→ Vai a '+(ev.type==='feed'?'Feed':ev.type==='story'?'Stories':'UGC');go.onclick=e=>{e.stopPropagation();switchTab(tabDest);closeCalPanel();};info.appendChild(go);}row.appendChild(thumb);row.appendChild(info);if(ev.type==='feed'&&ev.item)row.onclick=()=>{openLb(0,[ev.item]);};sec.appendChild(row);});body.appendChild(sec);};
  renderSection(feeds_,'Post feed','feed');renderSection(stories_,'Stories','story');renderSection(hl_,'In evidenza','highlight');renderSection(pedAuto_,'UGC Autonoma','feed');renderSection(pedTmpl_,'UGC Template','story');
  panel.classList.add('open');
}
function closeCalPanel(){const p=document.getElementById('cal-day-panel');if(p)p.classList.remove('open');}

// Close cal panel when clicking outside
document.addEventListener('click',e=>{
  const panel=document.getElementById('cal-day-panel');
  if(panel&&panel.classList.contains('open')&&!panel.contains(e.target)&&!e.target.closest('.cal-day')&&!e.target.closest('.cal-week-event')){
    closeCalPanel();
  }
});

/* ════════ PED STORIES ════════ */
function renderPED(){
  const hasClient=currentClientIdx>=0&&currentMonth;const cn=hasClient?clients[currentClientIdx].name:'—';const mn=currentMonth||'—';
  const titleEl=document.getElementById('ped-title');const metaEl=document.getElementById('ped-meta');const clientLbl=document.getElementById('ped-client-label');const emptyEl=document.getElementById('ped-empty');const freqBlock=document.getElementById('ped-freq-block');const calLbl=document.getElementById('ped-cal-label');
  if(titleEl)titleEl.textContent=hasClient?cn+' — UGC':'UGC';if(clientLbl)clientLbl.textContent=hasClient?cn+' · '+mn:'— seleziona cliente nel Feed';if(calLbl)calLbl.textContent=mn;
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
  newPlan.sort((a,b)=>a.date.localeCompare(b.date));setCurrentPedPlan(newPlan);
  // BUG #3 FIX: was missing autoSave + calendar update
  autoSave();renderPED();renderCalendar();
  showToast('✓ Piano UGC generato — '+newPlan.filter(s=>!existingDates.has(s.date)).length+' nuove date');
}
function pedClear(){if(!confirm('Svuotare il piano del mese?'))return;setCurrentPedPlan([]);autoSave();renderPED();renderCalendar();showToast('Piano UGC svuotato');}

function renderPEDCards(){
  const wrap=document.getElementById('ped-cards');if(!wrap)return;wrap.innerHTML='';
  const plan=currentPedPlan();
  if(!plan.length){wrap.innerHTML='<p style="font-size:11px;color:var(--text-3);text-align:center;padding:16px;">Nessuna story pianificata.<br>Scegli i giorni e clicca <strong>Genera piano</strong>.</p>';return;}
  plan.forEach((st,i)=>{
    const card=document.createElement('div');card.className='ped-story-card';
    const head=document.createElement('div');head.className='ped-story-card-head';
    const dateEl=document.createElement('div');dateEl.className='ped-story-date';dateEl.textContent=fmtDate(st.date)||st.date;
    const typeSel=document.createElement('select');typeSel.className='ped-story-type-sel';[['autonoma','Autonoma'],['template','Template']].forEach(([v,l])=>{const o=document.createElement('option');o.value=v;o.textContent=l;if(v===st.type)o.selected=true;typeSel.appendChild(o);});typeSel.onchange=e=>{currentPedPlan()[i].type=e.target.value;renderPEDCards();renderPEDCal();};
    const badge=document.createElement('span');badge.className='ped-type-badge';badge.innerHTML=st.type==='autonoma'?'<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>':'<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M9 21V9"/></svg>';
    const del=document.createElement('button');del.className='ped-story-del';del.innerHTML='<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/></svg>';del.onclick=()=>{const p=currentPedPlan();p.splice(i,1);setCurrentPedPlan(p);renderPED();};
    head.appendChild(dateEl);head.appendChild(typeSel);head.appendChild(badge);head.appendChild(del);
    const body=document.createElement('div');body.className='ped-story-body';
    const brief=document.createElement('textarea');brief.className='ped-story-brief';brief.placeholder=st.type==='autonoma'?'Brief per il cliente…':'Descrizione / copy…';brief.value=st.brief||'';brief.oninput=e=>{currentPedPlan()[i].brief=e.target.value;autoSave();};body.appendChild(brief);
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
    (feedMap[ds]||[]).forEach(it=>{const e=document.createElement('div');e.className='ped-cal-ev feed';e.textContent=(it.type==='video'?'Reel':'Post');evs.appendChild(e);});
    (pedMap[ds]||[]).forEach(s=>{const e=document.createElement('div');e.className='ped-cal-ev '+s.type;e.textContent=s.type==='autonoma'?'Autonoma':'Template';evs.appendChild(e);});
    cell.appendChild(evs);if((pedMap[ds]||[]).length){cell.title=(pedMap[ds]||[]).map(s=>s.brief||'(brief vuoto)').join(' | ');cell.style.cursor='pointer';}
    gridEl.appendChild(cell);
  }
}

/* PIANO TESTO */
function rebuildNotesSelects(){
  // Sync notesClientIdx from globalClientIdx if not set
  if(notesClientIdx<0&&globalClientIdx>=0)notesClientIdx=globalClientIdx;
  // Hidden select for JS compat only
  const csel=document.getElementById('notes-client-sel');
  if(csel){csel.innerHTML='<option value="">—</option>';clients.forEach((cl,i)=>{const o=document.createElement('option');o.value=i;o.textContent=cl.name;csel.appendChild(o);});if(notesClientIdx>=0)csel.value=notesClientIdx;}
  const msel=document.getElementById('notes-month-sel');if(!msel)return;if(notesClientIdx<0){msel.style.display='none';return;}
  msel.style.display='';const prevM=msel.value;msel.innerHTML='';
  // Build month list from actual notesData keys + current MONTH_OPTIONS
  const cl=clients[notesClientIdx];
  const notesMonths=cl?Object.keys(notesData).filter(k=>k.startsWith(cl.name+'|||')&&notesData[k]).map(k=>k.split('|||')[1]):[];
  const allMonths=[...new Set([...notesMonths,...MONTH_OPTIONS])].sort((a,b)=>{const pa=a.split(' '),pb=b.split(' ');const ya=parseInt(pa[1])||0,yb=parseInt(pb[1])||0;if(ya!==yb)return ya-yb;return MONTHS.indexOf(pa[0])-MONTHS.indexOf(pb[0]);});
  allMonths.forEach(m=>{const o=document.createElement('option');o.value=m;o.textContent=m;msel.appendChild(o);});
  if(prevM&&allMonths.includes(prevM))msel.value=prevM;else if(notesMonth&&allMonths.includes(notesMonth))msel.value=notesMonth;else{msel.value=MONTH_OPTIONS[new Date().getMonth()];notesMonth=msel.value;}
}
function onNotesClientChange(){const v=document.getElementById('notes-client-sel').value;notesClientIdx=v===''?-1:parseInt(v);notesMonth=MONTH_OPTIONS[new Date().getMonth()];rebuildNotesSelects();renderNotesEditor();}

function renderNotesEditor(){
  const msel=document.getElementById('notes-month-sel');if(msel&&msel.value)notesMonth=msel.value;
  const ed=document.getElementById('notes-editor');if(!ed)return;
  if(notesClientIdx<0){ed.value='';return;}
  // FIX 6: guard — notesClientIdx may be stale after removeClient
  if(notesClientIdx>=clients.length)notesClientIdx=clients.length>0?clients.length-1:-1;
  const cl=clients[notesClientIdx];if(!cl){ed.value='';return;}
  const key=cl.name+'|||'+notesMonth;
  ed.value=notesData[key]||'';
  // Update status bar
  const cs=document.getElementById('notes-client-status');if(cs)cs.textContent=cl.name;
  const ms=document.getElementById('notes-month-status');if(ms)ms.textContent=notesMonth;
  updateNotesToc();updateNotesWc();
}

// FIX 3: debounce timer — prevent cloud save on every keystroke
let _notesSaveTimer=null;
function saveNotesText(){
  const ed=document.getElementById('notes-editor');if(!ed||notesClientIdx<0)return;
  const cl=clients[notesClientIdx];if(!cl)return;
  const msel=document.getElementById('notes-month-sel');if(msel&&msel.value)notesMonth=msel.value;
  const key=cl.name+'|||'+notesMonth;
  notesData[key]=ed.value; // update in-memory immediately
  // Debounce: save to cloud max once per 1.5s
  clearTimeout(_notesSaveTimer);
  _notesSaveTimer=setTimeout(()=>{
    autoSave();
    const ss=document.getElementById('notes-saved-status');
    if(ss){ss.textContent='✓ Salvato';setTimeout(()=>{if(ss)ss.textContent='';},2000);}
  },1500);
}

let notesPreviewMode=false;
function toggleNotesPreview(){
  notesPreviewMode=!notesPreviewMode;
  const ta=document.getElementById('notes-editor');
  const pv=document.getElementById('notes-preview');
  const btn=document.getElementById('notes-preview-btn');
  if(!ta||!pv)return;
  if(notesPreviewMode){
    pv.innerHTML='<div class="notes-preview-inner">'+renderMarkdown(ta.value)+'</div>';
    pv.style.display='block';ta.style.display='none';
    if(btn)btn.classList.add('active');
  } else {
    pv.style.display='none';ta.style.display='';
    if(btn)btn.classList.remove('active');
  }
}

function renderMarkdown(md){
  if(!md)return'';
  const lines=md.split('\n');
  let html='';let inUl=false;let inOl=false;let inP=false;
  const closeP=()=>{if(inP){html+='</p>';inP=false;}};
  const closeUl=()=>{if(inUl){html+='</ul>';inUl=false;}};
  const closeOl=()=>{if(inOl){html+='</ol>';inOl=false;}};
  const esc=s=>s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  const inline=s=>esc(s)
    .replace(/\*\*(.+?)\*\*/g,'<strong>$1</strong>')
    .replace(/\*(.+?)\*/g,'<em>$1</em>')
    .replace(/`(.+?)`/g,'<code>$1</code>')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g,'<a href="$2" target="_blank">$1</a>')
    .replace(/!\[([^\]]*)\]\(([^)]+)\)/g,'<img src="$2" alt="$1" style="max-width:100%;border-radius:6px;margin:6px 0;"/>');
  lines.forEach(line=>{
    if(/^### /.test(line)){closeP();closeUl();closeOl();html+='<h3>'+inline(line.slice(4))+'</h3>';}
    else if(/^## /.test(line)){closeP();closeUl();closeOl();html+='<h2>'+inline(line.slice(3))+'</h2>';}
    else if(/^# /.test(line)){closeP();closeUl();closeOl();html+='<h1>'+inline(line.slice(2))+'</h1>';}
    else if(/^---$/.test(line)){closeP();closeUl();closeOl();html+='<hr/>';}
    else if(/^> /.test(line)){closeP();closeUl();closeOl();html+='<blockquote>'+inline(line.slice(2))+'</blockquote>';}
    else if(/^- /.test(line)){closeP();closeOl();if(!inUl){html+='<ul>';inUl=true;}html+='<li>'+inline(line.slice(2))+'</li>';}
    else if(/^\d+\. /.test(line)){closeP();closeUl();if(!inOl){html+='<ol>';inOl=true;}html+='<li>'+inline(line.replace(/^\d+\. /,''))+'</li>';}
    else if(line.trim()===''){closeUl();closeOl();closeP();}
    else{closeUl();closeOl();if(!inP){html+='<p>';inP=true;}else html+=' ';html+=inline(line);}
  });
  closeP();closeUl();closeOl();
  return html;
}

function updateNotesToc(){
  const ed=document.getElementById('notes-editor');
  const list=document.getElementById('notes-toc-list');
  if(!ed||!list)return;
  const lines=ed.value.split('\n');
  list.innerHTML='';
  lines.forEach((line,i)=>{
    const h1=line.match(/^# (.+)/);
    const h2=line.match(/^## (.+)/);
    const h3=line.match(/^### (.+)/);
    const match=h3||h2||h1;if(!match)return;
    const lvl=h3?'toc-h3':h2?'toc-h2':'toc-h1';
    const item=document.createElement('div');
    item.className='notes-toc-item '+lvl;
    item.textContent=match[1];
    item.dataset.line=i;
    item.onclick=()=>{
      if(notesPreviewMode){
        const headers=document.getElementById('notes-preview')?.querySelectorAll('h1,h2,h3');
        let idx=0;
        document.getElementById('notes-preview')?.querySelectorAll('h1,h2,h3').forEach((el,j)=>{
          if(el.textContent===match[1]&&j===idx){el.scrollIntoView({behavior:'smooth'});idx++;}
        });
      } else {
        const ta=document.getElementById('notes-editor');if(!ta)return;
        // Calculate char position of the line
        const pos=lines.slice(0,i).join('\n').length+(i>0?1:0);
        ta.focus();ta.setSelectionRange(pos,pos);
        // Scroll textarea to line
        const lineH=ta.scrollHeight/lines.length;
        ta.scrollTop=i*lineH-80;
      }
      // Highlight active
      list.querySelectorAll('.notes-toc-item').forEach(el=>el.classList.remove('active'));
      item.classList.add('active');
    };
    list.appendChild(item);
  });
}

function updateNotesWc(){
  const ed=document.getElementById('notes-editor');
  const wc=document.getElementById('notes-wc');
  if(!ed||!wc)return;
  const words=ed.value.trim().split(/\s+/).filter(w=>w.length>0).length;
  const lines=ed.value.split('\n').length;
  wc.textContent=words+' parole · '+lines+' righe';
}

function notesInsert(type){
  const ta=document.getElementById('notes-editor');if(!ta)return;
  const start=ta.selectionStart,end=ta.selectionEnd;
  const sel=ta.value.substring(start,end);
  const before=ta.value.substring(0,start);
  const after=ta.value.substring(end);
  const lineStart=before.lastIndexOf('\n')+1;
  const linePrefix=before.substring(lineStart);
  let ins='',cur=start;

  if(type==='h1'){ins='\n# '+sel;cur=start+ins.length;}
  else if(type==='h2'){ins='\n## '+sel;cur=start+ins.length;}
  else if(type==='h3'){ins='\n### '+sel;cur=start+ins.length;}
  else if(type==='bold'){ins='**'+(sel||'testo')+'**';cur=start+(sel?ins.length:3);}
  else if(type==='italic'){ins='*'+(sel||'testo')+'*';cur=start+(sel?ins.length:1);}
  else if(type==='ul'){ins='\n- '+(sel||'elemento');cur=start+ins.length;}
  else if(type==='ol'){ins='\n1. '+(sel||'elemento');cur=start+ins.length;}
  else if(type==='quote'){ins='\n> '+(sel||'citazione');cur=start+ins.length;}
  else if(type==='hr'){ins='\n---\n';cur=start+ins.length;}
  else if(type==='link'){
    const url=prompt('URL link:','https://');
    if(!url)return;
    const label=sel||prompt('Testo del link:','Link')||'Link';
    ins='['+label+']('+url+')';cur=start+ins.length;
  }
  else if(type==='media'){
    const url=prompt('URL immagine/video:','https://');
    if(!url)return;
    const alt=sel||prompt('Descrizione (alt):','')||'';
    ins='\n!['+alt+']('+url+')\n';cur=start+ins.length;
  }

  ta.value=before+ins+after;
  ta.focus();ta.setSelectionRange(cur,cur);
  saveNotesText();updateNotesToc();updateNotesWc();
}

/* DATE FORMAT */
function fmtDate(iso){if(!iso)return'';const[y,m,d]=iso.split('-');if(!y||!m||!d)return iso;const giorni=['Dom','Lun','Mar','Mer','Gio','Ven','Sab'];const mesi=['Gen','Feb','Mar','Apr','Mag','Giu','Lug','Ago','Set','Ott','Nov','Dic'];const dt=new Date(parseInt(y),parseInt(m)-1,parseInt(d));return giorni[dt.getDay()]+' '+parseInt(d)+' '+mesi[parseInt(m)-1];}
function formatItalianDate(year,month,day){const weekdays=['Dom','Lun','Mar','Mer','Gio','Ven','Sab'];const months=['gennaio','febbraio','marzo','aprile','maggio','giugno','luglio','agosto','settembre','ottobre','novembre','dicembre'];const dow=new Date(year,month,day).getDay();return weekdays[dow]+' '+day+' '+months[month];}
function parseItalianDate(str){if(!str)return null;const iso=str.match(/(\d{4})-(\d{2})-(\d{2})/);if(iso)return new Date(parseInt(iso[1]),parseInt(iso[2])-1,parseInt(iso[3]));return null;}

function italianToISO(str){
  // Handles both "Lun 7 luglio" and "Lun 7 giugno 2026" and ISO "2026-06-07"
  if(!str)return null;
  // Already ISO
  if(/^\d{4}-\d{2}-\d{2}$/.test(str))return str;
  const mesiMap={gennaio:1,febbraio:2,marzo:3,aprile:4,maggio:5,giugno:6,luglio:7,agosto:8,settembre:9,ottobre:10,novembre:11,dicembre:12};
  const lower=str.toLowerCase();
  // Try "Lun 7 giugno 2026" or "7 giugno 2026"
  const m1=lower.match(/^(?:\w+\s+)?(\d{1,2})\s+(\w+)\s+(\d{4})$/);
  if(m1){const mo=mesiMap[m1[2]];if(mo)return isoDate(parseInt(m1[3]),mo,parseInt(m1[1]));}
  // Try "Lun 7 giugno" (no year) — use feedMonth year or current year
  const m2=lower.match(/^(?:\w+\s+)?(\d{1,2})\s+(\w+)$/);
  if(m2){const mo=mesiMap[m2[2]];if(mo){
    // Try to infer year from feedMonth
    let y=new Date().getFullYear();
    if(feedMonth){const fy=parseInt(feedMonth.split(' ').pop());if(!isNaN(fy))y=fy;}
    return isoDate(y,mo,parseInt(m2[1]));
  }}
  return null;
}

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
      if(dateMese!==feedMonth&&feedMonth){const destKey=accountId(feedClientIdx,feedAccountIdx)+'|||'+dateMese;if(!feeds[destKey])feeds[destKey]=[];feeds[destKey]=[{...item},...(feeds[destKey]||[])];items.splice(idx,1);setFeedItems(items);closeDatePicker();renderFeedGrid();showToast('✓ Post spostato in '+dateMese);}else{setFeedItems(items);closeDatePicker();renderFeedGrid();renderDatePickerContent(idx,document.getElementById('global-date-picker'));}
      autoSave();
    };
    grid.appendChild(btn);
  }
  popup.appendChild(grid);
  const clear=document.createElement('button');clear.className='dp-clear';clear.textContent='✕ Rimuovi data';clear.onclick=e=>{e.stopPropagation();const items=currentFeedItems();items[idx].date='';items[idx].showDate=false;setFeedItems(items);popup.classList.remove('open');dpOpenIdx=null;renderFeedGrid();};popup.appendChild(clear);
}
document.addEventListener('click',e=>{if(!e.target.closest('#global-date-picker')&&!e.target.closest('.dp-trigger-btn')&&!e.target.closest('.date-input'))closeDatePicker();},true);

// Close datepicker on scroll so it doesn't float away from the post
document.addEventListener('scroll',()=>closeDatePicker(),true);

/* EDIT CLIENT */
function openEditClientModal(ci){
  ecEditIdx=ci;const cl=clients[ci];if(!cl)return;
  document.getElementById('ec-name').value=cl.name;
  document.getElementById('ec-pkg').value=cl.pkg;
  document.getElementById('ec-status').value=cl.status;
  document.getElementById('ec-revenue').value=cl.revenue||'';
  document.getElementById('edit-client-title').textContent='Modifica — '+cl.name;
  ecTmpAccounts=(cl.accounts||[]).map(a=>({...a}));
  // Load brand palette
  const b=cl.brand||{primary:'#1a3c5e',secondary:'#c8a96e',bg:'#f5f0e8',text:'#111111'};
  ['primary','secondary','bg','text'].forEach(k=>{
    const inp=document.getElementById('ec-pal-'+k);if(inp)inp.value=b[k]||'';
    ecPalUpdate(k);
  });
  renderEcAccounts();openModal('edit-client-modal');
}
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
function ecPalUpdate(key){
  const inp=document.getElementById('ec-pal-'+key);if(!inp)return;
  const val=inp.value.trim();
  const hex=/^#[0-9a-fA-F]{6}$/.test(val)?val:'';
  const preview=document.getElementById('ec-pal-preview-'+key);
  const swatch=document.getElementById('ec-pal-swatch-'+key);
  if(preview)preview.style.background=hex||'#eee';
  if(swatch)swatch.style.background=hex||'#eee';
  ecPalLivePreview();
}
function ecPalLivePreview(){
  const get=k=>{const v=document.getElementById('ec-pal-'+k)?.value.trim();return /^#[0-9a-fA-F]{6}$/.test(v)?v:null;};
  const bg=get('bg')||'#f5f0e8',primary=get('primary')||'#1a3c5e',secondary=get('secondary')||'#c8a96e',text=get('text')||'#111';
  const cl=ecEditIdx>=0?clients[ecEditIdx]:null;const cname=cl?cl.name.split(' ')[0]:'Cliente';
  // Feed preview
  const feed=document.getElementById('ec-pal-card-feed');
  if(feed){feed.style.background=bg;feed.style.color=text;
    feed.innerHTML=`<div style="font-size:6px;font-weight:700;letter-spacing:.8px;text-transform:uppercase;opacity:.5;margin-bottom:5px;">Insight · ${cname}</div><div style="font-size:10px;font-weight:800;line-height:1.1;flex:1;letter-spacing:-.3px;">"Al centro di ogni progetto c'è <span style='color:${secondary};'>${cname}.</span>"</div><div style="height:1px;background:currentColor;opacity:.15;margin:4px 0;"></div><div style="font-size:6px;opacity:.55;line-height:1.4;">La qualità è ascolto e dedizione.</div><div style="font-size:6px;font-weight:700;opacity:.6;margin-top:5px;">${cname} · 2026</div>`;
  }
  // Story preview
  const story=document.getElementById('ec-pal-card-story');
  if(story){story.style.background=primary;story.style.color=bg;
    story.innerHTML=`<div style="font-size:5px;font-weight:700;letter-spacing:.8px;text-transform:uppercase;color:${secondary};margin-bottom:6px;">UGC</div><div style="font-size:8px;font-weight:800;line-height:1.1;flex:1;">"Finalmente un'azienda che <span style='color:${secondary};'>mantiene</span> le promesse."</div><div style="height:1px;background:${bg};opacity:.2;margin:4px 0;"></div><div style="font-size:5px;opacity:.7;margin-top:auto;">${cname}</div>`;
  }
}

function ecAddAccount(){const name=document.getElementById('ec-new-acc-name').value.trim();const platform=document.getElementById('ec-new-acc-platform').value;if(!name){document.getElementById('ec-new-acc-name').focus();return;}ecTmpAccounts.push({id:'a_'+Date.now(),name,platform});document.getElementById('ec-new-acc-name').value='';renderEcAccounts();}
function ecSave(){
  if(ecEditIdx<0)return;const name=document.getElementById('ec-name').value.trim();if(!name){document.getElementById('ec-name').focus();return;}
  const cl=clients[ecEditIdx];const oldName=cl.name;cl.name=name;cl.pkg=document.getElementById('ec-pkg').value;cl.status=document.getElementById('ec-status').value;cl.revenue=parseFloat(document.getElementById('ec-revenue').value)||0;
  const oldAccIds=new Set((cl.accounts||[]).map(a=>a.id));const newAccIds=new Set(ecTmpAccounts.map(a=>a.id));
  oldAccIds.forEach(aid=>{if(!newAccIds.has(aid)){
    // Delete ALL years of data, not just current MONTH_OPTIONS
    Object.keys(feeds).filter(k=>k.startsWith(aid+'|||')).forEach(k=>delete feeds[k]);
    Object.keys(stories).filter(k=>k.startsWith(aid+'|||')).forEach(k=>delete stories[k]);
    delete highlights[aid];
  }});
  cl.accounts=ecTmpAccounts.map(a=>({...a}));
  // Save brand palette
  const getPal=k=>{const v=document.getElementById('ec-pal-'+k)?.value.trim();return /^#[0-9a-fA-F]{6}$/.test(v)?v:null;};
  cl.brand={
    primary:getPal('primary')||'#1a3c5e',
    secondary:getPal('secondary')||'#c8a96e',
    bg:getPal('bg')||'#f5f0e8',
    text:getPal('text')||'#111111'
  };
  if(oldName!==name){
    // Rename across ALL years in pedPlans
    Object.keys(pedPlans).filter(k=>k.startsWith(oldName+'|||')).forEach(k=>{
      const newKey=name+'|||'+k.slice(oldName.length+3);
      pedPlans[newKey]=pedPlans[k];delete pedPlans[k];
    });
    // Rename across ALL years in notesData
    Object.keys(notesData).filter(k=>k.startsWith(oldName+'|||')).forEach(k=>{
      const newKey=name+'|||'+k.slice(oldName.length+3);
      notesData[newKey]=notesData[k];delete notesData[k];
    });
  }
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
  const data={version:'2.0',exportedAt:new Date().toISOString(),clients,feeds:ef,stories:es,highlights:eh,pedPlans,notesData,pilastri,meta:{showAllDates,showAllCopy,pedFreqDays:Array.from(pedFreqDays)}};
  const blob=new Blob([JSON.stringify(data,null,2)],{type:'application/json'});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download='nassa-progetto-'+new Date().toISOString().slice(0,10)+'.json';a.click();URL.revokeObjectURL(url);showToast('✓ Progetto esportato');
}
function importProject(){document.getElementById('import-input').click();}
function loadProjectFile(input){
  const file=input.files[0];if(!file)return;const reader=new FileReader();
  reader.onload=e=>{
    try{
      const data=JSON.parse(e.target.result);if(!data.version||!data.clients)throw new Error('File non valido');
      clients=data.clients||[];clients.forEach(c=>{if(!c.accounts)c.accounts=[];if(!c.id)c.id='c_'+Date.now()+'_'+Math.random();});
      feeds={};Object.keys(data.feeds||{}).forEach(k=>{feeds[k]=(data.feeds[k]||[]).map(item=>{const hasUrl=item.externalUrl&&item.externalUrl.startsWith('http');return{...item,type:(item.type==='pending'&&hasUrl)?'image':item.type,url:hasUrl?item.externalUrl:'',needsReload:!hasUrl&&!!item.name,slides:(item.slides||[]).map(s=>({...s,url:(s.externalUrl&&s.externalUrl.startsWith('http'))?s.externalUrl:''}))};})});
      stories={};Object.keys(data.stories||{}).forEach(k=>{stories[k]=(data.stories[k]||[]).map(st=>({...st,url:(st.externalUrl&&st.externalUrl.startsWith('http'))?st.externalUrl:'',needsReload:!(st.externalUrl&&st.externalUrl.startsWith('http'))&&!!st.name,slides:(st.slides||[]).map(s=>({...s,url:(s.externalUrl&&s.externalUrl.startsWith('http'))?s.externalUrl:''}))}))}); 
      highlights={};Object.keys(data.highlights||{}).forEach(k=>{highlights[k]=(data.highlights[k]||[]).map(h=>({name:h.name,coverUrl:(h.coverUrl&&h.coverUrl.startsWith('http'))?h.coverUrl:''}));});
      pedPlans={};Object.keys(data.pedPlans||{}).forEach(k=>{pedPlans[k]=data.pedPlans[k]||[];});
      notesData=data.notesData||{};
      pilastri=data.pilastri||{};
      // FIX 1: restore brand palette per client (was missing from import)
      clients.forEach(c=>{ if(!c.brand) c.brand={primary:'#1a3c5e',secondary:'#c8a96e',bg:'#f5f0e8',text:'#111111'}; });
      if(data.meta){showAllDates=data.meta.showAllDates!==false;showAllCopy=data.meta.showAllCopy!==false;if(Array.isArray(data.meta.pedFreqDays))pedFreqDays=new Set(data.meta.pedFreqDays);}
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
document.addEventListener('click',e=>{const sw=document.getElementById('user-switcher');if(sw&&!e.target.closest('#user-switcher')&&!e.target.closest('#user-avatar'))sw.classList.remove('open');});

async function switchUser(username){CLOUD.user=username;localStorage.setItem('nassa_user',username);const av=document.getElementById('user-avatar');if(av)av.textContent=username.slice(0,2).toUpperCase();document.getElementById('user-switcher')?.classList.remove('open');await loadFromCloud();}

async function loadFromCloud(){
  // Show loading overlay during boot
  CLOUD._booting=true;
  showBootOverlay(true);
  const result=await CLOUD.load();
  if(result?.data){
    CLOUD.apply(result.data);
    // Reset ALL client state to avoid bleed between users
    globalClientIdx=-1;previewActiveAcc=0;
    feedClientIdx=-1;feedAccountIdx=-1;feedMonth='';
    storiesClientIdx=-1;storiesAccountIdx=-1;storiesMonth='';
    previewClientIdx=-1;previewAccountIdx=-1;previewMonth='';
    notesClientIdx=-1;notesMonth='';
    updateGlobalClientUI();
    renderStudio();rebuildAllSelects();rebuildGlobalClientSelect();
    renderFeedGrid();renderStoriesGrid();updateFeedHeader();updateStoriesHeader();
    showToast('✓ Dati caricati dal cloud');
  } else {
    CLOUD.setStatus('idle');
  }
  CLOUD._booting=false;
  showBootOverlay(false);
}

function showBootOverlay(show){
  let ov=document.getElementById('boot-overlay');
  if(show){
    if(!ov){
      ov=document.createElement('div');ov.id='boot-overlay';
      ov.style.cssText='position:fixed;inset:0;background:var(--bg,#f5f5f7);z-index:9999;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:16px;transition:opacity .3s;';
      const logo=document.createElement('div');logo.style.cssText='width:48px;height:48px;background:#0dff00;border-radius:10px;display:flex;align-items:center;justify-content:center;color:#111;font-size:22px;font-weight:700;';logo.textContent='N';
      const txt=document.createElement('div');txt.style.cssText='font-size:13px;color:#6b6b6b;font-family:Inter,sans-serif;';txt.textContent='Caricamento dati…';
      const dot=document.createElement('div');dot.style.cssText='display:flex;gap:6px;';
      for(let i=0;i<3;i++){const d=document.createElement('div');d.style.cssText='width:7px;height:7px;border-radius:50%;background:#0dff00;opacity:.3;animation:bounce .8s ease-in-out '+(i*0.15)+'s infinite alternate;';dot.appendChild(d);}
      const style=document.createElement('style');style.textContent='@keyframes bounce{to{opacity:1;transform:translateY(-4px)}}';
      ov.appendChild(style);ov.appendChild(logo);ov.appendChild(txt);ov.appendChild(dot);
      document.body.appendChild(ov);
    }
    ov.style.opacity='1';ov.style.pointerEvents='all';
  } else {
    if(ov){ov.style.opacity='0';ov.style.pointerEvents='none';setTimeout(()=>ov?.remove(),350);}
  }
}

/* ════════ CARD EDITORIALE ════════ */
let edTheme='light', edFmt='feed';

function addPendingSlot(){
  if(feedAccountIdx<0){showToast('Seleziona cliente e account','warn');return;}
  const items=currentFeedItems();
  items.unshift({type:'pending',url:'',name:'',date:'',showDate:false,copy:'',linkedStories:[],slides:[]});
  setFeedItems(items);refreshFeed();autoSave();showToast('✓ Slot aggiunto');
}

function openEditorialModal(){
  // Pre-fill client name in eyebrow
  const cl=clients[globalClientIdx>=0?globalClientIdx:0];
  if(cl){
    const inp=document.getElementById('ed-eyebrow');
    if(inp&&!inp.value)inp.value='Insight · '+cl.name.split(' ')[0];
  }
  document.getElementById('ed-title').value='';
  document.getElementById('ed-accent').value='';
  document.getElementById('ed-copy').value='';
  document.getElementById('ed-author').value='';
  edTheme='light';edFmt='feed';
  document.querySelectorAll('.ed-theme-btn').forEach(b=>{b.classList.toggle('active',b.dataset.theme==='light'||b.dataset.fmt==='feed');});
  renderEdPreview();
  openModal('editorial-modal');
}

function setEdTheme(t){
  edTheme=t;
  document.querySelectorAll('[data-theme]').forEach(b=>b.classList.toggle('active',b.dataset.theme===t));
  renderEdPreview();
}
function setEdFmt(f){
  edFmt=f;
  document.querySelectorAll('[data-fmt]').forEach(b=>b.classList.toggle('active',b.dataset.fmt===f));
  renderEdPreview();
}

function getEdColors(){
  const cl=clients[globalClientIdx>=0?globalClientIdx:0];
  const brand=cl?.brand||{primary:'#1a3c5e',secondary:'#c8a96e',bg:'#f5f0e8',text:'#111111'};
  if(edTheme==='dark')  return {bg:'#111',text:'#f5f0e8',accent:brand.secondary||'#0dff00',logo:'#0dff00',logoText:'#111'};
  if(edTheme==='brand') return {bg:brand.primary,text:brand.bg||'#f5f0e8',accent:brand.secondary,logo:brand.bg,logoText:brand.primary};
  return {bg:brand.bg||'#f5f0e8',text:brand.text||'#111',accent:brand.primary,logo:'#0dff00',logoText:'#111'};
}

function renderEdPreview(){
  const wrap=document.getElementById('ed-preview-wrap');
  const card=document.getElementById('ed-card-preview');
  if(!card)return;
  const cols=getEdColors();
  const eyebrow=document.getElementById('ed-eyebrow')?.value||'Insight';
  const titleRaw=document.getElementById('ed-title')?.value||'"Il tuo titolo grande qui."';
  const accentWord=document.getElementById('ed-accent')?.value?.trim();
  const copy=document.getElementById('ed-copy')?.value||'Il testo descrittivo appare qui sotto il titolo.';
  const author=document.getElementById('ed-author')?.value||'Firma · 2026';
  // Highlight accent word in title
  const titleHtml=accentWord&&titleRaw.includes(accentWord)
    ?titleRaw.replace(accentWord,`<span style="color:${cols.accent};">${accentWord}</span>`)
    :titleRaw;
  card.className='ed-card-preview '+(edFmt==='story'?'story-fmt':'feed-fmt');
  card.style.cssText=`background:${cols.bg};color:${cols.text};`;
  const titleSize=edFmt==='story'?'14px':'22px';
  const copySize=edFmt==='story'?'7px':'8px';
  card.innerHTML=`
    <div class="ecp-eyebrow" style="color:${cols.text};">${eyebrow}</div>
    <div class="ecp-title" style="font-size:${titleSize};flex:1;">${titleHtml}</div>
    <div class="ecp-div"></div>
    <div class="ecp-copy" style="font-size:${copySize};">${copy}</div>
    <div class="ecp-footer">
      <div class="ecp-author">${author}</div>
      <div class="ecp-logo" style="background:${cols.logo};color:${cols.logoText};">N</div>
    </div>`;
}

function saveEditorialCard(){
  const eyebrow=document.getElementById('ed-eyebrow')?.value||'';
  const title=document.getElementById('ed-title')?.value||'';
  const accent=document.getElementById('ed-accent')?.value||'';
  const copy=document.getElementById('ed-copy')?.value||'';
  const author=document.getElementById('ed-author')?.value||'';
  if(!title){document.getElementById('ed-title').focus();showToast('Aggiungi un titolo','warn');return;}
  const cols=getEdColors();
  const item={
    type:'editorial',
    editorialTheme:edTheme,
    editorialFmt:edFmt,
    editorialEyebrow:eyebrow,
    editorialTitle:title,
    editorialAccent:accent,
    editorialCopy:copy,
    editorialAuthor:author,
    editorialColors:cols,
    copy:title,
    date:'',
    showDate:false,
    url:'',
    name:'Card: '+title.slice(0,20),
  };
  if(edFmt==='feed'){
    const items=currentFeedItems();items.push(item);setFeedItems(items);
    closeModal('editorial-modal');refreshFeed();showToast('✓ Card aggiunta al feed');
    switchTab('feed');
  } else {
    const st={...item,isStoryboard:false,date:'',note:''};
    const arr=currentStoryItems();arr.push(st);setStoryItems(arr);
    closeModal('editorial-modal');refreshStories();showToast('✓ Card aggiunta alle stories');
    switchTab('stories');
  }
}

/* ════════ PILASTRI CONTENUTO ════════ */
// Default pillars — per client, stored in pilastri object
// pilastri = { clientName: [{id, name, color, description, postIds:[]}] }
let pilastri = {};

const PILASTRI_COLORS = [
  '#b2ebf2', // turchese — Foto
  '#b2dfdb', // verde acqua — Reel
  '#f0f4b2', // giallo lime — Carosello
  '#0dff00', // verde brand
  '#ffb2b2', // rosso soft
  '#c8b2f2', // viola soft
  '#ffd6b2', // arancio soft
  '#b2d4f2', // blu soft
];
// Text colors paired with each background
const PILASTRI_TEXT = {
  '#b2ebf2':'#006064',
  '#b2dfdb':'#004d40',
  '#f0f4b2':'#616100',
  '#0dff00':'#111',
  '#ffb2b2':'#7f0000',
  '#c8b2f2':'#3d0080',
  '#ffd6b2':'#7a3500',
  '#b2d4f2':'#003d80',
};
const PILASTRI_DEFAULT = [
  {name:'Educativo',    color:'#b2ebf2', description:'Tutorial, spiegazioni, come funziona'},
  {name:'Istituzionale',color:'#b2dfdb', description:'Azienda, team, valori, storia'},
  {name:'Promozionale', color:'#f0f4b2', description:'Offerte, prodotti, servizi'},
  {name:'Ispirazionale',color:'#0dff00', description:'Citazioni, storie, emozioni'},
];

function getPilastri(clientName){
  if(!pilastri[clientName]){
    pilastri[clientName]=PILASTRI_DEFAULT.map((p,i)=>({
      id:'p_'+Date.now()+'_'+i,
      name:p.name,color:p.color,
      description:p.description,
      postIds:[]
    }));
  }
  return pilastri[clientName];
}

function renderPilastri(){
  const body=document.getElementById('pilastri-body');if(!body)return;
  body.innerHTML='';

  // Header — client from global context, shown in subtopbar
  const header=document.createElement('div');header.className='pilastri-header';
  const title=document.createElement('h2');title.className='pilastri-title';title.textContent='Pilastri contenuto';
  header.appendChild(title);
  body.appendChild(header);

  const content=document.createElement('div');content.id='pilastri-content';body.appendChild(content);

  const ci=globalClientIdx>=0?globalClientIdx:(clients.length>0?0:-1);
  if(ci>=0){renderPilastriContent(body,ci);}
  else{content.innerHTML='<div style="text-align:center;padding:60px;color:var(--text-3);font-size:13px;">Aggiungi un cliente per configurare i pilastri.</div>';}
}

function renderPilastriContent(body,ci){
  const content=document.getElementById('pilastri-content');if(!content)return;content.innerHTML='';
  const cl=clients[ci];if(!cl)return;
  const pils=getPilastri(cl.name);

  // Stats bar
  const statsBar=document.createElement('div');statsBar.className='pilastri-stats-bar';
  // Count posts per pillar across all months
  const allPosts=[];
  Object.keys(feeds).filter(k=>cl.accounts?.some(a=>k.startsWith(a.id+'|||'))).forEach(k=>{
    (feeds[k]||[]).filter(it=>it.type!=='pending').forEach(it=>allPosts.push(it));
  });
  const total=allPosts.length;
  pils.forEach(p=>{
    const count=allPosts.filter(it=>it.pillarId===p.id).length;
    const pct=total>0?Math.round(count/total*100):0;
    const chip=document.createElement('div');chip.className='pilastri-stat-chip';
    chip.innerHTML=`<span class="ps-dot" style="background:${p.color}"></span><span class="ps-name">${p.name}</span><span class="ps-count">${count} post (${pct}%)</span>`;
    statsBar.appendChild(chip);
  });
  const unassigned=allPosts.filter(it=>!it.pillarId).length;
  if(unassigned>0){const chip=document.createElement('div');chip.className='pilastri-stat-chip';chip.innerHTML=`<span class="ps-dot" style="background:#aaa"></span><span class="ps-name" style="color:var(--text-3)">Non assegnati</span><span class="ps-count" style="color:var(--text-3)">${unassigned}</span>`;statsBar.appendChild(chip);}
  content.appendChild(statsBar);

  // Distribution bar
  if(total>0){
    const distBar=document.createElement('div');distBar.className='pilastri-dist-bar';
    pils.forEach(p=>{
      const count=allPosts.filter(it=>it.pillarId===p.id).length;
      const pct=count/total*100;
      if(pct>0){const seg=document.createElement('div');seg.className='dist-seg';seg.style.cssText=`width:${pct}%;background:${p.color};`;seg.title=`${p.name}: ${Math.round(pct)}%`;distBar.appendChild(seg);}
    });
    const unPct=unassigned/total*100;
    if(unPct>0){const seg=document.createElement('div');seg.className='dist-seg';seg.style.cssText=`width:${unPct}%;background:#ddd;`;seg.title=`Non assegnati: ${Math.round(unPct)}%`;distBar.appendChild(seg);}
    content.appendChild(distBar);
  }

  // Pillar cards grid
  const grid=document.createElement('div');grid.className='pilastri-grid';

  pils.forEach((p,pi)=>{
    const card=document.createElement('div');card.className='pilastri-card';
    card.style.borderTopColor=p.color;card.dataset.textColor=PILASTRI_TEXT[p.color]||'#111';

    // Card header
    const cardHead=document.createElement('div');cardHead.className='pilastri-card-head';
    const colorDot=document.createElement('div');colorDot.className='p-color-dot';colorDot.style.background=p.color;colorDot.style.border='.5px solid '+(PILASTRI_TEXT[p.color]||'#111');
    const nameInp=document.createElement('input');nameInp.className='p-name-inp';nameInp.value=p.name;
    nameInp.oninput=e=>{pils[pi].name=e.target.value;autoSave();};
    const colorSel=document.createElement('div');colorSel.className='p-color-sel';
    PILASTRI_COLORS.forEach(col=>{const dot=document.createElement('div');dot.className='p-color-opt'+(col===p.color?' active':'');dot.style.background=col;dot.style.border='.5px solid '+(PILASTRI_TEXT[col]||'#111');dot.onclick=()=>{pils[pi].color=col;card.style.borderTopColor=col;colorDot.style.background=col;colorDot.style.border='.5px solid '+(PILASTRI_TEXT[col]||'#111');colorSel.querySelectorAll('.p-color-opt').forEach(d=>d.classList.remove('active'));dot.classList.add('active');autoSave();};colorSel.appendChild(dot);});
    const delBtn=document.createElement('button');delBtn.className='p-del-btn';delBtn.textContent='✕';delBtn.title='Elimina pilastro';
    delBtn.onclick=()=>{if(confirm('Eliminare il pilastro "'+p.name+'"?')){pils.splice(pi,1);pilastri[cl.name]=pils;autoSave();renderPilastriContent(body,ci);}};
    cardHead.appendChild(colorDot);cardHead.appendChild(nameInp);cardHead.appendChild(delBtn);

    const descInp=document.createElement('input');descInp.className='p-desc-inp';descInp.placeholder='Descrizione breve…';descInp.value=p.description||'';
    descInp.oninput=e=>{pils[pi].description=e.target.value;autoSave();};

    // Posts assigned to this pillar
    const postsWrap=document.createElement('div');postsWrap.className='p-posts-wrap';
    const pillarPosts=allPosts.filter(it=>it.pillarId===p.id);
    if(pillarPosts.length){
      const postsGrid=document.createElement('div');postsGrid.className='p-posts-mini';
      pillarPosts.slice(0,6).forEach(it=>{
        const th=document.createElement('div');th.className='p-post-th';
        const coverUrl=it.type==='carousel'&&it.slides?.[0]?it.slides[0].url:it.url;
        if(coverUrl){const img=document.createElement('img');img.src=coverUrl;img.alt='';img.style.cssText='width:100%;height:100%;object-fit:cover;border-radius:3px;';th.appendChild(img);}
        else{th.style.background='#ddd';th.innerHTML=`<span style="font-size:10px;">${it.type==='video'?'▶':'🖼'}</span>`;}
        // Click to unassign
        th.title='Clicca per rimuovere';th.onclick=()=>{it.pillarId=null;autoSave();renderPilastriContent(body,ci);};
        postsGrid.appendChild(th);
      });
      if(pillarPosts.length>6){const more=document.createElement('div');more.className='p-post-th more';more.innerHTML=`+${pillarPosts.length-6}`;postsGrid.appendChild(more);}
      postsWrap.appendChild(postsGrid);
    } else {
      postsWrap.innerHTML='<div class="p-posts-empty">Nessun post assegnato</div>';
    }

    // Assign posts dropdown
    const assignWrap=document.createElement('div');assignWrap.className='p-assign-wrap';
    const unassignedPosts=allPosts.filter(it=>!it.pillarId);
    if(unassignedPosts.length){
      const assignLbl=document.createElement('div');assignLbl.className='p-assign-lbl';assignLbl.textContent='+ Assegna post:';
      const assignSel=document.createElement('select');assignSel.className='p-assign-sel';
      assignSel.innerHTML='<option value="">— seleziona post —</option>';
      unassignedPosts.forEach((it,ii)=>{const o=document.createElement('option');o.value=ii;o.textContent=(it.copy?it.copy.slice(0,30)+'…':it.name||'Post '+(ii+1));assignSel.appendChild(o);});
      assignSel.onchange=e=>{if(e.target.value==='')return;const idx=parseInt(e.target.value);unassignedPosts[idx].pillarId=p.id;autoSave();renderPilastriContent(body,ci);};
      assignWrap.appendChild(assignLbl);assignWrap.appendChild(assignSel);
    }

    card.appendChild(cardHead);card.appendChild(colorSel);card.appendChild(descInp);card.appendChild(postsWrap);card.appendChild(assignWrap);
    grid.appendChild(card);
  });

  // Add pillar button
  const addCard=document.createElement('div');addCard.className='pilastri-card add-pillar';
  addCard.innerHTML='<div style="font-size:24px;color:var(--text-3);">+</div><div style="font-size:12px;color:var(--text-3);margin-top:6px;">Aggiungi pilastro</div>';
  addCard.onclick=()=>{
    pils.push({id:'p_'+Date.now(),name:'Nuovo pilastro',color:PILASTRI_COLORS[pils.length%PILASTRI_COLORS.length],description:'',postIds:[]});
    pilastri[cl.name]=pils;autoSave();renderPilastriContent(body,ci);
  };
  grid.appendChild(addCard);
  content.appendChild(grid);
}

/* SIDEBAR TOGGLE */
let sidebarExpanded = localStorage.getItem('sb_expanded') === '1';
let feedPanelOpen = false;
function toggleFeedPanel(){
  feedPanelOpen=!feedPanelOpen;
  const panel=document.getElementById('feed-ctx-panel');
  const icon=document.getElementById('feed-expand-icon');
  const btn=document.getElementById('feed-expand-btn');
  if(panel){
    panel.classList.toggle('open',feedPanelOpen);
    if(feedPanelOpen&&btn){
      const r=btn.closest('.feed-ctx-bar').getBoundingClientRect();
      panel.style.top=r.bottom+'px';
    }
  }
  if(icon)icon.innerHTML=feedPanelOpen
    ?'<polyline points="18 15 12 9 6 15"/>'
    :'<polyline points="6 9 12 15 18 9"/>';
}

function toggleSidebar(){
  sidebarExpanded = !sidebarExpanded;
  localStorage.setItem('sb_expanded', sidebarExpanded ? '1' : '0');
  applySidebarState();
}
function applySidebarState(){
  const sb=document.getElementById('sidebar');
  const tbBrand=document.getElementById('topbar-brand');
  const icon=document.getElementById('sb-toggle-icon');
  if(!sb)return;
  if(sidebarExpanded){
    sb.classList.add('sb-expanded');
    if(tbBrand)tbBrand.classList.add('expanded');
    if(icon)icon.innerHTML='<polyline points="15 18 9 12 15 6"/>';
  } else {
    sb.classList.remove('sb-expanded');
    if(tbBrand)tbBrand.classList.remove('expanded');
    if(icon)icon.innerHTML='<polyline points="9 18 15 12 9 6"/>';
  }
}

function autoSave(){if(CLOUD._booting)return;CLOUD.scheduleSave(()=>CLOUD.snapshot());}


/* ════ ADS TAB ════ */
let adsCampaigns = {}; // key: clientName, value: [{id,name,platform,budget,spent,roas,roasTarget,cpc,impressions,status}]
let adsEditId = null;
let adsFilter = 'all';

const ADS_PLATFORM_LABELS = {
  instagram:'Instagram', facebook:'Facebook', meta:'Meta (IG+FB)',
  linkedin:'LinkedIn', google:'Google'
};
const ADS_PLATFORM_COLORS = {
  instagram:'ig', facebook:'fb', meta:'meta', linkedin:'li', google:'gg'
};

function currentAdsKey(){
  if(globalClientIdx<0)return null;
  return clients[globalClientIdx]?.name||null;
}

function currentAdsCampaigns(){
  const k=currentAdsKey();return k?(adsCampaigns[k]||[]):[];
}

function renderAdsTab(){
  const camps=currentAdsCampaigns();
  const cl=globalClientIdx>=0?clients[globalClientIdx]:null;
  const el=id=>document.getElementById(id);

  if(el('ads-page-title'))el('ads-page-title').textContent=(cl?cl.name+' — ':''  )+'Performance Ads';

  // Metrics
  const active=camps.filter(c=>c.status==='active');
  const totalBudget=camps.reduce((s,c)=>s+(c.budget||0),0);
  const totalSpent=camps.reduce((s,c)=>s+(c.spent||0),0);
  const avgRoas=active.length?
    (active.reduce((s,c)=>s+(c.roas||0),0)/active.length).toFixed(1):0;
  const totalImp=camps.reduce((s,c)=>s+(c.impressions||0),0);

  const metrics=el('ads-metrics');
  if(metrics){
    metrics.innerHTML=[
      {lbl:'Budget totale',val:'€'+totalBudget.toLocaleString('it'),sub:totalSpent?'€'+totalSpent.toLocaleString('it')+' spesi':'—'},
      {lbl:'ROAS medio',val:avgRoas+'×',sub:active.length+' camp. attive',cls:parseFloat(avgRoas)>=4?'up':parseFloat(avgRoas)>0&&parseFloat(avgRoas)<3?'dn':''},
      {lbl:'CPC medio',val:active.length?'€'+(active.reduce((s,c)=>s+(c.cpc||0),0)/active.length).toFixed(2):'—',sub:''},
      {lbl:'Impression tot.',val:totalImp>=1000?(totalImp/1000).toFixed(1)+'K':totalImp||'—',sub:''},
      {lbl:'Campagne',val:active.length+'/'+camps.length,sub:'attive / totali'}
    ].map(m=>`<div class="ads-metric">
      <div class="ads-metric-lbl">${m.lbl}</div>
      <div class="ads-metric-val">${m.val}</div>
      ${m.sub?`<div class="ads-metric-sub ${m.cls||''}">${m.sub}</div>`:''}
    </div>`).join('');
  }

  // Alert: ROAS below target
  const alert=el('ads-alert');
  if(alert){
    const under=camps.filter(c=>c.status==='active'&&c.roas>0&&c.roasTarget>0&&c.roas<c.roasTarget);
    if(under.length){
      const names=under.map(c=>'"'+c.name+'" ('+c.roas+'× vs target '+c.roasTarget+'×)').join(', ');
      alert.style.display='flex';
      alert.innerHTML=`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
      ROAS sotto target: ${names}`;
    } else {
      alert.style.display='none';
    }
  }

  // Chart bars per platform
  const bars=el('ads-bars');
  if(bars){
    const byPlatform={};
    camps.forEach(c=>{const p=c.platform||'altro';byPlatform[p]=(byPlatform[p]||0)+(c.spent||0);});
    const maxSpent=Math.max(...Object.values(byPlatform),1);
    const colors={instagram:'#3b82f6',facebook:'#8b5cf6',meta:'#7c3aed',linkedin:'#22c55e',google:'#f59e0b'};
    bars.innerHTML=Object.entries(byPlatform).sort((a,b)=>b[1]-a[1]).map(([p,s])=>`
      <div class="ads-bar-row">
        <span class="ads-bar-lbl">${ADS_PLATFORM_LABELS[p]||p}</span>
        <div class="ads-bar-track"><div class="ads-bar-fill" style="width:${Math.round(s/maxSpent*100)}%;background:${colors[p]||'#888'};"></div></div>
        <span class="ads-bar-val">€${s.toLocaleString('it')}</span>
      </div>`).join('');
    if(!Object.keys(byPlatform).length)bars.innerHTML='<div style="font-size:11px;color:var(--text-3);text-align:center;padding:12px 0;">Nessun dato di spesa</div>';
  }

  // Filter buttons
  const filterRow=el('ads-filter-row');
  if(filterRow){
    const platforms=['all',...new Set(camps.map(c=>c.platform))];
    filterRow.innerHTML=platforms.map(p=>`
      <button class="ads-filt${adsFilter===p?' active':''}" onclick="adsSetFilter('${p}',this)">
        ${p==='all'?'Tutte':ADS_PLATFORM_LABELS[p]||p}
      </button>`).join('');
  }

  renderAdsCampList(camps);
}

function renderAdsCampList(camps){
  const el=id=>document.getElementById(id);
  const list=el('ads-camp-list');if(!list)return;

  const filtered=adsFilter==='all'?camps:camps.filter(c=>c.platform===adsFilter);

  if(!filtered.length){
    list.innerHTML='<div class="ads-empty">Nessuna campagna. Clicca "+ Nuova campagna" per aggiungere.</div>';
    return;
  }

  list.innerHTML=filtered.map(camp=>{
    const pct=camp.budget>0?Math.round((camp.spent||0)/camp.budget*100):0;
    const roasCls=camp.roas>=4?'good':camp.roas>0&&camp.roas<3?'warn':'';
    const cpcCls=camp.cpc>0&&camp.cpc>1?'warn':'';
    const platCls=ADS_PLATFORM_COLORS[camp.platform]||'ig';
    return `<div class="ads-camp">
      <div>
        <div class="ads-camp-name">${camp.name}</div>
        <div class="ads-camp-meta">
          <span class="ads-plat ${platCls}">${ADS_PLATFORM_LABELS[camp.platform]||camp.platform}</span>
          <span class="ads-status ${camp.status}">${{active:'Attiva',paused:'In pausa',draft:'Bozza',ended:'Terminata'}[camp.status]||camp.status}</span>
          <span style="font-size:10px;color:var(--text-3);">€${(camp.spent||0).toLocaleString('it')} / €${(camp.budget||0).toLocaleString('it')} (${pct}%)</span>
        </div>
      </div>
      <div class="ads-camp-kpis">
        <div class="ads-kpi"><div class="ads-kpi-val ${roasCls}">${camp.roas?camp.roas+'×':'—'}</div><div class="ads-kpi-lbl">ROAS</div></div>
        <div class="ads-div"></div>
        <div class="ads-kpi"><div class="ads-kpi-val ${cpcCls}">€${camp.cpc?(camp.cpc).toFixed(2):'—'}</div><div class="ads-kpi-lbl">CPC</div></div>
        <div class="ads-div"></div>
        <div class="ads-kpi"><div class="ads-kpi-val">${camp.impressions>=1000?(camp.impressions/1000).toFixed(1)+'K':camp.impressions||'—'}</div><div class="ads-kpi-lbl">Impression</div></div>
        <div class="ads-div"></div>
        <button class="btn sm" onclick="openEditAdsCampaign('${camp.id}')">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:12px;height:12px;"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
        </button>
        <button class="ads-camp-del" onclick="deleteAdsCampaign('${camp.id}')">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:12px;height:12px;"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/></svg>
        </button>
      </div>
    </div>`;
  }).join('');
}

function adsSetFilter(f,el){
  adsFilter=f;
  document.querySelectorAll('.ads-filt').forEach(b=>b.classList.remove('active'));
  el.classList.add('active');
  renderAdsCampList(currentAdsCampaigns());
}

function openAddAdsCampaignModal(){
  adsEditId=null;
  const el=id=>document.getElementById(id);
  el('ads-modal-title').textContent='Nuova campagna Ads';
  el('adm-name').value='';
  el('adm-platform').value='instagram';
  el('adm-budget').value='';
  el('adm-spent').value='';
  el('adm-roas').value='';
  el('adm-cpc').value='';
  el('adm-imp').value='';
  el('adm-status').value='active';
  el('adm-roas-target').value='';
  openModal('ads-camp-modal');
}

function openEditAdsCampaign(id){
  const camp=currentAdsCampaigns().find(c=>c.id===id);
  if(!camp)return;
  adsEditId=id;
  const el=i=>document.getElementById(i);
  el('ads-modal-title').textContent='Modifica campagna';
  el('adm-name').value=camp.name||'';
  el('adm-platform').value=camp.platform||'instagram';
  el('adm-budget').value=camp.budget||'';
  el('adm-spent').value=camp.spent||'';
  el('adm-roas').value=camp.roas||'';
  el('adm-cpc').value=camp.cpc||'';
  el('adm-imp').value=camp.impressions||'';
  el('adm-status').value=camp.status||'active';
  el('adm-roas-target').value=camp.roasTarget||'';
  openModal('ads-camp-modal');
}

function saveAdsCampaign(){
  const g=id=>document.getElementById(id)?.value.trim()||'';
  const name=g('adm-name');
  if(!name){showToast('Inserisci il nome','warn');return;}
  const k=currentAdsKey();
  if(!k){showToast('Nessun cliente selezionato','warn');return;}
  if(!adsCampaigns[k])adsCampaigns[k]=[];
  const entry={
    id:adsEditId||('ads_'+Date.now()),
    name, platform:g('adm-platform'),
    budget:parseFloat(g('adm-budget'))||0,
    spent:parseFloat(g('adm-spent'))||0,
    roas:parseFloat(g('adm-roas'))||0,
    roasTarget:parseFloat(g('adm-roas-target'))||0,
    cpc:parseFloat(g('adm-cpc'))||0,
    impressions:parseInt(g('adm-imp'))||0,
    status:g('adm-status')||'active',
    updatedAt:new Date().toISOString()
  };
  if(adsEditId){
    const idx=adsCampaigns[k].findIndex(c=>c.id===adsEditId);
    if(idx>=0)adsCampaigns[k][idx]=entry;
  } else {
    adsCampaigns[k].push(entry);
  }
  closeModal('ads-camp-modal');
  autoSave();
  renderAdsTab();
  showToast(adsEditId?'✓ Campagna aggiornata':'✓ Campagna aggiunta');
}

function deleteAdsCampaign(id){
  if(!confirm('Eliminare questa campagna?'))return;
  const k=currentAdsKey();if(!k)return;
  adsCampaigns[k]=(adsCampaigns[k]||[]).filter(c=>c.id!==id);
  autoSave();renderAdsTab();showToast('Campagna eliminata');
}

/* INIT */
function init(){
  applySidebarState();
  const fdz=document.getElementById('feed-drop-zone');if(fdz){fdz.addEventListener('dragover',e=>{e.preventDefault();fdz.classList.add('drag-over');});fdz.addEventListener('dragleave',e=>{if(!fdz.contains(e.relatedTarget))fdz.classList.remove('drag-over');});fdz.addEventListener('drop',e=>{e.preventDefault();fdz.classList.remove('drag-over');queueFeedFiles(e.dataTransfer.files);});}
  const sdz=document.getElementById('stories-drop-zone');if(sdz){sdz.addEventListener('dragover',e=>{e.preventDefault();sdz.classList.add('drag-over');});sdz.addEventListener('dragleave',e=>{if(!sdz.contains(e.relatedTarget))sdz.classList.remove('drag-over');});sdz.addEventListener('drop',e=>{e.preventDefault();sdz.classList.remove('drag-over');queueStoryFiles(e.dataTransfer.files);});}
  const cuzEl=document.getElementById('c-upload-zone');if(cuzEl){cuzEl.addEventListener('dragover',e=>{e.preventDefault();cuzEl.classList.add('drag-over');});cuzEl.addEventListener('dragleave',()=>cuzEl.classList.remove('drag-over'));cuzEl.addEventListener('drop',e=>{e.preventDefault();cuzEl.classList.remove('drag-over');addCarouselFiles(e.dataTransfer.files);});}
  const hluz=document.getElementById('hl-upload-zone');if(hluz){hluz.addEventListener('dragover',e=>{e.preventDefault();hluz.classList.add('drag-over');});hluz.addEventListener('dragleave',()=>hluz.classList.remove('drag-over'));hluz.addEventListener('drop',e=>{e.preventDefault();hluz.classList.remove('drag-over');setHlCover(e.dataTransfer.files);});}
  renderStudio();rebuildAllSelects();renderFeedGrid();renderStoriesGrid();updateFeedHeader();updateStoriesHeader();
}

window.addEventListener('beforeunload',e=>{
  if(DROPBOX.uploading>0){
    e.preventDefault();
    e.returnValue='Ci sono '+DROPBOX.uploading+' file ancora in caricamento su Dropbox. Uscire ora li perderai.';
  }
});

document.addEventListener('DOMContentLoaded',async()=>{
  init();const av=document.getElementById('user-avatar');if(av)av.textContent=CLOUD.user.slice(0,2).toUpperCase();
  await loadFromCloud();
});
