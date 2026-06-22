function renderEdPreview(){
  const eyebrow = document.getElementById('ed-eyebrow')?.value||'';
  const title   = document.getElementById('ed-title')?.value||'';
  const accent  = document.getElementById('ed-accent')?.value||'';
  const copy    = document.getElementById('ed-copy')?.value||'';
  const cols    = getEdColors();

  // Aggiorna colori sfondo
  const wrap  = document.getElementById('ed-preview-wrap');
  const inner = document.getElementById('ed-preview-inner');
  const badge = document.getElementById('ed-prev-badge');
  if(!wrap) return;
  wrap.style.background = cols.bg;
  if(inner){ inner.style.color = cols.text; }
  if(badge){ badge.style.background = cols.logo; badge.style.color = cols.logoText; }

  // Aspect ratio formato
  wrap.style.aspectRatio = edFmt === 'story' ? '9/16' : '4/5';

  // Testi
  const el = id => document.getElementById(id);
  if(el('ed-prev-eyebrow')) el('ed-prev-eyebrow').textContent = eyebrow;

  // Titolo con parola colorata
  if(el('ed-prev-title')){
    if(accent && title.includes(accent)){
      el('ed-prev-title').innerHTML = esc(title).replace(
        esc(accent),
        `<span style="color:${cols.accent};">${esc(accent)}</span>`
      );
    } else {
      el('ed-prev-title').textContent = title;
    }
  }
  if(el('ed-prev-copy')) el('ed-prev-copy').textContent = copy.slice(0,100);
  // Placeholder titolo se vuoto
  if(el('ed-prev-title') && !title) el('ed-prev-title').textContent = 'Titolo';
  // Aggiorna aspect-ratio wrap
  const wr=el('ed-preview-wrap');
  if(wr) wr.style.aspectRatio = edFmt==='story' ? '9/16' : '4/5';
}/* ══════════════════════════════════════════
   UTILITIES — helpers globali usati in tutto il file
══════════════════════════════════════════ */

/**
 * safeLocalJSON — parse sicuro da localStorage.
 * Se il valore è corrotto o mancante, restituisce il fallback
 * senza crashare l'app. Logga in console per debug.
 */
function safeLocalJSON(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    if (raw === null) return fallback;
    return JSON.parse(raw);
  } catch (e) {
    console.warn('[safeLocalJSON] Chiave corrotta in localStorage:', key, e.message);
    // Rimuove il valore corrotto per evitare loop di crash
    try { localStorage.removeItem(key); } catch(_) {}
    return fallback;
  }
}

/**
 * esc — escape HTML per prevenire XSS in innerHTML.
 * Usare SEMPRE quando si interpolano dati utente in innerHTML.
 * Esempio: el.innerHTML = `<td>${esc(client.name)}</td>`
 */
function esc(str) {
  return String(str == null ? '' : str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;');
}

/* ══ PKG BADGE HELPER ══ */
function pkgBadge(pkg){
  const tiers={
    'Starter':     {cls:'pkg-starter',     icon:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="11" height="11"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>'},
    'Essential':   {cls:'pkg-essential',   icon:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="11" height="11"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><polyline points="9 12 11 14 15 10"/></svg>'},
    'Professional':{cls:'pkg-professional',icon:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="11" height="11"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>'},
    'Full':        {cls:'pkg-full',         icon:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="11" height="11"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>'},
  };
  // Normalizza il valore: rimuove emoji e spazi iniziali
  // Gestisce valori legacy come '🥉 Starter', '🥈 Essential', '🥇 Professional'
  const clean = String(pkg||'').replace(/^[\p{Emoji}\p{Emoji_Presentation}\s]+/u,'').trim();
  // Cerca match esatto o parziale (case-insensitive) tra le chiavi
  const key = Object.keys(tiers).find(k=>clean.toLowerCase().startsWith(k.toLowerCase()))||'';
  const t = tiers[key]||{cls:'pkg-starter',icon:''};
  // Mostra solo la parola chiave pulita, senza emoji legacy
  const label = key || clean || esc(pkg);
  return `<span class="pkg-badge ${t.cls}">${t.icon} ${label}</span>`;
}


/* ══ CONFIRM MODAL — sostituisce confirm() nativo ══
 * Uso: showConfirm({ title, body, okLabel, type:'danger'|'warn', onOk })
 * type 'danger' → bottone rosso (eliminazioni irreversibili)
 * type 'warn'   → bottone ambra (azioni reversibili ma impattanti)
 */
let _confirmCallback = null;

function showConfirm({title='Conferma', body='', okLabel='Conferma', type='danger', onOk}){
  const el  = id => document.getElementById(id);
  const SVG_TRASH = '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/></svg>';
  const SVG_WARN  = '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>';
  
  el('confirm-icon').innerHTML  = type==='danger' ? SVG_TRASH : SVG_WARN;
  el('confirm-icon').className  = 'confirm-icon ' + type;
  el('confirm-title').textContent = title;
  el('confirm-body').innerHTML  = body;
  el('confirm-ok-btn').textContent = okLabel;
  el('confirm-ok-btn').className   = 'btn sm ' + type;
  
  _confirmCallback = onOk;
  openModal('confirm-modal');
  // Focus sul bottone Annulla per sicurezza (previene accidentale conferma)
  setTimeout(()=>el('confirm-cancel-btn')?.focus(), 50);
}

function confirmOk(){
  closeModal('confirm-modal');
  if(typeof _confirmCallback === 'function') _confirmCallback();
  _confirmCallback = null;
}

function confirmCancel(){
  closeModal('confirm-modal');
  _confirmCallback = null;
}

/* ══ TOAST-UNDO SYSTEM ══
 * Uso: showUndoToast(label, undoFn)
 * - Esegue l'azione immediatamente (già fatto dal chiamante)
 * - Mostra toast con "Annulla" per 5 secondi + barra countdown
 * - Se Annulla → chiama undoFn() e ri-renderizza
 * - Se scade → persiste (autoSave già schedulato dal chiamante)
 */
let _undoTimer = null;
let _undoBarTimer = null;

function showUndoToast(label, undoFn){
  // Cancella eventuale undo precedente pendente (ne può esistere uno solo)
  clearTimeout(_undoTimer);
  clearTimeout(_undoBarTimer);

  const t = document.getElementById('toast');
  if(!t) return;

  // Costruisce il toast con barra progress + link Annulla
  t.innerHTML = `
    <span class="toast-label">${label}</span>
    <button class="toast-undo-btn" onclick="triggerUndo()">Annulla</button>
    <div class="toast-progress-bar"><div class="toast-progress-fill" id="toast-progress-fill"></div></div>
  `;
  t.className = 'toast toast-undo';
  // Piccolo delay per trigger transition
  setTimeout(() => {
    t.classList.add('show');
    // Avvia animazione barra
    const fill = document.getElementById('toast-progress-fill');
    if(fill){ fill.style.transition='width 5s linear'; fill.style.width='0%'; }
  }, 10);

  // Salva callback undo
  window._pendingUndoFn = undoFn;

  // Dopo 5s: nasconde toast, undo non più disponibile
  _undoTimer = setTimeout(() => {
    t.classList.remove('show');
    window._pendingUndoFn = null;
    setTimeout(() => { t.innerHTML=''; t.className='toast'; }, 300);
  }, 5000);
}

function triggerUndo(){
  clearTimeout(_undoTimer);
  clearTimeout(_undoBarTimer);
  const t = document.getElementById('toast');
  if(t){ t.classList.remove('show'); setTimeout(()=>{t.innerHTML='';t.className='toast';},300); }
  if(typeof window._pendingUndoFn === 'function'){
    window._pendingUndoFn();
    window._pendingUndoFn = null;
    showToast('✓ Azione annullata');
  }
}

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
    CLOUD._saveTimer = setTimeout(() => CLOUD.saveNow(dataFn()), 800);
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
    clients = (data.clients || []).map(cl=>({
      ...cl,
      accounts: (cl.accounts||[]).map(acc=>({
        profileImg: '',
        bio: '',
        ...acc
      }))
    }));
    adsCampaigns = data.adsCampaigns || {};
    // MIGRAZIONE: converte chiavi legacy clientName → client.id
    // Eseguita una sola volta, poi il dato è già in formato nuovo
    adsCampaigns = migrateAdsCampaignsKeys(adsCampaigns, clients);
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

let showAllDates = true, showAllCopy = true, feedViewMode = 'grid';
let currentTab = 'studio';

let feedDragSrc = null, stDragSrc = null;
let carouselEditIdx = null, carouselTmp = [];
let sbEditIdx = null, sbTmpSlides = [];
let hlEditIdx = null, hlTmpCover = null;
let linkModalPostIdx = null, linkModalSelected = new Set();
let copySelectedItems = new Set();
let feedLinkTab = 'frame', storiesLinkTab = 'frame';
let lbItems = [], lbIdx = 0, lbSlide = 0, lbStArr = [], lbOpts = {};
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
    coverUrl:'', // cover poster per reel
    _uploadId: f.name+'_'+Date.now() // unique id to track this specific upload
  }));
  setFeedItems([...newItems,...items]);refreshFeed();
  // Upload each file to Dropbox sequentially to avoid race conditions
  (async()=>{
    const total = filesArr.length;
    let done = 0;
    let failed = 0;
    // Mostra upload bar con contatore
    const uploadBar = document.getElementById('dbx-upload-bar');
    const uploadText = document.getElementById('dbx-upload-text');
    const updateProgress = () => {
      if(uploadText) uploadText.textContent = total === 1
        ? 'Caricamento su Dropbox…'
        : `Caricamento ${done + failed + 1} di ${total}…`;
      if(uploadBar) uploadBar.style.display = 'flex';
    };
    updateProgress();

    for(const f of filesArr){
      updateProgress();
      const destPath='/nassa/'+CLOUD.user+'/'+(feedMonth||'misc')+'/'+f.name;
      const sharedUrl=await DROPBOX.upload(f,destPath);
      const arr=currentFeedItems();
      const match=arr.findIndex(it=>it.name===f.name&&!it.externalUrl);
      if(sharedUrl){
        done++;
        if(match>=0){
          if(arr[match].url&&arr[match].url.startsWith('blob:')) URL.revokeObjectURL(arr[match].url);
          arr[match].externalUrl=sharedUrl;arr[match].url=sharedUrl;
          arr[match].isExternalLink=true;arr[match].linkSource='dropbox';
          arr[match].needsReload=false;delete arr[match]._uploadId;
        }
        setFeedItems(arr);refreshFeed();
        CLOUD.saveNow(CLOUD.snapshot());
      } else {
        failed++;
        if(match>=0){ arr[match].needsReload=true; }
        setFeedItems(arr);refreshFeed();
        showToast('⚠ Upload fallito: '+f.name,'warn');
      }
    }
    // Upload completato
    if(uploadBar) uploadBar.style.display = 'none';
    if(done > 0 && failed === 0){
      showToast(total === 1 ? '✓ File caricato su Dropbox' : `✓ ${done} file caricati su Dropbox`);
    } else if(failed > 0){
      showToast(`⚠ ${done} ok, ${failed} falliti — ricarica i file mancanti`, 'warn');
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
  if(type==='video'){const v=document.createElement('video');v.src=url;v.muted=opts.muted!==false;v.loop=opts.loop!==false;v.playsInline=true;v.preload='metadata';v.style.cssText='pointer-events:none;background:#111;width:100%;height:100%;object-fit:cover;display:block;';if(opts.autoplay)v.autoplay=true;if(opts.controls){v.controls=true;v.style.pointerEvents='auto';}return v;}
  const img=document.createElement('img');img.src=url;img.alt='';img.loading='lazy';img.decoding='async';return img;
}
function needsReloadPh(icon,name,reuploadFn){
  const ph=document.createElement('div');ph.className='needs-reload-ph';
  // FIX UX: usa SVG invece di emoji per cross-OS consistency
  const svgIcon=icon==='img'
    ?'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" width="18" height="18"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>'
    :icon==='vid'
    ?'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" width="18" height="18"><polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2"/></svg>'
    :icon;
  ph.innerHTML=`<div class="nr-icon">${svgIcon}</div><div class="nr-name">${name||'file'}</div><div class="nr-label">ricarica media</div>`;
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
  const allTabs=['studio','notes','pilastri','feed','stories','ped','cal','anno','preview','ads'];
  allTabs.forEach(t=>{
    const te=document.getElementById('tab-'+t);if(te)te.classList.toggle('active',t===tab);
    const st=document.getElementById('sub-tab-'+t);if(st)st.classList.toggle('active',t===tab);
    const pe=document.getElementById('page-'+t);if(pe)pe.classList.toggle('active',t===tab);
    const si=document.getElementById('si-'+t);if(si)si.classList.toggle('active',t===tab);
    // Update main nav icon sidebar
    const sn=document.getElementById('si-'+t);if(sn)sn.classList.toggle('active',t===tab);
  });
  const subt=document.getElementById('subtopbar');if(subt)subt.classList.toggle('visible',tab!=='studio');
  const _sb=document.getElementById('sidebar');if(_sb)_sb.classList.toggle('hidden',tab!=='studio');
  // Sidebar visibile solo in Studio — usa classe .hidden per transizione CSS
  const sb=document.getElementById('sidebar');
  if(sb) sb.classList.toggle('hidden', tab!=='studio');
  const sStudio=document.getElementById('sidebar-studio');const sAdd=document.getElementById('sidebar-studio-add');const sFeed=document.getElementById('sidebar-feed');const sSt=document.getElementById('sidebar-stories');
  if(sStudio)sStudio.style.display='none';if(sAdd)sAdd.style.display='none';if(sFeed)sFeed.style.display='none';if(sSt)sSt.style.display='none';
  if(tab==='studio'){renderStudio();updateGlobalClientUI();}else{renderAccSwitcher();}
  if(tab==='notes'){if(notesClientIdx<0&&globalClientIdx>=0)notesClientIdx=globalClientIdx;rebuildNotesSelects();renderNotesMonthPills();renderNotesEditor();}
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
  if(tab==='anno'){renderAnnoTab();}
  if(tab==='preview'){if(previewClientIdx<0&&globalClientIdx>=0){previewClientIdx=globalClientIdx;previewAccountIdx=clients[globalClientIdx]?.accounts?.length>=1?0:-1;}syncPreviewSelectors();renderPreview();}
  // FIX QA: renderAdsTab mancava dal switchTab — tab Ads non si aggiornava mai
  if(tab==='ads'){renderAdsTab();}
}
function showStudioAdd(){openModal('add-client-modal');rebuildStudioAccountSelect();}
function backToClients(){switchTab('studio');}

/* CLIENT MANAGEMENT */
function addClient(){
  const name=document.getElementById('nc-name').value.trim();if(!name){document.getElementById('nc-name').focus();return;}
  if(clients.find(c=>c.name.toLowerCase()===name.toLowerCase())){showToast('Cliente già presente','warn');return;}
  const id='c_'+Date.now();const defaultAccount={id:'a_'+Date.now(),name,platform:'Instagram',profileImg:'',bio:''};const defaultBrand={primary:'#1a3c5e',secondary:'#c8a96e',bg:'#f5f0e8',text:'#111111'};
  clients.push({id,name,pkg:document.getElementById('nc-pkg').value,status:document.getElementById('nc-status').value,revenue:parseFloat(document.getElementById('nc-revenue').value)||0,accounts:[defaultAccount]});
  document.getElementById('nc-name').value='';document.getElementById('nc-revenue').value='';
  renderStudio();rebuildAllSelects();rebuildGlobalClientSelect();showToast('✓ Cliente aggiunto');autoSave();
  // Return to client list automatically
  closeModal('add-client-modal');
}
function addAccount(){const ci=parseInt(document.getElementById('na-client').value);if(isNaN(ci)||ci<0){showToast('Seleziona un cliente','warn');return;}const name=document.getElementById('na-name').value.trim();if(!name){document.getElementById('na-name').focus();return;}const platform=document.getElementById('na-platform').value;const id='a_'+Date.now();clients[ci].accounts.push({id,name,platform});document.getElementById('na-name').value='';renderStudio();rebuildAllSelects();showToast('✓ Account aggiunto');autoSave();}
function removeClient(i){
  showConfirm({
    title:'Elimina cliente',
    body:`Stai per eliminare <strong>${esc(clients[i].name)}</strong> e tutti i suoi dati (feed, stories, UGC, note). Questa azione è irreversibile.`,
    okLabel:'Elimina',
    type:'danger',
    onOk:()=>{clients[i].accounts.forEach(acc=>{// Delete ALL years of data, not just current MONTH_OPTIONS
Object.keys(feeds).filter(k=>k.startsWith(acc.id+'|||')).forEach(k=>delete feeds[k]);Object.keys(stories).filter(k=>k.startsWith(acc.id+'|||')).forEach(k=>delete stories[k]);delete highlights[acc.id];});// Delete PED plans and notes for this client
Object.keys(pedPlans).filter(k=>k.startsWith(clients[i].name+'|||')).forEach(k=>delete pedPlans[k]);Object.keys(notesData).filter(k=>k.startsWith(clients[i].name+'|||')).forEach(k=>delete notesData[k]);if(feedClientIdx===i){feedClientIdx=-1;feedAccountIdx=-1;feedMonth='';renderFeedGrid();}else if(feedClientIdx>i)feedClientIdx--;clients.splice(i,1);renderStudio();rebuildAllSelects();autoSave();}});
}
function openClientFeed(ci){globalClientIdx=ci;feedClientIdx=ci;feedAccountIdx=clients[ci].accounts.length>0?0:-1;storiesClientIdx=ci;storiesAccountIdx=feedAccountIdx;notesClientIdx=ci;if(!feedMonth)feedMonth=MONTH_OPTIONS[new Date().getMonth()];if(!storiesMonth)storiesMonth=feedMonth;updateGlobalClientUI();switchTab('feed');rebuildFeedSelects();renderFeedMonthPills();renderFeedGrid();updateFeedHeader();renderAccSwitcher();}
function openAccountFeed(ci,aid){globalClientIdx=ci;feedClientIdx=ci;feedAccountIdx=clients[ci].accounts.findIndex(a=>a.id===aid);storiesClientIdx=ci;storiesAccountIdx=feedAccountIdx;notesClientIdx=ci;if(!feedMonth)feedMonth=MONTH_OPTIONS[new Date().getMonth()];if(!storiesMonth)storiesMonth=feedMonth;updateGlobalClientUI();switchTab('feed');rebuildFeedSelects();renderFeedMonthPills();renderFeedGrid();updateFeedHeader();renderAccSwitcher();}

function renderStudio(){
  const active=clients.filter(c=>c.status==='Attivo');const totalRev=active.reduce((s,c)=>s+c.revenue,0);const totalAccounts=clients.reduce((s,c)=>s+(c.accounts?.length||0),0);const el=v=>document.getElementById(v);
  if(el('kpi-revenue'))el('kpi-revenue').textContent='€ '+totalRev.toLocaleString('it-IT');if(el('kpi-active'))el('kpi-active').textContent=active.length;if(el('kpi-accounts'))el('kpi-accounts').textContent=totalAccounts;if(el('kpi-rev-sub'))el('kpi-rev-sub').textContent='da '+active.length+(active.length===1?' cliente attivo':' clienti attivi');
  const countTxt=clients.length+' client'+(clients.length===1?'e':'i');if(el('studio-count'))el('studio-count').textContent=countTxt;
  const tbody=document.getElementById('clients-tbody');if(!tbody)return;tbody.innerHTML='';
  if(!clients.length){
    // FIX UX: empty state con CTA chiara invece di testo generico
    tbody.innerHTML=`<tr><td colspan="6">
      <div class="studio-empty-state">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="width:36px;height:36px;opacity:.25;margin-bottom:12px;"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
        <p style="font-size:14px;font-weight:600;color:var(--text);margin-bottom:6px;">Nessun cliente ancora</p>
        <p style="font-size:12px;color:var(--text-2);margin-bottom:16px;">Aggiungi il tuo primo cliente per iniziare a pianificare i contenuti.</p>
        <button class="btn primary sm" onclick="openAddClientModal()">+ Aggiungi primo cliente</button>
      </div>
    </td></tr>`;
    return;
  }
  // FIX QA: tutti i dati utente (name, pkg, status) passano per esc() — previene XSS
  clients.forEach((c,i)=>{const dotCls={Attivo:'green','In onboarding':'blue','In pausa':'amber',Perso:'red'}[c.status]||'green';const accs=c.accounts||[];const accsHtml=accs.length===0?'<span style="color:var(--text-3);font-size:11px;">—</span>':accs.length===1&&accs[0].name===c.name?`<span class="feed-chip" onclick="openClientFeed(${i})" style="color:#111;border-color:var(--green-mid);">Feed →</span>`:accs.map(a=>`<span class="feed-chip" onclick="openAccountFeed(${i},'${a.id}')" title="${esc(a.platform)}">${esc(a.name)} →</span>`).join(' ');const tr=document.createElement('tr');tr.innerHTML=`<td style="font-weight:500;">${esc(c.name)}</td><td style="font-size:11px;">${accsHtml}</td><td>${pkgBadge(c.pkg)}</td><td><span class="status-dot"><span class="dot ${dotCls}"></span>${esc(c.status)}</span></td><td class="muted">€ ${(c.revenue||0).toLocaleString('it-IT')}</td><td><div class="tr-actions"><button class="btn sm" onclick="openEditClientModal(${i})" title="Modifica cliente"><svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4L18.5 2.5z"/></svg> Modifica</button><button class="btn sm danger" onclick="removeClient(${i})" title="Elimina cliente"><svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/></svg></button></div></td>`;tbody.appendChild(tr);});
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
function renderFeedMonthPills(){const c=document.getElementById('feed-month-pills')||document.querySelector('.feed-month-pills-inline');if(!c)return;c.innerHTML='';if(feedAccountIdx<0)return;let pillYear=CUR_YEAR;if(feedMonth){const y=parseInt(feedMonth.split(' ').pop());if(!isNaN(y))pillYear=y;}const ynav=document.createElement('div');ynav.className='year-nav';const prev=document.createElement('button');prev.className='year-nav-btn';prev.textContent='‹';
  prev.setAttribute('aria-label','Mese precedente');prev.onclick=()=>{pillYear--;CUR_YEAR=pillYear;MONTH_OPTIONS=monthsForYear(pillYear);renderFeedMonthPills();};const lbl=document.createElement('span');lbl.className='year-label';lbl.textContent=pillYear;const next=document.createElement('button');next.className='year-nav-btn';next.textContent='›';
  next.setAttribute('aria-label','Mese successivo');next.onclick=()=>{pillYear++;CUR_YEAR=pillYear;MONTH_OPTIONS=monthsForYear(pillYear);renderFeedMonthPills();};ynav.appendChild(prev);ynav.appendChild(lbl);ynav.appendChild(next);c.appendChild(ynav);const pillsWrap=document.createElement('div');pillsWrap.className='month-pills';monthsForYear(pillYear).forEach(m=>{const p=document.createElement('button');p.className='month-pill'+(m===feedMonth?' active':'');p.textContent=m.slice(0,3);p.onclick=()=>{feedMonth=m;renderFeedMonthPills();renderFeedGrid();updateFeedHeader();};pillsWrap.appendChild(p);});c.appendChild(pillsWrap);}

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
function refreshFeed(){
  try{ renderFeedGrid(); } catch(e){ console.error('renderFeedGrid error:', e); }
  updateFeedStats();updateFeedHeader();autoSave();
}

/* ══ CAROSELLO PLAYER INLINE — Feed (Gruppo D) ══ */
function buildCaroselloPlayer(item, itemIdx, items, stArr){
  const slides = (item.slides || []).filter(s => s && typeof s === 'object');
  const total = slides.length;
  if(!total) return document.createElement('div'); // guard
  const state = { cur: 0, touchStart: null };

  // Wrapper — overflow:hidden, position:relative
  const wrap = document.createElement('div');
  wrap.style.cssText = 'position:relative;width:100%;height:100%;overflow:hidden;user-select:none;';

  // Track scorrevole
  const track = document.createElement('div');
  track.className = 'cc-track';
  track.style.cssText = 'display:flex;width:100%;height:100%;transition:transform 0.28s cubic-bezier(0.4,0,0.2,1);will-change:transform;';

  slides.forEach((sl, i) => {
    const slide = document.createElement('div');
    slide.style.cssText = 'flex:0 0 100%;width:100%;height:100%;position:relative;';
    if(sl.url){
      const img = document.createElement('img');
      img.src = sl.url;
      img.alt = sl.alt || '';
      img.draggable = false;
      img.style.cssText = 'width:100%;height:100%;object-fit:cover;display:block;cursor:pointer;';
      img.onclick = e => { e.stopPropagation(); openLb(itemIdx, items, []); };
      slide.appendChild(img);
    } else {
      slide.innerHTML = `<div style="width:100%;height:100%;background:var(--cell-bg);display:flex;align-items:center;justify-content:center;font-size:11px;font-family:var(--font);color:var(--text-3);letter-spacing:.06em;">${i+1} / ${total}</div>`;
    }
    track.appendChild(slide);
  });
  wrap.appendChild(track);

  // Funzioni navigazione
  function goTo(i){
    state.cur = Math.max(0, Math.min(total-1, i));
    track.style.transform = `translateX(-${state.cur * 100}%)`;
    updateControls();
  }

  // Frecce ‹ ›
  const btnPrev = document.createElement('button');
  btnPrev.className = 'cc-arrow cc-prev';
  btnPrev.setAttribute('aria-label','Slide precedente');
  btnPrev.innerHTML = '‹';
      btnPrev.setAttribute('aria-label', 'Slide precedente');
  btnPrev.onclick = e => { e.stopPropagation(); goTo(state.cur - 1); };

  const btnNext = document.createElement('button');
  btnNext.className = 'cc-arrow cc-next';
  btnNext.setAttribute('aria-label','Slide successiva');
  btnNext.innerHTML = '›';
      btnNext.setAttribute('aria-label', 'Slide successiva');
  btnNext.onclick = e => { e.stopPropagation(); goTo(state.cur + 1); };

  wrap.appendChild(btnPrev);
  wrap.appendChild(btnNext);

  // Dots indicatori
  const dotsWrap = document.createElement('div');
  dotsWrap.className = 'cc-dots';

  const dots = slides.map((_, i) => {
    const dot = document.createElement('span');
    dot.className = 'cc-dot' + (i === 0 ? ' active' : '');
    dot.setAttribute('aria-label', 'Vai alla slide ' + (i+1));
    dot.onclick = e => { e.stopPropagation(); goTo(i); };
    dotsWrap.appendChild(dot);
    return dot;
  });
  wrap.appendChild(dotsWrap);

  // Counter "1 / 5"
  const counter = document.createElement('div');
  counter.className = 'cc-counter';
  counter.textContent = `1 / ${total}`;
  if(total > 1) wrap.appendChild(counter);

  // Badge "Carosello"
  const badge = document.createElement('div');
  badge.className = 'cc-badge';
  badge.textContent = 'Carosello';
  wrap.appendChild(badge);

  // Aggiorna controlli
  function updateControls(){
    btnPrev.style.display = state.cur > 0 ? 'flex' : 'none';
    btnNext.style.display = state.cur < total - 1 ? 'flex' : 'none';
    dots.forEach((d, i) => d.classList.toggle('active', i === state.cur));
    counter.textContent = `${state.cur + 1} / ${total}`;
  }
  updateControls();

  // Swipe touch
  wrap.addEventListener('touchstart', e => {
    state.touchStart = e.touches[0].clientX;
  }, { passive: true });
  wrap.addEventListener('touchend', e => {
    if(state.touchStart === null) return;
    const delta = state.touchStart - e.changedTouches[0].clientX;
    if(Math.abs(delta) > 40){
      delta > 0
        ? goTo(Math.min(total-1, state.cur+1))
        : goTo(Math.max(0, state.cur-1));
    }
    state.touchStart = null;
  }, { passive: true });

  // Click su wrap → stopPropagation per non triggerare l'overlay della cell
  // L'utente può usare l'overlay (tasto destro / hover) per aprire il lightbox
  wrap.onclick = e => { e.stopPropagation(); };

  return wrap;
}


function renderFeedGrid(){
  const grid=document.getElementById('feed-grid');if(!grid)return;grid.innerHTML='';updateFeedFormat();
  // Vista: grid | list
  grid.classList.toggle('feed-view-list', feedViewMode==='list');
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
        const btns=document.createElement('div');btns.className='type-btns';[['<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>','Foto','image'],['<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2"/></svg>','Reel','video'],['<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="3" width="20" height="18" rx="2"/><path d="M8 3v18M16 3v18"/></svg>','Caros.','carousel']].forEach(([icon,label,type])=>{const b=document.createElement('button');b.className='type-btn';b.innerHTML=`<span class="ti">${icon}</span>${label}`;b.onclick=()=>setFeedItemType(idx,type);btns.appendChild(b);});pk.appendChild(btns);
        const rm=document.createElement('button');rm.className='picker-rm';rm.textContent='✕ rimuovi';rm.onclick=()=>removeFeedItem(idx);pk.appendChild(rm);cell.appendChild(pk);wrap.appendChild(cell);
      } else {
        const _itemUrl=item.url||item.externalUrl||'';
      const coverUrl=item.type==='carousel'&&item.slides?.length?(item.slides[0].url||item.slides[0].externalUrl||''):_itemUrl;
        if(item.needsReload&&!item.url){
          const _icon=item.type==='video'?'<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2"/></svg>':item.type==='carousel'?'<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="3" width="20" height="18" rx="2"/><path d="M8 3v18M16 3v18"/></svg>':'<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>';
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
        else if(item.type==='video'){const v=makeMedia(item.url,'video');if(v){if(item.coverUrl)v.setAttribute('poster',item.coverUrl);v.onerror=()=>{cell.appendChild(needsReloadPh('vid',item.name));};cell.addEventListener('mouseenter',()=>{v.removeAttribute('poster');v.play().catch(()=>{});});cell.addEventListener('mouseleave',()=>{v.pause();v.currentTime=0;if(item.coverUrl)v.setAttribute('poster',item.coverUrl);});cell.appendChild(v);}else{cell.appendChild(needsReloadPh('vid',item.name));}
          // Bottone cover sempre visibile sulla card video
          const cvBtn=document.createElement('button');
          cvBtn.className='video-cover-pill';
          cvBtn.innerHTML=item.coverUrl
            ?'<svg viewBox="0 0 24 24" width="10" height="10" fill="none" stroke="currentColor" stroke-width="2.5"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg> Cover ✓'
            :'<svg viewBox="0 0 24 24" width="10" height="10" fill="none" stroke="currentColor" stroke-width="2.5"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg> + Cover';
          cvBtn.title = item.coverUrl ? 'Cambia cover' : 'Aggiungi cover reel';
          cvBtn.onclick=e=>{e.stopPropagation();openVideoCoverModal(idx);};
          cell.appendChild(cvBtn);}
        else if(item.type==='carousel'&&item.slides?.length>1){
          // Carosello navigabile inline (Gruppo D)
          // Mostra "non disponibile" solo se TUTTE le slide sono senza URL
          const allEmpty = item.slides.every(s=>!s.url);
          if(allEmpty){
            const ph=document.createElement('div');
            ph.style.cssText='position:absolute;inset:0;background:#1a1a1a;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:10px;';
            ph.innerHTML='<svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="rgba(255,255,255,.25)" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="6" width="14" height="14" rx="2"/><path d="M22 6h-2a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2"/></svg>'
              +'<div style="font-size:10px;color:rgba(255,255,255,.3);font-family:var(--font);text-align:center;line-height:1.4;">Media non<br>disponibile</div>';
            const delBtn=document.createElement('button');
            delBtn.style.cssText='position:absolute;top:6px;right:6px;width:26px;height:26px;border-radius:50%;background:rgba(220,50,50,.85);border:none;color:#fff;font-size:14px;cursor:pointer;display:flex;align-items:center;justify-content:center;z-index:20;';
            delBtn.innerHTML='✕';delBtn.title='Rimuovi carosello';
            delBtn.onclick=e=>{e.stopPropagation();removeFeedItem(idx);};
            cell.appendChild(ph);cell.appendChild(delBtn);
          } else {
            try{
              const player = buildCaroselloPlayer(item, idx, items, []);
              cell.appendChild(player);
            } catch(e){
              console.warn('Carousel player error:', e);
              const img=makeMedia(coverUrl,'image');
              if(img) cell.appendChild(img);
            }
          }
        }
        else{const img=makeMedia(coverUrl,'image');if(img){img.onerror=()=>{img.style.display='none';cell.appendChild(needsReloadPh('img',item.name));};cell.appendChild(img);}else{cell.appendChild(needsReloadPh('img',item.name));}}
        // drag via event delegation — mark the cell
        cell.draggable=true;
        cell.dataset.dragIdx=idx;

        // SVG icons as strings
        const SVG_DOTS='<svg viewBox="0 0 24 24" width="14" height="14"><circle cx="9" cy="5" r="1.2" fill="#fff"/><circle cx="9" cy="12" r="1.2" fill="#fff"/><circle cx="9" cy="19" r="1.2" fill="#fff"/><circle cx="15" cy="5" r="1.2" fill="#fff"/><circle cx="15" cy="12" r="1.2" fill="#fff"/><circle cx="15" cy="19" r="1.2" fill="#fff"/></svg>';
        const SVG_CAL='<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>';

        // ── Editorial card background ──
        const badge=document.createElement('div');
        if(item.type==='editorial'){
          const _clientBrand = feedClientIdx>=0 ? (clients[feedClientIdx]?.brand||{}) : {};
          const cols=item.editorialColors||(Object.keys(_clientBrand).length ? {
            bg: _clientBrand.bg||'#f5f0e8',
            text: _clientBrand.text||'#111',
            accent: _clientBrand.primary||'#1a3c5e',
            logo: '#0dff00',
            logoText: '#111'
          } : {bg:'#f5f0e8',text:'#111',accent:'#1a3c5e',logo:'#0dff00',logoText:'#111'});
          cell.classList.add('editorial');cell.style.background=cols.bg;cell.style.color=cols.text;
          // aspect ratio dalla piattaforma account
          const _edFmt=getPlatformFormat();
          if(_edFmt?.cssRatio) cell.style.aspectRatio=_edFmt.cssRatio;
          // Indicatore: "Brand" se palette viene dal cliente
          if(!item.editorialColors && feedClientIdx>=0 && clients[feedClientIdx]?.brand){
            const brandDot=document.createElement('div');
            brandDot.className='cell-brand-dot';
            brandDot.title='Palette brand cliente applicata';
            cell.appendChild(brandDot);
          }
          const titleHtml=item.editorialAccent&&item.editorialTitle?.includes(item.editorialAccent)
            ?item.editorialTitle.replace(item.editorialAccent,`<span style="color:${cols.accent};">${item.editorialAccent}</span>`)
            :item.editorialTitle||'';
          const cardInner=document.createElement('div');
          cardInner.style.cssText='position:absolute;inset:0;padding:12px 11px 44px;display:flex;flex-direction:column;font-family:var(--font);';
          cardInner.innerHTML=`<div style="font-size:11px;font-weight:700;letter-spacing:.8px;text-transform:uppercase;opacity:.45;margin-bottom:6px;">${esc(item.editorialEyebrow||''  )}</div><div style="font-weight:800;line-height:1.1;letter-spacing:-1px;font-size:17px;flex:1;">${titleHtml}</div><div style="height:1px;background:currentColor;opacity:.15;margin:6px 0;"></div><div style="font-size:11px;opacity:.55;line-height:1.4;">${(item.editorialCopy||'').slice(0,80)}</div>`;
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
        if((item.linkedStories||[]).length>0){const lb=document.createElement('div');lb.className='ls-badge-cell';lb.textContent=''+item.linkedStories.length;cell.appendChild(lb);}

        // ── BOTTOM BAR: date with gradient, always at bottom ──
        const showDate=showAllDates&&item.showDate;
        const db=document.createElement('div');db.className='date-bar'+(showDate?'':' hidden-bar');
        const calWrap=document.createElement('span');calWrap.innerHTML=SVG_CAL;calWrap.style.cssText='display:flex;align-items:center;flex-shrink:0;';
        const di=document.createElement('input');di.className='date-input';di.type='text';di.value=item.date||'';di.placeholder='data…';
        di.onclick=e=>{e.stopPropagation();openDatePicker(idx,cell);};
        di.onfocus=e=>{e.target.blur();openDatePicker(idx,cell);}; // mobile: apre picker al tap
        di.oninput=e=>{currentFeedItems()[idx].date=e.target.value;};
        const dt=document.createElement('button');dt.className='date-toggle';dt.textContent=item.showDate?'✓':'✕';
        dt.onclick=e=>{e.stopPropagation();currentFeedItems()[idx].showDate=!currentFeedItems()[idx].showDate;renderFeedGrid();};
        db.appendChild(calWrap);db.appendChild(di);db.appendChild(dt);cell.appendChild(db);

        // Date add button (hover, no date set)
        const dpTrigger=document.createElement('button');dpTrigger.className='date-add-btn dp-trigger-btn';
        const calWrap2=document.createElement('span');calWrap2.innerHTML=SVG_CAL;calWrap2.style.cssText='display:flex;align-items:center;';
        dpTrigger.appendChild(calWrap2);dpTrigger.appendChild(document.createTextNode(item.date?' '+item.date.split(' ').slice(1).join(' '):'+ data'));
        dpTrigger.onclick=e=>{e.stopPropagation();openDatePicker(idx,cell);};
        dpTrigger.ontouchstart=e=>{e.stopPropagation();openDatePicker(idx,cell);};cell.appendChild(dpTrigger);

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
        if(item.type==='video'){
          const coverLbl = item.coverUrl ? 'Cover · cambia' : '+ Cover reel';
          sheet.appendChild(mkBtn('ob-cover','<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/>',coverLbl,()=>openVideoCoverModal(idx)));
          sheet.appendChild(mkDiv());
        }
        sheet.appendChild(mkBtn('ob-stories','<rect x="7" y="2" width="10" height="20" rx="2"/>',((item.linkedStories||[]).length>0?'Stories ('+item.linkedStories.length+')':'Collega stories'),()=>openLinkStoriesModal(idx)));
        sheet.appendChild(mkDiv());
        sheet.appendChild(mkBtn('ob-copy','<rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>','Copia da…',()=>openCopyModal('feed')));
        sheet.appendChild(mkDiv());
        sheet.appendChild(mkBtn('ob-delete','<polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/>','Rimuovi',()=>showConfirm({
            title:'Rimuovi post',
            body:'Il post verrà eliminato dal feed. Questa azione non può essere annullata.',
            okLabel:'Rimuovi',
            type:'danger',
            onOk:()=>removeFeedItem(idx)
          })));
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
        // Se item ha copy, espandi solo su desktop
        if(item.copy && window.innerWidth > 768){cpanel_body.classList.add('open');expBtn.classList.add('open');prev.style.display='none';}
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
function removeFeedItem(i){
  const items=currentFeedItems();
  // Snapshot per undo — salva l'item e la posizione
  const snapshot={item:{...items[i]},idx:i};
  // Revoca blob URL subito (non recuperabile — non serve per undo, il file non è più in memoria)
  if(!items[i].isExternalLink)URL.revokeObjectURL(items[i].url);
  (items[i].slides||[]).forEach(s=>{if(s.url&&!s.externalUrl)URL.revokeObjectURL(s.url);});
  items.splice(i,1);setFeedItems(items);refreshFeed();
  // Undo: reinserisce l'item (senza media locale, ma con externalUrl se presente)
  showUndoToast('Post rimosso',()=>{
    const cur=currentFeedItems();
    cur.splice(snapshot.idx,0,{...snapshot.item,url:snapshot.item.externalUrl||''});
    setFeedItems(cur);refreshFeed();autoSave();
  });
}
function updateFeedStats(){const f=currentFeedItems().filter(i=>i.type!=='pending');const s=currentStoryItems();const el=id=>document.getElementById(id);if(el('stat-tot'))el('stat-tot').textContent=f.length;if(el('stat-vid'))el('stat-vid').textContent=f.filter(i=>i.type==='video').length;if(el('stat-car'))el('stat-car').textContent=f.filter(i=>i.type==='carousel').length;if(el('stat-stories'))el('stat-stories').textContent=s.length;if(el('stat-stories-sb'))el('stat-stories-sb').textContent=s.filter(x=>x.isStoryboard).length;const aid=accountId(feedClientIdx,feedAccountIdx);if(el('stat-hl'))el('stat-hl').textContent=aid?(highlights[aid]||[]).length:0;if(el('feed-meta'))el('feed-meta').textContent=f.length+' post';const status=feedAccountIdx<0?'Seleziona cliente e account.':f.length===0?'Nessun contenuto per questo mese.':f.length+' contenut'+(f.length===1?'o pronti.':'i pronti.');if(el('feed-status'))el('feed-status').textContent=status;}
function updateFeedHeader(){const acc=getAccount(feedClientIdx,feedAccountIdx);const cn=acc?clients[feedClientIdx].name+' — '+acc.name:'Feed Preview';const mn=feedMonth;const el=id=>document.getElementById(id);if(el('feed-title'))el('feed-title').textContent=cn+(mn?' · '+mn:'');if(el('feed-tag'))el('feed-tag').textContent=mn?mn+' · 4:5':'1080×1350 · 4:5';updateFeedStats();feedProfileSync();}

/* ── FEED PROFILE PANEL ── */
function feedProfileSync(){
  const acc=getAccount(feedClientIdx,feedAccountIdx);
  const avatarEl=document.getElementById('feed-profile-avatar');
  const bioEl=document.getElementById('feed-profile-bio');
  const section=document.getElementById('feed-profile-section');
  if(!avatarEl||!bioEl)return;
  if(!acc){if(section)section.style.display='none';return;}
  if(section)section.style.display='';
  // Avatar
  const img=avatarEl.querySelector('img');
  const svg=avatarEl.querySelector('svg');
  if(acc.profileImg){
    if(!img){
      const i=document.createElement('img');i.src=acc.profileImg;i.alt='';
      avatarEl.insertBefore(i,avatarEl.firstChild);
      if(svg)svg.style.display='none';
    } else {
      img.src=acc.profileImg;
      if(svg)svg.style.display='none';
    }
  } else {
    if(img){img.remove();}
    if(svg)svg.style.display='';
  }
  // Bio
  bioEl.value=acc.bio||'';
}

function feedProfileAvatarClick(){
  const inp=document.getElementById('feed-profile-img-inp');
  if(inp)inp.click();
}

async function feedProfileImgChange(files){
  const file=files[0]; if(!file)return;
  const acc=getAccount(feedClientIdx,feedAccountIdx);
  if(!acc)return;
  showToast('⟳ Caricamento foto profilo…');
  const destPath='/nassa/'+CLOUD.user+'/profiles/'+Date.now()+'_'+file.name;
  const url=await DROPBOX.upload(file,destPath);
  const finalUrl=url||URL.createObjectURL(file);
  clients[feedClientIdx].accounts[feedAccountIdx].profileImg=finalUrl;
  autoSave();
  feedProfileSync();
  showToast('✓ Foto profilo aggiornata');
  // Reset input
  const inp=document.getElementById('feed-profile-img-inp');
  if(inp)inp.value='';
}

function feedProfileBioInput(val){
  const acc=getAccount(feedClientIdx,feedAccountIdx);
  if(!acc)return;
  clients[feedClientIdx].accounts[feedAccountIdx].bio=val;
  autoSave();
}
function toggleFeedView(){
  feedViewMode = feedViewMode==='grid' ? 'list' : 'grid';
  const btn = document.getElementById('toggle-view');
  const icon = document.getElementById('toggle-view-icon');
  if(btn) btn.classList.toggle('active', feedViewMode==='list');
  if(icon) icon.innerHTML = feedViewMode==='list'
    ? '<rect x="3" y="3" width="18" height="4" rx="1"/><rect x="3" y="10" width="18" height="4" rx="1"/><rect x="3" y="17" width="18" height="4" rx="1"/>'  // lista
    : '<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>'; // griglia
  renderFeedGrid();
}


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
  setFeedItems(items);closeModal('carousel-modal');refreshFeed();
  CLOUD.saveNow(CLOUD.snapshot()); // salva subito dopo upload slide
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
        if(st.isStoryboard){
        const coverUrl=st.slides?.[0]?.url||'';
        const firstSlide=st.slides?.[0]||{};
        // Sfondo dalla palette SFONDI — default Avorio
        const sfKey=firstSlide.sfondo||'Avorio';
        const sfCol=(typeof SFONDI!=='undefined'&&SFONDI[sfKey])?SFONDI[sfKey]:{bg:'#F5F2EB',text:'#2a2a2a',acc:'#888'};

        // Funzione mostra placeholder testuale
        const showSbPh=()=>{
          const ph=document.createElement('div');
          ph.style.cssText='position:absolute;inset:0;display:flex;flex-direction:column;justify-content:center;padding:12px 10px;';
          ph.style.background=sfCol.bg;
          ph.innerHTML=(firstSlide.num?'<div style="font-size:22px;font-weight:700;font-family:Georgia,serif;color:'+sfCol.acc+';line-height:1;margin-bottom:4px;">'+firstSlide.num+'</div>':'')
            +(firstSlide.eye?'<div style="font-size:7px;font-weight:600;letter-spacing:.1em;text-transform:uppercase;color:'+sfCol.acc+';opacity:.6;margin-bottom:4px;">'+firstSlide.eye+'</div>':'')
            +(firstSlide.title?'<div style="font-size:11px;font-weight:700;font-family:Georgia,serif;color:'+sfCol.text+';line-height:1.2;">'+firstSlide.title+'</div>'
              :'<div style="font-size:9px;color:'+sfCol.acc+';opacity:.4;">'+(st.slides?.length||0)+' slide</div>');
          cell.appendChild(ph);
        };

        if(coverUrl){
          const img=document.createElement('img');
          img.src=coverUrl;img.alt='';
          img.onerror=()=>{ img.remove(); showSbPh(); };
          cell.appendChild(img);
        } else { showSbPh(); }const b=document.createElement('span');b.className='story-badge storyboard';
        b.innerHTML='<svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><rect x="7" y="2" width="10" height="20" rx="2"/><line x1="12" y1="6" x2="12" y2="6.01"/><line x1="12" y1="10" x2="12" y2="14"/></svg>'+(st.slides?.length||0)+' slide';
        cell.appendChild(b);}
        else if(st.type==='video'){const v=makeMedia(st.url,'video');cell.addEventListener('mouseenter',()=>v.play().catch(()=>{}));cell.addEventListener('mouseleave',()=>{v.pause();v.currentTime=0;});cell.appendChild(v);const b=document.createElement('span');b.className='story-badge video';
        b.innerHTML='<svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polygon points="5 3 19 12 5 21 5 3"/></svg>Reel';
        cell.appendChild(b);}
        else if(st.url){const img=document.createElement('img');img.src=st.url;img.alt='';cell.appendChild(img);}
        const num=document.createElement('span');num.className='story-num';num.textContent=i+1;cell.appendChild(num);
        const dh=document.createElement('div');dh.className='story-drag-h';dh.innerHTML='⠿';cell.appendChild(dh);
        // FIX 5: drag via delegation on stories grid
        cell.draggable=true;
        cell.dataset.stDragIdx=idx;
        const ov=document.createElement('div');ov.className='story-overlay';
        if(st.isStoryboard){const eb=document.createElement('button');eb.className='ov-btn ob-edit';eb.innerHTML='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg> Modifica';eb.onclick=e=>{e.stopPropagation();openStoryboardModal(idx);};ov.appendChild(eb);}
        const cpb=document.createElement('button');cpb.className='ov-btn ob-copy';cpb.innerHTML='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg> Copia da…';cpb.onclick=e=>{e.stopPropagation();openCopyModal('stories');};ov.appendChild(cpb);
        const del=document.createElement('button');del.className='ov-btn ob-delete';del.innerHTML='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/></svg> Rimuovi';del.onclick=e=>{e.stopPropagation();showConfirm({
              title:'Rimuovi story',
              body:'La story verrà eliminata definitivamente.',
              okLabel:'Rimuovi',
              type:'danger',
              onOk:()=>removeStoryItem(idx)
            })};ov.appendChild(del);
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
        cell.title=(st.type==='autonoma'?'Autonoma':'Template Nassa')+(st.brief?' — '+st.brief:'');

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
        di.textContent=(st.type==='autonoma'?'Autonoma':'Template')+(st.date?' · '+fmtDate(st.date):'');
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
function removeStoryItem(i){
  const arr=currentStoryItems();
  const snapshot={item:{...arr[i]},idx:i};
  if(!arr[i].isExternalLink)URL.revokeObjectURL(arr[i].url);
  arr.splice(i,1);setStoryItems(arr);refreshStories();
  showUndoToast('Story rimossa',()=>{
    const cur=currentStoryItems();
    cur.splice(snapshot.idx,0,{...snapshot.item,url:snapshot.item.externalUrl||''});
    setStoryItems(cur);refreshStories();autoSave();
  });
}

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

  setTimeout(sbInitMobile, 50); // mobile layout init
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
    arr[sbEditIdx].url=cleanSlides[0]?.url||'';arr[sbEditIdx].isStoryboard=true;if(arr[sbEditIdx].isUGC===undefined)arr[sbEditIdx].isUGC=false;if(arr[sbEditIdx].briefInviato===undefined)arr[sbEditIdx].briefInviato=false;if(arr[sbEditIdx].fileCaricato===undefined)arr[sbEditIdx].fileCaricato=false;
  }else{
    arr.push({type:'image',url:cleanSlides[0]?.url||'',name:'Storyboard',date:'',note:'',isStoryboard:true,slides:cleanSlides,isUGC:false,briefInviato:false,fileCaricato:false,id:'sb_'+Date.now()+'_'+Math.random().toString(36).slice(2,7)});
  }
  setStoryItems(arr);closeModal('storyboard-modal');refreshStories();
  CLOUD.saveNow(CLOUD.snapshot()); // salva subito dopo upload slides
  showToast('✓ Storyboard salvato');
}

/* ════ SLIDE BUILDER ════ */
// Sfondi storyboard — token Gruppo A
const SFONDI = {
  'Avorio': { bg:'#F5F2EB', text:'#2a2a2a', acc:'#888' },
  'Righe':  { bg:'#eeeeee', text:'#1a1a1a', acc:'#666' },
  'Quadr.': { bg:'#e8e8e8', text:'#1a1a1a', acc:'#666' },
  'Dark':   { bg:'#1a1a1a', text:'#f0f0f0', acc:'#aaa' },
};
const SFONDI_DEFAULT = 'Avorio';
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
  // Gruppo A: campi aggiuntivi
  const sfEl=document.getElementById('sb-f-sfondo');
  if(sfEl)sfEl.value=sl.sfondo||SFONDI_DEFAULT;
  const nrEl=document.getElementById('sb-f-nota-regia');
  if(nrEl)nrEl.value=sl.noteRegia||'';
  const phEl=document.getElementById('sb-f-placeholder');
  if(phEl)phEl.checked=!!sl.isPlaceholder;
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
  // Gruppo A: salva campi aggiuntivi
  sl.sfondo = g('sb-f-sfondo') || SFONDI_DEFAULT;
  sl.noteRegia = g('sb-f-nota-regia') || '';
  const phEl = document.getElementById('sb-f-placeholder');
  sl.isPlaceholder = phEl ? phEl.checked : false;
  updateSbPreview();renderSbThumbs();
}

function updateSbPreview(){
  const sl=sbTmpSlides[sbCurSlide]||{};
  const s=(id,v)=>{const el=document.getElementById(id);if(el)el.textContent=v||'';};
  s('sb-p-num',sl.num||'1.');s('sb-p-eye',sl.eye||'');s('sb-p-tit',sl.title||'Titolo');s('sb-p-cop',sl.note||'');

  // Immagine
  const ci=document.getElementById('sb-canvas-img');
  if(ci){const src=sl.blobUrl||sl.url||'';if(src){ci.style.display='block';ci.innerHTML='<img src="'+src+'" style="width:100%;height:100%;object-fit:cover;"/>';}else{ci.style.display='none';}}

  // Sfondo da SFONDI token (Gruppo A)
  const canvas=document.getElementById('sb-canvas');
  if(canvas && sl.sfondo && typeof SFONDI!=='undefined' && SFONDI[sl.sfondo]){
    const sf=SFONDI[sl.sfondo];
    canvas.style.background=sf.bg;
    canvas.style.backgroundImage='none';
    // Aggiorna colore testi
    const numEl=document.getElementById('sb-p-num');
    const titEl=document.getElementById('sb-p-tit');
    const copEl=document.getElementById('sb-p-cop');
    if(numEl)numEl.style.color=sf.acc;
    // Aggiorna swatch colore numero
    const swatch=document.getElementById('sb-num-color-swatch');
    if(swatch) swatch.style.background=sf.acc;
    if(titEl)titEl.style.color=sf.text;
    if(copEl)copEl.style.color=sf.text;
  } else if(canvas && !sl.sfondo){
    // Ripristina default classe CSS
    canvas.style.background='';
    canvas.style.backgroundImage='';
  }

  // Nota regia (Gruppo A) — appare in fondo al canvas
  let nrEl=document.getElementById('sb-p-nota-regia');
  if(sl.noteRegia){
    if(!nrEl){
      nrEl=document.createElement('div');
      nrEl.id='sb-p-nota-regia';
      nrEl.style.cssText='margin-top:6px;font-size:8px;color:#7a5c00;line-height:1.4;border-left:2px solid #d4a800;padding-left:5px;background:rgba(212,168,0,0.07);padding:3px 5px;';
      const lbl=document.createElement('div');
      lbl.style.cssText='font-size:7px;font-family:var(--font);letter-spacing:.1em;text-transform:uppercase;color:#7a5c00;margin-bottom:2px;font-weight:600;';
      lbl.textContent='REGIA';
      nrEl.appendChild(lbl);
      const txt=document.createElement('div');txt.id='sb-p-regia-txt';
      nrEl.appendChild(txt);
      if(canvas)canvas.appendChild(nrEl);
    }
    const txt=document.getElementById('sb-p-regia-txt');
    if(txt)txt.textContent=sl.noteRegia;
    nrEl.style.display='block';
  } else if(nrEl){
    nrEl.style.display='none';
  }

  // isPlaceholder — cornicetta tratteggiata (Gruppo A)
  let phEl=document.getElementById('sb-p-placeholder-overlay');
  if(sl.isPlaceholder){
    if(!phEl){
      phEl=document.createElement('div');
      phEl.id='sb-p-placeholder-overlay';
      phEl.style.cssText='position:absolute;inset:6px;border:1.5px dashed rgba(120,120,120,0.35);border-radius:4px;pointer-events:none;display:flex;align-items:center;justify-content:center;';
      const lbl=document.createElement('div');
      lbl.style.cssText='font-size:8px;font-family:var(--font);color:rgba(120,120,120,0.5);letter-spacing:.06em;text-transform:uppercase;';
      lbl.textContent='video creator';
      phEl.appendChild(lbl);
      if(canvas)canvas.appendChild(phEl);
    }
    phEl.style.display='flex';
  } else if(phEl){
    phEl.style.display='none';
  }
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


function addSbSlide(){sbTmpSlides.push({url:'',blobUrl:'',num:(sbTmpSlides.length+1)+'.',eye:'',title:'',note:'',_file:null,sfondo:SFONDI_DEFAULT,noteRegia:'',isPlaceholder:false});sbCurSlide=sbTmpSlides.length-1;renderSbBuilder();}
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
    const del=document.createElement('button');del.className='sb-del';del.innerHTML='<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/></svg>';del.onclick=()=>removeSbSlide(i);row.appendChild(del);
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
let sbCassetto=safeLocalJSON('sb_cassetto',[]);
let cassettoRealizzati=safeLocalJSON('sb_realizzati',[]);

function sbSaveToCassetto(){
  if(!sbTmpSlides.length){showToast('Nessuna slide da salvare','warn');return;}
  const name=prompt('Nome bozza:','Bozza '+(sbCassetto.length+1));
  if(!name)return;
  const entry={id:Date.now(),name,savedAt:new Date().toISOString(),
    slides:sbTmpSlides.map(s=>({num:s.num||'',eye:s.eye||'',title:s.title||'',note:s.note||'',url:s.url||'',sfondo:s.sfondo||SFONDI_DEFAULT,noteRegia:s.noteRegia||'',isPlaceholder:!!s.isPlaceholder}))};
  sbCassetto.unshift(entry);
  try{localStorage.setItem('sb_cassetto',JSON.stringify(sbCassetto));}catch(e){}
  renderSbCassetto();
  showToast('✓ Bozza salvata nel cassetto');
}

function sbLoadFromCassetto(id){
  const entry=sbCassetto.find(e=>e.id===id);if(!entry)return;
  showConfirm({
    title:'Carica bozza',
    body:'Le slide correnti verranno sostituite con questa bozza. Continui?',
    okLabel:'Carica',
    type:'warn',
    onOk:()=>{
  sbTmpSlides=entry.slides.map(s=>({...s,blobUrl:'',_file:null}));
  sbCurSlide=0;
  renderSbBuilder();
  sbSwitchTab('editor',document.getElementById('sb-tab-editor'));
  showToast('✓ Bozza caricata');
  }});
}

function sbDeleteFromCassetto(id){
  const entry=sbCassetto.find(e=>e.id===id);
  const idx=sbCassetto.findIndex(e=>e.id===id);
  sbCassetto=sbCassetto.filter(e=>e.id!==id);
  try{localStorage.setItem('sb_cassetto',JSON.stringify(sbCassetto));}catch(e){}
  renderSbCassetto();
  if(entry){
    showUndoToast('Bozza eliminata',()=>{
      sbCassetto.splice(idx,0,entry);
      try{localStorage.setItem('sb_cassetto',JSON.stringify(sbCassetto));}catch(e){}
      renderSbCassetto();
    });
  }
}

let sbCasTab = 'bozze'; // 'bozze' | 'realizzati'

function sbSwitchCasTab(tab){
  sbCasTab = tab;
  renderSbCassetto();
}

function renderSbCassetto(){
  const c=document.getElementById('sb-cassetto-list');if(!c)return;

  // Tab header
  const tabHtml = `<div class="sb-cas-tabs">
    <button class="sb-cas-tab${sbCasTab==='bozze'?' active':''}" onclick="sbSwitchCasTab('bozze')">Bozze</button>
    <button class="sb-cas-tab${sbCasTab==='realizzati'?' active':''}" onclick="sbSwitchCasTab('realizzati')">Realizzati</button>
  </div>`;

  if(sbCasTab === 'bozze'){
    if(!sbCassetto.length){
      c.innerHTML=tabHtml+'<div class="sb-cass-empty">Nessuna bozza salvata.<br>Clicca "+ Salva corrente" per iniziare.</div>';return;
    }
    c.innerHTML=tabHtml;
    sbCassetto.forEach(entry=>{
      const d=document.createElement('div');d.className='sb-cassetto-item';
      const dt=new Date(entry.savedAt);
      const dateStr=dt.toLocaleDateString('it-IT',{day:'numeric',month:'short'})+' '+dt.toLocaleTimeString('it-IT',{hour:'2-digit',minute:'2-digit'});
      d.innerHTML=`<div><div class="sb-cass-name">${entry.name}</div><div class="sb-cass-meta">${entry.slides.length} slide · ${dateStr}</div></div><div class="sb-cass-actions"><button class="sb-cass-btn" onclick="sbLoadFromCassetto(${entry.id})">Carica</button><button class="sb-cass-btn" style="color:var(--red);" onclick="showConfirm({title:'Elimina bozza',body:'La bozza verrà eliminata.',okLabel:'Elimina',type:'danger',onOk:()=>sbDeleteFromCassetto(${entry.id})})">✕</button></div>`;
      c.appendChild(d);
    });
  } else {
    // Tab Idee realizzate
    if(!cassettoRealizzati.length){
      c.innerHTML=tabHtml+'<div class="sb-cass-empty">Nessun template realizzato.<br>Appariranno qui quando il creator carica il video.</div>';return;
    }
    c.innerHTML=tabHtml;
    cassettoRealizzati.forEach((entry,ri)=>{
      const d=document.createElement('div');d.className='sb-cassetto-item';
      const dt=entry.archiviatoAt ? new Date(entry.archiviatoAt) : null;
      const dateStr=dt ? dt.toLocaleDateString('it-IT',{day:'numeric',month:'short'}) : '—';
      const nSlide = (entry.slides||[]).length;

      // Miniatura con checkmark verde
      const thumb=document.createElement('div');
      thumb.className='sb-real-thumb';
      thumb.innerHTML='<span class="sb-real-check">✓</span>';

      const info=document.createElement('div');
      info.style.cssText='flex:1;min-width:0;';
      info.innerHTML=`<div class="sb-cass-name">${entry.name||'Template'}</div>`
        +`<div class="sb-cass-meta">${nSlide} slide · ${dateStr}</div>`
        +`<span class="sb-ugc-tag">UGC</span>`;

      const riusaBtn=document.createElement('button');
      riusaBtn.className='sb-riusa-btn';
      riusaBtn.textContent='Riusa';
      riusaBtn.onclick=()=>{
        // Duplica il template come nuova bozza nel cassetto
        const clone={
          ...entry,
          id: Date.now(),
          name: (entry.name||'Template')+' (copia)',
          salvatoAt: Date.now(),
          slides: (entry.slides||[]).map(s=>({...s}))
        };
        // Rimuove campi specifici del "realizzato"
        delete clone.archiviatoAt;
        sbCassetto.unshift(clone);
        try{localStorage.setItem('sb_cassetto',JSON.stringify(sbCassetto));}catch(e){}
        showToast('✓ Template duplicato come nuova bozza');
        sbSwitchCasTab('bozze');
      };

      d.appendChild(thumb);
      d.appendChild(info);
      d.appendChild(riusaBtn);
      c.appendChild(d);
    });
  }
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
  const key=accountKey(acc.id,month);const _allReady=(feeds[key]||[]).filter(i=>i.type!=='pending');
  const stArr=stories[key]||[];
  // Applica filtri tipologia + approvazione
  const ready=_allReady.filter(item=>{
    const typeOk = previewTypeFilter==='tutti' ||
      (previewTypeFilter==='image' && (item.type==='image'||item.type==='editorial')) ||
      (previewTypeFilter==='video' && item.type==='video') ||
      (previewTypeFilter==='carousel' && item.type==='carousel');
    const apprOk = apprFilter==='tutti' || (item.apprStato||'bozza')===apprFilter;
    return typeOk && apprOk;
  });
  const chip=document.getElementById('preview-chip');if(chip)chip.textContent=ready.length+' contenut'+(ready.length===1?'o':'i')+(accs.length>1?' · '+acc.name:'');
  if(!ready.length){const em=document.createElement('div');em.className='preview-empty';em.innerHTML='<p>Nessun contenuto per '+acc.name+' — '+month+'.</p>';body.appendChild(em);}
  else{
    // ── PROFILO INSTAGRAM: foto + highlights + bio ──
    // Recupera highlights dell'account di preview
    const accPreviewIdx = accs.indexOf(acc);
    const accPreviewId = acc?.id || null;
    const hlArr = accPreviewId ? (highlights[accPreviewId]||[]) : [];

    const profileSec = document.createElement('div');
    profileSec.className = 'preview-profile-sec';

    // Riga superiore: avatar + highlights
    const profileTop = document.createElement('div');
    profileTop.className = 'preview-profile-top';

    // Avatar (foto profilo)
    const avatarEl = document.createElement('div');
    avatarEl.className = 'preview-profile-avatar';
    if(acc.profileImg){
      const img = document.createElement('img');
      img.src = acc.profileImg;
      img.alt = 'Foto profilo';
      img.style.cssText = 'width:100%;height:100%;object-fit:cover;';
      avatarEl.appendChild(img);
    } else {
      avatarEl.innerHTML = '<svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="rgba(255,255,255,0.5)" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>';
    }
    profileTop.appendChild(avatarEl);

    // Highlights in riga
    if(hlArr.length){
      const hlStrip = document.createElement('div');
      hlStrip.className = 'preview-hl-strip';
      hlArr.forEach(hl=>{
        const hlItem = document.createElement('div');
        hlItem.className = 'preview-hl-item';
        // Cerchio
        const circle = document.createElement('div');
        circle.className = 'preview-hl-circle';
        if(hl.coverUrl){
          const img = document.createElement('img');
          img.src = hl.coverUrl;
          img.alt = hl.name||'';
          circle.appendChild(img);
        } else {
          circle.style.background = 'var(--cell-bg)';
        }
        // Label
        const lbl = document.createElement('div');
        lbl.className = 'preview-hl-lbl';
        lbl.textContent = hl.name||'';
        hlItem.appendChild(circle);
        hlItem.appendChild(lbl);
        hlStrip.appendChild(hlItem);
      });
      profileTop.appendChild(hlStrip);
    }

    profileSec.appendChild(profileTop);

    // Bio
    if(acc.bio){
      const bioEl = document.createElement('div');
      bioEl.className = 'preview-profile-bio';
      bioEl.textContent = acc.bio;
      profileSec.appendChild(bioEl);
    }

    // Separatore
    const sep = document.createElement('div');
    sep.style.cssText = 'height:1px;background:var(--border);margin:12px 0 8px;';
    profileSec.appendChild(sep);

    body.appendChild(profileSec);

    const grid=document.createElement('div');grid.className='client-grid';
    ready.forEach((item,i)=>{
      const post=document.createElement('div');post.className='client-post';
      const cell=document.createElement('div');cell.className='client-cell';
      // Use pointer cursor always so click is obvious even on empty cells
      cell.style.cursor='pointer';
      cell.onclick=()=>openLb(i,ready,stArr);
      const _itemUrl=item.url||item.externalUrl||'';
      const coverUrl=item.type==='carousel'&&item.slides?.length?(item.slides[0].url||item.slides[0].externalUrl||''):_itemUrl;
      if(item.type==='video'){
        if(item.coverUrl){
          // Mostra cover statica in Preview + play icon overlay
          const img=makeMedia(item.coverUrl,'image');
          if(img){ img.style.pointerEvents='none'; cell.appendChild(img); }
          const playIcon=document.createElement('div');
          playIcon.style.cssText='position:absolute;inset:0;display:flex;align-items:center;justify-content:center;pointer-events:none;';
          playIcon.innerHTML='<div style="width:36px;height:36px;border-radius:50%;background:rgba(0,0,0,.55);display:flex;align-items:center;justify-content:center;"><svg viewBox=\"0 0 24 24\" width=\"16\" height=\"16\" fill=\"#fff\"><polygon points=\"5 3 19 12 5 21 5 3\"/></svg></div>';
          cell.appendChild(playIcon);
        } else {
          // Reel senza cover: placeholder cliccabile (URL Dropbox non streamabili inline)
          const ph3=document.createElement('div');ph3.style.cssText='width:100%;height:100%;background:#1a1a1a;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:8px;pointer-events:none;';
          ph3.innerHTML='<div style="width:40px;height:40px;border-radius:50%;background:rgba(255,255,255,.12);display:flex;align-items:center;justify-content:center;"><svg viewBox=\"0 0 24 24\" width=\"18\" height=\"18\" fill=\"rgba(255,255,255,.6)\"><polygon points=\"5 3 19 12 5 21 5 3\"/></svg></div><div style=\"font-size:9px;color:rgba(255,255,255,.4);font-family:var(--font);\">Reel</div>';
          cell.appendChild(ph3);
        }
        const b=document.createElement('span');b.className='client-badge video';
        b.innerHTML='<svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polygon points="5 3 19 12 5 21 5 3"/></svg>Reel';
        cell.appendChild(b);
      } else if(item.type==='carousel'&&item.slides?.length>1){
        // Carosello navigabile inline in Preview
        try{
          const player = buildCaroselloPlayer(item, i, ready, []);
          // In Preview, il wrap del carosello fa stopPropagation → aggiunge click in capture
          player.addEventListener('click', (e)=>{ openLb(i,ready,stArr); }, true);
          cell.appendChild(player);
          cell.style.overflow='hidden';
        } catch(e){
          console.warn('Preview carousel error:', e);
          const img=makeMedia(coverUrl,'image');
          if(img){img.style.pointerEvents='none';cell.appendChild(img);}
          const b=document.createElement('span');b.className='client-badge carousel';
          b.innerHTML='<svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="6" width="14" height="14" rx="2"/><path d="M22 6h-2a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2"/></svg>'+(item.slides?.length||0)+' slide';
          cell.appendChild(b);
        }
       } else if(item.type==='editorial'){
         // Card editoriale: render grafico inline (no URL file)
         const _brand=feedClientIdx>=0?clients[feedClientIdx]?.brand||{}:{};
         const cols=item.editorialColors||(Object.keys(_brand).length?{bg:_brand.bg||'#f5f0e8',text:_brand.text||'#111',accent:_brand.primary||'#1a3c5e'}:{bg:'#f5f0e8',text:'#111',accent:'#1a3c5e'});
         cell.style.background=cols.bg;cell.style.color=cols.text;
         const edTitleHtml=item.editorialAccent&&item.editorialTitle?.includes(item.editorialAccent)
           ?item.editorialTitle.replace(item.editorialAccent,`<span style="color:${cols.accent};">${item.editorialAccent}</span>`)
           :item.editorialTitle||'';
         const cardInner=document.createElement('div');
         cardInner.style.cssText='position:absolute;inset:0;padding:12px 11px 36px;display:flex;flex-direction:column;font-family:var(--font);pointer-events:none;';
         cardInner.innerHTML=`<div style="font-size:10px;font-weight:700;letter-spacing:.8px;text-transform:uppercase;opacity:.4;margin-bottom:6px;">${esc(item.editorialEyebrow||'')}</div><div style="font-weight:800;line-height:1.1;letter-spacing:-1px;font-size:16px;flex:1;">${edTitleHtml}</div><div style="height:1px;background:currentColor;opacity:.15;margin:6px 0;"></div><div style="font-size:10px;opacity:.5;line-height:1.4;">${(item.editorialCopy||'').slice(0,80)}</div>`;
         cell.appendChild(cardInner);
       } else {
         const imgPrev=makeMedia(coverUrl,'image');
         if(imgPrev){imgPrev.style.pointerEvents='none';cell.appendChild(imgPrev);}
         else{const ph=document.createElement('div');ph.style.cssText='width:100%;height:100%;background:#e2e2e4;display:flex;align-items:center;justify-content:center;color:#aaa;font-size:24px;';ph.textContent='';cell.appendChild(ph);}
         if(item.type==='carousel'){const b=document.createElement('span');b.className='client-badge carousel';
         b.innerHTML='<svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="6" width="14" height="14" rx="2"/><path d="M22 6h-2a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2"/></svg>'+(item.slides?.length||0)+' slide';
         cell.appendChild(b);}
       }
      if(item.showDate&&item.date){const dp=document.createElement('div');dp.className='client-date-bar';dp.textContent=item.date;cell.appendChild(dp);}
      post.appendChild(cell);
      if(item.copy?.trim()){const cd=document.createElement('div');cd.className='client-copy';cd.innerHTML='<div class="client-copy-lbl">Caption</div>';const ct=document.createElement('div');ct.textContent=item.copy;cd.appendChild(ct);post.appendChild(cd);}
      const linked=(item.linkedStories||[]).map(si=>stArr[si]).filter(Boolean);
      if(linked.length){
        const strip=document.createElement('div');strip.className='ls-strip';
        strip.innerHTML='<div class="ls-strip-lbl">📱</div>';
        linked.forEach((st,si)=>{
          const circ=document.createElement('div');circ.className='ls-circle';
          const cu=st.isStoryboard&&st.slides?.[0]?st.slides[0].url:st.url;
          if(cu){const img=document.createElement('img');img.src=cu;img.alt='';circ.appendChild(img);}
          // Click: apre anteprima storyboard/story
          circ.title = st.name || 'Story collegata';
          circ.style.cursor = 'pointer';
          circ.onclick = e => {
            e.stopPropagation();
            const storyOpts={aspectRatio:'9/16'};
            if(st.isStoryboard && st.slides?.length){
              const slideItems=st.slides.map((sl,idx)=>({
                type:'image', url:sl.url||sl.externalUrl||sl.blobUrl||'', name:sl.title||'Slide '+(idx+1),
                note:sl.note||sl.noteRegia||''
              }));
              const hasAnyUrl=slideItems.some(s=>s.url);
              if(hasAnyUrl){
                openLb(0, slideItems, [], storyOpts);
              } else {
                // Nessun URL disponibile — le immagini non sono state caricate su Dropbox
                showToast('Le slide non sono disponibili. Apri il tab Stories per caricarle.','warn');
              }
            } else {
              const stUrl=cu||st.url||st.externalUrl||'';
              if(stUrl){
                openLb(0,[{type:st.type||'image', url:stUrl, name:st.name||'Story'}], [], storyOpts);
              } else {
                showToast('Story non disponibile. Apri il tab Stories.','warn');
              }
            }
          };
          strip.appendChild(circ);
        });
        post.appendChild(strip);
      }
      // ── STATUS BADGE APPROVAZIONE ──
      const apprSt = item.apprStato || 'bozza';
      const revCount = item.apprRevisions || 0;
      const APPR_CFG = {
        bozza:     {label:'Bozza',       dot:'#aaa',    bg:'rgba(0,0,0,0.52)',       text:'#e8e8e8',       border:'rgba(255,255,255,0.15)'},
        approvare: {label:'In revisione', dot:'#f5c800', bg:'rgba(212,168,0,0.82)',  text:'#3d2e00',       border:'rgba(212,168,0,0.9)'},
        approvato: {label:'Approvato',    dot:'#22c97a', bg:'rgba(26,122,74,0.82)',  text:'#d6fff0',       border:'rgba(26,122,74,0.9)'},
      };
      const cfg = APPR_CFG[apprSt] || APPR_CFG.bozza;
      // Bordo card colorato per stato
      if(apprSt !== 'bozza'){
        post.style.borderColor = apprSt==='approvare' ? '#d4a800' : '#22c97a';
        post.style.borderWidth = '2px';
      }
      // Badge stato in basso a sinistra sulla cella immagine
      const stBadge = document.createElement('div');
      stBadge.className = 'feed-appr-badge';
      stBadge.style.cssText = `background:${cfg.bg};color:${cfg.text};border:1px solid ${cfg.border};`;
      stBadge.innerHTML = `<span class="feed-appr-dot" style="background:${cfg.dot};"></span>${cfg.label}`;
      stBadge.onclick = (e)=>{ e.stopPropagation(); openApprModal(i, ready); };
      cell.appendChild(stBadge);
      // Badge revisioni (solo se > 0)
      if(revCount > 0){
        const revBadge = document.createElement('div');
        const revColor = revCount >= 3 ? '#ef4444' : revCount === 2 ? '#d4a800' : '#1a7a4a';
        const revLabel = revCount >= 3 ? 'Fuori contratto' : `Rev. ${revCount}`;
        revBadge.className = 'feed-rev-badge';
        revBadge.style.cssText = `background:${revColor};color:#fff;`;
        revBadge.title = revCount >= 3 ? `${revCount} revisioni — fuori dal contratto` : `${revCount} revision${revCount>1?'i':'e'}`;
        revBadge.textContent = revCount >= 3 ? `⚠ ${revCount}` : revCount;
        cell.appendChild(revBadge);
      }
      grid.appendChild(post);
    });
    body.appendChild(grid);
  }

  // ── STORYBOARD SECTION — Gruppo B: player inline con autoplay, puntini, strip ──
  const storyboards = stArr.filter(st => st.isStoryboard && st.slides?.length);
  if(storyboards.length){
    // Stato player per ogni storyboard: {curSlide, playing, interval}
    const sbPlayerState = {};

    const sbSec = document.createElement('div');
    sbSec.style.cssText = 'margin-top:24px;';
    const sbHead = document.createElement('div');
    sbHead.style.cssText = 'font-size:11px;font-weight:600;color:var(--text-2);letter-spacing:.06em;text-transform:uppercase;margin-bottom:10px;padding-bottom:6px;border-bottom:1px solid var(--border);';
    sbHead.textContent = 'Storyboard · ' + storyboards.length + (storyboards.length===1?' elemento':' elementi');
    sbSec.appendChild(sbHead);

    const sbGrid = document.createElement('div');
    sbGrid.style.cssText = 'display:grid;grid-template-columns:repeat(3,1fr);gap:10px;';

    storyboards.forEach((sb, si) => {
      const sbId = sb.id || si;
      sbPlayerState[sbId] = { cur: 0, playing: false, interval: null };
      const state = sbPlayerState[sbId];

      // Funzione aggiorna slide attiva
      function sbGoTo(idx){
        if(state.interval){ clearInterval(state.interval); state.interval=null; state.playing=false; }
        state.cur = (idx + sb.slides.length) % sb.slides.length;
        sbRefresh();
      }
      function sbTogglePlay(){
        if(state.playing){
          clearInterval(state.interval); state.interval=null; state.playing=false;
        } else {
          state.playing=true;
          state.interval = setInterval(()=>{
            state.cur = (state.cur+1) % sb.slides.length;
            sbRefresh();
          }, 1800);
        }
        sbRefresh();
      }

      // ── Card wrapper ──
      const sbPost = document.createElement('div');
      sbPost.className = 'sb-player-card';

      // ── Player area 9:16 ──
      const playerWrap = document.createElement('div');
      playerWrap.className = 'sb-player-wrap';

      // Immagine slide
      const slideImg = document.createElement('img');
      slideImg.className = 'sb-player-img';

      // Badge stato (bozza/approvare/approvato)
      const statoBadge = document.createElement('div');
      statoBadge.className = 'sb-stato-badge';

      // Badge contatore slide (es. 2/5)
      const counterBadge = document.createElement('div');
      counterBadge.className = 'sb-counter-badge';

      // Frecce navigazione
      const btnPrev = document.createElement('button');
      btnPrev.className = 'sb-player-nav sb-player-prev';
      btnPrev.innerHTML = '‹';
      btnPrev.onclick = (e)=>{ e.stopPropagation(); sbGoTo(state.cur-1); };

      const btnNext = document.createElement('button');
      btnNext.className = 'sb-player-nav sb-player-next';
      btnNext.innerHTML = '›';
      btnNext.onclick = (e)=>{ e.stopPropagation(); sbGoTo(state.cur+1); };

      // Bottone autoplay
      const btnPlay = document.createElement('button');
      btnPlay.className = 'sb-player-play';
      btnPlay.onclick = (e)=>{ e.stopPropagation(); sbTogglePlay(); };

      // Puntini indicatori
      const dotsWrap = document.createElement('div');
      dotsWrap.className = 'sb-player-dots';

      playerWrap.appendChild(slideImg);
      playerWrap.appendChild(statoBadge);
      playerWrap.appendChild(counterBadge);
      if(sb.slides.length > 1){
        playerWrap.appendChild(btnPrev);
        playerWrap.appendChild(btnNext);
        playerWrap.appendChild(btnPlay);
        playerWrap.appendChild(dotsWrap);
      }
      sbPost.appendChild(playerWrap);

      // ── Strip miniature ──
      const strip = document.createElement('div');
      strip.className = 'sb-player-strip';
      sbPost.appendChild(strip);

      // ── Info footer ──
      const info = document.createElement('div');
      info.className = 'sb-player-info';
      info.innerHTML = `<span class="sb-player-name">${sb.name||'Storyboard'}</span>`
        + (sb.note ? `<span class="sb-player-note">${sb.note}</span>` : '');

      // Bottone brief (solo se isUGC)
      if(sb.isUGC){
        const briefBtn = document.createElement('button');
        briefBtn.className = 'sb-brief-btn';
        if(sb.briefInviato){
          briefBtn.textContent = 'Brief inviato · in attesa UGC';
          briefBtn.disabled = true;
          briefBtn.classList.add('sent');
        } else {
          briefBtn.textContent = '→ Invia brief';
          briefBtn.onclick = (e)=>{ e.stopPropagation(); openBriefModal(sb); };
        }
        info.appendChild(briefBtn);
      }

      sbPost.appendChild(info);

      // ── Funzione render stato ──
      function sbRefresh(){
        const sl = sb.slides[state.cur] || {};
        const url = sl.url || '';

        // Immagine
        if(url){ slideImg.src=url; slideImg.style.display='block'; }
        else { slideImg.style.display='none'; }

        // Sfondo dalla palette — default Avorio se non impostato
        const sfDefault = (typeof SFONDI !== 'undefined') ? SFONDI['Avorio'] : {bg:'#F5F2EB',text:'#2a2a2a',acc:'#888'};
        const sfCfg = (typeof SFONDI !== 'undefined' && sl.sfondo && SFONDI[sl.sfondo]) ? SFONDI[sl.sfondo] : sfDefault;
        playerWrap.style.background = sfCfg.bg;

        // Placeholder testo quando non c'è immagine
        let phTxt = playerWrap.querySelector('.sb-slide-ph-txt');
        if(!url){
          if(!phTxt){
            phTxt = document.createElement('div');
            phTxt.className = 'sb-slide-ph-txt';
            playerWrap.insertBefore(phTxt, slideImg.nextSibling);
          }
          phTxt.style.color = sfCfg.text;
          phTxt.innerHTML = (sl.num ? '<div class="sb-ph-num">'+sl.num+'</div>' : '')
            + (sl.eye ? '<div class="sb-ph-eye">'+sl.eye+'</div>' : '')
            + (sl.title ? '<div class="sb-ph-tit">'+sl.title+'</div>' : '<div class="sb-ph-tit" style="opacity:.3">Slide '+(state.cur+1)+'</div>')
            + (sl.note ? '<div class="sb-ph-cop">'+sl.note+'</div>' : '');
          phTxt.style.display = 'flex';
        } else if(phTxt){
          phTxt.style.display = 'none';
        }

        // Badge UGC viola (Gruppo C)
        if(sb.isUGC){
          const ugcBadge = document.createElement('div');
          ugcBadge.className = 'sb-ugc-badge';
          ugcBadge.textContent = 'UGC';
          playerWrap.appendChild(ugcBadge);
        }

        // Stato badge
        const STATO_S = {
          bozza:     {dot:'#999',   label:'Bozza',       bg:'rgba(0,0,0,0.55)',       text:'#e0e0e0'},
          approvare: {dot:'#d4a800',label:'Da approvare',bg:'rgba(212,168,0,0.18)',   text:'#7a5c00'},
          approvato: {dot:'#1a7a4a',label:'Approvato',   bg:'rgba(26,122,74,0.14)',   text:'#0f5230'},
        };
        const stKey = sb.stato||'bozza';
        const st = STATO_S[stKey]||STATO_S.bozza;
        statoBadge.style.cssText = `background:${st.bg};color:${st.text};`;
        statoBadge.innerHTML = `<span class="sb-stato-dot" style="background:${st.dot};"></span>${st.label}`;

        // Contatore
        counterBadge.textContent = `${state.cur+1}/${sb.slides.length}`;

        // Play button
        btnPlay.textContent = state.playing ? '⏸' : '▶';
        btnPlay.setAttribute('aria-label', state.playing ? 'Pausa' : 'Riproduci');
        btnPlay.title = state.playing ? 'Pausa' : 'Autoplay';

        // Puntini
        dotsWrap.innerHTML = '';
        sb.slides.forEach((_,di)=>{
          const dot = document.createElement('span');
          dot.className = 'sb-dot' + (di===state.cur ? ' active' : '');
          dot.onclick = (e)=>{ e.stopPropagation(); sbGoTo(di); };
          dotsWrap.appendChild(dot);
        });

        // Strip miniature
        strip.innerHTML = '';
        sb.slides.forEach((thumb,ti)=>{
          const th = document.createElement('div');
          th.className = 'sb-thumb' + (ti===state.cur ? ' active' : '');
          if(thumb.url){
            const tImg = document.createElement('img');
            tImg.src = thumb.url; tImg.alt = '';
            th.appendChild(tImg);
          }
          // Placeholder indicator
          if(thumb.isPlaceholder){
            const ph = document.createElement('div');
            ph.className = 'sb-thumb-ph';
            th.appendChild(ph);
          }
          th.onclick = (e)=>{ e.stopPropagation(); sbGoTo(ti); };
          strip.appendChild(th);
        });
      }

      sbRefresh();
      sbGrid.appendChild(sbPost);
    });

    sbSec.appendChild(sbGrid);
    body.appendChild(sbSec);
  }

  const footer=document.createElement('div');footer.className='preview-footer';footer.innerHTML='<p>Anteprima preparata da</p><div class="nassa-sig">Nassa Studio · nassastudio.it</div>';body.appendChild(footer);
  // Aggiorna statistiche approvazione
  apprUpdateStats(_allReady); // sempre aggiorna barra — usa _allReady per totali non filtrati
}

/* LIGHTBOX */
function openLb(i,ready,stArr,opts){if(!ready||!ready.length)return;lbItems=ready;lbIdx=Math.max(0,Math.min(i,ready.length-1));lbSlide=0;lbStArr=stArr||[];lbOpts=opts||{};renderLb();document.getElementById('lightbox').classList.add('open');}
function lbBg(e){if(e.target===document.getElementById('lightbox'))document.getElementById('lightbox').classList.remove('open');}
function lbNav(d){lbIdx=(lbIdx+d+lbItems.length)%lbItems.length;lbSlide=0;renderLb();}
function lbSlideNav(d){const item=lbItems[lbIdx];if(!item?.slides?.length)return;lbSlide=(lbSlide+d+item.slides.length)%item.slides.length;renderLb();}
function renderLb(){
  const inner=document.getElementById('lb-inner');if(!inner)return;inner.innerHTML='';
  // Applica aspect-ratio dal contesto (feed=4/5, stories=9/16)
  inner.style.aspectRatio=lbOpts.aspectRatio||'4/5';
  const lbWrap=inner.closest('.lb-wrap');if(lbWrap)lbWrap.style.width=lbOpts.aspectRatio==='9/16'?'min(260px,50vw)':'min(390px,85vw)';
  if(!lbItems.length){inner.innerHTML='<div style="color:#555;font-size:14px;font-family:var(--font);padding:40px;text-align:center;">Nessun contenuto disponibile</div>';return;}
  const item=lbItems[lbIdx];if(!item){return;}
  const isMulti=lbItems.length>1;const isCarousel=item.type==='carousel'&&item.slides?.length>1;
  const showPostNav=isMulti&&!isCarousel;
  document.getElementById('lb-prev').style.display=showPostNav?'flex':'none';document.getElementById('lb-next').style.display=showPostNav?'flex':'none';
  const x=document.createElement('button');x.className='lb-close';x.innerHTML='×';x.setAttribute('aria-label','Chiudi lightbox');x.onclick=()=>document.getElementById('lightbox').classList.remove('open');inner.appendChild(x);
  if(item.type==='carousel'&&item.slides?.length){
    const slideUrl=item.slides[lbSlide]?.url||item.url||'';
    if(slideUrl){const img=document.createElement('img');img.src=slideUrl;img.alt='';inner.appendChild(img);}
    else{const ph=document.createElement('div');ph.style.cssText='color:#555;font-size:48px;text-align:center;padding:40px;';ph.textContent='';inner.appendChild(ph);}
    if(item.slides.length>1){
      // Frecce dentro lb-inner — position:absolute rispetto al container immagine
      inner.querySelectorAll('.lb-slide-nav').forEach(el=>el.remove());
      const sp=document.createElement('button');sp.className='lb-slide-nav lb-slide-prev';sp.innerHTML='‹';sp.onclick=e=>{e.stopPropagation();lbSlideNav(-1);};inner.appendChild(sp);
      const sn=document.createElement('button');sn.className='lb-slide-nav lb-slide-next';sn.innerHTML='›';sn.onclick=e=>{e.stopPropagation();lbSlideNav(1);};inner.appendChild(sn);
    }
  } else if(item.type==='video'){
    const videoUrl=item.url||item.externalUrl||'';
    if(videoUrl){
      const vWrap=document.createElement('div');vWrap.style.cssText='width:100%;height:100%;display:flex;flex-direction:column;align-items:center;justify-content:center;background:#111;position:relative;';
      const v=document.createElement('video');
      v.src=videoUrl;v.controls=true;v.autoplay=false;v.muted=false;v.loop=false;v.playsInline=true;
      v.style.cssText='width:100%;height:100%;object-fit:contain;display:block;max-height:100%;';
      // Fallback: se CORS blocca il video, mostra pulsante apri
      const fallback=document.createElement('div');
      fallback.style.cssText='display:none;flex-direction:column;align-items:center;gap:12px;padding:20px;text-align:center;';
      fallback.innerHTML='<div style="font-size:32px;">🎬</div><div style="font-size:12px;color:#aaa;font-family:var(--font);">Il video non può essere riprodotto inline</div>';
      const openBtn=document.createElement('a');openBtn.href=videoUrl;openBtn.target='_blank';openBtn.rel='noopener';
      openBtn.style.cssText='background:rgba(255,255,255,.12);color:#fff;font-size:12px;font-family:var(--font);padding:8px 18px;border-radius:20px;text-decoration:none;display:inline-flex;align-items:center;gap:6px;margin-top:4px;';
      openBtn.innerHTML='<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="5 3 19 12 5 21 5 3"/></svg> Apri video';
      fallback.appendChild(openBtn);
      v.onerror=()=>{v.style.display='none';fallback.style.display='flex';};
      v.addEventListener('loadeddata',()=>{v.play().catch(()=>{});},{ once:true });
      vWrap.appendChild(v);vWrap.appendChild(fallback);inner.appendChild(vWrap);
    } else {
      const ph=document.createElement('div');ph.style.cssText='color:#555;font-size:48px;text-align:center;padding:40px;';ph.textContent='🎬';inner.appendChild(ph);
    }
  } else {
    const url=item.url||item.externalUrl||'';
    if(url){const img=document.createElement('img');img.src=url;img.alt='';img.style.cssText='max-width:100%;max-height:100%;object-fit:contain;';inner.appendChild(img);}
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
  if(e.key==='Escape'){lb.classList.remove('open');const dr=document.getElementById('ped-drawer');if(dr&&dr.style.display!=='none')pedCloseDrawer();}
});

/* MODAL HELPERS */
function openModal(id){const m=document.getElementById(id);if(m)m.classList.add('open');}
function closeModal(id){const m=document.getElementById(id);if(m)m.classList.remove('open');}
document.addEventListener('click',e=>{if(e.target.classList.contains('modal-bg')&&!e.target.dataset.noClose)e.target.classList.remove('open');});

/* ════════ CALENDARIO ════════ */
let calView='month',calDate=new Date();
const GIORNIW=['Lun','Mar','Mer','Gio','Ven','Sab','Dom'];
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
      (pedPlans[pkey]||[]).forEach((st)=>{if(!st.date)return;const lbl=(st.type==='autonoma'?'👤 ':'🎨 ')+(st.brief?st.brief.slice(0,18):'Story pianificata');addEv(st.date,{type:'ped',label:lbl,thumb:st.storyboardThumb||null,item:st,clientIdx:ci,clientName:cl.name,month:mo,pedType:st.type,ugcStato:st.ugcStato||'raccolto'});});
    });
    // Campagne Paid → aggiungi evento al giorno di inizio nel mese del calendario
    const adsKey=cl.id||null;
    if(adsKey&&adsCampaigns[adsKey]){
      const yr=calDate.getFullYear(),mo2=calDate.getMonth();
      (adsCampaigns[adsKey]||[]).forEach(camp=>{
        if(!camp.startDay)return;
        const days=new Date(yr,mo2+1,0).getDate();
        if(camp.startDay>days)return;
        const ds=`${yr}-${String(mo2+1).padStart(2,'0')}-${String(camp.startDay).padStart(2,'0')}`;
        addEv(ds,{type:'ads',label:camp.name||'Campagna',camp,clientIdx:ci,clientName:cl.name,platform:camp.platform||''});
      });
    }
  });
  return events;
}

function renderCalendar(){
  const body=document.getElementById('cal-body');if(!body)return;
  const lbl=document.getElementById('cal-month-label');const events=calGetAllEvents();const today=todayISO();
  if(calView==='month'){
    const y=calDate.getFullYear(),m=calDate.getMonth();if(lbl)lbl.textContent=MONTHS[m]+' '+y;
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
          else if(isPed){badgeCls='cal-badge-ugc';badgeTxt='UGC';}else if(ev.type==='ads'){badgeCls='cal-badge-ads';badgeTxt='PAID';}
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
    if(lbl)lbl.textContent='Settimana del '+curr.getDate()+' '+MONTHS[curr.getMonth()];
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
  const thumbHtml=ev.thumb?`<img src="${ev.thumb}" class="cal-ev-thumb-week" onerror="this.style.display='none'" />`:(dot?`<span>${dot}</span>`:`<span>${ev.type==='feed'?'🖼':''}</span>`);
  html+=`<div class="cal-week-event ${cls}" style="top:${top}px;height:34px;" onclick="openCalPanel('${ds}')">${thumbHtml}<span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;flex:1;">${ev.clientName.split(' — ')[0]}: ${ev.label}</span></div>`;
});html+='</div>';});
    html+='</div>';body.innerHTML=html;
  }
}

function openCalPanel(dateStr){
  const events=calGetAllEvents();const evs=events[dateStr]||[];
  const panel=document.getElementById('cal-day-panel');if(!panel)return;
  // Overlay
  let overlay=document.getElementById('cal-panel-overlay');
  if(!overlay){
    overlay=document.createElement('div');
    overlay.id='cal-panel-overlay';
    overlay.className='cal-panel-overlay';
    overlay.onclick=()=>closeCalPanel();
    document.body.appendChild(overlay);
  }
  overlay.classList.add('open');
  // Handle mobile (già nell'HTML)
  const handle=panel.querySelector('.cal-panel-handle');
  if(!handle){
    const hEl=document.createElement('div');
    hEl.className='cal-panel-handle';
    panel.insertBefore(hEl, panel.firstChild);
  }
  const head=document.getElementById('cal-panel-date');const body=document.getElementById('cal-panel-body');if(!head||!body)return;
  const[y,mo,d]=dateStr.split('-');const dt=new Date(parseInt(y),parseInt(mo)-1,parseInt(d));
  const gg=['Domenica','Lunedì','Martedì','Mercoledì','Giovedì','Venerdì','Sabato'];
  head.textContent=gg[dt.getDay()]+' '+parseInt(d)+' '+MONTHS[parseInt(mo)-1]+' '+y;
  body.innerHTML='';
  if(!evs.length){body.innerHTML='<p style="font-size:12px;color:var(--text-3);text-align:center;padding:20px;">Nessun contenuto programmato.</p>';panel.classList.add('open');return;}
  const feeds_=evs.filter(e=>e.type==='feed');const stories_=evs.filter(e=>e.type==='story');const hl_=evs.filter(e=>e.type==='highlight');const pedAuto_=evs.filter(e=>e.type==='ped'&&e.pedType==='autonoma');const pedTmpl_=evs.filter(e=>e.type==='ped'&&e.pedType==='template');
  const renderSection=(list,label,typeClass)=>{if(!list.length)return;const sec=document.createElement('div');const sl=document.createElement('div');sl.className='cal-panel-section';sl.textContent=label;sec.appendChild(sl);list.forEach(ev=>{const row=document.createElement('div');row.className='cal-panel-item';const thumb=document.createElement('div');thumb.className='cal-panel-thumb'+(typeClass==='story'?' story':'');if(ev.vidUrl){const v=document.createElement('video');v.src=ev.vidUrl;v.muted=true;v.playsInline=true;v.preload='metadata';v.style.cssText='width:100%;height:100%;object-fit:cover;';thumb.appendChild(v);}else if(ev.thumb){const img=document.createElement('img');img.src=ev.thumb;img.alt='';thumb.appendChild(img);}const info=document.createElement('div');info.className='cal-panel-info';const type_=document.createElement('div');type_.className=`cal-panel-type ${typeClass}`;type_.textContent=label.replace(/[📄📱⭐👤🎨] /,'');info.appendChild(type_);const cp=document.createElement('div');cp.className='cal-panel-copy';cp.textContent=ev.item.brief||ev.item.copy||ev.item.note||ev.item.name||ev.label||'—';info.appendChild(cp);if(ev.clientName){const cl_=document.createElement('div');cl_.style.cssText='font-size:10px;color:var(--text-3);margin-top:2px;';cl_.textContent=ev.clientName;info.appendChild(cl_);}if(ev.type==='feed'||ev.type==='story'||ev.type==='ped'){const tabDest=ev.type==='feed'?'feed':ev.type==='story'?'stories':'ped';const go=document.createElement('div');go.className='cal-panel-goto';go.innerHTML='→ Vai a '+(ev.type==='feed'?'Feed':ev.type==='story'?'Stories':'UGC');go.onclick=e=>{e.stopPropagation();switchTab(tabDest);closeCalPanel();};info.appendChild(go);}if(ev.type==='ped'&&ev.ugcStato){const UGC_STATI={raccolto:{l:'Raccolto',c:'#888'},selezionato:{l:'Selezionato',c:'#1D6FA8'},adattato:{l:'Adattato',c:'#d4a800'},approvato:{l:'Approvato',c:'#1a7a4a'}};const sc=UGC_STATI[ev.ugcStato]||UGC_STATI.raccolto;const sb=document.createElement('div');sb.style.cssText=`display:inline-flex;align-items:center;gap:4px;font-size:9px;font-weight:600;color:${sc.c};margin-top:3px;`;sb.innerHTML=`<span style="width:6px;height:6px;border-radius:50%;background:${sc.c};flex-shrink:0;"></span>${sc.l}`;info.appendChild(sb);}row.appendChild(thumb);row.appendChild(info);if(ev.type==='feed'&&ev.item)row.onclick=()=>{openLb(0,[ev.item]);};sec.appendChild(row);});body.appendChild(sec);};
  renderSection(feeds_,'Post feed','feed');renderSection(stories_,'Stories','story');renderSection(hl_,'In evidenza','highlight');renderSection(pedAuto_,'UGC Autonoma','feed');renderSection(pedTmpl_,'UGC Template','story');
  panel.classList.add('open');
}
function closeCalPanel(){
  const p=document.getElementById('cal-day-panel');
  if(p) p.classList.remove('open');
  const ov=document.getElementById('cal-panel-overlay');
  if(ov) ov.classList.remove('open');
}

// Close cal panel when clicking outside
document.addEventListener('click',e=>{
  const panel=document.getElementById('cal-day-panel');
  if(panel&&panel.classList.contains('open')&&!panel.contains(e.target)&&!e.target.closest('.cal-day')&&!e.target.closest('.cal-week-event')){
    closeCalPanel();
  }
});

/* ════════ PED STORIES ════════ */
/* ════════ UGC / PED — REDESIGN ════════ */
const UGC_STATI = {
  raccolto:   {label:'Raccolto',   dot:'#d4a800', bg:'rgba(212,168,0,0.12)',   text:'#7a5c00',  border:'rgba(212,168,0,0.3)'},
  selezionato:{label:'Selezionato',dot:'#1D9E75', bg:'rgba(29,158,117,0.12)', text:'#085041',  border:'rgba(29,158,117,0.3)'},
  autonoma:   {label:'Autonoma',   dot:'#7F77DD', bg:'rgba(127,119,221,0.10)',text:'#26215C',  border:'rgba(127,119,221,0.3)'},
};

let pedCurrentTab = 'calendario';
let pedCalYear = null;
let pedCalMonthIdx = null;
let pedDrawerSlotId = null;
let pedDrawerIsNew = false;
let pedDrawerDate = null;
let pedDrawerTmp = {};

/* ── Tab switcher ── */
function pedSwitchTab(tab){
  pedCurrentTab = tab;
  ['calendario','piano','anno'].forEach(t=>{
    const btn=document.getElementById('ped-tab-'+t);
    const panel=document.getElementById('ped-panel-'+t);
    if(btn)btn.classList.toggle('active',t===tab);
    if(panel)panel.classList.toggle('active',t===tab);
  });
  if(tab==='calendario')renderPEDCalendario();
  else if(tab==='piano')renderPEDPiano();
  else if(tab==='anno')renderPEDAnno();
}

/* ── Helper mese/anno ── */
function pedGetMeseAnno(){
  if(pedCalMonthIdx!==null&&pedCalYear!==null)return{moIdx:pedCalMonthIdx,year:pedCalYear};
  if(currentMonth){
    const[moName,y]=currentMonth.split(' ');const moIdx=MONTHS.indexOf(moName);
    if(moIdx>=0)return{moIdx,year:parseInt(y)};
  }
  const n=new Date();return{moIdx:n.getMonth(),year:n.getFullYear()};
}
function pedSetMese(moIdx,year){pedCalMonthIdx=moIdx;pedCalYear=year;}

/* ── Navigazione mese ── */
function pedCalNav(dir){
  const{moIdx,year}=pedGetMeseAnno();
  let nm=moIdx+dir,ny=year;
  if(nm<0){nm=11;ny--;}else if(nm>11){nm=0;ny++;}
  pedSetMese(nm,ny);
  renderPEDCalendario();
}

/* ── renderPED principale ── */
function renderPED(){
  const hasClient=currentClientIdx>=0&&currentMonth;
  const cn=hasClient?clients[currentClientIdx].name:'—';
  const mn=currentMonth||'—';
  const titleEl=document.getElementById('ped-title');
  const metaEl=document.getElementById('ped-meta');
  const clientLbl=document.getElementById('ped-client-label');
  if(titleEl)titleEl.textContent=hasClient?cn+' — UGC':'UGC';
  if(clientLbl)clientLbl.textContent=hasClient?cn+' · '+mn:'— seleziona cliente nel Feed';
  const plan=currentPedPlan();
  if(metaEl)metaEl.textContent=plan.length?plan.length+' slot':'';
  if(pedCalMonthIdx===null&&currentMonth){
    const[moName,y]=currentMonth.split(' ');const mi=MONTHS.indexOf(moName);
    if(mi>=0){pedCalMonthIdx=mi;pedCalYear=parseInt(y);}
  }
  if(pedCurrentTab==='calendario')renderPEDCalendario();
  else if(pedCurrentTab==='piano')renderPEDPiano();
  else if(pedCurrentTab==='anno')renderPEDAnno();
}

/* ══ TAB CALENDARIO ══ */
function renderPEDCalendario(){
  const{moIdx,year}=pedGetMeseAnno();
  const lbl=document.getElementById('ped-cal-month-lbl');
  if(lbl)lbl.textContent=MONTHS[moIdx]+' '+year;
  renderFreqDays();
  const hasClient=currentClientIdx>=0;
  const emptyEl=document.getElementById('ped-empty');
  const calBody=document.getElementById('ped-cal-body');
  if(emptyEl)emptyEl.style.display=hasClient?'none':'flex';
  if(calBody)calBody.style.display=hasClient?'flex':'none';
  if(!hasClient)return;
  renderPEDCal();
}

function renderFreqDays(){
  const wrap=document.getElementById('ped-freq-days');if(!wrap)return;
  const labels=['L','M','M','G','V','S','D'];wrap.innerHTML='';
  labels.forEach((lbl,i)=>{
    const btn=document.createElement('button');
    btn.className='freq-day-btn'+(pedFreqDays.has(i)?' active':'');
    btn.textContent=lbl;
    btn.title=['Lunedì','Martedì','Mercoledì','Giovedì','Venerdì','Sabato','Domenica'][i];
    btn.onclick=()=>{if(pedFreqDays.has(i))pedFreqDays.delete(i);else pedFreqDays.add(i);renderFreqDays();};
    wrap.appendChild(btn);
  });
}

function renderPEDCal(){
  const headEl=document.getElementById('ped-cal-head');
  const gridEl=document.getElementById('ped-cal-grid');
  if(!headEl||!gridEl)return;
  headEl.innerHTML='';
  ['L','M','M','G','V','S','D'].forEach(g=>{
    const d=document.createElement('div');d.className='ped-cal-dh';d.textContent=g;headEl.appendChild(d);
  });
  gridEl.innerHTML='';
  const{moIdx,year}=pedGetMeseAnno();
  const firstDay=new Date(year,moIdx,1);let startDow=firstDay.getDay();startDow=startDow===0?6:startDow-1;
  const daysInMonth=new Date(year,moIdx+1,0).getDate();
  const daysInPrev=new Date(year,moIdx,0).getDate();
  const today=todayISO();
  const plan=currentPedPlan();
  const pedMap={};plan.forEach(s=>{if(!pedMap[s.date])pedMap[s.date]=[];pedMap[s.date].push(s);});
  const totalCells=Math.ceil((startDow+daysInMonth)/7)*7;
  let day=1,nextDay=1;
  for(let i=0;i<totalCells;i++){
    let cellY=year,cellM=moIdx+1,cellD,isOther=false;
    if(i<startDow){cellD=daysInPrev-startDow+i+1;cellM=moIdx===0?12:moIdx;cellY=moIdx===0?year-1:year;isOther=true;}
    else if(day>daysInMonth){cellD=nextDay++;cellM=moIdx+2>12?1:moIdx+2;cellY=moIdx+2>12?year+1:year;isOther=true;}
    else{cellD=day++;}
    const ds=isoDate(cellY,cellM,cellD);
    const isToday=ds===today;
    const slots=pedMap[ds]||[];
    const cell=document.createElement('div');
    cell.className='ped-cal-day'+(isOther?' other':'')+(isToday?' today':'')+(slots.length?' has-slots':'');
    if(!isOther){
      const num=document.createElement('div');num.className='ped-cal-day-num';num.textContent=cellD;cell.appendChild(num);
      const evs=document.createElement('div');evs.className='ped-cal-day-events';
      const MAX_PILLS=2;
      slots.slice(0,MAX_PILLS).forEach(sl=>{
        const cfg=UGC_STATI[sl.ugcStato]||UGC_STATI.autonoma;
        const pill=document.createElement('div');
        pill.className='ped-cal-pill';
        pill.style.cssText='background:'+cfg.bg+';color:'+cfg.text+';';
        pill.textContent=sl.brief||sl.type||'UGC';
        pill.onclick=(e)=>{e.stopPropagation();pedOpenDrawer(sl.id,ds);};
        evs.appendChild(pill);
      });
      if(slots.length>MAX_PILLS){
        const more=document.createElement('div');more.className='ped-cal-more';
        more.textContent='+'+(slots.length-MAX_PILLS)+' altri';evs.appendChild(more);
      }
      cell.appendChild(evs);
      const hint=document.createElement('div');hint.className='ped-cal-add-hint';
      hint.innerHTML='+ aggiungi';
      cell.appendChild(hint);
      cell.onclick=()=>pedOpenDrawerNew(ds);
    }
    gridEl.appendChild(cell);
  }
}

/* ── Drawer: slot esistente ── */
function pedOpenDrawer(slotId,dateStr){
  const plan=currentPedPlan();
  const sl=plan.find(s=>s.id===slotId);
  if(!sl)return;
  pedDrawerSlotId=slotId;pedDrawerIsNew=false;
  pedDrawerDate=dateStr||sl.date;
  pedDrawerTmp={...sl};
  pedRenderDrawer();
}

/* ── Drawer: nuovo slot ── */
function pedOpenDrawerNew(dateStr){
  pedDrawerSlotId=null;pedDrawerIsNew=true;pedDrawerDate=dateStr;
  pedDrawerTmp={date:dateStr,type:'autonoma',ugcStato:'autonoma',brief:'',templateRef:'',creator:'',noteRegia:'',id:pedUID()};
  pedRenderDrawer();
}

function pedRenderDrawer(){
  const drawer=document.getElementById('ped-drawer');
  const dateEl=document.getElementById('ped-drawer-date');
  const body=document.getElementById('ped-drawer-body');
  const delBtn=document.getElementById('ped-drawer-del');
  if(!drawer||!body)return;
  if(dateEl)dateEl.textContent=fmtDate(pedDrawerDate)||pedDrawerDate||'—';
  if(delBtn)delBtn.style.display=pedDrawerIsNew?'none':'';
  body.innerHTML='';
  const sl=pedDrawerTmp;
  const mk=(tag,cls,style)=>{const el=document.createElement(tag);if(cls)el.className=cls;if(style)el.style.cssText=style;return el;};
  const addLabel=(text)=>{const l=mk('div','ped-field-label');l.textContent=text;body.appendChild(l);};
  // Tipo chips
  addLabel('Tipo');
  const tipoWrap=mk('div','ped-tipo-chips');
  ['autonoma','template','video','foto','reel','stories'].forEach(tipo=>{
    const ch=mk('button','ped-tipo-chip'+(sl.type===tipo?' active':''));
    ch.textContent=tipo.charAt(0).toUpperCase()+tipo.slice(1);
    ch.onclick=()=>{pedDrawerTmp.type=tipo;pedRenderDrawer();};
    tipoWrap.appendChild(ch);
  });
  body.appendChild(tipoWrap);
  // Stato
  addLabel('Stato');
  const statoWrap=mk('div','ped-stato-pills');
  Object.entries(UGC_STATI).forEach(([key,cfg])=>{
    const p=mk('button','ped-stato-pill'+(sl.ugcStato===key?' active':''));
    p.style.cssText='background:'+cfg.bg+';color:'+cfg.text+';border:1px solid '+cfg.border+';';
    p.textContent=cfg.label;
    p.onclick=()=>{pedDrawerTmp.ugcStato=key;pedRenderDrawer();};
    statoWrap.appendChild(p);
  });
  body.appendChild(statoWrap);
  // Brief
  addLabel('Brief cliente');
  const briefTA=mk('textarea','ped-field-ta');briefTA.rows=3;briefTA.placeholder='Brief per il creator…';briefTA.value=sl.brief||'';
  briefTA.oninput=e=>{pedDrawerTmp.brief=e.target.value;};body.appendChild(briefTA);
  // Creator
  addLabel('Creator');
  const creatorInp=mk('input','ped-field-inp');creatorInp.type='text';creatorInp.placeholder='Nome creator…';creatorInp.value=sl.creator||'';
  creatorInp.oninput=e=>{pedDrawerTmp.creator=e.target.value;};body.appendChild(creatorInp);
  // Note regia collassabile
  const noteToggle=mk('button','ped-collapse-toggle');
  const noteArrow=mk('span','ped-collapse-arrow'+(sl._noteOpen?' open':''));noteArrow.textContent='›';
  noteToggle.appendChild(noteArrow);const noteLbl=mk('span');noteLbl.textContent=' Note regia';noteToggle.appendChild(noteLbl);
  const noteBody=mk('div','ped-collapse-body '+(sl._noteOpen?'open':'closed'));
  const noteTA=mk('textarea','ped-field-ta','margin-top:6px;');noteTA.rows=3;noteTA.placeholder='Istruzioni per il creator…';noteTA.value=sl.noteRegia||'';
  noteTA.oninput=e=>{pedDrawerTmp.noteRegia=e.target.value;};
  noteBody.appendChild(noteTA);
  noteToggle.onclick=()=>{pedDrawerTmp._noteOpen=!pedDrawerTmp._noteOpen;pedRenderDrawer();};
  body.appendChild(noteToggle);body.appendChild(noteBody);
  // Template
  const tmplToggle=mk('button','ped-collapse-toggle');
  const tmplArrow=mk('span','ped-collapse-arrow'+(sl._tmplOpen?' open':''));tmplArrow.textContent='›';
  tmplToggle.appendChild(tmplArrow);const tmplLbl=mk('span');tmplLbl.textContent=' Link template';tmplToggle.appendChild(tmplLbl);
  const tmplBody=mk('div','ped-collapse-body '+(sl._tmplOpen?'open':'closed'));
  const tmplInp=mk('input','ped-field-inp','margin-top:6px;');tmplInp.type='text';tmplInp.placeholder='Canva, Adobe Express…';tmplInp.value=sl.templateRef||'';
  tmplInp.oninput=e=>{pedDrawerTmp.templateRef=e.target.value;};
  tmplBody.appendChild(tmplInp);
  tmplToggle.onclick=()=>{pedDrawerTmp._tmplOpen=!pedDrawerTmp._tmplOpen;pedRenderDrawer();};
  body.appendChild(tmplToggle);body.appendChild(tmplBody);
  drawer.style.display='flex';
}

function pedCloseDrawer(){
  const drawer=document.getElementById('ped-drawer');
  if(drawer)drawer.style.display='none';
  pedDrawerSlotId=null;pedDrawerIsNew=false;pedDrawerTmp={};
}

function pedDrawerSave(){
  const plan=currentPedPlan();
  const sl={...pedDrawerTmp};
  delete sl._noteOpen;delete sl._tmplOpen;
  if(pedDrawerIsNew){
    plan.push(sl);plan.sort((a,b)=>a.date.localeCompare(b.date));
    setCurrentPedPlan(plan);
  } else {
    const idx=plan.findIndex(s=>s.id===sl.id);
    if(idx>=0)plan[idx]=sl;setCurrentPedPlan(plan);
  }
  autoSave();renderPEDCal();renderCalendar();
  showToast('✓ Slot UGC salvato');pedCloseDrawer();
}

function pedDrawerDelete(){
  if(!pedDrawerSlotId)return;
  showConfirm({
    title:'Elimina slot UGC',body:'Lo slot verrà eliminato definitivamente.',okLabel:'Elimina',type:'danger',
    onOk:()=>{
      const plan=currentPedPlan().filter(s=>s.id!==pedDrawerSlotId);
      setCurrentPedPlan(plan);autoSave();renderPEDCal();renderCalendar();
      showToast('✓ Slot eliminato');pedCloseDrawer();
    }
  });
}

/* ── Genera piano / Svuota ── */
function pedGenerate(){
  if(currentClientIdx<0||!currentMonth)return;
  if(pedFreqDays.size===0){showToast('Seleziona almeno un giorno','warn');return;}
  const{moIdx,year}=pedGetMeseAnno();
  const daysInMonth=new Date(year,moIdx+1,0).getDate();
  const existing=currentPedPlan();const existingDates=new Set(existing.map(s=>s.date));const newPlan=[...existing];
  for(let d=1;d<=daysInMonth;d++){
    const dt=new Date(year,moIdx,d);let dow=dt.getDay();dow=dow===0?6:dow-1;
    const iso=isoDate(year,moIdx+1,d);
    if(pedFreqDays.has(dow)&&!existingDates.has(iso)){
      newPlan.push({date:iso,type:'autonoma',ugcStato:'autonoma',brief:'',templateRef:'',creator:'',noteRegia:'',id:pedUID()});
    }
  }
  newPlan.sort((a,b)=>a.date.localeCompare(b.date));setCurrentPedPlan(newPlan);
  autoSave();renderPEDCal();renderCalendar();
  showToast('✓ Piano UGC generato — '+newPlan.filter(s=>!existingDates.has(s.date)).length+' nuove date');
}
function pedClear(){
  showConfirm({
    title:'Svuota piano UGC',
    body:'Tutti gli slot autonoma senza contenuto verranno rimossi.',
    okLabel:'Svuota',type:'warn',
    onOk:()=>{
      // Mantieni solo slot con contenuto reale o stato modificato dall'utente
      const keep=currentPedPlan().filter(s=>(s.brief&&s.brief.trim())||(s.creator&&s.creator.trim())||(s.noteRegia&&s.noteRegia.trim())||(s.ugcStato&&s.ugcStato!=='autonoma'));
      setCurrentPedPlan(keep);autoSave();renderPEDCal();renderCalendar();
      showToast('Piano UGC svuotato');
    }
  });
}

/* ══ TAB PIANO ══ */
function renderPEDPiano(){
  const wrap=document.getElementById('ped-piano-list');if(!wrap)return;wrap.innerHTML='';
  const plan=currentPedPlan();
  if(!plan.length){
    const em=document.createElement('div');em.className='ped-piano-empty';
    em.textContent='Nessuno slot pianificato. Vai al Calendario per aggiungerne.';
    wrap.appendChild(em);return;
  }
  plan.forEach((sl,i)=>{
    const cfg=UGC_STATI[sl.ugcStato]||UGC_STATI.autonoma;
    const item=document.createElement('div');item.className='ped-piano-item';
    const row1=document.createElement('div');row1.className='ped-piano-row1';
    const dateEl=document.createElement('div');dateEl.className='ped-piano-date';dateEl.textContent=fmtDate(sl.date)||sl.date;
    const statoPill=document.createElement('span');
    statoPill.className='ped-stato-pill active';
    statoPill.style.cssText='background:'+cfg.bg+';color:'+cfg.text+';border:1px solid '+cfg.border+';';
    statoPill.textContent=cfg.label;
    statoPill.onclick=e=>{e.stopPropagation();
      const keys=Object.keys(UGC_STATI);const cur=keys.indexOf(sl.ugcStato||'autonoma');
      plan[i].ugcStato=keys[(cur+1)%keys.length];setCurrentPedPlan(plan);autoSave();renderPEDPiano();
    };
    const titleEl=document.createElement('div');titleEl.className='ped-piano-title';
    titleEl.textContent=sl.brief||(sl.type==='autonoma'?'Autonoma':'Template');
    const tipoBadge=document.createElement('span');tipoBadge.className='ped-piano-tipo';tipoBadge.textContent=sl.type||'—';
    row1.appendChild(dateEl);row1.appendChild(statoPill);row1.appendChild(titleEl);row1.appendChild(tipoBadge);
    item.appendChild(row1);
    if(sl.creator){const cr=document.createElement('div');cr.className='ped-piano-creator';cr.textContent='Creator: '+sl.creator;item.appendChild(cr);}
    item.onclick=()=>{pedSwitchTab('calendario');setTimeout(()=>pedOpenDrawer(sl.id,sl.date),50);};
    wrap.appendChild(item);
  });
  const addBtn=document.createElement('div');addBtn.className='ped-piano-add-row';
  const btn=document.createElement('button');btn.className='btn sm';btn.textContent='+ Aggiungi slot';
  btn.onclick=()=>pedSwitchTab('calendario');addBtn.appendChild(btn);wrap.appendChild(addBtn);
}

/* ══ TAB ANNO ══ */
function renderPEDAnno(){
  const wrap=document.getElementById('ped-anno-grid');if(!wrap)return;wrap.innerHTML='';
  if(currentClientIdx<0){
    wrap.innerHTML='<div style="grid-column:1/-1;text-align:center;padding:40px;color:var(--text-3);font-size:12px;">Seleziona un cliente nel Feed.</div>';return;
  }
  const cl=clients[currentClientIdx];
  const now=new Date();const curMo=now.getMonth();const curYear=now.getFullYear();
  const annoYear=pedCalYear||curYear;
  MONTHS.forEach((moName,mi)=>{
    const key=pedKey(cl.name,moName+' '+annoYear);
    const slots=pedPlans[key]||[];
    const totale=slots.length;
    const counts={selezionato:0,raccolto:0,autonoma:0};
    slots.forEach(s=>{const k=s.ugcStato||'autonoma';if(counts[k]!==undefined)counts[k]++;});
    const maxSlots=20;const pct=Math.min(100,Math.round(totale/maxSlots*100));
    const isCurrent=mi===curMo&&annoYear===curYear;
    const isFuture=annoYear>curYear||(annoYear===curYear&&mi>curMo);
    const cell=document.createElement('div');
    cell.className='ped-anno-mese'+(isCurrent?' corrente':'')+(isFuture&&!totale?' futuro-vuoto':'');
    const lbl=document.createElement('div');lbl.className='ped-anno-m-label';lbl.textContent=moName.slice(0,3).toUpperCase();
    const barWrap=document.createElement('div');barWrap.className='ped-anno-bar-wrap';
    const bar=document.createElement('div');bar.className='ped-anno-bar';
    const barColor=isFuture&&!totale?'var(--border)':isCurrent?'#d4a800':'#1D9E75';
    bar.style.cssText='width:'+pct+'%;background:'+barColor+';';
    barWrap.appendChild(bar);
    const pills=document.createElement('div');pills.className='ped-anno-pills';
    if(counts.selezionato>0){const p=document.createElement('span');p.className='ped-anno-pill sel';p.textContent=counts.selezionato+' sel.';pills.appendChild(p);}
    if(counts.raccolto>0){const p=document.createElement('span');p.className='ped-anno-pill racc';p.textContent=counts.raccolto+' racc.';pills.appendChild(p);}
    if(counts.autonoma>0){const p=document.createElement('span');p.className='ped-anno-pill aut';p.textContent=counts.autonoma+' aut.';pills.appendChild(p);}
    const nEl=document.createElement('div');nEl.className='ped-anno-n';nEl.textContent=totale>0?totale+' UGC':'—';
    cell.appendChild(lbl);cell.appendChild(barWrap);cell.appendChild(pills);cell.appendChild(nEl);
    cell.onclick=()=>{pedSetMese(mi,annoYear);pedSwitchTab('calendario');};
    wrap.appendChild(cell);
  });
}

/* ── Compat stub ── */
function renderPEDCards(){}


/* PIANO TESTO */
function renderNotesMonthPills(){
  const container=document.getElementById('notes-month-pills');
  if(!container)return;
  container.innerHTML='';
  if(notesClientIdx<0)return;
  let pillYear=CUR_YEAR;
  if(notesMonth){const y=parseInt(notesMonth.split(' ').pop());if(!isNaN(y))pillYear=y;}
  // Year nav
  const ynav=document.createElement('div');ynav.className='year-nav';
  const prev=document.createElement('button');prev.className='year-nav-btn';prev.textContent='‹';
  prev.onclick=()=>{pillYear--;renderNotesMonthPillsForYear(pillYear);};
  const lbl=document.createElement('span');lbl.className='year-label';lbl.textContent=pillYear;
  const next=document.createElement('button');next.className='year-nav-btn';next.textContent='›';
  next.onclick=()=>{pillYear++;renderNotesMonthPillsForYear(pillYear);};
  ynav.appendChild(prev);ynav.appendChild(lbl);ynav.appendChild(next);
  container.appendChild(ynav);
  // Month pills
  const pillsWrap=document.createElement('div');pillsWrap.className='month-pills';
  monthsForYear(pillYear).forEach(m=>{
    const p=document.createElement('button');
    p.className='month-pill'+(m===notesMonth?' active':'');
    p.textContent=m.slice(0,3);
    p.onclick=()=>{
      notesMonth=m;
      const sel=document.getElementById('notes-month-sel');
      if(sel)sel.value=m;
      renderNotesMonthPills();
      renderNotesEditor();
    };
    pillsWrap.appendChild(p);
  });
  container.appendChild(pillsWrap);
}

function renderNotesMonthPillsForYear(yr){
  CUR_YEAR=yr;MONTH_OPTIONS=monthsForYear(yr);
  renderNotesMonthPills();
}

function rebuildNotesSelects(){
  // Sync notesClientIdx from globalClientIdx if not set
  if(notesClientIdx<0&&globalClientIdx>=0)notesClientIdx=globalClientIdx;
  // Hidden select for JS compat only
  const csel=document.getElementById('notes-client-sel');
  if(csel){csel.innerHTML='<option value="">—</option>';clients.forEach((cl,i)=>{const o=document.createElement('option');o.value=i;o.textContent=cl.name;csel.appendChild(o);});if(notesClientIdx>=0)csel.value=notesClientIdx;}
  const msel=document.getElementById('notes-month-sel');if(!msel)return;if(notesClientIdx<0){msel.style.display='none';renderNotesMonthPills();return;}
  msel.style.display='';const prevM=msel.value;msel.innerHTML='';
  // Build month list from actual notesData keys + current MONTH_OPTIONS
  const cl=clients[notesClientIdx];
  const notesMonths=cl?Object.keys(notesData).filter(k=>k.startsWith(cl.name+'|||')&&notesData[k]).map(k=>k.split('|||')[1]):[];
  const allMonths=[...new Set([...notesMonths,...MONTH_OPTIONS])].sort((a,b)=>{const pa=a.split(' '),pb=b.split(' ');const ya=parseInt(pa[1])||0,yb=parseInt(pb[1])||0;if(ya!==yb)return ya-yb;return MONTHS.indexOf(pa[0])-MONTHS.indexOf(pb[0]);});
  allMonths.forEach(m=>{const o=document.createElement('option');o.value=m;o.textContent=m;msel.appendChild(o);});
  if(prevM&&allMonths.includes(prevM))msel.value=prevM;else if(notesMonth&&allMonths.includes(notesMonth))msel.value=notesMonth;else{msel.value=MONTH_OPTIONS[new Date().getMonth()];notesMonth=msel.value;}
  // Aggiorna le pill mese visive
  renderNotesMonthPills();
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

function openDatePicker(idx,anchorEl){
  closeDatePicker();dpOpenIdx=idx;
  const item=currentFeedItems()[idx];
  const fm=feedMonth?feedMonth.split(' '):null;
  if(fm){dpMonth=MONTHS.indexOf(fm[0]);dpYear=parseInt(fm[1]);if(dpMonth<0){dpMonth=new Date().getMonth();dpYear=new Date().getFullYear();}}
  else{dpMonth=new Date().getMonth();dpYear=new Date().getFullYear();}
  if(item.date){const parsed=parseItalianDate(item.date);if(parsed){dpMonth=parsed.getMonth();dpYear=parsed.getFullYear();}}
  // Overlay mobile — crea se non esiste (indipendente dal popup)
  if(!document.getElementById('dp-mobile-overlay')){
    const ov=document.createElement('div');
    ov.id='dp-mobile-overlay';
    ov.style.cssText='display:none;position:fixed;inset:0;z-index:9998;background:rgba(0,0,0,.35);touch-action:none;';
    ov.onclick=()=>closeDatePicker();
    document.body.appendChild(ov);
  }
  let popup=document.getElementById('global-date-picker');
  if(!popup){
    popup=document.createElement('div');
    popup.id='global-date-picker';
    popup.className='date-picker-popup';
    document.body.appendChild(popup);
  }
  const isMobile = window.innerWidth <= 744;
  renderDatePickerContent(idx,popup);

  // Overlay — cerca sempre, non solo alla prima creazione
  const overlay = document.getElementById('dp-mobile-overlay');

  if(isMobile){
    // BOTTOM SHEET — resetta posizione, poi anima con rAF
    popup.classList.add('mobile-sheet');
    popup.classList.remove('open');
    popup.style.top=''; popup.style.left=''; popup.style.width='';
    if(overlay) overlay.style.display='block';
    // Forza un reflow poi aggiungi .open per triggerare la transizione
    popup.style.display='flex';
    popup.offsetHeight; // reflow
    requestAnimationFrame(()=>{
      popup.classList.add('open');
    });
  } else {
    // POPUP normale su desktop/tablet
    popup.classList.remove('mobile-sheet');
    if(overlay) overlay.style.display='none';
    const rect=anchorEl.getBoundingClientRect();
    popup.style.width=Math.max(rect.width,240)+'px';
    const vw=window.innerWidth; const vh=window.innerHeight;
    const popH=popup.offsetHeight||300; const popW=popup.offsetWidth||240;
    const topAbove=rect.top-popH-6;
    const topBelow=rect.bottom+6;
    popup.style.top=(topAbove>8 ? topAbove : Math.min(topBelow, vh-popH-8))+'px';
    popup.style.left=Math.max(8, Math.min(rect.left, vw-popW-8))+'px';
    popup.classList.add('open');
  }
}
function closeDatePicker(){
  const p=document.getElementById('global-date-picker');
  if(p){ p.classList.remove('open'); dpOpenIdx=null; }
  const ov=document.getElementById('dp-mobile-overlay');
  if(ov) ov.style.display='none';
}
function renderDatePickerContent(idx,popup){
  popup.innerHTML='';
  // Header mobile: titolo + chiudi
  if(popup.classList.contains('mobile-sheet')){
    const mhdr=document.createElement('div');
    mhdr.style.cssText='display:flex;align-items:center;justify-content:space-between;padding:0 16px 8px;';
    mhdr.innerHTML='<span style="font-size:13px;font-weight:600;color:var(--text);">Seleziona data</span>'
      +'<button onclick="closeDatePicker()" style="background:none;border:none;font-size:20px;color:var(--text-2);cursor:pointer;padding:4px 8px;min-width:36px;min-height:36px;">✕</button>';
    popup.appendChild(mhdr);
  }
  const hdr=document.createElement('div');hdr.className='dp-header';
  const prev=document.createElement('button');prev.className='dp-nav';prev.textContent='‹';prev.onclick=e=>{e.stopPropagation();dpMonth--;if(dpMonth<0){dpMonth=11;dpYear--;}renderDatePickerContent(idx,popup);};
  const lbl=document.createElement('div');lbl.className='dp-header-label';lbl.textContent=MONTHS[dpMonth]+' '+dpYear;
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
    // ── Foto profilo + bio (riga espansa) ──
    const extra=document.createElement('div');extra.className='ec-acc-extra';
    // Foto profilo
    const avatarWrap=document.createElement('div');avatarWrap.className='ec-acc-avatar-wrap';
    const avatarImg=document.createElement('div');avatarImg.className='ec-acc-avatar';
    avatarImg.style.cssText='width:44px;height:44px;border-radius:50%;overflow:hidden;background:var(--cell-bg);cursor:pointer;flex-shrink:0;border:2px solid var(--border);display:flex;align-items:center;justify-content:center;';
    if(acc.profileImg){
      avatarImg.innerHTML=`<img src="${acc.profileImg}" style="width:100%;height:100%;object-fit:cover;" alt="Foto profilo"/>`;
    } else {
      avatarImg.innerHTML='<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="var(--text-3)" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>';
    }
    const avatarInp=document.createElement('input');avatarInp.type='file';avatarInp.accept='image/*';avatarInp.style.display='none';
    avatarInp.onchange=async e=>{
      const file=e.target.files[0]; if(!file) return;
      showToast('⟳ Caricamento foto profilo…');
      const destPath='/nassa/'+CLOUD.user+'/profiles/'+file.name;
      const url=await DROPBOX.upload(file,destPath);
      if(url){
        ecTmpAccounts[i].profileImg=url;
        avatarImg.innerHTML=`<img src="${url}" style="width:100%;height:100%;object-fit:cover;" alt="Foto profilo"/>`;
        showToast('✓ Foto profilo aggiornata');
      } else {
        // fallback blob
        const blobUrl=URL.createObjectURL(file);
        ecTmpAccounts[i].profileImg=blobUrl;
        avatarImg.innerHTML=`<img src="${blobUrl}" style="width:100%;height:100%;object-fit:cover;" alt="Foto profilo"/>`;
      }
    };
    avatarImg.onclick=()=>avatarInp.click();
    avatarImg.title='Clicca per cambiare foto profilo';
    avatarWrap.appendChild(avatarImg);avatarWrap.appendChild(avatarInp);
    // Bio
    const bioWrap=document.createElement('div');bioWrap.style.cssText='flex:1;';
    const bioLbl=document.createElement('div');bioLbl.style.cssText='font-size:10px;color:var(--text-3);margin-bottom:3px;font-family:var(--font);font-weight:600;letter-spacing:.04em;text-transform:uppercase;';bioLbl.textContent='Bio';
    const bioInp=document.createElement('textarea');bioInp.className='ec-acc-bio';bioInp.rows=2;bioInp.placeholder='Scrivi la bio del profilo…';bioInp.value=acc.bio||'';
    bioInp.oninput=e=>{ecTmpAccounts[i].bio=e.target.value;};
    bioWrap.appendChild(bioLbl);bioWrap.appendChild(bioInp);
    extra.appendChild(avatarWrap);extra.appendChild(bioWrap);
    const del=document.createElement('button');del.className='ec-acc-del';del.innerHTML='<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/></svg>';del.title='Rimuovi account';
    // Inserisci extra (foto+bio) prima del bottone delete
    row.appendChild(main);row.appendChild(extra);row.appendChild(del);
    del.onclick=()=>{showConfirm({
    title:'Rimuovi account',
    body:`Rimuovere l'account <strong>${esc(acc.name)}</strong>? I dati feed e stories associati saranno eliminati.`,
    okLabel:'Rimuovi',
    type:'danger',
    onOk:()=>{ecTmpAccounts.splice(i,1);renderEcAccounts();}
  });};
    list.appendChild(row);
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
function ecDeleteClient(){
  if(ecEditIdx<0)return;
  const cl=clients[ecEditIdx];
  showConfirm({
    title:'Elimina cliente',
    body:`Eliminare <strong>${esc(cl.name)}</strong> e tutti i suoi dati? Questa azione è irreversibile.`,
    okLabel:'Elimina definitivamente',
    type:'danger',
    onOk:()=>{closeModal('edit-client-modal');removeClient(ecEditIdx);}
  });
}

/* EXPORT / IMPORT */
function exportProject(){
  function san(arr){return(arr||[]).map(item=>({type:item.type,name:item.name||'',date:item.date||'',showDate:item.showDate||false,copy:item.copy||'',linkedStories:item.linkedStories||[],isStoryboard:item.isStoryboard||false,isExternalLink:item.isExternalLink||false,linkSource:item.linkSource||'',externalUrl:item.externalUrl||'',slides:(item.slides||[]).map(s=>({title:s.title||'',note:s.note||'',name:s.name||'',externalUrl:s.externalUrl||''}))}));}
  function sanSt(arr){return(arr||[]).map(st=>({type:st.type,name:st.name||'',date:st.date||'',note:st.note||'',isStoryboard:st.isStoryboard||false,isExternalLink:st.isExternalLink||false,linkSource:st.linkSource||'',externalUrl:st.externalUrl||'',briefInviato:st.briefInviato||false,fileCaricato:st.fileCaricato||false,slides:(st.slides||[]).map(s=>({title:s.title||'',eye:s.eye||'',num:s.num||'',note:s.note||'',noteRegia:s.noteRegia||'',sfondo:s.sfondo||'',name:s.name||'',externalUrl:s.externalUrl||'',url:(s.externalUrl&&s.externalUrl.startsWith('http'))?s.externalUrl:(s.url&&!s.url.startsWith('blob:'))?s.url:''}))}));}
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
      // FIX QA: ripristina campagne Ads (aggiunto dopo il codice di import originale)
      adsCampaigns=data.adsCampaigns||{};
      adsCampaigns=migrateAdsCampaignsKeys(adsCampaigns,clients);
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
  if(subt)subt.classList.toggle('visible',!!cl&&currentTab!=='studio');if(nameEl)nameEl.textContent=cl?cl.name:'—';if(pkgEl)pkgEl.innerHTML=cl?pkgBadge(cl.pkg):'';
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
  // Chiudi il pannello filtri se aperto
  const ctxPanel=document.getElementById('feed-ctx-panel');
  if(ctxPanel&&ctxPanel.classList.contains('open')){
    ctxPanel.classList.remove('open');
    const icon=document.getElementById('feed-expand-icon');
    if(icon)icon.innerHTML='<polyline points="6 9 12 15 18 9"/>';
  }
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
  document.querySelectorAll('.ed-theme-btn').forEach(b=>b.classList.toggle('active',b.dataset.theme==='light'));
  document.querySelectorAll('.ed-fmt-btn').forEach(b=>b.classList.toggle('active',b.dataset.fmt==='feed'));
  // Badge con iniziali cliente
  const badge=document.getElementById('ed-prev-badge');
  if(badge){
    const cl2=clients[globalClientIdx>=0?globalClientIdx:0];
    const initials=cl2?cl2.name.split(' ').map(w=>w[0]).join('').slice(0,2).toUpperCase():'N';
    badge.textContent=initials;
  }
  openModal('editorial-modal');
  // Render DOPO che il modal è visibile nel DOM
  setTimeout(()=>renderEdPreview(), 30);
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
    delBtn.onclick=()=>{showConfirm({
    title:'Elimina pilastro',
    body:`Eliminare il pilastro <strong>${esc(p.name)}</strong>? I post associati non saranno eliminati.`,
    okLabel:'Elimina',
    type:'danger',
    onOk:()=>{pils.splice(pi,1);pilastri[cl.name]=pils;autoSave();renderPilastriContent(body,ci);}
  });};
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
        else{th.style.background='#ddd';th.innerHTML=`<span style="font-size:10px;">${it.type==='video'?'':'🖼'}</span>`;}
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



/* ══ ADS GANTT ══ */
const ADS_PLAT_COLORS={instagram:'#378ADD',facebook:'#7F77DD',meta:'#7F77DD',linkedin:'#1D9E75',google:'#BA7517'};

function adsGanttPrevMonth(){
  adsGanttMonth--;
  if(adsGanttMonth<0){adsGanttMonth=11;adsGanttYear--;}
  renderAdsMonthPills();renderAdsGantt();
}
function adsGanttNextMonth(){
  adsGanttMonth++;
  if(adsGanttMonth>11){adsGanttMonth=0;adsGanttYear++;}
  renderAdsMonthPills();renderAdsGantt();
}

function renderAdsMonthPills(){
  const c=document.getElementById('ads-month-pills');
  if(!c)return;
  c.innerHTML='';

  // Year nav
  const ynav=document.createElement('div');
  ynav.className='year-nav';
  ynav.style.marginBottom='0';
  const prev=document.createElement('button');
  prev.className='year-nav-btn';prev.textContent='‹';
  prev.onclick=()=>{adsGanttYear--;renderAdsMonthPills();renderAdsGantt();};
  const lbl=document.createElement('span');
  lbl.className='year-label';lbl.textContent=adsGanttYear;
  const next=document.createElement('button');
  next.className='year-nav-btn';next.textContent='›';
  next.onclick=()=>{adsGanttYear++;renderAdsMonthPills();renderAdsGantt();};
  ynav.appendChild(prev);ynav.appendChild(lbl);ynav.appendChild(next);
  c.appendChild(ynav);

  // Month pills
  const pillsWrap=document.createElement('div');
  pillsWrap.style.cssText='display:flex;gap:3px;overflow-x:auto;flex-wrap:nowrap;';
  const mShort=['Gen','Feb','Mar','Apr','Mag','Giu','Lug','Ago','Set','Ott','Nov','Dic'];
  mShort.forEach((m,i)=>{
    const p=document.createElement('button');
    p.className='month-pill'+(i===adsGanttMonth?' active':'');
    p.textContent=m;
    p.onclick=()=>{adsGanttMonth=i;renderAdsMonthPills();renderAdsGantt();};
    pillsWrap.appendChild(p);
  });
  c.appendChild(pillsWrap);
}

function adsAutoSpends(camp, days){
  // Distribute spent evenly across campaign days, 3-5 milestones
  const start=Math.max(1,camp.startDay||1);
  const end=Math.min(days,camp.endDay||days);
  const dur=end-start+1;
  if(!camp.spent||dur<=0)return[];
  const pts=Math.min(5,Math.max(2,Math.floor(dur/5)));
  const step=Math.floor(dur/(pts+1));
  const amtEach=Math.round(camp.spent/pts);
  return Array.from({length:pts},(_,i)=>({
    day:start+step*(i+1),
    amt:i===pts-1?camp.spent-(amtEach*(pts-1)):amtEach
  })).filter(s=>s.day>=1&&s.day<=days);
}

function renderAdsGantt(){
  const el=id=>document.getElementById(id);
  const ganttEl=el('ads-gantt');
  if(!ganttEl)return;

  const days=new Date(adsGanttYear,adsGanttMonth+1,0).getDate();
  const today=new Date();
  const isNow=today.getFullYear()===adsGanttYear&&today.getMonth()===adsGanttMonth;
  const todayDay=isNow?today.getDate():-1;


  const camps=currentAdsCampaigns().filter(c=>c.startDay&&c.endDay);
  const LABEL_W=130;

  ganttEl.innerHTML='';

  if(!camps.length){
    ganttEl.innerHTML='<div class="ads-gantt-empty">Nessuna campagna con date impostate. Modifica una campagna e aggiungi giorno di inizio e fine.</div>';
    return;
  }

  // Header
  const hdr=document.createElement('div');
  hdr.className='ads-gantt-hdr';
  hdr.style.gridTemplateColumns=`${LABEL_W}px 1fr`;
  const hdrLbl=document.createElement('div');
  hdrLbl.className='ads-gantt-hdr-lbl';
  hdrLbl.textContent='Campagna';
  hdr.appendChild(hdrLbl);

  const dayWrap=document.createElement('div');
  dayWrap.className='ads-gantt-days';
  // Show every 5th day
  for(let d=1;d<=days;d++){
    const dl=document.createElement('div');
    dl.className='ads-gantt-day'+(d===todayDay?' today':'');
    dl.textContent=(d===1||d%5===0||d===days)?d:'';
    dayWrap.appendChild(dl);
  }
  hdr.appendChild(dayWrap);
  ganttEl.appendChild(hdr);

  // Rows
  camps.forEach(camp=>{
    const row=document.createElement('div');
    row.className='ads-gantt-row';
    row.style.gridTemplateColumns=`${LABEL_W}px 1fr`;

    // Label
    const lbl=document.createElement('div');
    lbl.className='ads-gantt-lbl';
    // FIX QA: esc() su camp.name e camp.status — previene XSS da nomi campagna
    lbl.innerHTML=`<div class="ads-gantt-lbl-name">${esc(camp.name)}</div>
      <div class="ads-gantt-lbl-sub">${esc({active:'Attiva',paused:'In pausa',draft:'Bozza',ended:'Terminata'}[camp.status]||camp.status)}</div>`;
    row.appendChild(lbl);

    // Timeline
    const tl=document.createElement('div');
    tl.className='ads-gantt-tl';

    // Today line
    if(todayDay>0){
      const tline=document.createElement('div');
      tline.className='ads-gantt-today';
      tline.style.left=((todayDay-0.5)/days*100)+'%';
      tl.appendChild(tline);
    }

    // Bar
    const s=Math.max(1,camp.startDay), e=Math.min(days,camp.endDay);
    if(s<=days&&e>=1){
      const left=((s-1)/days*100).toFixed(2)+'%';
      const width=((e-s+1)/days*100).toFixed(2)+'%';
      const color=ADS_PLAT_COLORS[camp.platform]||'#888';
      const bar=document.createElement('div');
      bar.className='ads-gantt-bar'+(camp.status!=='active'?' '+camp.status:'');
      bar.style.cssText=`left:${left};width:${width};background:${color};`;
      // Label: spent/budget
      const pct=camp.budget>0?Math.round((camp.spent||0)/camp.budget*100):0;
      bar.textContent=`€${(camp.spent||0).toLocaleString('it')} (${pct}%)`;
      bar.title=`${camp.name} — ${s}→${e} ${MONTHS[adsGanttMonth]}
Budget: €${camp.budget} | Speso: €${camp.spent||0} | ROAS: ${camp.roas||'—'}×`;
      tl.appendChild(bar);
    }

    // Auto spend dots
    adsAutoSpends(camp, days).forEach(sp=>{
      const dot=document.createElement('div');
      dot.className='ads-gantt-spend-dot';
      dot.style.left=((sp.day-0.5)/days*100).toFixed(2)+'%';
      dot.title=`Spesa stimata giorno ${sp.day}: €${sp.amt}`;
      tl.appendChild(dot);
    });

    row.appendChild(tl);
    ganttEl.appendChild(row);
  });
}

/* ════ ADS TAB ════ */

/* ══ MIGRATION: adsCampaigns clientName → client.id ══
 * Converte le chiavi legacy (nome cliente) in client.id stabile.
 * Sicura da chiamare più volte — salta chiavi già nel formato corretto.
 */
function migrateAdsCampaignsKeys(adsData, clientList){
  if(!adsData||!clientList) return adsData||{};
  const result={};
  const clientIds=new Set(clientList.map(c=>c.id));
  
  Object.keys(adsData).forEach(key=>{
    if(clientIds.has(key)){
      // Chiave già in formato id — copia diretta
      result[key]=(result[key]||[]).concat(adsData[key]);
    } else {
      // Chiave legacy (nome) — cerca il client corrispondente
      const match=clientList.find(c=>c.name===key);
      if(match){
        // Migra alla chiave id
        result[match.id]=(result[match.id]||[]).concat(adsData[key]);
        console.log('[ADS] Migrated adsCampaigns key:',key,'→',match.id);
      } else {
        // Cliente non trovato — mantieni la chiave (potrebbe essere dato orfano)
        result[key]=adsData[key];
      }
    }
  });
  return result;
}

let adsCampaigns = {};
let adsGanttYear = new Date().getFullYear();
let annoYear = new Date().getFullYear();
let annoFilterTag = null;
let annoSelectedEv = null;
let annoExpanded = {};
let adsGanttMonth = new Date().getMonth(); // 0-indexed // key: clientName, value: [{id,name,platform,budget,spent,roas,roasTarget,cpc,impressions,status,creativeUrl,creativeType}]
let _adsCreativeFile = null; // temp file object for upload
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
  // FIX: usa client.id stabile — immune a rename del cliente
  if(globalClientIdx<0)return null;
  return clients[globalClientIdx]?.id||null;
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
  renderAdsMonthPills();
  renderAdsGantt();
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
    const thumb=camp.creativeUrl?`
      ${camp.creativeType==='video'
        ?`<video src="${camp.creativeUrl}" class="ads-creative-thumb-vid" muted playsinline preload="metadata"></video>`
        :`<img src="${camp.creativeUrl}" class="ads-creative-thumb" alt="creativo"/>`
      }` : '';
    return `<div class="ads-camp">
      ${thumb?`<div style="flex-shrink:0;">${thumb}<div class="ads-creative-badge">${camp.creativeType==='video'?'Reel':'Foto'}</div></div>`:''}
      <div style="flex:1;min-width:0;">
        <div class="ads-camp-name">${esc(camp.name)}</div>
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

function adsPreviewCreative(inp){
  const file=inp.files[0];if(!file)return;
  _adsCreativeFile=file;
  const url=URL.createObjectURL(file);
  const isVideo=file.type.startsWith('video');
  const ph=document.getElementById('adm-creative-placeholder');
  const prev=document.getElementById('adm-creative-preview');
  const img=document.getElementById('adm-creative-img');
  const vid=document.getElementById('adm-creative-vid');
  if(ph)ph.style.display='none';
  if(prev)prev.style.display='block';
  if(isVideo){
    if(vid){vid.src=url;vid.style.display='block';}
    if(img)img.style.display='none';
  } else {
    if(img){img.src=url;img.style.display='block';}
    if(vid)vid.style.display='none';
  }
}

function adsClearCreative(){
  _adsCreativeFile=null;
  const inp=document.getElementById('adm-creative-inp');
  if(inp)inp.value='';
  const ph=document.getElementById('adm-creative-placeholder');
  const prev=document.getElementById('adm-creative-preview');
  const img=document.getElementById('adm-creative-img');
  const vid=document.getElementById('adm-creative-vid');
  if(ph)ph.style.display='flex';
  if(prev)prev.style.display='none';
  if(img){img.src='';img.style.display='none';}
  if(vid){vid.src='';vid.style.display='none';}
  document.getElementById('adm-creative-url').value='';
}

function adsSetFilter(f,el){
  adsFilter=f;
  document.querySelectorAll('.ads-filt').forEach(b=>b.classList.remove('active'));
  el.classList.add('active');
  renderAdsCampList(currentAdsCampaigns());
}

function openAddAdsCampaignModal(){
  adsEditId=null;
  _adsCreativeFile=null;
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
  el('adm-start').value='';
  el('adm-end').value='';
  el('adm-creative-url').value='';
  adsClearCreative();
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
  el('adm-start').value=camp.startDay||'';
  el('adm-end').value=camp.endDay||'';
  // Load creative
  adsClearCreative();
  if(camp.creativeUrl){
    const urlInp=el('adm-creative-url');
    if(urlInp)urlInp.value=camp.creativeUrl;
    // Show preview if it's a stored URL
    const prev=el('adm-creative-preview');
    const ph=el('adm-creative-placeholder');
    const img=el('adm-creative-img');
    const vid=el('adm-creative-vid');
    if(camp.creativeType==='video'){
      if(vid){vid.src=camp.creativeUrl;vid.style.display='block';}
    } else if(camp.creativeUrl){
      if(img){img.src=camp.creativeUrl;img.style.display='block';}
    }
    if(prev)prev.style.display='block';
    if(ph)ph.style.display='none';
  }
  openModal('ads-camp-modal');
}

async function saveAdsCampaign(){
  const g=id=>document.getElementById(id)?.value.trim()||'';
  const name=g('adm-name');
  if(!name){showToast('Inserisci il nome','warn');return;}
  const k=currentAdsKey();
  if(!k){showToast('Nessun cliente selezionato','warn');return;}
  if(!adsCampaigns[k])adsCampaigns[k]=[];

  const campId=adsEditId||('ads_'+Date.now());
  let creativeUrl=g('adm-creative-url');
  let creativeType='image';

  // Upload file to Dropbox if a new file was selected
  if(_adsCreativeFile){
    showToast('⟳ Caricamento creativo…');
    try{
      const file=_adsCreativeFile;
      creativeType=file.type.startsWith('video')?'video':'image';
      const ext=file.name.split('.').pop();
      const destPath='/nassa/'+(CLOUD.user||'shared')+'/ads/'+campId+'.'+ext;
      const formData=new FormData();
      formData.append('file',file);
      formData.append('path',destPath);
      const res=await fetch('/api/dropbox-upload',{
        method:'POST',
        headers:{'x-nassa-key':CLOUD.apiKey},
        body:formData
      });
      if(res.ok){
        const data=await res.json();
        creativeUrl=data.url||data.link||creativeUrl;
        URL.revokeObjectURL(_adsCreativeFile._blobUrl||'');
      }
    }catch(e){console.warn('Creative upload failed',e);}
    _adsCreativeFile=null;
  }

  const entry={
    id:campId,
    name, platform:g('adm-platform'),
    budget:parseFloat(g('adm-budget'))||0,
    spent:parseFloat(g('adm-spent'))||0,
    roas:parseFloat(g('adm-roas'))||0,
    roasTarget:parseFloat(g('adm-roas-target'))||0,
    cpc:parseFloat(g('adm-cpc'))||0,
    impressions:parseInt(g('adm-imp'))||0,
    status:g('adm-status')||'active',
    startDay:parseInt(g('adm-start'))||1,
    endDay:parseInt(g('adm-end'))||new Date(new Date().getFullYear(),new Date().getMonth()+1,0).getDate(),
    creativeUrl, creativeType,
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
  showConfirm({
    title:'Elimina campagna',
    body:'La campagna verrà eliminata definitivamente. I dati di spesa e ROAS andranno persi.',
    okLabel:'Elimina campagna',
    type:'danger',
    onOk:()=>{const k=currentAdsKey();if(!k)return;
  const deleted=currentAdsCampaigns().find(camp=>camp.id===id);
  const delIdx=currentAdsCampaigns().findIndex(camp=>camp.id===id);
  adsCampaigns[k]=(adsCampaigns[k]||[]).filter(c=>c.id!==id);
  renderAdsTab();
  showUndoToast('Campagna eliminata',()=>{
    if(deleted){adsCampaigns[k]=adsCampaigns[k]||[];adsCampaigns[k].splice(delIdx,0,deleted);renderAdsTab();autoSave();}
  });
  autoSave();
  }});
}


/* ══ TAB ANNO — Calendario Editoriale Annuale ══ */

const ANNO_TAG_COLORS = {
  'Feed':     {bg:'#b2d8d0', text:'#0a3d35', border:'#7ab8ae'},
  'Reel':     {bg:'#d4cff5', text:'#2a1a6e', border:'#a49de0'},
  'Stories':  {bg:'#f5d4b8', text:'#5c2a00', border:'#d4a070'},
  'UGC':      {bg:'#d8f0d4', text:'#1a4d14', border:'#80c878'},
  'deadline': {bg:'#f5b8b8', text:'#5c0000', border:'#d48080'},
  'note':     {bg:'#e8e8e8', text:'#2a2a2a', border:'#b0b0b0'},
};

/**
 * Aggrega tutti i dati Feed + Stories + PED del cliente corrente
 * per un dato anno, organizzati per mese (0-11) e canale (0=Feed, 1=Deadline/Note, 2=Stories/UGC)
 */
function buildAnnoData(year) {
  const result = {}; // { monthIdx: [{day, ch, title, sub, tag, label}] }
  if(globalClientIdx < 0) return result;
  const cl = clients[globalClientIdx];
  if(!cl) return result;

  const yr = String(year);

  // Scorre tutti gli account del cliente
  (cl.accounts || []).forEach(acc => {
    MONTHS.forEach((mName, mi) => {
      const monthKey = accountKey(acc.id, mName + ' ' + yr);
      if(!result[mi]) result[mi] = [];

      // Campagne Paid → Canale 0 (primo giorno della campagna nel mese)
      (adsCampaigns[cl.id||''] || []).forEach(camp => {
        if(!camp.startDay) return;
        const daysInMo = new Date(parseInt(yr), mi+1, 0).getDate();
        if(camp.startDay > daysInMo) return;
        if(!result[mi]) result[mi] = [];
        result[mi].push({
          day: camp.startDay,
          ch: 0,
          title: camp.name || 'Campagna Paid',
          sub: (camp.platform||'ADS').toUpperCase() + (camp.budget ? ' · €'+camp.budget : ''),
          tag: 'Paid',
          raw: camp
        });
      });

      // Feed items → Canale 0
      (feeds[monthKey] || []).forEach(item => {
        if(!item.date && !item.copy && !item.brief) return;
        const dayNum = parseDayFromItalianDate(item.date);
        if(!dayNum) return;
        const tag = item.type === 'video' ? 'Reel' : item.type === 'carousel' ? 'Feed' : 'Feed';
        result[mi].push({
          day: dayNum,
          ch: 0,
          title: item.copy || item.brief || '—',
          sub: acc.name + (item.type ? ' · ' + (item.type==='video'?'Reel':item.type==='carousel'?'Carosello':'Foto') : ''),
          tag,
          raw: item
        });
      });

      // Stories → Canale 2
      (stories[monthKey] || []).forEach(st => {
        if(!st.date) return;
        const dayNum = parseDayFromItalianDate(st.date);
        if(!dayNum) return;
        result[mi].push({
          day: dayNum,
          ch: 2,
          title: st.isStoryboard ? 'Storyboard' : (st.note || st.copy || 'Story'),
          sub: acc.name + (st.type === 'video' ? ' · Reel' : ' · Story'),
          tag: 'Stories',
          raw: st
        });
      });
    });
  });

  // PED plans (UGC) → Canale 2
  // FIX: usa stesso pattern del calendario (renderCalendar) che funziona
  // Itera tutte le chiavi che iniziano con cl.name|||
  // e filtra per anno con regex robusta invece di split fragile
  const pedPrefix = cl.name + '|||';
  Object.keys(pedPlans).forEach(k => {
    if(!k.startsWith(pedPrefix)) return;
    const monthStr = k.replace(pedPrefix, '').trim();
    // Estrai anno con regex — gestisce spazi multipli e formati vari
    const yearMatch = monthStr.match(/(\d{4})$/);
    if(!yearMatch || yearMatch[1] !== yr) return;
    // Estrai nome mese (tutto prima dell'anno)
    const mName = monthStr.replace(yearMatch[1],'').trim();
    const mi = MONTHS.indexOf(mName);
    if(mi < 0) return;
    if(!result[mi]) result[mi] = [];
    (pedPlans[k] || []).forEach(item => {
      if(!item.date) return;
      // item.date può essere ISO "2026-06-03" o italiano
      let dayNum = null;
      if(item.date.match(/^\d{4}-\d{2}-\d{2}$/)) {
        // ISO format — estrai giorno direttamente senza timezone issues
        dayNum = parseInt(item.date.split('-')[2]);
      } else {
        dayNum = parseDayFromItalianDate(item.date);
      }
      if(!dayNum) return;
      result[mi].push({
        day: dayNum,
        ch: 2,
        title: item.brief || (item.type === 'autonoma' ? 'UGC Autonoma' : 'UGC Template'),
        sub: item.type === 'autonoma' ? 'Autonoma' : 'Template Nassa',
        tag: 'UGC',
        raw: item
      });
    });
  });

  // Note → Canale 1 (da notesData)
  const notesPrefix = cl.name + '|||';
  Object.keys(notesData).forEach(k => {
    if(!k.startsWith(notesPrefix)) return;
    const monthStr = k.replace(notesPrefix, '');
    const parts = monthStr.split(' ');
    if(parts[1] !== yr) return;
    const mi = MONTHS.indexOf(parts[0]);
    if(mi < 0) return;
    if(!result[mi]) result[mi] = [];
    const content = notesData[k] || '';
    // Estrae le deadline (righe che iniziano con ## o contengono "deadline"/"scadenza")
    content.split('\n').forEach(line => {
      const dl = line.match(/deadline[:\s]+(.+)/i) || line.match(/scadenza[:\s]+(.+)/i);
      if(dl) {
        result[mi].push({day:1, ch:1, label:dl[1].trim(), tag:'deadline'});
      }
    });
  });

  // Ordina ogni mese per giorno
  Object.keys(result).forEach(mi => {
    result[mi].sort((a,b) => a.day - b.day);
  });

  return result;
}

function parseDayFromItalianDate(dateStr) {
  if(!dateStr) return null;
  // Formato: "Lun 3 Giu" o "3 Giugno" o "2026-06-03"
  const iso = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if(iso) return parseInt(iso[3]);
  const parts = dateStr.trim().split(/\s+/);
  // "Ven 5 Giu" → giorno è il numero
  for(const p of parts) {
    const n = parseInt(p);
    if(!isNaN(n) && n >= 1 && n <= 31) return n;
  }
  return null;
}

function annoPrevYear() { annoYear--; renderAnnoTab(); }
function annoNextYear() { annoYear++; renderAnnoTab(); }

function annoSetFilter(tag) {
  annoFilterTag = annoFilterTag === tag ? null : tag;
  renderAnnoTab();
}

function annoToggleMonth(mi) {
  annoExpanded[mi] = !annoExpanded[mi];
  renderAnnoTab();
}

function annoSelectEv(mi, evIdx) {
  const data = buildAnnoData(annoYear);
  const evs = data[mi] || [];
  annoSelectedEv = evs[evIdx] ? {...evs[evIdx], month: mi} : null;
  renderAnnoTab();
}

function renderAnnoTab() {
  const cl = globalClientIdx >= 0 ? clients[globalClientIdx] : null;
  const eid = id => document.getElementById(id);

  // Year label
  if(eid('anno-year-lbl')) eid('anno-year-lbl').textContent = annoYear;

  const data = buildAnnoData(annoYear);
  const tags = Object.keys(ANNO_TAG_COLORS);

  // Tag filters
  const filterRow = eid('anno-tag-filters');
  if(filterRow) {
    filterRow.innerHTML = tags.map(t => {
      const tc = ANNO_TAG_COLORS[t];
      const isActive = annoFilterTag === t;
      return `<button class="anno-tag-btn${isActive?' active':''}" 
        onclick="annoSetFilter('${t}')"
        style="${isActive?'background:'+tc.bg+';color:'+tc.text+';border:1.5px solid '+tc.border:'border-color:'+tc.border}"
      >${t}</button>`;
    }).join('');
  }

  // Bands
  const bandsEl = eid('anno-bands');
  if(!bandsEl) return;

  const MONTHS_SHORT_IT = ['Gen','Feb','Mar','Apr','Mag','Giu','Lug','Ago','Set','Ott','Nov','Dic'];
  let totalEvs = 0;
  let html = '';

  MONTHS.forEach((mName, mi) => {
    let evs = data[mi] || [];
    if(annoFilterTag) evs = evs.filter(e => e.tag === annoFilterTag);
    totalEvs += evs.length;

    const exp = !!annoExpanded[mi];
    const byCh = [[],[],[]];
    evs.forEach(e => byCh[Math.min(e.ch ?? 0, 2)].push(e));

    html += `<div class="anno-band">
      <div class="anno-band-row" onclick="annoToggleMonth(${mi})">
        <div class="anno-month-cell">
          <span class="anno-month-name">${MONTHS_SHORT_IT[mi]}</span>
        </div>`;

    [0,1,2].forEach(ch => {
      const chEvs = byCh[ch];
      if(!exp) {
        html += `<div class="anno-channel"><div class="anno-ch-count">${chEvs.length ? chEvs.length + (chEvs.length===1?' evento':' eventi') : '—'}</div></div>`;
        return;
      }
      html += `<div class="anno-channel">`;
      chEvs.forEach((ev, ei) => {
        const tc = ANNO_TAG_COLORS[ev.tag] || ANNO_TAG_COLORS.note;
        const dayEl = ch === 0
          ? `<span class="anno-day-pri">${ev.day}</span>`
          : `<span class="anno-day-sec">${ev.day}</span>`;

        if(ev.label) {
          html += `<div class="anno-ev-row" onclick="event.stopPropagation();annoSelectEv(${mi},${byCh[ch].indexOf(ev)+(ch>0?byCh[0].length+(ch>1?byCh[1].length:0):0)})">
            ${dayEl}
            <div class="anno-ev-content">
              <span class="anno-ev-tag" style="background:${tc.bg};color:${tc.text}">${ev.tag.toUpperCase()}</span>
              <div class="anno-ev-label">${esc(ev.label)}</div>
            </div>
          </div>`;
        } else {
          html += `<div class="anno-ev-row" onclick="event.stopPropagation();annoSelectEv(${mi},${evs.indexOf(ev)})">
            ${dayEl}
            <div class="anno-ev-content">
              <div class="anno-ev-primary" style="border-color:${tc.border}">
                <span class="anno-ev-tag" style="background:${tc.bg};color:${tc.text}">${ev.tag}</span>
                <div class="anno-ev-title">${esc(ev.title||'—')}</div>
                ${ev.sub ? `<div class="anno-ev-sub">${esc(ev.sub)}</div>` : ''}
              </div>
            </div>
          </div>`;
        }
      });
      if(!chEvs.length) html += `<div class="anno-ch-count">—</div>`;
      html += `</div>`;
    });

    html += `</div></div>`;
  });

  // Empty state — nessun cliente o nessun contenuto con date
  if(!cl) {
    bandsEl.innerHTML = `
      <div class="anno-empty">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="width:36px;height:36px;opacity:.2;margin-bottom:14px;"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
        <p class="anno-empty-title">Nessun cliente selezionato</p>
        <p class="anno-empty-sub">Seleziona un cliente dal menu in alto per vedere il suo calendario annuale.</p>
      </div>`;
  } else if(totalEvs === 0) {
    const filterMsg = annoFilterTag ? ` con tag <strong>${annoFilterTag}</strong>` : '';
    bandsEl.innerHTML = `
      <div class="anno-empty">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="width:36px;height:36px;opacity:.2;margin-bottom:14px;"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/><line x1="8" y1="14" x2="8" y2="18"/><line x1="12" y1="14" x2="12" y2="18"/><line x1="16" y1="14" x2="16" y2="18"/></svg>
        <p class="anno-empty-title">Nessun contenuto nel ${annoYear}${filterMsg}</p>
        <p class="anno-empty-sub">I post appariranno qui non appena assegni una <strong>data</strong> ai contenuti in Feed, Stories o UGC.</p>
        <div class="anno-empty-tips">
          <div class="anno-empty-tip" onclick="switchTab('feed')">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
            Vai a Feed →
          </div>
          <div class="anno-empty-tip" onclick="switchTab('stories')">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><rect x="5" y="2" width="14" height="20" rx="2"/></svg>
            Vai a Stories →
          </div>
          <div class="anno-empty-tip" onclick="switchTab('ped')">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/></svg>
            Vai a UGC →
          </div>
        </div>
      </div>`;
  } else {
    bandsEl.innerHTML = html;
  }

  // Footer
  const footer = eid('anno-footer');
  if(footer) {
    const cln = cl ? cl.name.toUpperCase() : 'NESSUN CLIENTE';
    footer.innerHTML = `
      <span class="anno-footer-txt">NASSA STUDIO · ${cln} · ${annoYear}</span>
      <span class="anno-footer-txt">${totalEvs > 0 ? totalEvs + ' EVENTI' + (annoFilterTag?' · '+annoFilterTag:'') : '—'}</span>
    `;
  }

  // Modal evento
  let existingModal = document.getElementById('anno-detail-modal');
  if(existingModal) existingModal.remove();

  if(annoSelectedEv) {
    const ev = annoSelectedEv;
    const tc = ANNO_TAG_COLORS[ev.tag] || ANNO_TAG_COLORS.note;
    const mNameFull = MONTHS[ev.month] || '';
    const modal = document.createElement('div');
    modal.id = 'anno-detail-modal';
    modal.className = 'anno-modal-bg';
    modal.onclick = () => { annoSelectedEv = null; renderAnnoTab(); };
    modal.innerHTML = `<div class="anno-modal" onclick="event.stopPropagation()">
      <div class="anno-modal-eyebrow">Dettaglio · ${ev.day} ${mNameFull} ${annoYear}</div>
      ${ev.title ? `<div class="anno-modal-title">${esc(ev.title)}</div>` : ''}
      ${ev.sub ? `<div class="anno-modal-sub">${esc(ev.sub)}</div>` : ''}
      ${ev.label ? `<div class="anno-modal-sub" style="font-style:italic">${esc(ev.label)}</div>` : ''}
      <span class="anno-ev-tag" style="background:${tc.bg};color:${tc.text};font-size:10px;padding:2px 8px;display:inline-block">${ev.tag.toUpperCase()}</span>
      <button class="btn sm" style="margin-top:14px;" onclick="annoSelectedEv=null;renderAnnoTab()">Chiudi</button>
    </div>`;
    document.body.appendChild(modal);
  }
}


/* ══ SISTEMA APPROVAZIONE FEED ══ */

const APPR_STATI = [
  {key:'bozza',       label:'Bozza',            dot:'#999',    bg:'rgba(100,100,100,0.12)', text:'var(--text-2)',  border:'var(--border)'},
  {key:'revisione',   label:'Da Revisionare',   dot:'#e05c00', bg:'rgba(224,92,0,0.13)',    text:'#7a2e00',        border:'rgba(224,92,0,0.45)'},
  {key:'approvare',   label:'Da Approvare',     dot:'#d4a800', bg:'rgba(212,168,0,0.15)',   text:'#7a5c00',        border:'rgba(212,168,0,0.5)'},
  {key:'approvato',   label:'Approvato',        dot:'#1a7a4a', bg:'rgba(26,122,74,0.12)',   text:'#0f5230',        border:'rgba(26,122,74,0.4)'},
];
/* ══ SISTEMA NOTIFICHE NOTE ══ */
function updateNotifBadge(){
  const badge = document.getElementById('notif-badge');
  const count = apprUnreadNotes.length;
  if(badge){
    badge.textContent = count > 9 ? '9+' : count;
    badge.style.display = count > 0 ? 'flex' : 'none';
  }
}

function markNoteRead(idx){
  apprUnreadNotes = apprUnreadNotes.filter(i => i !== idx);
  updateNotifBadge();
}

function markNoteUnread(idx, fromClient=false){
  if(!apprUnreadNotes.includes(idx)) apprUnreadNotes.push(idx);
  if(fromClient) showToast('💬 Nuova nota dal cliente sul post '+(idx+1));
  updateNotifBadge();
}


function apprGetStato(key){ return APPR_STATI.find(s=>s.key===key)||APPR_STATI[0]; }

let apprMode = false;          // toggle on/off
let apprFilter = 'tutti';      // filtro stato approvazione
let previewTypeFilter = 'tutti'; // filtro tipologia
let apprOpenMenu = null;       // id post con menu aperto
let apprModalIdx = null;       // index post nel modal
let apprModalItems = [];
let apprUnreadNotes = [];      // indici post con note non lette       // array corrente di feed items

function toggleApprMode(){
  apprMode = !apprMode;
  const btn = document.getElementById('appr-toggle-btn');
  const lbl = document.getElementById('appr-toggle-lbl');
  const bar = document.getElementById('appr-stats-bar');
  if(btn) btn.classList.toggle('active', apprMode);
  if(lbl) lbl.textContent = apprMode ? 'Approvazione ON' : 'Approvazione';
  if(bar) bar.style.display = apprMode ? 'flex' : 'none';
  apprFilter = 'tutti';
  renderPreview();
}

function apprGetItems(){
  const ci = globalClientIdx >= 0 ? globalClientIdx : 0;
  const cl = clients[ci];
  if(!cl) return [];
  const accs = cl.accounts || [];
  const acc = accs[previewActiveAcc] || accs[0];
  if(!acc) return [];
  const msel = document.getElementById('preview-month-sel');
  const month = (msel?.value) || feedMonth || MONTH_OPTIONS[new Date().getMonth()];
  const key = accountKey(acc.id, month);
  return (feeds[key] || []).filter(i => i.type !== 'pending');
}

function apprUpdateStats(items){
  const bar = document.getElementById('appr-stats-bar');
  if(!bar) return;
  // Sempre visibile — non più condizionato a apprMode
  bar.style.display = 'flex';

  // Conteggi per stato approvazione (su tutto il feed, non filtered)
  const allItems = apprGetItems ? apprGetItems() : items;
  const counts = {bozza:0, approvare:0, approvato:0};
  allItems.forEach(it => { const st=it.apprStato||'bozza'; counts[st]=(counts[st]||0)+1; });
  const total = allItems.length;

  // Conteggi per tipologia
  const nFoto     = allItems.filter(x=>x.type==='image'||x.type==='editorial').length;
  const nReel     = allItems.filter(x=>x.type==='video').length;
  const nCarousel = allItems.filter(x=>x.type==='carousel').length;

  // Aggiorna celle numeriche vecchie (retrocompat)
  ['bozza','approvare','approvato'].forEach(k => {
    const cell = document.getElementById('appr-stat-'+k);
    if(!cell) return;
    const num = cell.querySelector('.appr-stat-num');
    const barEl = cell.querySelector('.appr-stat-bar');
    if(num) num.textContent = counts[k];
    if(barEl) barEl.style.width = total ? Math.round(counts[k]/total*100)+'%' : '0%';
  });
  const tot = document.getElementById('appr-stat-totale');
  if(tot) tot.textContent = total;

  // Barra chip unica: Tipo | Approvazione
  const filterRow = document.getElementById('appr-filter-row');
  if(filterRow){
    const typeOpts = [
      {k:'tutti', label:'Tutti', n:total, dot:null},
      ...(nFoto     ? [{k:'image',    label:'Foto',      n:nFoto,     dot:null}] : []),
      ...(nReel     ? [{k:'video',    label:'Reel',      n:nReel,     dot:null}] : []),
      ...(nCarousel ? [{k:'carousel', label:'Carosello', n:nCarousel, dot:null}] : []),
    ];
    const apprOpts = APPR_STATI.map(s=>({k:s.key, label:s.label, n:counts[s.key]||0, dot:s.dot}));

    filterRow.innerHTML =
      typeOpts.map(o=>`
        <button class="appr-filter-chip${previewTypeFilter===o.k&&apprFilter==='tutti'?' active':''}"
          onclick="previewTypeFilter='${o.k}';apprFilter='tutti';apprUpdateStats(apprGetItems());renderPreview();">
          ${o.label} <span class="afc-count">${o.n}</span>
        </button>`).join('')
      + '<span class="appr-filter-sep"></span>'
      + apprOpts.map(o=>`
        <button class="appr-filter-chip${apprFilter===o.k&&previewTypeFilter==='tutti'?' active':''}"
          onclick="apprFilter='${o.k}';previewTypeFilter='tutti';apprUpdateStats(apprGetItems());renderPreview();">
          <span class="afc-dot" style="background:${o.dot};"></span>
          ${o.label} <span class="afc-count">${o.n}</span>
        </button>`).join('');
  }
}

function apprSetFilter(f){
  apprFilter = f;
  apprUpdateStats(apprGetItems());
  renderPreview();
}
function setPreviewTypeFilter(f){
  previewTypeFilter = f;
  apprUpdateStats(apprGetItems());
  renderPreview();
}

function apprChangeStato(idx, stato){
  const items = apprGetItems();
  if(!items[idx]) return;
  const oldStato = items[idx].apprStato || 'bozza';
  items[idx].apprStato = stato;
  if(stato === 'approvare' && oldStato === 'bozza'){
    items[idx].apprRevisions = (items[idx].apprRevisions || 0) + 1;
  }
  apprOpenMenu = null;
  autoSave();
  renderPreview();
}

function apprToggleMenu(idx){
  apprOpenMenu = apprOpenMenu === idx ? null : idx;
  renderPreview();
}

function openApprModal(idx, items){
  apprModalIdx = idx;
  apprModalItems = items;
  const post = items[idx];
  if(!post) return;
  const s = apprGetStato(post.apprStato||'bozza');

  document.getElementById('appr-modal-title').textContent =
    `Post ${idx+1} · ${post.type||'Post'} · ${post.date||'—'}`;

  // Thumb
  const thumb = document.getElementById('appr-modal-thumb');
  thumb.innerHTML = '';
  const coverUrl = post.type==='carousel'&&post.slides?.length ? post.slides[0].url : post.url;
  if(coverUrl){
    const el = post.type==='video' ? makeMedia(coverUrl,'video') : makeMedia(coverUrl,'image');
    if(el) thumb.appendChild(el);
  } else {
    thumb.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="width:32px;height:32px;opacity:.2;"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>`;
  }

  // Stato pills
  const pillsEl = document.getElementById('appr-stato-pills');
  pillsEl.innerHTML = APPR_STATI.map(st=>{
    const active = (post.apprStato||'bozza') === st.key;
    return `<button class="appr-stato-pill" onclick="apprModalSetStato('${st.key}')"
      style="${active?`background:${st.bg};color:${st.text};border-color:${st.border};`:''}">
      <span style="width:6px;height:6px;border-radius:50%;background:${st.dot};display:inline-block;"></span>
      ${st.label}
    </button>`;
  }).join('');

  // Note
  const noteArea = document.getElementById('appr-note-area');
  noteArea.value = post.apprNote || '';

  // Bottone approva
  const apprBtn = document.getElementById('appr-approva-btn');
  if(apprBtn) apprBtn.style.display = post.apprStato==='approvato' ? 'none' : '';

  document.getElementById('appr-modal-bg').style.display = 'flex';
}

function closeApprModal(){ document.getElementById('appr-modal-bg').style.display='none'; apprModalIdx=null; }

function apprModalSetStato(stato){
  if(apprModalIdx === null) return;
  const post = apprModalItems[apprModalIdx];
  if(!post) return;
  const old = post.apprStato || 'bozza';
  post.apprStato = stato;
  if(stato==='approvare'&&old==='bozza') post.apprRevisions=(post.apprRevisions||0)+1;
  // Aggiorna pills
  const pillsEl = document.getElementById('appr-stato-pills');
  if(pillsEl) pillsEl.innerHTML = APPR_STATI.map(st=>{
    const active = stato === st.key;
    return `<button class="appr-stato-pill" onclick="apprModalSetStato('${st.key}')"
      style="${active?`background:${st.bg};color:${st.text};border-color:${st.border};`:''}">
      <span style="width:6px;height:6px;border-radius:50%;background:${st.dot};display:inline-block;"></span>
      ${st.label}
    </button>`;
  }).join('');
  const apprBtn = document.getElementById('appr-approva-btn');
  if(apprBtn) apprBtn.style.display = stato==='approvato'?'none':'';
}

function apprModalApprova(){
  if(apprModalIdx===null) return;
  apprModalSalva(true);
  apprModalSetStato('approvato');
  apprModalItems[apprModalIdx].apprStato = 'approvato';
  closeApprModal();
  autoSave();
  renderPreview();
}

function apprModalSalva(skipClose){
  if(apprModalIdx===null) return;
  const note = document.getElementById('appr-note-area')?.value || '';
  const oldNote = apprModalItems[apprModalIdx].apprNote || '';
  apprModalItems[apprModalIdx].apprNote = note;
  // Se c'è una nota nuova → notifica
  if(note && note !== oldNote) markNoteUnread(apprModalIdx, false);
  autoSave();
  if(!skipClose){ closeApprModal(); renderPreview(); }
}

/** Inietta l'overlay approvazione su ogni client-post nella griglia */
function apprInjectGrid(items){
  if(!apprMode) return;
  const posts = document.querySelectorAll('.client-post');
  posts.forEach((postEl, idx) => {
    const item = items[idx];
    if(!item) return;
    // Applica filtro
    const st = item.apprStato || 'bozza';
    if(apprFilter !== 'tutti' && st !== apprFilter){
      postEl.style.display = 'none';
      return;
    }
    postEl.style.display = '';

    const s = apprGetStato(st);
    const cell = postEl.querySelector('.client-cell');
    if(!cell) return;

    // Badge stato + menu
    if(!cell.querySelector('.appr-badge')){
      const badgeWrap = document.createElement('div');
      badgeWrap.style.cssText = 'position:absolute;top:8px;left:8px;z-index:5;';

      const badge = document.createElement('button');
      badge.className = 'appr-badge';
      badge.style.cssText = `background:${s.bg};color:${s.text};border-color:${s.border};`;
      badge.innerHTML = `<span class="appr-badge-dot" style="background:${s.dot};"></span>${s.label}`;
      badge.onclick = (e) => { e.stopPropagation(); apprToggleMenu(idx); };
      badgeWrap.appendChild(badge);

      if(apprOpenMenu === idx){
        const menu = document.createElement('div');
        menu.className = 'appr-status-menu';
        APPR_STATI.forEach((st2, si) => {
          const item2 = document.createElement('div');
          item2.className = 'appr-menu-item' + (st===st2.key?' current':'');
          item2.innerHTML = `<span style="width:8px;height:8px;border-radius:50%;background:${st2.dot};flex-shrink:0;display:inline-block;"></span>${st2.label}${st===st2.key?'<span style="margin-left:auto;opacity:.4;">✓</span>':''}`;
          item2.onclick = (e) => { e.stopPropagation(); apprChangeStato(idx, st2.key); };
          if(si < APPR_STATI.length-1){
            const sep = document.createElement('div');
            sep.style.cssText = 'height:.5px;background:var(--border);';
            menu.appendChild(item2);
            menu.appendChild(sep);
          } else {
            menu.appendChild(item2);
          }
        });
        badgeWrap.appendChild(menu);
      }
      cell.appendChild(badgeWrap);
    }

    // Border colorato sulla card
    postEl.style.borderColor = st==='approvare'?'#d4a800':st==='approvato'?'#1a7a4a':'var(--border)';
    postEl.style.borderWidth = st==='bozza'?'1px':'1.5px';

    // Nota revisione
    if(item.apprNote && st==='approvare' && !postEl.querySelector('.appr-rev-note')){
      const revDiv = document.createElement('div');
      revDiv.className = 'appr-rev-note';
      revDiv.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="#d4a800" stroke-width="2" style="width:12px;height:12px;flex-shrink:0;margin-top:1px;"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
        <span style="flex:1;">${esc(item.apprNote)}</span>
        ${item.apprRevisions>0?`<span style="font-size:10px;color:#d4a800;white-space:nowrap;font-family:var(--font);">${item.apprRevisions} rev.</span>`:''}`;
      const cell2 = postEl.querySelector('.client-cell');
      if(cell2) cell2.after(revDiv);
    }

    // Azioni rapide
    if(!postEl.querySelector('.appr-actions')){
      const actions = document.createElement('div');
      actions.className = 'appr-actions';
      if(st==='bozza'){
        const btn = document.createElement('button');
        btn.className = 'appr-action-btn';
        btn.style.cssText = 'border:.5px solid #d4a800;color:#7a5c00;';
        btn.textContent = '→ Invia';
        btn.onclick = (e) => { e.stopPropagation(); apprChangeStato(idx,'approvare'); };
        actions.appendChild(btn);
      }
      if(st==='approvare'){
        const btn = document.createElement('button');
        btn.className = 'appr-action-btn';
        btn.style.cssText = 'border:.5px solid #1a7a4a;color:#0f5230;';
        btn.textContent = '✓ Approva';
        btn.onclick = (e) => { e.stopPropagation(); apprChangeStato(idx,'approvato'); };
        actions.appendChild(btn);
      }
      if(st==='approvato'){
        const lbl = document.createElement('span');
        lbl.style.cssText = 'font-size:10px;color:#1a7a4a;font-family:var(--font);';
        lbl.textContent = '✓ Approvato';
        actions.appendChild(lbl);
      }
      const detBtn = document.createElement('button');
      detBtn.className = 'appr-action-btn';
      detBtn.style.cssText = 'border:.5px solid var(--border);color:var(--text-2);margin-left:auto;';
      detBtn.textContent = 'Dettaglio';
      detBtn.onclick = (e) => { e.stopPropagation(); openApprModal(idx, items); };
      actions.appendChild(detBtn);
      postEl.appendChild(actions);
    }
  });

  apprUpdateStats(items);

  // Chiude menu su click fuori
  document.addEventListener('mousedown', (e) => {
    if(apprOpenMenu!==null && !e.target.closest('.appr-badge') && !e.target.closest('.appr-status-menu')){
      apprOpenMenu = null;
    }
  }, {once:true});
}

function cycleApprStato(idx, items){
  if(!items[idx]) return;
  const order = ['bozza','approvare','approvato'];
  const cur = items[idx].apprStato || 'bozza';
  const next = order[(order.indexOf(cur)+1) % order.length];
  items[idx].apprStato = next;
  if(next === 'approvare') items[idx].apprRevisions = (items[idx].apprRevisions||0)+1;
  autoSave();
  refreshFeed();
}


function sbLivePreview(){
  const raw = document.getElementById('sb-parser-input')?.value || '';
  const preview = document.getElementById('sb-live-preview');
  if(!preview) return;
  if(!raw.trim()){ preview.style.display='none'; return; }
  const lines = raw.split('\n').map(l=>l.trim()).filter(l=>l.length>0);
  let num='',eye='',tit='',cop='';
  lines.forEach(l=>{
    if(/^\[NUM\]/i.test(l))          num=l.replace(/^\[NUM\]\s*/i,'');
    else if(/^\[OCCHIELLO\]/i.test(l)) eye=l.replace(/^\[OCCHIELLO\]\s*/i,'');
    else if(/^\[TITOLO\]/i.test(l))    tit=l.replace(/^\[TITOLO\]\s*/i,'');
    else if(/^\[COPY\]/i.test(l))      cop=l.replace(/^\[COPY\]\s*/i,'');
  });
  // Fallback no-tag
  if(!num&&!eye&&!tit&&!cop&&lines.length>=2){eye=lines[0];tit=lines[1];cop=lines.slice(2).join(' ');}
  const set=(id,val)=>{const el=document.getElementById(id);if(el){el.textContent=val||'';el.style.opacity=val?'1':'0.3';}};
  set('sb-live-num', num ? `#${num}` : '—');
  set('sb-live-eye', eye || '—');
  set('sb-live-tit', tit || '—');
  set('sb-live-cop', cop || '—');
  preview.style.display = 'block';
}


/* ══ BRIEF CREATOR MODAL (Gruppo C) ══ */
let briefTargetSb = null;

function openBriefModal(sb){
  briefTargetSb = sb;
  const modal = document.getElementById('brief-modal');
  if(!modal) return;

  // Titolo
  const titleEl = document.getElementById('brief-modal-title');
  if(titleEl) titleEl.textContent = sb.name || 'Storyboard';

  // Link
  const linkEl = document.getElementById('brief-modal-link');
  if(linkEl){
    const briefId = sb.id || 'preview';
    const briefUrl = 'https://nassa.studio/brief/' + briefId;
    linkEl.textContent = briefUrl;
    linkEl.title = 'Clicca per copiare';
    linkEl.style.cursor = 'pointer';
    linkEl.onclick = ()=>{
      navigator.clipboard.writeText(briefUrl).then(()=>{
        const orig = linkEl.textContent;
        linkEl.textContent = '✓ Link copiato!';
        setTimeout(()=>{ linkEl.textContent = orig; }, 1800);
      }).catch(()=>{ showToast('Copia manuale: '+briefUrl); });
    };
  }

  // Preview slide list
  const listEl = document.getElementById('brief-modal-list');
  if(listEl){
    listEl.innerHTML = '';
    (sb.slides || []).forEach((sl, i) => {
      const row = document.createElement('div');
      row.className = 'brief-slide-row';

      // Miniatura
      const thumb = document.createElement('div');
      thumb.className = 'brief-slide-thumb';
      if(sl.url){
        const img = document.createElement('img');
        img.src = sl.url; img.alt = '';
        thumb.appendChild(img);
      }
      if(sl.isPlaceholder){
        const ph = document.createElement('div');
        ph.className = 'brief-slide-ph';
        thumb.appendChild(ph);
      }

      // Info
      const info = document.createElement('div');
      info.className = 'brief-slide-info';

      const num = document.createElement('div');
      num.className = 'brief-slide-num';
      num.textContent = sl.num ? '#'+sl.num : '#'+(i+1);

      const tit = document.createElement('div');
      tit.className = 'brief-slide-tit';
      tit.textContent = sl.title || sl.eye || '—';

      info.appendChild(num);
      info.appendChild(tit);

      // Nota regia
      if(sl.noteRegia){
        const nr = document.createElement('div');
        nr.className = 'brief-slide-regia';
        nr.textContent = sl.noteRegia;
        info.appendChild(nr);
      }

      // Placeholder label
      if(sl.isPlaceholder){
        const ph = document.createElement('div');
        ph.className = 'brief-slide-ph-lbl';
        ph.textContent = '↑ questa slide richiede il tuo video';
        info.appendChild(ph);
      }

      row.appendChild(thumb);
      row.appendChild(info);
      listEl.appendChild(row);
    });
  }

  // Stato bottone invia
  const inviaBtn = document.getElementById('brief-modal-invia');
  if(inviaBtn){
    if(sb.briefInviato){
      inviaBtn.textContent = 'Brief già inviato';
      inviaBtn.disabled = true;
      inviaBtn.style.opacity = '.5';
    } else {
      inviaBtn.textContent = 'Invia brief al creator';
      inviaBtn.disabled = false;
      inviaBtn.style.opacity = '1';
    }
  }

  modal.style.display = 'flex';
}

function closeBriefModal(){
  const modal = document.getElementById('brief-modal');
  if(modal) modal.style.display = 'none';
  briefTargetSb = null;
}

function copyBriefLink(){
  const linkEl = document.getElementById('brief-modal-link');
  if(!linkEl) return;
  navigator.clipboard?.writeText(linkEl.textContent).then(()=>{
    showToast('✓ Link copiato');
  }).catch(()=>{
    showToast('Link: ' + linkEl.textContent);
  });
}

function inviaBreifCreator(){
  if(!briefTargetSb) return;
  briefTargetSb.briefInviato = true;
  autoSave();
  showToast('✓ Brief inviato al creator');
  closeBriefModal();
  renderPreview(); // aggiorna badge
}


function archiviaTemplate(sbId){
  // Trova lo storyboard nelle Stories del cliente corrente
  const key = currentFeedKey ? currentFeedKey() : null;
  // Cerca in tutte le stories
  let found = null;
  Object.values(stories||{}).forEach(arr=>{
    const s = arr.find(x=>x.id===sbId);
    if(s) found=s;
  });
  if(!found) return;
  found.fileCaricato = true;
  // Archivia nel cassetto realizzati
  const entry = {
    ...found,
    archiviatoAt: new Date().toISOString(),
    nomeCreator: '',
  };
  cassettoRealizzati.unshift(entry);
  try{ localStorage.setItem('sb_realizzati', JSON.stringify(cassettoRealizzati)); }catch(e){}
  autoSave();
  renderSbCassetto();
  showToast('✓ Template archiviato come realizzato');
}


/* ══ VIDEO COVER MODAL ══ */
let videoCoverEditIdx = null;

function openVideoCoverModal(idx){
  videoCoverEditIdx = idx;
  const modal = document.getElementById('video-cover-modal');
  if(!modal) return;
  const item = currentFeedItems()[idx];
  // Mostra preview cover attuale se esiste
  const prev = document.getElementById('vcm-preview');
  if(prev){
    if(item.coverUrl){
      prev.innerHTML = '<img src="'+item.coverUrl+'" style="width:100%;height:100%;object-fit:cover;border-radius:var(--rs);display:block;"/>';
      prev.style.display = 'block';
    } else {
      prev.innerHTML = '';
      prev.style.display = 'none';
    }
  }
  const inp = document.getElementById('vcm-file-inp');
  if(inp) inp.value = '';
  modal.style.display = 'flex';
}

function closeVideoCoverModal(){
  const modal = document.getElementById('video-cover-modal');
  if(modal) modal.style.display = 'none';
  videoCoverEditIdx = null;
}

async function setVideoCover(file){
  if(!file || videoCoverEditIdx === null) return;
  const items = currentFeedItems();
  const item = items[videoCoverEditIdx];
  if(!item) return;

  showToast('⟳ Caricamento cover…');
  // Upload su Dropbox
  const destPath = '/nassa/'+CLOUD.user+'/'+(feedMonth||'misc')+'/covers/'+file.name;
  const url = await DROPBOX.upload(file, destPath);
  if(url){
    items[videoCoverEditIdx].coverUrl = url;
    setFeedItems(items);
    CLOUD.saveNow(CLOUD.snapshot()); // salva subito la cover
    refreshFeed();
    showToast('✓ Cover reel impostata');
  } else {
    // Fallback: blob URL locale
    if(item.coverUrl && item.coverUrl.startsWith('blob:')) URL.revokeObjectURL(item.coverUrl);
    items[videoCoverEditIdx].coverUrl = URL.createObjectURL(file);
    setFeedItems(items);
    refreshFeed();
    showToast('Cover impostata (locale)', 'warn');
  }
  closeVideoCoverModal();
}

function removeVideoCover(){
  if(videoCoverEditIdx === null) return;
  const items = currentFeedItems();
  if(items[videoCoverEditIdx]?.coverUrl?.startsWith('blob:'))
    URL.revokeObjectURL(items[videoCoverEditIdx].coverUrl);
  items[videoCoverEditIdx].coverUrl = '';
  setFeedItems(items);
  autoSave();
  refreshFeed();
  closeVideoCoverModal();
  showToast('Cover rimossa');
}


/* ══ SLIDE BUILDER — Mobile tab navigation ══ */
function sbMobTab(tab){
  if(window.innerWidth > 744) return; // solo su mobile
  const nav = document.querySelector('.sbcol-nav');
  const fields = document.querySelector('.sb-fields');
  const preview = document.querySelector('.sb-preview-wrap');
  const btnSlide = document.getElementById('sb-mob-slide-btn');
  const btnEditor = document.getElementById('sb-mob-editor-btn');
  const btnPreview = document.getElementById('sb-mob-preview-btn');

  // Nascondi tutto
  [nav, fields, preview].forEach(el => { if(el) el.classList.remove('sb-mob-active'); });
  [btnSlide, btnEditor, btnPreview].forEach(b => { if(b) b.classList.remove('active'); });

  // Mostra tab richiesto
  if(tab === 'slides' && nav){
    nav.classList.add('sb-mob-active');
    if(btnSlide) btnSlide.classList.add('active');
  } else if(tab === 'editor' && fields){
    fields.classList.add('sb-mob-active');
    if(btnEditor) btnEditor.classList.add('active');
  } else if(tab === 'preview' && preview){
    preview.classList.add('sb-mob-active');
    if(btnPreview) btnPreview.classList.add('active');
    // Aggiorna anteprima quando si entra
    updateSbPreview();
  }
}

// Quando si carica il SB su mobile, attiva il tab editor di default
function sbInitMobile(){
  if(window.innerWidth <= 744){
    const fields = document.querySelector('.sb-fields');
    if(fields) fields.classList.add('sb-mob-active');
  }
}


/* INIT */
function init(){
  applySidebarState();
  const fdz=document.getElementById('feed-drop-zone');if(fdz){fdz.addEventListener('dragover',e=>{e.preventDefault();fdz.classList.add('drag-over');});fdz.addEventListener('dragleave',e=>{if(!fdz.contains(e.relatedTarget))fdz.classList.remove('drag-over');});fdz.addEventListener('drop',e=>{e.preventDefault();fdz.classList.remove('drag-over');queueFeedFiles(e.dataTransfer.files);});}
  const sdz=document.getElementById('stories-drop-zone');if(sdz){sdz.addEventListener('dragover',e=>{e.preventDefault();sdz.classList.add('drag-over');});sdz.addEventListener('dragleave',e=>{if(!sdz.contains(e.relatedTarget))sdz.classList.remove('drag-over');});sdz.addEventListener('drop',e=>{e.preventDefault();sdz.classList.remove('drag-over');queueStoryFiles(e.dataTransfer.files);});}
  const cuzEl=document.getElementById('c-upload-zone');if(cuzEl){cuzEl.addEventListener('dragover',e=>{e.preventDefault();cuzEl.classList.add('drag-over');});cuzEl.addEventListener('dragleave',()=>cuzEl.classList.remove('drag-over'));cuzEl.addEventListener('drop',e=>{e.preventDefault();cuzEl.classList.remove('drag-over');addCarouselFiles(e.dataTransfer.files);});}
  const hluz=document.getElementById('hl-upload-zone');if(hluz){hluz.addEventListener('dragover',e=>{e.preventDefault();hluz.classList.add('drag-over');});hluz.addEventListener('dragleave',()=>hluz.classList.remove('drag-over'));hluz.addEventListener('drop',e=>{e.preventDefault();hluz.classList.remove('drag-over');setHlCover(e.dataTransfer.files);});}
  const pav=document.getElementById('feed-profile-avatar');if(pav){pav.addEventListener('dragover',e=>{if(e.dataTransfer.types.includes('Files')){e.preventDefault();pav.classList.add('drag-over');}});pav.addEventListener('dragleave',e=>{if(!pav.contains(e.relatedTarget))pav.classList.remove('drag-over');});pav.addEventListener('drop',e=>{e.preventDefault();pav.classList.remove('drag-over');if(e.dataTransfer.files.length)feedProfileImgChange(e.dataTransfer.files);});}
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
