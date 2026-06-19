/* \u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550
   NASSA STUDIO \u2014 v2.0
   Stato globale
\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550 */

const SUPABASE_URL = 'https://eusxreazwqmwtsdbhhjr.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV1c3hyZWF6d3Ftd3RzZGJoaGpyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE4NDA0NTQsImV4cCI6MjA5NzQxNjQ1NH0.9ekxNnt9wGzEeGexUP_0mZGGsa-YIPZs5zblu-_OECg';
const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

let dbx = null;
let lastStateStr = '';

async function initBackend() {
  const syncBtn = document.getElementById('dbx-sync-btn');
  const loginBtn = document.getElementById('dbx-login-btn');
  
  if (loginBtn) loginBtn.style.display = 'none';
  if (syncBtn) {
    syncBtn.style.display = 'inline-flex';
    syncBtn.textContent = 'Sync DB';
    syncBtn.onclick = () => syncToSupabase(true);
  }

  // Load initial state
  await loadFromSupabase();

  // Supabase Realtime subscription
  supabase.channel('app_state')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'app_state', filter: 'id=eq.1' }, payload => {
      if (payload.new && payload.new.state_json) {
        const globalData = payload.new.state_json;
        const incomingStateStr = JSON.stringify({
          clients: globalData.clients || [],
          feeds: globalData.feeds || {},
          stories: globalData.stories || {},
          highlights: globalData.highlights || {},
          pedPlans: globalData.pedPlans || {}
        });
        
        // Only reload if the state actually differs from our local state
        if (incomingStateStr !== lastStateStr) {
          console.log('Realtime update received!');
          loadFromSupabase(true);
        }
      }
    })
    .subscribe();

  // Auto-save interval with fast debounce
  let saveTimeout = null;
  setInterval(() => {
    const currentStr = JSON.stringify({clients, feeds, stories, highlights, pedPlans});
    if (lastStateStr !== currentStr) {
      lastStateStr = currentStr;
      clearTimeout(saveTimeout);
      saveTimeout = setTimeout(() => {
        syncToSupabase(false);
      }, 1000);
    }
  }, 500);

  // Fetch Dropbox token for background media uploads
  try {
    const res = await fetch('/api/get-dropbox-token');
    if (res.ok) {
      const data = await res.json();
      dbx = new Dropbox.Dropbox({ accessToken: data.access_token });
    } else {
      console.warn('Failed to get Dropbox token. Uploads will fallback to local blobs.');
    }
  } catch (err) {
    console.error('Error fetching Dropbox token:', err);
  }
}

let clients = [];
let feeds = {};
let stories = {};
let highlights = {};

let feedClientIdx = -1;
let feedAccountIdx = -1;
let feedMonth = '';
let storiesClientIdx = -1;
let storiesAccountIdx = -1;
let storiesMonth = '';
let previewClientIdx = -1;
let previewAccountIdx = -1;
let previewMonth = '';

let showAllDates = true;
let showAllCopy  = true;
let currentTab = 'feed';

let feedDragSrc = null;
let stDragSrc = null;

let carouselEditIdx = null;
let carouselTmp = [];
let sbEditIdx = null;
let sbTmpSlides = [];
let hlEditIdx = null;
let hlTmpCover = null;
let linkModalPostIdx = null;
let linkModalSelected = new Set();
let copySelectedItems = new Set();
let feedLinkTab = 'frame';
let storiesLinkTab = 'frame';

let lbItems = [];
let lbIdx = 0;
let lbSlide = 0;
let lbStArr = [];

let pedPlans = {};
let pedFreqDays = new Set([0,2,4]);

let calView = 'month';
let calDate = new Date();

const MONTHS = ['Gennaio','Febbraio','Marzo','Aprile','Maggio','Giugno','Luglio','Agosto','Settembre','Ottobre','Novembre','Dicembre'];
const CUR_YEAR = new Date().getFullYear();
const MONTH_OPTIONS = MONTHS.map(m => m + ' ' + CUR_YEAR);
const GIORNIW = ['Lun','Mar','Mer','Gio','Ven','Sab','Dom'];
const MESI_IT = MONTHS;
const WEEKDAYS_DP = ['L','M','M','G','V','S','D'];
const MONTH_NAMES_DP = MONTHS;

/* \u2500\u2500 KEY HELPERS \u2500\u2500 */
function accountKey(accountId, month) { return accountId + '|||' + month; }
function getAccount(clientIdx, accountIdx) {
  if (clientIdx < 0 || accountIdx < 0) return null;
  return clients[clientIdx]?.accounts?.[accountIdx] || null;
}
function accountId(clientIdx, accountIdx) {
  const acc = getAccount(clientIdx, accountIdx);
  return acc ? acc.id : null;
}
function currentFeedKey() {
  const aid = accountId(feedClientIdx, feedAccountIdx);
  return aid && feedMonth ? accountKey(aid, feedMonth) : null;
}
function currentFeedItems() {
  const k = currentFeedKey(); return k ? (feeds[k] || []) : [];
}
function setFeedItems(arr) {
  const k = currentFeedKey(); if (k) feeds[k] = arr;
}
function currentStoriesKey() {
  const aid = accountId(storiesClientIdx, storiesAccountIdx);
  return aid && storiesMonth ? accountKey(aid, storiesMonth) : null;
}
function currentStoryItems() {
  const k = currentStoriesKey(); return k ? (stories[k] || []) : [];
}
function setStoryItems(arr) {
  const k = currentStoriesKey(); if (k) stories[k] = arr;
}
function currentHighlights() {
  const aid = accountId(storiesClientIdx, storiesAccountIdx);
  return aid ? (highlights[aid] || []) : [];
}
function setHighlights(arr) {
  const aid = accountId(storiesClientIdx, storiesAccountIdx);
  if (aid) highlights[aid] = arr;
}

/* \u2500\u2500 PED bridge \u2500\u2500 */
Object.defineProperty(window, 'currentClientIdx', { get() { return feedClientIdx; }, set(v) { feedClientIdx = v; } });
Object.defineProperty(window, 'currentMonth', { get() { return feedMonth; }, set(v) { feedMonth = v; } });
function pedKey(cn, m) { return cn + '|||' + m; }
function currentPedPlan() {
  if (currentClientIdx < 0 || !currentMonth) return [];
  return pedPlans[pedKey(clients[currentClientIdx].name, currentMonth)] || [];
}
function setCurrentPedPlan(arr) {
  if (currentClientIdx < 0 || !currentMonth) return;
  pedPlans[pedKey(clients[currentClientIdx].name, currentMonth)] = arr;
}
function pedUID() { return Math.random().toString(36).slice(2,9); }

/* \u2500\u2500 TAB SWITCHING \u2500\u2500 */
function switchTab(tab) {
  currentTab = tab;
  const tabs = ['studio','feed','stories','ped','cal','preview'];
  tabs.forEach(t => {
    const te = document.getElementById('tab-'+t); if (te) te.classList.toggle('active', t===tab);
    const pe = document.getElementById('page-'+t); if (pe) pe.classList.toggle('active', t===tab);
  });
  document.getElementById('panel-studio').style.display  = tab==='studio'  ? 'flex' : 'none';
  document.getElementById('panel-feed').style.display    = tab==='feed'    ? 'flex' : 'none';
  document.getElementById('panel-stories').style.display = tab==='stories' ? 'flex' : 'none';
  const iconMap = {studio:['icon-studio','icon-studio2'],feed:['icon-feed'],stories:['icon-stories'],ped:['icon-ped'],cal:['icon-cal'],preview:['icon-preview']};
  ['icon-studio','icon-studio2','icon-feed','icon-stories','icon-ped','icon-cal','icon-preview'].forEach(id=>{const e=document.getElementById(id);if(e)e.classList.remove('active');});
  (iconMap[tab]||[]).forEach(id=>{const e=document.getElementById(id);if(e)e.classList.add('active');});
  if (tab==='studio') renderStudio();
  if (tab==='stories') {
    if (storiesClientIdx < 0 && feedClientIdx >= 0) {
      storiesClientIdx = feedClientIdx; storiesAccountIdx = feedAccountIdx;
      storiesMonth = feedMonth || MONTH_OPTIONS[new Date().getMonth()];
      rebuildStoriesSelects(); renderStoriesMonthPills(); renderStoriesGrid(); updateStoriesHeader();
    } else { renderStoriesGrid(); updateStoriesHeader(); }
  }
  if (tab==='ped') renderPED();
  if (tab==='cal') renderCalendar();
  if (tab==='preview') { syncPreviewSelectors(); renderPreview(); }
}

/* \u2500\u2500 STUDIO \u2500\u2500 */
function addClient() {
  const name = document.getElementById('nc-name').value.trim();
  if (!name) { document.getElementById('nc-name').focus(); return; }
  if (clients.find(c=>c.name.toLowerCase()===name.toLowerCase())) { showToast('Cliente gi\u00e0 presente','warn'); return; }
  const id = 'c_' + Date.now();
  const defaultAccount = { id: 'a_' + Date.now(), name: name, platform: 'Instagram' };
  clients.push({ id, name, pkg: document.getElementById('nc-pkg').value, status: document.getElementById('nc-status').value, revenue: parseFloat(document.getElementById('nc-revenue').value)||0, accounts: [defaultAccount] });
  document.getElementById('nc-name').value = '';
  document.getElementById('nc-revenue').value = '';
  renderStudio(); rebuildAllSelects(); showToast('\u2713 Cliente aggiunto');
}
function addAccount() {
  const ci = parseInt(document.getElementById('na-client').value);
  if (isNaN(ci) || ci < 0) { showToast('Seleziona un cliente','warn'); return; }
  const name = document.getElementById('na-name').value.trim();
  if (!name) { document.getElementById('na-name').focus(); return; }
  const platform = document.getElementById('na-platform').value;
  const id = 'a_' + Date.now();
  clients[ci].accounts.push({ id, name, platform });
  document.getElementById('na-name').value = '';
  renderStudio(); rebuildAllSelects(); showToast('\u2713 Account aggiunto');
}
function removeClient(i) {
  if (!confirm('Rimuovere ' + clients[i].name + ' e tutti i suoi dati?')) return;
  clients[i].accounts.forEach(acc => {
    MONTH_OPTIONS.forEach(m => { delete feeds[accountKey(acc.id,m)]; delete stories[accountKey(acc.id,m)]; });
    delete highlights[acc.id];
  });
  if (feedClientIdx === i) { feedClientIdx=-1; feedAccountIdx=-1; feedMonth=''; renderFeedGrid(); }
  else if (feedClientIdx > i) feedClientIdx--;
  clients.splice(i,1);
  renderStudio(); rebuildAllSelects();
}
function openClientFeed(ci) {
  feedClientIdx = ci; feedAccountIdx = clients[ci].accounts.length > 0 ? 0 : -1;
  if (!feedMonth) feedMonth = MONTH_OPTIONS[new Date().getMonth()];
  switchTab('feed'); rebuildFeedSelects(); renderFeedMonthPills(); renderFeedGrid(); updateFeedHeader();
}
function renderStudio() {
  const active = clients.filter(c=>c.status==='Attivo');
  const totalRev = active.reduce((s,c)=>s+c.revenue,0);
  const totalAccounts = clients.reduce((s,c)=>s+(c.accounts?.length||0),0);
  const el = v => document.getElementById(v);
  if(el('kpi-revenue')) el('kpi-revenue').textContent = '\u20ac '+totalRev.toLocaleString('it-IT');
  if(el('kpi-active'))  el('kpi-active').textContent  = active.length;
  if(el('kpi-accounts'))el('kpi-accounts').textContent= totalAccounts;
  if(el('kpi-rev-sub')) el('kpi-rev-sub').textContent = 'da '+active.length+(active.length===1?' cliente attivo':' clienti attivi');
  const countTxt = clients.length+' client'+(clients.length===1?'e':'i');
  if(el('studio-count'))  el('studio-count').textContent  = countTxt;
  if(el('studio-count2')) el('studio-count2').textContent = countTxt;
  const tbody = document.getElementById('clients-tbody'); if (!tbody) return;
  tbody.innerHTML = '';
  if (!clients.length) {
    tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;color:var(--text-3);padding:24px;font-size:12px;">Nessun cliente. Aggiungine uno dal pannello.</td></tr>'; return;
  }
  clients.forEach((c,i) => {
    const dotCls = {Attivo:'green','In onboarding':'blue','In pausa':'amber',Perso:'red'}[c.status]||'green';
    const accs = c.accounts||[];
    const accsHtml = accs.length===0 ? '<span style="color:var(--text-3);font-size:11px;">\u2014</span>'
      : accs.length===1 && accs[0].name===c.name ? `<span style="color:var(--text-3);font-size:11px;">Mono \u00b7 ${accs[0].platform}</span>`
      : accs.map(a=>`<span class="feed-chip" onclick="openAccountFeed(${i},'${a.id}')" title="${a.platform}">${a.name}</span>`).join(' ');
    const tr = document.createElement('tr');
    tr.innerHTML = `<td style="font-weight:500;">${c.name}</td><td style="font-size:11px;">${accsHtml}</td><td><span class="pkg-badge">${c.pkg}</span></td><td><span class="status-dot"><span class="dot ${dotCls}"></span>${c.status}</span></td><td class="muted">\u20ac ${c.revenue.toLocaleString('it-IT')}</td><td><div class="tr-actions"><button class="btn sm danger" onclick="removeClient(${i})">Rimuovi</button></div></td>`;
    tbody.appendChild(tr);
  });
}
function openAccountFeed(ci, aid) {
  feedClientIdx = ci; feedAccountIdx = clients[ci].accounts.findIndex(a=>a.id===aid);
  if (!feedMonth) feedMonth = MONTH_OPTIONS[new Date().getMonth()];
  switchTab('feed'); rebuildFeedSelects(); renderFeedMonthPills(); renderFeedGrid(); updateFeedHeader();
}

/* \u2500\u2500 SELECTS \u2500\u2500 */
function rebuildAllSelects() { rebuildFeedSelects(); rebuildStoriesSelects(); rebuildPreviewSelects(); rebuildStudioAccountSelect(); }
function populateClientSelect(selId, currentCi) {
  const sel = document.getElementById(selId); if (!sel) return;
  sel.innerHTML = '<option value="">\u2014 Cliente \u2014</option>';
  clients.forEach((c,i)=>{const o=document.createElement('option');o.value=i;o.textContent=c.name;sel.appendChild(o);});
  if (currentCi>=0) sel.value=currentCi;
}
function populateAccountSelect(selId, clientIdx, currentAi) {
  const sel = document.getElementById(selId); if (!sel) return;
  if (clientIdx<0 || !clients[clientIdx]?.accounts?.length) { sel.style.display='none'; return; }
  sel.style.display='';
  sel.innerHTML = '<option value="">\u2014 Account \u2014</option>';
  clients[clientIdx].accounts.forEach((a,i)=>{const o=document.createElement('option');o.value=i;o.textContent=a.name+' ('+a.platform+')';sel.appendChild(o);});
  if (currentAi>=0) sel.value=currentAi;
}
function rebuildFeedSelects() {
  populateClientSelect('feed-client-sel', feedClientIdx);
  populateAccountSelect('feed-account-sel', feedClientIdx, feedAccountIdx);
  const sel = document.getElementById('feed-account-sel');
  if (sel) sel.classList.toggle('sel-highlight', feedAccountIdx>=0);
}
function rebuildStoriesSelects() {
  populateClientSelect('stories-client-sel', storiesClientIdx);
  populateAccountSelect('stories-account-sel', storiesClientIdx, storiesAccountIdx);
}
function rebuildPreviewSelects() {
  populateClientSelect('preview-client-sel', previewClientIdx);
  populateAccountSelect('preview-account-sel', previewClientIdx, previewAccountIdx);
  const msel = document.getElementById('preview-month-sel'); if (!msel) return;
  if (previewAccountIdx<0) { msel.style.display='none'; return; }
  msel.style.display='';
  msel.innerHTML='';
  MONTH_OPTIONS.forEach(m=>{const o=document.createElement('option');o.value=m;o.textContent=m;msel.appendChild(o);});
  if (previewMonth) msel.value=previewMonth;
}
function rebuildStudioAccountSelect() {
  const sel = document.getElementById('na-client'); if (!sel) return;
  sel.innerHTML = '<option value="">\u2014 seleziona \u2014</option>';
  clients.forEach((c,i)=>{const o=document.createElement('option');o.value=i;o.textContent=c.name;sel.appendChild(o);});
}

/* \u2500\u2500 FEED SELECTORS \u2500\u2500 */
function onFeedClientChange() {
  const v = document.getElementById('feed-client-sel').value;
  feedClientIdx = v==='' ? -1 : parseInt(v); feedAccountIdx = -1;
  const accs = feedClientIdx>=0 ? (clients[feedClientIdx]?.accounts||[]) : [];
  if (accs.length === 1) { feedAccountIdx = 0; const sel=document.getElementById('feed-account-sel'); if(sel)sel.style.display='none'; }
  else if (accs.length > 1) { populateAccountSelect('feed-account-sel', feedClientIdx, -1); }
  else { const sel=document.getElementById('feed-account-sel'); if(sel)sel.style.display='none'; }
  if (!feedMonth) feedMonth = MONTH_OPTIONS[new Date().getMonth()];
  renderFeedMonthPills(); renderFeedGrid(); updateFeedHeader();
}
function onFeedAccountChange() {
  const v = document.getElementById('feed-account-sel').value;
  feedAccountIdx = v==='' ? -1 : parseInt(v);
  if (!feedMonth) feedMonth = MONTH_OPTIONS[new Date().getMonth()];
  renderFeedMonthPills(); renderFeedGrid(); updateFeedHeader();
}
function renderFeedMonthPills() {
  const c = document.getElementById('feed-month-pills'); if (!c) return;
  c.innerHTML = '';
  if (feedAccountIdx<0) return;
  MONTH_OPTIONS.forEach(m=>{
    const p=document.createElement('button'); p.className='month-pill'+(m===feedMonth?' active':'');
    p.textContent=m.slice(0,3)+' '+m.split(' ')[1];
    p.onclick=()=>{feedMonth=m;renderFeedMonthPills();renderFeedGrid();updateFeedHeader();};
    c.appendChild(p);
  });
}

/* \u2500\u2500 STORIES SELECTORS \u2500\u2500 */
function onStoriesClientChange() {
  const v = document.getElementById('stories-client-sel').value;
  storiesClientIdx = v==='' ? -1 : parseInt(v); storiesAccountIdx = -1;
  const accs = storiesClientIdx>=0 ? (clients[storiesClientIdx]?.accounts||[]) : [];
  if (accs.length === 1) { storiesAccountIdx = 0; const sel=document.getElementById('stories-account-sel'); if(sel)sel.style.display='none'; }
  else if (accs.length > 1) { populateAccountSelect('stories-account-sel', storiesClientIdx, -1); }
  else { const sel=document.getElementById('stories-account-sel'); if(sel)sel.style.display='none'; }
  if (!storiesMonth) storiesMonth = MONTH_OPTIONS[new Date().getMonth()];
  renderStoriesMonthPills(); renderStoriesGrid(); updateStoriesHeader();
}
function onStoriesAccountChange() {
  const v = document.getElementById('stories-account-sel').value;
  storiesAccountIdx = v==='' ? -1 : parseInt(v);
  if (!storiesMonth) storiesMonth = MONTH_OPTIONS[new Date().getMonth()];
  renderStoriesMonthPills(); renderStoriesGrid(); updateStoriesHeader();
}
function renderStoriesMonthPills() {
  const c = document.getElementById('stories-month-pills'); if (!c) return;
  c.innerHTML = '';
  if (storiesAccountIdx<0) return;
  MONTH_OPTIONS.forEach(m=>{
    const p=document.createElement('button'); p.className='month-pill'+(m===storiesMonth?' active':'');
    p.textContent=m.slice(0,3)+' '+m.split(' ')[1];
    p.onclick=()=>{storiesMonth=m;renderStoriesMonthPills();renderStoriesGrid();updateStoriesHeader();};
    c.appendChild(p);
  });
}

/* \u2500\u2500 PREVIEW SELECTORS \u2500\u2500 */
function syncPreviewSelectors() {
  if (previewClientIdx<0 && feedClientIdx>=0) { previewClientIdx=feedClientIdx; previewAccountIdx=feedAccountIdx; previewMonth=feedMonth; }
  rebuildPreviewSelects();
}
function onPreviewClientChange() {
  const v = document.getElementById('preview-client-sel').value;
  previewClientIdx = v==='' ? -1 : parseInt(v); previewAccountIdx = -1;
  populateAccountSelect('preview-account-sel', previewClientIdx, -1);
  previewMonth = MONTH_OPTIONS[new Date().getMonth()];
  rebuildPreviewSelects(); renderPreview();
}
function onPreviewAccountChange() {
  const v = document.getElementById('preview-account-sel').value;
  previewAccountIdx = v==='' ? -1 : parseInt(v);
  previewMonth = MONTH_OPTIONS[new Date().getMonth()];
  rebuildPreviewSelects(); renderPreview();
}

/* \u2500\u2500 MEDIA UTILS \u2500\u2500 */
function detectType(file_or_url) {
  const s = typeof file_or_url === 'string' ? file_or_url : (file_or_url.name||'');
  if (/\.(mp4|mov|webm|avi|m4v)/i.test(s)) return 'video';
  if (typeof file_or_url !== 'string' && file_or_url.type?.startsWith('video')) return 'video';
  if (typeof file_or_url === 'string' && (file_or_url.includes('frame.io')||file_or_url.includes('f.io'))) return 'video';
  return 'image';
}
function makeMedia(url, type, opts={}) {
  if (!url) return null;
  if (type === 'video') {
    const v = document.createElement('video');
    v.src=url; v.muted=true; v.loop=true; v.playsInline=true; v.preload='metadata';
    v.style.cssText='pointer-events:none;background:#111;width:100%;height:100%;object-fit:cover;display:block;';
    if (opts.autoplay) v.autoplay=true;
    if (opts.controls) { v.controls=true; v.style.pointerEvents='auto'; }
    return v;
  }
  const img = document.createElement('img'); img.src=url; img.alt=''; return img;
}
function needsReloadPh(icon, name) {
  const ph = document.createElement('div'); ph.className='needs-reload-ph';
  ph.innerHTML=`<div class="nr-icon">${icon}</div><div class="nr-name">${name||'file'}</div><div class="nr-label">ricarica media</div>`;
  return ph;
}

/* \u2500\u2500 FEED FILES \u2500\u2500 */
async function queueFeedFiles(files) {
  if (feedAccountIdx<0) { showToast('Seleziona cliente e account','warn'); return; }
  const clientName = clients[feedClientIdx].name;
  const items = currentFeedItems();
  document.getElementById('dbx-loader').style.display = 'flex';
  document.getElementById('dbx-loader-text').textContent = 'Upload in corso...';
  for(let f of Array.from(files)){
    const url = await uploadMediaToDropbox(f, clientName);
    items.push({type:detectType(f)==='video'?'video':'pending',url:url,name:f.name,date:'',showDate:false,copy:'',linkedStories:[],slides:[],mimeType:f.type});
  }
  document.getElementById('dbx-loader').style.display = 'none';
  setFeedItems(items); refreshFeed();
  if(typeof syncToSupabase === 'function') syncToSupabase(false);
}
function setFeedLinkTab(tab) {
  feedLinkTab=tab;
  document.getElementById('fl-tab-frame').classList.toggle('active',tab==='frame');
  document.getElementById('fl-tab-other').classList.toggle('active',tab==='other');
  document.getElementById('feed-link-inp').placeholder = tab==='frame' ? 'Incolla link Frame.io\u2026' : 'Incolla URL diretto\u2026';
}
function addFeedLink() {
  if (feedAccountIdx<0) { showToast('Seleziona cliente e account','warn'); return; }
  const raw = document.getElementById('feed-link-inp').value.trim(); if (!raw) return;
  const type = detectType(raw);
  const name = raw.split('/').pop().split('?')[0]||'link';
  const items = currentFeedItems();
  items.push({type,url:raw,externalUrl:raw,isExternalLink:true,linkSource:feedLinkTab,name,date:'',showDate:false,copy:'',linkedStories:[],slides:[]});
  setFeedItems(items); document.getElementById('feed-link-inp').value=''; refreshFeed();
  showToast('\u2713 Link aggiunto');
}

/* \u2500\u2500 STORY FILES \u2500\u2500 */
async function queueStoryFiles(files) {
  if (storiesAccountIdx<0) { showToast('Seleziona cliente e account','warn'); return; }
  const clientName = clients[storiesClientIdx].name;
  const arr = currentStoryItems();
  document.getElementById('dbx-loader').style.display = 'flex';
  document.getElementById('dbx-loader-text').textContent = 'Upload in corso...';
  for(let f of Array.from(files)){
    const url = await uploadMediaToDropbox(f, clientName);
    arr.push({type:detectType(f),url:url,name:f.name,date:'',note:'',isStoryboard:false,slides:[]});
  }
  document.getElementById('dbx-loader').style.display = 'none';
  setStoryItems(arr); refreshStories();
  if(typeof syncToDropbox === 'function') syncToDropbox(false);
}
function setStoriesLinkTab(tab) {
  storiesLinkTab=tab;
  document.getElementById('sl-tab-frame').classList.toggle('active',tab==='frame');
  document.getElementById('sl-tab-other').classList.toggle('active',tab==='other');
  document.getElementById('stories-link-inp').placeholder = tab==='frame' ? 'Incolla link Frame.io\u2026' : 'Incolla URL diretto\u2026';
}
function addStoryLink() {
  if (storiesAccountIdx<0) { showToast('Seleziona cliente e account','warn'); return; }
  const raw = document.getElementById('stories-link-inp').value.trim(); if (!raw) return;
  const type = detectType(raw);
  const name = raw.split('/').pop().split('?')[0]||'link';
  const arr = currentStoryItems();
  arr.push({type,url:raw,externalUrl:raw,isExternalLink:true,linkSource:storiesLinkTab,name,date:'',note:'',isStoryboard:false,slides:[]});
  setStoryItems(arr); document.getElementById('stories-link-inp').value=''; refreshStories();
  showToast('\u2713 Link story aggiunto');
}

/* \u2500\u2500 FEED GRID \u2500\u2500 */
function refreshFeed() { renderFeedGrid(); updateFeedStats(); updateFeedHeader(); }
function renderFeedGrid() {
  const grid = document.getElementById('feed-grid'); if (!grid) return;
  grid.innerHTML = '';
  const items = currentFeedItems();
  if (feedAccountIdx<0) {
    const em=document.createElement('div'); em.className='feed-empty';
    em.innerHTML='<span class="fe-icon">\ud83d\udc46</span><p>Seleziona <strong>cliente</strong> \u2192 <strong>account</strong> \u2192 <strong>mese</strong><br>per costruire il feed.</p>';
    grid.appendChild(em); return;
  }
  const total = Math.max(items.length+1,9);
  for (let i=0;i<total;i++) {
    const wrap=document.createElement('div'); wrap.className='cell-wrap';
    const cell=document.createElement('div'); cell.className='feed-cell';
    if (i<items.length) {
      const item=items[i], idx=i;
      if (item.type==='pending') {
        cell.classList.add('empty-slot'); cell.style.overflow='hidden';
        if(item.url){const bg=document.createElement('img');bg.className='picker-bg';bg.src=item.url;cell.appendChild(bg);}
        const pk=document.createElement('div'); pk.className='type-picker';
        const lbl=document.createElement('div'); lbl.className='type-picker-lbl'; lbl.textContent='Tipo post'; pk.appendChild(lbl);
        const btns=document.createElement('div'); btns.className='type-btns';
        [['\ud83d\uddbc','Foto','image'],['\u25b6','Reel','video'],['\u274f\u274f','Caros.','carousel']].forEach(([icon,label,type])=>{
          const b=document.createElement('button'); b.className='type-btn';
          b.innerHTML=`<span class="ti">${icon}</span>${label}`; b.onclick=()=>setFeedItemType(idx,type); btns.appendChild(b);
        });
        pk.appendChild(btns);
        const rm=document.createElement('button'); rm.className='picker-rm'; rm.textContent='\u2715 rimuovi'; rm.onclick=()=>removeFeedItem(idx); pk.appendChild(rm);
        cell.appendChild(pk); wrap.appendChild(cell);
      } else {
        const coverUrl=item.type==='carousel'&&item.slides?.length?item.slides[0].url:item.url;
        if (item.needsReload&&!item.url) {
          cell.appendChild(needsReloadPh(item.type==='video'?'\u25b6':item.type==='carousel'?'\u274f\u274f':'\ud83d\uddbc',item.name));
        } else if (item.type==='video') {
          const v=makeMedia(item.url,'video');
          if(v){v.onerror=()=>{cell.appendChild(needsReloadPh('\u25b6',item.name));};
          cell.addEventListener('mouseenter',()=>v.play().catch(()=>{}));
          cell.addEventListener('mouseleave',()=>{v.pause();v.currentTime=0;});
          cell.appendChild(v);}
        } else {
          const img=makeMedia(coverUrl,'image');
          if(img){img.onerror=()=>{img.style.display='none';cell.appendChild(needsReloadPh('\ud83d\uddbc',item.name));};cell.appendChild(img);}
        }
        cell.draggable=true;
        cell.addEventListener('dragstart',e=>{feedDragSrc=idx;e.dataTransfer.effectAllowed='move';setTimeout(()=>cell.classList.add('dragging'),0);});
        cell.addEventListener('dragover',e=>{e.preventDefault();if(feedDragSrc!==null&&feedDragSrc!==idx){document.querySelectorAll('.feed-cell').forEach(c=>c.classList.remove('drag-over-cell'));cell.classList.add('drag-over-cell');}});
        cell.addEventListener('drop',e=>{e.preventDefault();if(feedDragSrc!==null&&feedDragSrc!==idx){const arr=currentFeedItems();const tmp=arr[feedDragSrc];arr[feedDragSrc]=arr[idx];arr[idx]=tmp;setFeedItems(arr);}feedDragSrc=null;renderFeedGrid();});
        cell.addEventListener('dragend',()=>{feedDragSrc=null;document.querySelectorAll('.feed-cell').forEach(c=>c.classList.remove('dragging','drag-over-cell'));});
        const handle=document.createElement('div');handle.className='drag-handle';handle.innerHTML='\u283f';cell.appendChild(handle);
        const num=document.createElement('span');num.className='cell-num';num.textContent=i+1;cell.appendChild(num);
        const badge=document.createElement('span');badge.className='cell-badge '+item.type;
        badge.textContent=item.type==='video'?'\u25b6 REEL':item.type==='image'?'IMG':'\u274f\u274f '+(item.slides?.length||0);cell.appendChild(badge);
        if (item.isExternalLink){const d=document.createElement('div');d.className='cell-url-dot';d.title=(item.linkSource==='frame'?'Frame.io':'Link')+': '+(item.externalUrl||'');cell.appendChild(d);}
        if ((item.linkedStories||[]).length>0){const lb=document.createElement('div');lb.className='ls-badge-cell';lb.textContent='\ud83d\udcf1 '+item.linkedStories.length;cell.appendChild(lb);}
        if (item.type==='carousel'&&item.slides?.length>1){const de=document.createElement('div');de.className='carousel-dots';item.slides.slice(0,5).forEach((_,si)=>{const d=document.createElement('div');d.className='carousel-dot'+(si===0?' active':'');de.appendChild(d);});cell.appendChild(de);}
        const showDate=showAllDates&&item.showDate;
        const db=document.createElement('div');db.className='date-bar'+(showDate?'':' hidden-bar');
        const di=document.createElement('input');di.className='date-input';di.type='text';di.value=item.date||'';di.placeholder='es. Lun 7 luglio';
        di.onclick=e=>{e.stopPropagation();openDatePicker(idx,cell);};
        di.oninput=e=>{currentFeedItems()[idx].date=e.target.value;};
        const dt=document.createElement('button');dt.className='date-toggle';dt.textContent=item.showDate?'\u2713':'\u2715';
        dt.onclick=e=>{e.stopPropagation();currentFeedItems()[idx].showDate=!currentFeedItems()[idx].showDate;renderFeedGrid();};
        db.appendChild(di);db.appendChild(dt);cell.appendChild(db);
        const dpTrigger=document.createElement('button');
        dpTrigger.className='date-add-btn dp-trigger-btn';
        dpTrigger.textContent = item.date ? '\ud83d\udcc5 '+item.date.split(' ').slice(1).join(' ') : '\ud83d\udcc5 data';
        dpTrigger.onclick=e=>{e.stopPropagation();openDatePicker(idx,cell);};
        cell.appendChild(dpTrigger);
        const ov=document.createElement('div');ov.className='cell-overlay';
        if (item.type==='carousel'){const eb=document.createElement('button');eb.className='ov-btn';eb.innerHTML='\u270f\ufe0f Slide';eb.onclick=e=>{e.stopPropagation();openCarouselModal(idx);};ov.appendChild(eb);}
        const lsb=document.createElement('button');lsb.className='ov-btn';lsb.innerHTML='\ud83d\udcf1 '+((item.linkedStories||[]).length>0?'Stories ('+item.linkedStories.length+')':'Collega stories');lsb.onclick=e=>{e.stopPropagation();openLinkStoriesModal(idx);};ov.appendChild(lsb);
        const del=document.createElement('button');del.className='ov-btn';del.innerHTML='\ud83d\uddd1 Rimuovi';del.onclick=e=>{e.stopPropagation();removeFeedItem(idx);};ov.appendChild(del);
        cell.appendChild(ov); wrap.appendChild(cell);
        const cp=document.createElement('div');cp.className='copy-panel';cp.style.display=showAllCopy?'':'none';
        const cl=document.createElement('div');cl.className='copy-label';cl.textContent='Caption';
        const ct=document.createElement('textarea');ct.placeholder='Scrivi la caption\u2026';ct.value=item.copy||'';
        ct.oninput=e=>{currentFeedItems()[idx].copy=e.target.value;};
        cp.appendChild(cl);cp.appendChild(ct);wrap.appendChild(cp);
      }
    } else if (i===items.length) {
      cell.classList.add('empty-slot'); addEmptyFeedListeners(cell);
      const sp=document.createElement('span');sp.textContent='+ aggiungi';cell.appendChild(sp);wrap.appendChild(cell);
    } else {
      cell.classList.add('empty-slot'); addEmptyFeedListeners(cell); wrap.appendChild(cell);
    }
    grid.appendChild(wrap);
  }
}
function addEmptyFeedListeners(cell) {
  cell.addEventListener('dragover',e=>{if(feedDragSrc!==null)return;if(e.dataTransfer.types.includes('Files')){e.preventDefault();cell.classList.add('file-hover');}});
  cell.addEventListener('dragleave',()=>cell.classList.remove('file-hover'));
  cell.addEventListener('drop',e=>{cell.classList.remove('file-hover');if(feedDragSrc!==null)return;e.preventDefault();if(e.dataTransfer.files.length)queueFeedFiles(e.dataTransfer.files);});
}
function setFeedItemType(idx,type) {
  const items=currentFeedItems(); items[idx].type=type;
  if (type==='carousel'&&!items[idx].slides?.length) items[idx].slides=[{url:items[idx].url,name:items[idx].name}];
  setFeedItems(items); refreshFeed();
  if (type==='carousel') openCarouselModal(idx);
}
function removeFeedItem(i) {
  const items=currentFeedItems();
  if (!items[i].isExternalLink&&items[i].url&&items[i].url.startsWith('blob:')) URL.revokeObjectURL(items[i].url);
  (items[i].slides||[]).forEach(s=>{if(s.url&&s.url.startsWith('blob:'))URL.revokeObjectURL(s.url);});
  items.splice(i,1); setFeedItems(items); refreshFeed();
}
function updateFeedStats() {
  const f=currentFeedItems().filter(i=>i.type!=='pending');
  const s=currentStoryItems();
  const el=id=>document.getElementById(id);
  if(el('stat-tot'))el('stat-tot').textContent=f.length;
  if(el('stat-vid'))el('stat-vid').textContent=f.filter(i=>i.type==='video').length;
  if(el('stat-car'))el('stat-car').textContent=f.filter(i=>i.type==='carousel').length;
  if(el('stat-stories'))el('stat-stories').textContent=s.length;
  if(el('stat-stories-sb'))el('stat-stories-sb').textContent=s.filter(x=>x.isStoryboard).length;
  const aid=accountId(feedClientIdx,feedAccountIdx);
  if(el('stat-hl'))el('stat-hl').textContent=aid?(highlights[aid]||[]).length:0;
  if(el('feed-meta'))el('feed-meta').textContent=f.length+' post';
  const status=feedAccountIdx<0?'Seleziona cliente e account.':f.length===0?'Nessun contenuto per questo mese.':f.length+' contenut'+(f.length===1?'o pronti.':'i pronti.');
  if(el('feed-status'))el('feed-status').textContent=status;
}
function updateFeedHeader() {
  const acc=getAccount(feedClientIdx,feedAccountIdx);
  const cn=acc?clients[feedClientIdx].name+' \u2014 '+acc.name:'Feed Preview';
  const mn=feedMonth;
  const el=id=>document.getElementById(id);
  if(el('feed-title'))el('feed-title').textContent=cn+(mn?' \u00b7 '+mn:'');
  if(el('feed-tag'))el('feed-tag').textContent=mn?mn+' \u00b7 4:5':'1080\u00d71350 \u00b7 4:5';
  const pill=el('ctx-pill');
  if(pill){if(acc){pill.textContent=clients[feedClientIdx].name+' \u00b7 '+(mn?mn.slice(0,3):'');pill.style.display='flex';}else pill.style.display='none';}
  updateFeedStats();
}

/* \u2500\u2500 TOGGLE \u2500\u2500 */
function toggleAllDates(){
  showAllDates=!showAllDates;
  const b=document.getElementById('toggle-dates'),c=document.getElementById('toggle-dates-chip');
  if(b)b.classList.toggle('off',!showAllDates);
  if(c){c.textContent=showAllDates?'ON':'OFF';c.classList.toggle('off',!showAllDates);}
  renderFeedGrid();
}
function toggleAllCopy(){
  showAllCopy=!showAllCopy;
  const b=document.getElementById('toggle-copy'),c=document.getElementById('toggle-copy-chip');
  if(b)b.classList.toggle('off',!showAllCopy);
  if(c){c.textContent=showAllCopy?'ON':'OFF';c.classList.toggle('off',!showAllCopy);}
  renderFeedGrid();
}

/* \u2500\u2500 CAROUSEL MODAL \u2500\u2500 */
function openCarouselModal(idx){ carouselEditIdx=idx; const item=currentFeedItems()[idx]; carouselTmp=(item.slides||[]).map(s=>({...s})); renderCThumbs(); openModal('carousel-modal'); }
function saveCarousel(){
  if(!carouselTmp.length){showToast('Aggiungi almeno una slide','warn');return;}
  const items=currentFeedItems(); items[carouselEditIdx].slides=carouselTmp.map(s=>({...s})); items[carouselEditIdx].url=carouselTmp[0].url||'';
  setFeedItems(items); closeModal('carousel-modal'); refreshFeed();
}
async function addCarouselFiles(files){ 
  const clientName = feedClientIdx >= 0 ? clients[feedClientIdx].name : 'General';
  document.getElementById('dbx-loader').style.display = 'flex';
  document.getElementById('dbx-loader-text').textContent = 'Upload in corso...';
  for(let f of Array.from(files)){
    if(f.type.startsWith('image')){
      const url = await uploadMediaToDropbox(f, clientName);
      carouselTmp.push({url:url,name:f.name});
    }
  }
  document.getElementById('dbx-loader').style.display = 'none';
  renderCThumbs(); 
}
function removeCSlide(i){ if(carouselTmp[i].url.startsWith('blob:'))URL.revokeObjectURL(carouselTmp[i].url); carouselTmp.splice(i,1); renderCThumbs(); }
function renderCThumbs(){
  const c=document.getElementById('c-thumbs');if(!c)return;c.innerHTML='';
  carouselTmp.forEach((s,i)=>{
    const th=document.createElement('div');th.className='c-thumb';
    const img=document.createElement('img');img.src=s.url;img.alt='';
    const del=document.createElement('button');del.className='c-thumb-del';del.textContent='\u2715';del.onclick=()=>removeCSlide(i);
    const num=document.createElement('span');num.className='c-thumb-num';num.textContent=i+1;
    th.appendChild(img);th.appendChild(del);th.appendChild(num);c.appendChild(th);
  });
}

/* \u2500\u2500 STORIES GRID \u2500\u2500 */
function refreshStories(){ renderStoriesGrid(); updateStoriesStats(); }
function updateStoriesStats(){
  const s=currentStoryItems(); const aid=accountId(storiesClientIdx,storiesAccountIdx);
  const el=id=>document.getElementById(id);
  if(el('stat-st-tot'))el('stat-st-tot').textContent=s.length;
  if(el('stat-st-sb'))el('stat-st-sb').textContent=s.filter(x=>x.isStoryboard).length;
  if(el('stat-st-hl'))el('stat-st-hl').textContent=aid?(highlights[aid]||[]).length:0;
  if(el('stories-meta'))el('stories-meta').textContent=s.length+' stor'+(s.length===1?'y':'ies');
}
function updateStoriesHeader(){
  const acc=getAccount(storiesClientIdx,storiesAccountIdx);
  const cn=acc?clients[storiesClientIdx].name+' \u2014 '+acc.name:'Stories';
  const el=id=>document.getElementById(id);
  if(el('stories-title'))el('stories-title').textContent=cn+(storiesMonth?' \u00b7 '+storiesMonth:'');
  updateStoriesStats();
}
function renderStoriesGrid(){
  const grid=document.getElementById('stories-grid'); const hlRow=document.getElementById('hl-row');
  if(!grid||!hlRow)return; grid.innerHTML=''; hlRow.innerHTML='';
  const arr=currentStoryItems();
  if(storiesAccountIdx<0){
    const em=document.createElement('div');em.style.cssText='grid-column:1/-1;text-align:center;padding:40px 0;color:var(--text-3);font-size:12px;';
    em.textContent='\ud83d\udcf1 Seleziona cliente e account per gestire le stories.'; grid.appendChild(em);
  } else {
    const total=Math.max(arr.length+1,8);
    for(let i=0;i<total;i++){
      const wrap=document.createElement('div');wrap.className='story-wrap';
      const cell=document.createElement('div');cell.className='story-cell';
      if(i<arr.length){
        const st=arr[i],idx=i;
        if(st.isStoryboard){
          const coverUrl=st.slides?.[0]?.url||'';
          if(coverUrl){const img=document.createElement('img');img.src=coverUrl;img.alt='';cell.appendChild(img);}
          else{const ph=document.createElement('div');ph.style.cssText='position:absolute;inset:0;background:#1a1a2e;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:6px;';ph.innerHTML='<span style="font-size:22px;">\ud83c\udfac</span><span style="font-size:9px;color:rgba(255,255,255,.5);">'+(st.slides?.length||0)+' slide</span>';cell.appendChild(ph);}
          const b=document.createElement('span');b.className='story-badge storyboard';b.textContent='\ud83c\udfac '+(st.slides?.length||0);cell.appendChild(b);
        } else if(st.type==='video'){
          const v=makeMedia(st.url,'video');
          if(v){cell.addEventListener('mouseenter',()=>v.play().catch(()=>{}));cell.addEventListener('mouseleave',()=>{v.pause();v.currentTime=0;});cell.appendChild(v);}
          const b=document.createElement('span');b.className='story-badge video';b.textContent='\u25b6';cell.appendChild(b);
        } else if(st.url){
          const img=document.createElement('img');img.src=st.url;img.alt='';cell.appendChild(img);
        }
        const num=document.createElement('span');num.className='story-num';num.textContent=i+1;cell.appendChild(num);
        const dh=document.createElement('div');dh.className='story-drag-h';dh.innerHTML='\u283f';cell.appendChild(dh);
        cell.draggable=true;
        cell.addEventListener('dragstart',e=>{stDragSrc=idx;e.dataTransfer.effectAllowed='move';setTimeout(()=>cell.classList.add('dragging'),0);});
        cell.addEventListener('dragover',e=>{e.preventDefault();if(stDragSrc!==null&&stDragSrc!==idx){document.querySelectorAll('.story-cell').forEach(c=>c.classList.remove('drag-over-st'));cell.classList.add('drag-over-st');}});
        cell.addEventListener('drop',e=>{e.preventDefault();if(stDragSrc!==null&&stDragSrc!==idx){const a=currentStoryItems();const tmp=a[stDragSrc];a[stDragSrc]=a[idx];a[idx]=tmp;setStoryItems(a);}stDragSrc=null;renderStoriesGrid();});
        cell.addEventListener('dragend',()=>{stDragSrc=null;document.querySelectorAll('.story-cell').forEach(c=>c.classList.remove('dragging','drag-over-st'));});
        const ov=document.createElement('div');ov.className='story-overlay';
        if(st.isStoryboard){const eb=document.createElement('button');eb.className='ov-btn';eb.innerHTML='\u270f\ufe0f Modifica';eb.onclick=e=>{e.stopPropagation();openStoryboardModal(idx);};ov.appendChild(eb);}
        const del=document.createElement('button');del.className='ov-btn';del.innerHTML='\ud83d\uddd1 Rimuovi';del.onclick=e=>{e.stopPropagation();removeStoryItem(idx);};ov.appendChild(del);
        cell.appendChild(ov); wrap.appendChild(cell);
        const info=document.createElement('div');info.className='story-info';
        const di=document.createElement('input');di.className='story-date-inp';di.type='text';di.value=st.date||'';di.placeholder='Data\u2026';di.oninput=e=>{currentStoryItems()[idx].date=e.target.value;};
        const ni=document.createElement('textarea');ni.className='story-note-inp';ni.value=st.note||'';ni.placeholder='Nota regia\u2026';ni.oninput=e=>{currentStoryItems()[idx].note=e.target.value;};
        info.appendChild(di);info.appendChild(ni);wrap.appendChild(info);
      } else if(i===arr.length){
        cell.classList.add('empty-story');addEmptyStoryListeners(cell);
        const sp=document.createElement('span');sp.textContent='+ aggiungi';cell.appendChild(sp);wrap.appendChild(cell);
      } else{cell.classList.add('empty-story');addEmptyStoryListeners(cell);wrap.appendChild(cell);}
      grid.appendChild(wrap);
    }
  }
  const hls=currentHighlights();
  hls.forEach((h,i)=>{
    const hw=document.createElement('div');hw.className='hl-wrap';hw.onclick=()=>openHighlightModal(i);
    const hc=document.createElement('div');hc.className='hl-circle';
    if(h.coverUrl){const img=document.createElement('img');img.src=h.coverUrl;img.alt='';hc.appendChild(img);}
    const hn=document.createElement('div');hn.className='hl-name';hn.textContent=h.name;
    hw.appendChild(hc);hw.appendChild(hn);hlRow.appendChild(hw);
  });
  const addHl=document.createElement('div');addHl.className='hl-add';addHl.title='Aggiungi evidenza';addHl.innerHTML='+';addHl.onclick=()=>openHighlightModal(-1);hlRow.appendChild(addHl);
}
function addEmptyStoryListeners(cell){
  cell.addEventListener('dragover',e=>{if(stDragSrc!==null)return;if(e.dataTransfer.types.includes('Files')){e.preventDefault();cell.classList.add('file-hover');}});
  cell.addEventListener('dragleave',()=>cell.classList.remove('file-hover'));
  cell.addEventListener('drop',e=>{cell.classList.remove('file-hover');if(stDragSrc!==null)return;e.preventDefault();if(e.dataTransfer.files.length)queueStoryFiles(e.dataTransfer.files);});
}
function removeStoryItem(i){ const arr=currentStoryItems(); if(!arr[i].isExternalLink&&arr[i].url?.startsWith('blob:'))URL.revokeObjectURL(arr[i].url); arr.splice(i,1); setStoryItems(arr); refreshStories(); }

/* \u2500\u2500 STORYBOARD MODAL \u2500\u2500 */
function openStoryboardModal(idx){ sbEditIdx=idx; const st=idx!==null&&idx>=0?currentStoryItems()[idx]:null; sbTmpSlides=st?.isStoryboard?(st.slides||[]).map(s=>({...s})):[]; renderSbSlides(); openModal('storyboard-modal'); }
function saveStoryboard(){
  if(!sbTmpSlides.length){showToast('Aggiungi almeno una slide','warn');return;}
  const arr=currentStoryItems();
  if(sbEditIdx!==null&&sbEditIdx>=0&&sbEditIdx<arr.length){arr[sbEditIdx].slides=sbTmpSlides.map(s=>({...s}));arr[sbEditIdx].url=sbTmpSlides[0].url||'';arr[sbEditIdx].isStoryboard=true;}
  else{arr.push({type:'image',url:sbTmpSlides[0].url||'',name:'Storyboard',date:'',note:'',isStoryboard:true,slides:sbTmpSlides.map(s=>({...s}))});}
  setStoryItems(arr); closeModal('storyboard-modal'); refreshStories();
}
function addSbSlide(){ sbTmpSlides.push({url:'',title:'',note:''}); renderSbSlides(); }
function removeSbSlide(i){ sbTmpSlides.splice(i,1); renderSbSlides(); }
function renderSbSlides(){
  const c=document.getElementById('sb-slides');if(!c)return;c.innerHTML='';
  if(!sbTmpSlides.length){c.innerHTML='<div style="text-align:center;padding:16px;font-size:11px;color:var(--text-3);">Nessuna slide. Clicca "+ Aggiungi slide".</div>';return;}
  sbTmpSlides.forEach((sl,i)=>{
    const row=document.createElement('div');row.className='sb-slide';
    const num=document.createElement('div');num.className='sb-num';num.textContent=i+1;row.appendChild(num);
    const thumb=document.createElement('div');thumb.className='sb-thumb';thumb.style.position='relative';
    if(sl.url){const img=document.createElement('img');img.src=sl.url;img.alt='';thumb.appendChild(img);}
    else{const ph=document.createElement('div');ph.className='sb-thumb-add';ph.innerHTML='\ud83d\uddbc';thumb.appendChild(ph);}
    const fi=document.createElement('input');fi.type='file';fi.accept='image/*';fi.style.cssText='position:absolute;inset:0;opacity:0;cursor:pointer;width:100%;height:100%;';
    fi.onchange=async e=>{if(e.target.files[0]){
      document.getElementById('dbx-loader').style.display = 'flex';
      document.getElementById('dbx-loader-text').textContent = 'Upload in corso...';
      const clientName = storiesClientIdx >= 0 ? clients[storiesClientIdx].name : 'General';
      const url = await uploadMediaToDropbox(e.target.files[0], clientName);
      sbTmpSlides[i].url=url;
      document.getElementById('dbx-loader').style.display = 'none';
      renderSbSlides();
    }};
    thumb.appendChild(fi);row.appendChild(thumb);
    const con=document.createElement('div');con.className='sb-content';
    const ti=document.createElement('input');ti.type='text';ti.placeholder='Titolo\u2026';ti.value=sl.title||'';ti.oninput=e=>{sbTmpSlides[i].title=e.target.value;};
    const ni=document.createElement('textarea');ni.placeholder='Nota regia\u2026';ni.value=sl.note||'';ni.oninput=e=>{sbTmpSlides[i].note=e.target.value;};
    con.appendChild(ti);con.appendChild(ni);row.appendChild(con);
    const del=document.createElement('button');del.className='sb-del';del.innerHTML='\ud83d\uddd1';del.onclick=()=>removeSbSlide(i);row.appendChild(del);
    c.appendChild(row);
  });
}

/* \u2500\u2500 HIGHLIGHT MODAL \u2500\u2500 */
function openHighlightModal(idx){ hlEditIdx=idx; hlTmpCover=null; const hl=idx>=0?currentHighlights()[idx]:null; const nn=document.getElementById('hl-name');if(nn)nn.value=hl?hl.name:''; const ll=document.getElementById('hl-upload-lbl');if(ll)ll.innerHTML=hl?.coverUrl?'<strong>Clicca per cambiare copertina</strong>':'Carica copertina \u00b7 <strong>clicca per sfogliare</strong>'; openModal('highlight-modal'); }
async function setHlCover(files){ 
  if(!files[0])return; 
  const clientName = storiesClientIdx >= 0 ? clients[storiesClientIdx].name : 'General';
  document.getElementById('dbx-loader').style.display = 'flex';
  document.getElementById('dbx-loader-text').textContent = 'Upload in corso...';
  hlTmpCover = await uploadMediaToDropbox(files[0], clientName);
  document.getElementById('dbx-loader').style.display = 'none';
  const ll=document.getElementById('hl-upload-lbl');
  if(ll)ll.innerHTML='<strong>\u2713 Copertina caricata</strong>'; 
}
function saveHighlight(){
  const name=(document.getElementById('hl-name')?.value||'').trim();if(!name){showToast('Inserisci un nome','warn');return;}
  const arr=currentHighlights();
  if(hlEditIdx>=0){arr[hlEditIdx].name=name;if(hlTmpCover)arr[hlEditIdx].coverUrl=hlTmpCover;}
  else{arr.push({name,coverUrl:hlTmpCover||''});}
  setHighlights(arr); closeModal('highlight-modal'); refreshStories(); showToast('\u2713 Evidenza salvata');
}

/* \u2500\u2500 LINK STORIES MODAL \u2500\u2500 */
function openLinkStoriesModal(postIdx){
  linkModalPostIdx=postIdx; const post=currentFeedItems()[postIdx];
  linkModalSelected=new Set(post.linkedStories||[]);
  const grid=document.getElementById('link-modal-grid');if(!grid)return; grid.innerHTML='';
  const aid=accountId(feedClientIdx,feedAccountIdx);
  const key=aid&&feedMonth?accountKey(aid,feedMonth):null;
  const arr=key?(stories[key]||[]):[];
  const hint=document.getElementById('link-modal-hint');
  if(hint)hint.textContent=arr.length?'Seleziona le stories da collegare ('+arr.length+' disponibili).':'Nessuna story per questo account/mese.';
  arr.forEach((st,i)=>{
    const th=document.createElement('div');th.className='lm-thumb'+(linkModalSelected.has(i)?' selected':'');
    th.onclick=()=>{if(linkModalSelected.has(i))linkModalSelected.delete(i);else linkModalSelected.add(i);th.classList.toggle('selected',linkModalSelected.has(i));th.querySelector('.lm-check').style.display=linkModalSelected.has(i)?'flex':'none';};
    const chk=document.createElement('div');chk.className='lm-check';chk.innerHTML='\u2713';chk.style.display=linkModalSelected.has(i)?'flex':'none';th.appendChild(chk);
    const coverUrl=st.isStoryboard&&st.slides?.[0]?st.slides[0].url:st.url;
    if(coverUrl){const img=document.createElement('img');img.src=coverUrl;img.alt='';th.appendChild(img);}
    const num=document.createElement('div');num.className='lm-num';num.textContent=i+1;th.appendChild(num);
    grid.appendChild(th);
  });
  openModal('link-stories-modal');
}
function saveLinkStories(){
  if(linkModalPostIdx===null)return;
  const items=currentFeedItems(); items[linkModalPostIdx].linkedStories=Array.from(linkModalSelected).sort((a,b)=>a-b);
  setFeedItems(items); closeModal('link-stories-modal'); renderFeedGrid();
}

/* \u2500\u2500 COPY CONTENT MODAL \u2500\u2500 */
function openCopyModal(){
  const sel=document.getElementById('copy-src-account');if(!sel)return;
  sel.innerHTML='<option value="">\u2014 seleziona account \u2014</option>';
  clients.forEach((c,ci)=>{(c.accounts||[]).forEach((a,ai)=>{const o=document.createElement('option');o.value=ci+'|'+ai;o.textContent=c.name+' \u2014 '+a.name;sel.appendChild(o);});});
  document.getElementById('copy-content-list').innerHTML='<div style="text-align:center;padding:20px;font-size:11px;color:var(--text-3);">Seleziona account e mese sorgente.</div>';
  copySelectedItems=new Set(); openModal('copy-content-modal');
}
function loadCopyItems(){
  const srcSel=document.getElementById('copy-src-account').value; const mSel=document.getElementById('copy-src-month').value;
  const msEl=document.getElementById('copy-src-month');
  if(!srcSel){msEl.innerHTML='<option value="">\u2014 seleziona mese \u2014</option>';return;}
  const [ci,ai]=srcSel.split('|').map(Number); const acc=getAccount(ci,ai); if(!acc)return;
  if(msEl.dataset.acc!==acc.id){
    msEl.dataset.acc=acc.id; msEl.innerHTML='<option value="">\u2014 seleziona mese \u2014</option>';
    MONTH_OPTIONS.forEach(m=>{const k=accountKey(acc.id,m);if(feeds[k]?.length){const o=document.createElement('option');o.value=m;o.textContent=m;msEl.appendChild(o);}});
  }
  if(!mSel)return;
  const items=(feeds[accountKey(acc.id,mSel)]||[]).filter(i=>i.type!=='pending');
  const list=document.getElementById('copy-content-list');if(!list)return;
  list.innerHTML=''; copySelectedItems=new Set();
  if(!items.length){list.innerHTML='<div style="text-align:center;padding:20px;font-size:11px;color:var(--text-3);">Nessun contenuto in questo mese.</div>';return;}
  items.forEach((item,i)=>{
    const row=document.createElement('div');row.className='copy-item';
    row.onclick=()=>{copySelectedItems.has(i)?copySelectedItems.delete(i):copySelectedItems.add(i);row.classList.toggle('selected',copySelectedItems.has(i));};
    const thumb=document.createElement('div');thumb.className='copy-item-thumb';
    const coverUrl=item.type==='carousel'&&item.slides?.length?item.slides[0].url:item.url;
    if(coverUrl){const img=document.createElement('img');img.src=coverUrl;img.alt='';thumb.appendChild(img);}
    const info=document.createElement('div');info.className='copy-item-info';
    const tp=document.createElement('div');tp.className='copy-item-type';tp.textContent=item.type.toUpperCase();
    const nm=document.createElement('div');nm.className='copy-item-name';nm.textContent=item.copy?item.copy.slice(0,40)+'\u2026':item.name||'(senza caption)';
    info.appendChild(tp);info.appendChild(nm); row.appendChild(thumb);row.appendChild(info);list.appendChild(row);
  });
}
function executeCopy(){
  if(feedAccountIdx<0){showToast('Seleziona prima un account destinazione','warn');return;}
  const srcSel=document.getElementById('copy-src-account').value; const mSel=document.getElementById('copy-src-month').value;
  if(!srcSel||!mSel){showToast('Seleziona account e mese sorgente','warn');return;}
  const [ci,ai]=srcSel.split('|').map(Number); const acc=getAccount(ci,ai); if(!acc)return;
  const srcItems=(feeds[accountKey(acc.id,mSel)]||[]).filter(i=>i.type!=='pending');
  const destItems=currentFeedItems();
  Array.from(copySelectedItems).sort((a,b)=>a-b).forEach(i=>{ const src=srcItems[i];if(!src)return; destItems.push({...src,linkedStories:[],copy:src.copy||''}); });
  setFeedItems(destItems); closeModal('copy-content-modal'); refreshFeed();
  showToast('\u2713 '+copySelectedItems.size+' contenut'+(copySelectedItems.size===1?'o':'i')+' copiati');
}

/* \u2500\u2500 PREVIEW \u2500\u2500 */
function renderPreview(){
  const el=id=>document.getElementById(id);
  const ci=previewClientIdx, ai=previewAccountIdx;
  const m=document.getElementById('preview-month-sel')?.value||previewMonth;
  const acc=getAccount(ci,ai); const aid=acc?acc.id:null;
  const key=aid&&m?accountKey(aid,m):null;
  const ready=(key?feeds[key]||[]:currentFeedItems()).filter(i=>i.type!=='pending');
  const stArr=key?(stories[key]||[]):[];
  const title=acc?clients[ci].name+' \u2014 '+acc.name:'\u2014';
  if(el('preview-title'))el('preview-title').textContent=title;
  if(el('preview-sub'))el('preview-sub').textContent=m?'Anteprima \u2014 '+m:'Anteprima contenuti';
  if(el('preview-chip'))el('preview-chip').textContent=ready.length+' contenut'+(ready.length===1?'o':'i');
  const emEl=el('preview-empty'),grEl=el('preview-grid');
  if(!ready.length){if(emEl)emEl.style.display='flex';if(grEl)grEl.style.display='none';return;}
  if(emEl)emEl.style.display='none';if(grEl)grEl.style.display='grid';
  grEl.innerHTML='';
  ready.forEach((item,i)=>{
    const post=document.createElement('div');post.className='client-post';
    const cell=document.createElement('div');cell.className='client-cell';cell.onclick=()=>openLb(i,ready,stArr);
    const coverUrl=item.type==='carousel'&&item.slides?.length?item.slides[0].url:item.url;
    if(item.type==='video'){
      const v=makeMedia(item.url,'video');
      if(v){cell.addEventListener('mouseenter',()=>v.play().catch(()=>{}));cell.addEventListener('mouseleave',()=>{v.pause();v.currentTime=0;});cell.appendChild(v);}
      const b=document.createElement('span');b.className='client-badge video';b.textContent='\u25b6 REEL';cell.appendChild(b);
    }else{
      const img=makeMedia(coverUrl,'image');if(img)cell.appendChild(img);
      if(item.type==='carousel'){const b=document.createElement('span');b.className='client-badge carousel';b.textContent='\u274f\u274f '+(item.slides?.length||0);cell.appendChild(b);}
    }
    if(item.showDate&&item.date){const dp=document.createElement('div');dp.className='client-date-bar';dp.textContent=item.date;cell.appendChild(dp);}
    post.appendChild(cell);
    if(item.copy?.trim()){const cd=document.createElement('div');cd.className='client-copy';const cl=document.createElement('div');cl.className='client-copy-lbl';cl.textContent='Caption';cd.appendChild(cl);const ct=document.createElement('div');ct.textContent=item.copy;cd.appendChild(ct);post.appendChild(cd);}
    const linked=(item.linkedStories||[]).map(idx=>stArr[idx]).filter(Boolean);
    if(linked.length){const strip=document.createElement('div');strip.className='ls-strip';const lbl=document.createElement('div');lbl.className='ls-strip-lbl';lbl.textContent='\ud83d\udcf1';strip.appendChild(lbl);linked.forEach(st=>{const circ=document.createElement('div');circ.className='ls-circle';const cu=st.isStoryboard&&st.slides?.[0]?st.slides[0].url:st.url;if(cu){const img=document.createElement('img');img.src=cu;img.alt='';circ.appendChild(img);}strip.appendChild(circ);});post.appendChild(strip);}
    grEl.appendChild(post);
  });
}

/* \u2500\u2500 LIGHTBOX \u2500\u2500 */
function openLb(i,ready,stArr){ lbItems=ready; lbIdx=i; lbSlide=0; lbStArr=stArr||[]; renderLb(); document.getElementById('lightbox').classList.add('open'); }
function lbBg(e){ if(e.target===document.getElementById('lightbox'))document.getElementById('lightbox').classList.remove('open'); }
function lbNav(d){ lbIdx=(lbIdx+d+lbItems.length)%lbItems.length; lbSlide=0; renderLb(); }
function lbSlideNav(d){ const item=lbItems[lbIdx]; lbSlide=(lbSlide+d+item.slides.length)%item.slides.length; renderLb(); }
function renderLb(){
  const inner=document.getElementById('lb-inner');if(!inner)return;inner.innerHTML='';
  const item=lbItems[lbIdx]; const isMulti=lbItems.length>1;
  document.getElementById('lb-prev').style.display=isMulti?'flex':'none';
  document.getElementById('lb-next').style.display=isMulti?'flex':'none';
  const x=document.createElement('button');x.className='lb-close';x.innerHTML='\u00d7';x.onclick=()=>document.getElementById('lightbox').classList.remove('open');inner.appendChild(x);
  if(item.type==='carousel'&&item.slides?.length){
    const img=document.createElement('img');img.src=item.slides[lbSlide].url;img.alt='';inner.appendChild(img);
    if(item.slides.length>1){
      const sp=document.createElement('button');sp.className='lb-slide-nav lb-slide-prev';sp.innerHTML='\u2039';sp.onclick=e=>{e.stopPropagation();lbSlideNav(-1);};inner.appendChild(sp);
      const sn=document.createElement('button');sn.className='lb-slide-nav lb-slide-next';sn.innerHTML='\u203a';sn.onclick=e=>{e.stopPropagation();lbSlideNav(1);};inner.appendChild(sn);
      const de=document.createElement('div');de.className='lb-dots';item.slides.forEach((_,si)=>{const d=document.createElement('div');d.className='lb-dot'+(si===lbSlide?' active':'');de.appendChild(d);});inner.appendChild(de);
    }
  } else if(item.type==='video'){ const v=makeMedia(item.url,'video',{controls:true,autoplay:true});if(v)inner.appendChild(v); }
  else{ const img=document.createElement('img');img.src=item.url;img.alt='';inner.appendChild(img); }
  document.getElementById('lb-counter').textContent=isMulti?(lbIdx+1)+' / '+lbItems.length:'';
  const copyEl=document.getElementById('lb-copy');
  if(copyEl){if(item.copy?.trim()){copyEl.textContent=item.copy;copyEl.className='lb-copy visible';}else{copyEl.textContent='';copyEl.className='lb-copy';}}
  const ssEl=document.getElementById('lb-stories-strip');if(!ssEl)return;
  const linked=(item.linkedStories||[]).map(idx=>lbStArr[idx]).filter(Boolean);
  if(linked.length){
    ssEl.className='lb-stories-strip visible';ssEl.innerHTML='';
    const lbl=document.createElement('div');lbl.className='lb-stories-lbl';lbl.textContent='Stories collegate';ssEl.appendChild(lbl);
    const row=document.createElement('div');row.className='lb-stories-row';
    linked.forEach(st=>{const th=document.createElement('div');th.className='lb-story-th';const cu=st.isStoryboard&&st.slides?.[0]?st.slides[0].url:st.url;if(cu){const img=document.createElement('img');img.src=cu;img.alt='';th.appendChild(img);}row.appendChild(th);});
    ssEl.appendChild(row);
  }else{ssEl.className='lb-stories-strip';ssEl.innerHTML='';}
}
document.addEventListener('keydown',e=>{
  const lb=document.getElementById('lightbox');if(!lb.classList.contains('open'))return;
  const item=lbItems[lbIdx];
  if(e.key==='ArrowLeft'){if(item.type==='carousel'&&item.slides?.length>1)lbSlideNav(-1);else lbNav(-1);}
  if(e.key==='ArrowRight'){if(item.type==='carousel'&&item.slides?.length>1)lbSlideNav(1);else lbNav(1);}
  if(e.key==='Escape')lb.classList.remove('open');
});

/* \u2500\u2500 MODAL HELPERS \u2500\u2500 */
function openModal(id){ const m=document.getElementById(id);if(m)m.classList.add('open'); }
function closeModal(id){ const m=document.getElementById(id);if(m)m.classList.remove('open'); }
document.addEventListener('click',e=>{ if(e.target.classList.contains('modal-bg'))e.target.classList.remove('open'); });

/* \u2500\u2500 CALENDAR \u2500\u2500 */
function setCalView(v){ calView=v; document.getElementById('cal-btn-month').classList.toggle('active',v==='month'); document.getElementById('cal-btn-week').classList.toggle('active',v==='week'); renderCalendar(); }
function calNav(dir){ if(calView==='month')calDate.setMonth(calDate.getMonth()+dir); else calDate.setDate(calDate.getDate()+dir*7); calDate=new Date(calDate); renderCalendar(); }
function calGoToday(){ calDate=new Date(); renderCalendar(); }
function isoDate(y,m,d){ return y+'-'+(m<10?'0':'')+m+'-'+(d<10?'0':'')+d; }
function todayISO(){ const n=new Date(); return isoDate(n.getFullYear(),n.getMonth()+1,n.getDate()); }

function calGetAllEvents(){
  const events={};
  const addEv=(dateStr,ev)=>{if(!events[dateStr])events[dateStr]=[];events[dateStr].push(ev);};
  clients.forEach((cl,ci)=>{
    (cl.accounts||[]).forEach(acc=>{
      MONTH_OPTIONS.forEach(mo=>{
        const key=acc.id+'|||'+mo;
        (feeds[key]||[]).filter(it=>it.type!=='pending'&&it.date).forEach((it,ii)=>{addEv(it.date,{type:'feed',label:it.copy?it.copy.slice(0,20):(it.type==='video'?'Reel':'Post'),thumb:it.type==='carousel'&&it.slides?.[0]?it.slides[0].url:it.url,vidUrl:it.type==='video'?it.url:null,item:it,clientIdx:ci,clientName:cl.name+' \u2014 '+acc.name,month:mo});});
        (stories[key]||[]).filter(st=>st.date).forEach((st,si)=>{addEv(st.date,{type:'story',label:st.isStoryboard?'Storyboard':(st.type==='video'?'Reel story':'Story'),thumb:st.isStoryboard&&st.slides?.[0]?st.slides[0].url:st.url,item:st,clientIdx:ci,clientName:cl.name+' \u2014 '+acc.name,month:mo});});
      });
    });
    MONTH_OPTIONS.forEach(mo=>{
      const pkey=pedKey(cl.name,mo);
      (pedPlans[pkey]||[]).forEach(st=>{if(!st.date)return;addEv(st.date,{type:'ped',label:(st.type==='autonoma'?'\ud83d\udc64 ':'\ud83c\udfa8 ')+(st.brief?st.brief.slice(0,18):'Story pianificata'),thumb:null,item:st,clientIdx:ci,clientName:cl.name,month:mo,pedType:st.type});});
    });
  });
  return events;
}

function renderCalendar(){
  const body=document.getElementById('cal-body');if(!body)return;
  const lbl=document.getElementById('cal-month-label');
  const events=calGetAllEvents(); const today=todayISO();
  if(calView==='month'){
    const y=calDate.getFullYear(),m=calDate.getMonth();
    if(lbl)lbl.textContent=MESI_IT[m]+' '+y;
    const firstDay=new Date(y,m,1);
    let startDow=firstDay.getDay();startDow=startDow===0?6:startDow-1;
    const daysInMonth=new Date(y,m+1,0).getDate(); const daysInPrev=new Date(y,m,0).getDate();
    let html='<div class="cal-month-grid">';
    GIORNIW.forEach(g=>{html+=`<div class="cal-day-header">${g}</div>`;});
    let day=1,nextDay=1; const totalCells=Math.ceil((startDow+daysInMonth)/7)*7;
    for(let i=0;i<totalCells;i++){
      let cellY=y,cellM=m+1,cellD,isOther=false;
      if(i<startDow){cellD=daysInPrev-startDow+i+1;cellM=m===0?12:m;cellY=m===0?y-1:y;isOther=true;}
      else if(day>daysInMonth){cellD=nextDay++;cellM=m+2>12?1:m+2;cellY=m+2>12?y+1:y;isOther=true;}
      else{cellD=day++;}
      const dateStr=isoDate(cellY,cellM,cellD); const isToday=dateStr===today; const evs=events[dateStr]||[];
      html+=`<div class="cal-day${isOther?' other-month':''}${isToday?' today':''}" onclick="openCalPanel('${dateStr}')">`;
      html+=`<div class="cal-day-num">${cellD}</div><div class="cal-events">`;
      evs.slice(0,3).forEach(ev=>{
        const cls=ev.type==='feed'?'feed-post':ev.type==='story'?'story-item':ev.type==='ped'?(ev.pedType==='template'?'ped-template':'ped-autonoma'):'highlight-item';
        const dot=ev.type==='feed'?'\ud83d\udfe2':ev.type==='story'?'\ud83d\udd35':ev.type==='ped'?(ev.pedType==='template'?'\ud83d\udfe3':'\ud83d\udd35'):'\ud83d\udfe1';
        html+=`<div class="cal-event ${cls}" onclick="event.stopPropagation();openCalPanel('${dateStr}')"><span>${dot}</span><span class="cal-event-label">${ev.clientName}: ${ev.label}</span></div>`;
      });
      if(evs.length>3)html+=`<div class="cal-event-more">+${evs.length-3} altri</div>`;
      html+='</div></div>';
    }
    html+='</div>'; body.innerHTML=html;
  } else {
    const curr=new Date(calDate); const dow=curr.getDay(); const diff=dow===0?-6:1-dow; curr.setDate(curr.getDate()+diff);
    if(lbl)lbl.textContent='Settimana del '+curr.getDate()+' '+MESI_IT[curr.getMonth()];
    const weekDays=[]; for(let i=0;i<7;i++){const d=new Date(curr);d.setDate(d.getDate()+i);weekDays.push(d);}
    let html='<div class="cal-week-wrap">';
    html+='<div class="cal-week-header" style="border-right:1px solid var(--border);border-bottom:1px solid var(--border);"></div>';
    weekDays.forEach((d,di)=>{const ds=isoDate(d.getFullYear(),d.getMonth()+1,d.getDate());const isT=ds===today;html+=`<div class="cal-week-header${isT?' today':''}"><div class="wh-day">${GIORNIW[di]}</div><div class="wh-num">${d.getDate()}</div></div>`;});
    const HOURS=[];for(let h=8;h<=22;h++)HOURS.push(h);
    html+='<div class="cal-time-col">';HOURS.forEach(h=>{html+=`<div class="cal-time-slot"><span class="cal-time-label">${h}:00</span></div>`;});html+='</div>';
    weekDays.forEach(d=>{
      const ds=isoDate(d.getFullYear(),d.getMonth()+1,d.getDate()); const dayEvs=events[ds]||[];
      html+='<div class="cal-week-col">';HOURS.forEach(()=>{html+='<div class="cal-week-slot"></div>';});
      dayEvs.forEach((ev,ei)=>{const top=4+ei*40;const cls=ev.type==='feed'?'feed-post':ev.type==='story'?'story-item':ev.type==='ped'?(ev.pedType==='template'?'ped-template':'ped-autonoma'):'highlight-item';const dot=ev.type==='feed'?'\ud83d\udfe2':ev.type==='story'?'\ud83d\udd35':ev.type==='ped'?(ev.pedType==='template'?'\ud83d\udfe3':'\ud83d\udd35'):'\ud83d\udfe1';html+=`<div class="cal-week-event ${cls}" style="top:${top}px;height:34px;" onclick="openCalPanel('${ds}')"><span>${dot}</span><span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;flex:1;">${ev.clientName}: ${ev.label}</span></div>`;});
      html+='</div>';
    });
    html+='</div>'; body.innerHTML=html;
  }
}

function openCalPanel(dateStr){
  const events=calGetAllEvents(); const evs=events[dateStr]||[];
  const panel=document.getElementById('cal-day-panel');if(!panel)return;
  const head=document.getElementById('cal-panel-date'); const body=document.getElementById('cal-panel-body');
  if(!head||!body)return;
  const [y,mo,d]=dateStr.split('-'); const dt=new Date(parseInt(y),parseInt(mo)-1,parseInt(d));
  const gg=['Domenica','Luned\u00ec','Marted\u00ec','Mercoled\u00ec','Gioved\u00ec','Venerd\u00ec','Sabato'];
  head.textContent=gg[dt.getDay()]+' '+parseInt(d)+' '+MESI_IT[parseInt(mo)-1]+' '+y;
  body.innerHTML='';
  if(!evs.length){body.innerHTML='<p style="font-size:12px;color:var(--text-3);text-align:center;padding:20px;">Nessun contenuto programmato.</p>';panel.classList.add('open');return;}
  const renderSection=(list,label,typeClass)=>{
    if(!list.length)return; const sec=document.createElement('div');
    const sl=document.createElement('div');sl.className='cal-panel-section';sl.textContent=label;sec.appendChild(sl);
    list.forEach(ev=>{
      const row=document.createElement('div');row.className='cal-panel-item';
      const thumb=document.createElement('div');thumb.className='cal-panel-thumb'+(typeClass==='story'?' story':'');
      if(ev.thumb){const img=document.createElement('img');img.src=ev.thumb;img.alt='';thumb.appendChild(img);}
      const info=document.createElement('div');info.className='cal-panel-info';
      const type_=document.createElement('div');type_.className=`cal-panel-type ${typeClass}`;type_.textContent=label.replace(/[\ud83d\udcc4\ud83d\udcf1\u2b50\ud83d\udc64\ud83c\udfa8] /g,'');info.appendChild(type_);
      const cp=document.createElement('div');cp.className='cal-panel-copy';cp.textContent=ev.item.brief||ev.item.copy||ev.item.note||ev.item.name||ev.label||'\u2014';info.appendChild(cp);
      if(ev.clientName){const cl_=document.createElement('div');cl_.style.cssText='font-size:10px;color:var(--text-3);margin-top:2px;';cl_.textContent=ev.clientName;info.appendChild(cl_);}
      if(ev.type==='feed'||ev.type==='story'||ev.type==='ped'){const tabDest=ev.type==='feed'?'feed':ev.type==='story'?'stories':'ped';const tabLabel=ev.type==='feed'?'Feed':ev.type==='story'?'Stories':'PED Stories';const go=document.createElement('div');go.className='cal-panel-goto';go.innerHTML='\u2192 Vai a '+tabLabel;go.onclick=e=>{e.stopPropagation();switchTab(tabDest);closeCalPanel();};info.appendChild(go);}
      row.appendChild(thumb);row.appendChild(info);sec.appendChild(row);
    });
    body.appendChild(sec);
  };
  renderSection(evs.filter(e=>e.type==='feed'),'\ud83d\udcc4 Post feed','feed');
  renderSection(evs.filter(e=>e.type==='story'),'\ud83d\udcf1 Stories','story');
  renderSection(evs.filter(e=>e.type==='ped'&&e.pedType==='autonoma'),'\ud83d\udc64 PED Autonoma','feed');
  renderSection(evs.filter(e=>e.type==='ped'&&e.pedType==='template'),'\ud83c\udfa8 PED Template','story');
  panel.classList.add('open');
}
function closeCalPanel(){ const p=document.getElementById('cal-day-panel');if(p)p.classList.remove('open'); }

/* \u2500\u2500 PED STORIES \u2500\u2500 */
function renderPED(){
  const hasClient=currentClientIdx>=0&&currentMonth;
  const cn=hasClient?clients[currentClientIdx].name:'\u2014'; const mn=currentMonth||'\u2014';
  const el=id=>document.getElementById(id);
  if(el('ped-title'))el('ped-title').textContent=hasClient?cn+' \u2014 PED Stories':'PED Stories';
  if(el('ped-client-label'))el('ped-client-label').textContent=hasClient?cn+' \u00b7 '+mn:'\u2014 seleziona cliente nel Feed';
  if(el('ped-cal-label'))el('ped-cal-label').textContent=mn;
  const emptyEl=el('ped-empty'),freqBlock=el('ped-freq-block');
  if(!hasClient){if(emptyEl)emptyEl.style.display='flex';if(freqBlock)freqBlock.style.display='none';renderPEDCal();return;}
  if(emptyEl)emptyEl.style.display='none';if(freqBlock)freqBlock.style.display='block';
  renderFreqDays();renderPEDCards();renderPEDCal();
  const plan=currentPedPlan();
  if(el('ped-meta'))el('ped-meta').textContent=plan.length+' stor'+(plan.length===1?'y':'ies')+' pianificat'+(plan.length===1?'a':'e');
}
function renderFreqDays(){
  const wrap=document.getElementById('ped-freq-days');if(!wrap)return;
  const labels=['L','M','M','G','V','S','D'];
  wrap.innerHTML='';
  labels.forEach((lbl,i)=>{
    const btn=document.createElement('button');btn.className='freq-day-btn'+(pedFreqDays.has(i)?' active':'');btn.textContent=lbl;
    btn.title=['Luned\u00ec','Marted\u00ec','Mercoled\u00ec','Gioved\u00ec','Venerd\u00ec','Sabato','Domenica'][i];
    btn.onclick=()=>{if(pedFreqDays.has(i))pedFreqDays.delete(i);else pedFreqDays.add(i);renderFreqDays();};
    wrap.appendChild(btn);
  });
}
function pedGenerate(){
  if(currentClientIdx<0||!currentMonth)return;
  if(pedFreqDays.size===0){alert('Seleziona almeno un giorno.');return;}
  const [moName,y]=currentMonth.split(' '); const moIdx=MESI_IT.indexOf(moName);if(moIdx<0)return;
  const year=parseInt(y); const daysInMonth=new Date(year,moIdx+1,0).getDate();
  const existing=currentPedPlan(); const existingDates=new Set(existing.map(s=>s.date));
  const newPlan=[...existing];
  for(let d=1;d<=daysInMonth;d++){
    const dt=new Date(year,moIdx,d);let dow=dt.getDay();dow=dow===0?6:dow-1;
    const iso=isoDate(year,moIdx+1,d);
    if(pedFreqDays.has(dow)&&!existingDates.has(iso))newPlan.push({date:iso,type:'autonoma',brief:'',templateRef:'',id:pedUID()});
  }
  newPlan.sort((a,b)=>a.date.localeCompare(b.date));setCurrentPedPlan(newPlan);renderPED();
}
function pedClear(){ if(!confirm('Svuotare il piano del mese?'))return; setCurrentPedPlan([]); renderPED(); }
function renderPEDCards(){
  const wrap=document.getElementById('ped-cards');if(!wrap)return;wrap.innerHTML='';
  const plan=currentPedPlan();
  if(!plan.length){wrap.innerHTML='<p style="font-size:11px;color:var(--text-3);text-align:center;padding:16px;">Nessuna story pianificata.<br>Scegli i giorni e clicca <strong>Genera piano</strong>.</p>';return;}
  plan.forEach((st,i)=>{
    const card=document.createElement('div');card.className='ped-story-card';
    const head=document.createElement('div');head.className='ped-story-card-head';
    const dateEl=document.createElement('div');dateEl.className='ped-story-date';dateEl.textContent=fmtDate(st.date)||st.date;
    const typeSel=document.createElement('select');typeSel.className='ped-story-type-sel';
    [['autonoma','\ud83d\udc64 Autonoma'],['template','\ud83c\udfa8 Template']].forEach(([v,l])=>{const o=document.createElement('option');o.value=v;o.textContent=l;if(v===st.type)o.selected=true;typeSel.appendChild(o);});
    typeSel.onchange=e=>{currentPedPlan()[i].type=e.target.value;renderPEDCards();renderPEDCal();};
    const badge=document.createElement('span');badge.className='ped-type-badge '+st.type;badge.textContent=st.type==='autonoma'?'\ud83d\udc64':'\ud83c\udfa8';
    const del=document.createElement('button');del.className='ped-story-del';del.innerHTML='\ud83d\uddd1';del.onclick=()=>{const p=currentPedPlan();p.splice(i,1);setCurrentPedPlan(p);renderPED();};
    head.appendChild(dateEl);head.appendChild(typeSel);head.appendChild(badge);head.appendChild(del);
    const body=document.createElement('div');body.className='ped-story-body';
    const brief=document.createElement('textarea');brief.className='ped-story-brief';
    brief.placeholder=st.type==='autonoma'?'Brief per il cliente: cosa girare, dove, come\u2026':'Descrizione contenuto / copy\u2026';
    brief.value=st.brief||'';brief.oninput=e=>{currentPedPlan()[i].brief=e.target.value;};
    body.appendChild(brief);
    if(st.type==='template'){const tmpl=document.createElement('input');tmpl.type='text';tmpl.className='ped-story-template';tmpl.placeholder='Link o nome template (Canva, Adobe Express\u2026)';tmpl.value=st.templateRef||'';tmpl.oninput=e=>{currentPedPlan()[i].templateRef=e.target.value;};body.appendChild(tmpl);}
    card.appendChild(head);card.appendChild(body);wrap.appendChild(card);
  });
}
function renderPEDCal(){
  const headEl=document.getElementById('ped-cal-head');const gridEl=document.getElementById('ped-cal-grid');if(!headEl||!gridEl)return;
  headEl.innerHTML='';['L','M','M','G','V','S','D'].forEach(g=>{const d=document.createElement('div');d.className='ped-cal-dh';d.textContent=g;headEl.appendChild(d);});
  gridEl.innerHTML='';
  if(currentClientIdx<0||!currentMonth)return;
  const [moName,y]=currentMonth.split(' ');const moIdx=MESI_IT.indexOf(moName);if(moIdx<0)return;
  const year=parseInt(y);const firstDay=new Date(year,moIdx,1);let startDow=firstDay.getDay();startDow=startDow===0?6:startDow-1;
  const daysInMonth=new Date(year,moIdx+1,0).getDate();const daysInPrev=new Date(year,moIdx,0).getDate();const today=todayISO();
  const pedMap={};currentPedPlan().forEach(s=>{if(!pedMap[s.date])pedMap[s.date]=[];pedMap[s.date].push(s);});
  const feedMap={};
  if(feedClientIdx>=0&&feedAccountIdx>=0){const acc=getAccount(feedClientIdx,feedAccountIdx);const fkey=acc?acc.id+'|||'+(feedMonth||currentMonth):null;if(fkey)(feeds[fkey]||[]).filter(it=>it.type!=='pending'&&it.date).forEach(it=>{if(!feedMap[it.date])feedMap[it.date]=[];feedMap[it.date].push(it);});}
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
    (feedMap[ds]||[]).forEach(it=>{const e=document.createElement('div');e.className='ped-cal-ev feed';e.textContent='\ud83d\udcf8 '+(it.type==='video'?'Reel':'Post');evs.appendChild(e);});
    (pedMap[ds]||[]).forEach(s=>{const e=document.createElement('div');e.className='ped-cal-ev '+s.type;e.textContent=(s.type==='autonoma'?'\ud83d\udc64':'\ud83c\udfa8')+' Story';evs.appendChild(e);});
    cell.appendChild(evs);
    if((pedMap[ds]||[]).length){cell.title=(pedMap[ds]||[]).map(s=>s.brief||'(brief vuoto)').join(' | ');cell.style.cursor='pointer';}
    gridEl.appendChild(cell);
  }
}

/* \u2500\u2500 DATE PICKER \u2500\u2500 */
let dpOpenIdx=null,dpYear=new Date().getFullYear(),dpMonth=new Date().getMonth();
function fmtDate(iso){
  if(!iso)return'';const[y,m,d]=iso.split('-');if(!y||!m||!d)return iso;
  const giorni=['Dom','Lun','Mar','Mer','Gio','Ven','Sab'];const mesi=['Gen','Feb','Mar','Apr','Mag','Giu','Lug','Ago','Set','Ott','Nov','Dic'];
  const dt=new Date(parseInt(y),parseInt(m)-1,parseInt(d));
  return giorni[dt.getDay()]+' '+parseInt(d)+' '+mesi[parseInt(m)-1];
}
function formatItalianDate(year,month,day){
  const weekdays=['Dom','Lun','Mar','Mer','Gio','Ven','Sab'];
  const months=['gennaio','febbraio','marzo','aprile','maggio','giugno','luglio','agosto','settembre','ottobre','novembre','dicembre'];
  const dow=new Date(year,month,day).getDay();
  return weekdays[dow]+' '+day+' '+months[month];
}
function openDatePicker(idx,anchorEl){
  closeDatePicker();dpOpenIdx=idx;
  const item=currentFeedItems()[idx];
  const fm=feedMonth?feedMonth.split(' '):null;
  if(fm){dpMonth=MONTHS.indexOf(fm[0]);dpYear=parseInt(fm[1]);if(dpMonth<0){dpMonth=new Date().getMonth();dpYear=new Date().getFullYear();}}
  else{dpMonth=new Date().getMonth();dpYear=new Date().getFullYear();}
  let popup=document.getElementById('global-date-picker');
  if(!popup){popup=document.createElement('div');popup.id='global-date-picker';popup.className='date-picker-popup';document.body.appendChild(popup);}
  const rect=anchorEl.getBoundingClientRect();
  popup.style.top=rect.top+'px';popup.style.left=rect.left+'px';popup.style.width=Math.max(rect.width,220)+'px';
  renderDatePickerContent(idx,popup);popup.classList.add('open');
  const popH=popup.offsetHeight;
  if(rect.top-popH-6<0)popup.style.top=(rect.bottom+6)+'px';else popup.style.top=(rect.top-popH-6)+'px';
}
function closeDatePicker(){const popup=document.getElementById('global-date-picker');if(popup)popup.classList.remove('open');dpOpenIdx=null;}
function renderDatePickerContent(idx,popup){
  popup.innerHTML='';
  const hdr=document.createElement('div');hdr.className='dp-header';
  const prev=document.createElement('button');prev.className='dp-nav';prev.textContent='\u2039';
  prev.onclick=e=>{e.stopPropagation();dpMonth--;if(dpMonth<0){dpMonth=11;dpYear--;}renderDatePickerContent(idx,popup);};
  const lbl=document.createElement('div');lbl.className='dp-header-label';lbl.textContent=MONTH_NAMES_DP[dpMonth]+' '+dpYear;
  const next=document.createElement('button');next.className='dp-nav';next.textContent='\u203a';
  next.onclick=e=>{e.stopPropagation();dpMonth++;if(dpMonth>11){dpMonth=0;dpYear++;}renderDatePickerContent(idx,popup);};
  hdr.appendChild(prev);hdr.appendChild(lbl);hdr.appendChild(next);popup.appendChild(hdr);
  const wds=document.createElement('div');wds.className='dp-weekdays';
  WEEKDAYS_DP.forEach(d=>{const wd=document.createElement('div');wd.className='dp-wd';wd.textContent=d;wds.appendChild(wd);});popup.appendChild(wds);
  const grid=document.createElement('div');grid.className='dp-days';
  const firstDay=new Date(dpYear,dpMonth,1).getDay();const daysInMonth=new Date(dpYear,dpMonth+1,0).getDate();
  const offset=firstDay===0?6:firstDay-1;const today=new Date();const item=currentFeedItems()[idx];const selectedDate=item.date||null;
  for(let i=0;i<offset;i++){const emp=document.createElement('button');emp.className='dp-day empty';emp.disabled=true;grid.appendChild(emp);}
  for(let d=1;d<=daysInMonth;d++){
    const btn=document.createElement('button');btn.className='dp-day';btn.textContent=d;
    const italianStr=formatItalianDate(dpYear,dpMonth,d);
    if(today.getDate()===d&&today.getMonth()===dpMonth&&today.getFullYear()===dpYear)btn.classList.add('today');
    if(selectedDate===italianStr)btn.classList.add('selected');
    btn.onclick=e=>{e.stopPropagation();const items=currentFeedItems();items[idx].date=italianStr;items[idx].showDate=true;setFeedItems(items);renderFeedGrid();renderDatePickerContent(idx,popup);};
    grid.appendChild(btn);
  }
  popup.appendChild(grid);
  const clear=document.createElement('button');clear.className='dp-clear';clear.textContent='\u2715 Rimuovi data';
  clear.onclick=e=>{e.stopPropagation();const items=currentFeedItems();items[idx].date='';items[idx].showDate=false;setFeedItems(items);popup.classList.remove('open');dpOpenIdx=null;renderFeedGrid();};
  popup.appendChild(clear);
}
document.addEventListener('click',e=>{if(!e.target.closest('#global-date-picker')&&!e.target.closest('.dp-trigger-btn')&&!e.target.closest('.date-input'))closeDatePicker();},true);

/* \u2500\u2500 EXPORT / IMPORT \u2500\u2500 */
function exportProject(){
  function san(arr){return(arr||[]).map(item=>({type:item.type,name:item.name||'',date:item.date||'',showDate:item.showDate||false,copy:item.copy||'',linkedStories:item.linkedStories||[],isStoryboard:item.isStoryboard||false,isExternalLink:item.isExternalLink||false,linkSource:item.linkSource||'',externalUrl:item.externalUrl||'',slides:(item.slides||[]).map(s=>({title:s.title||'',note:s.note||'',name:s.name||'',externalUrl:s.externalUrl||''}))}));}
  function sanSt(arr){return(arr||[]).map(st=>({type:st.type,name:st.name||'',date:st.date||'',note:st.note||'',isStoryboard:st.isStoryboard||false,isExternalLink:st.isExternalLink||false,linkSource:st.linkSource||'',externalUrl:st.externalUrl||'',slides:(st.slides||[]).map(s=>({title:s.title||'',note:s.note||'',name:s.name||'',externalUrl:s.externalUrl||''}))}));}
  const ef={};Object.keys(feeds).forEach(k=>{ef[k]=san(feeds[k]);});
  const es={};Object.keys(stories).forEach(k=>{es[k]=sanSt(stories[k]);});
  const eh={};Object.keys(highlights).forEach(k=>{eh[k]=(highlights[k]||[]).map(h=>({name:h.name,coverUrl:(h.coverUrl&&h.coverUrl.startsWith('http'))?h.coverUrl:''}));});
  const data={version:'2.0',exportedAt:new Date().toISOString(),clients,feeds:ef,stories:es,highlights:eh,pedPlans,meta:{showAllDates,showAllCopy}};
  const blob=new Blob([JSON.stringify(data,null,2)],{type:'application/json'});
  const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;
  a.download='nassa-progetto-'+new Date().toISOString().slice(0,10)+'.json';a.click();URL.revokeObjectURL(url);
  showToast('\u2713 Progetto esportato');
}
function importProject(){ document.getElementById('import-input').click(); }
function loadProjectFile(input){
  const file=input.files[0];if(!file)return;
  const reader=new FileReader();
  reader.onload=e=>{
    try{
      const data=JSON.parse(e.target.result);
      if(!data.version||!data.clients)throw new Error('File non valido');
      clients=data.clients||[];
      clients.forEach(c=>{if(!c.accounts)c.accounts=[];if(!c.id)c.id='c_'+Date.now()+'_'+Math.random();});
      feeds={};Object.keys(data.feeds||{}).forEach(k=>{feeds[k]=(data.feeds[k]||[]).map(item=>({...item,url:(item.externalUrl&&item.externalUrl.startsWith('http'))?item.externalUrl:'',needsReload:!(item.externalUrl&&item.externalUrl.startsWith('http'))&&!!item.name,slides:(item.slides||[]).map(s=>({...s,url:(s.externalUrl&&s.externalUrl.startsWith('http'))?s.externalUrl:''}))}))}); 
      stories={};Object.keys(data.stories||{}).forEach(k=>{stories[k]=(data.stories[k]||[]).map(st=>({...st,url:(st.externalUrl&&st.externalUrl.startsWith('http'))?st.externalUrl:'',needsReload:!(st.externalUrl&&st.externalUrl.startsWith('http'))&&!!st.name,slides:(st.slides||[]).map(s=>({...s,url:(s.externalUrl&&s.externalUrl.startsWith('http'))?s.externalUrl:''}))}))}); 
      highlights={};Object.keys(data.highlights||{}).forEach(k=>{highlights[k]=(data.highlights[k]||[]).map(h=>({name:h.name,coverUrl:(h.coverUrl&&h.coverUrl.startsWith('http'))?h.coverUrl:''}));});
      pedPlans={};Object.keys(data.pedPlans||{}).forEach(k=>{pedPlans[k]=data.pedPlans[k]||[];});
      if(data.meta){showAllDates=data.meta.showAllDates!==false;showAllCopy=data.meta.showAllCopy!==false;}
      feedClientIdx=-1;feedAccountIdx=-1;feedMonth='';storiesClientIdx=-1;storiesAccountIdx=-1;storiesMonth='';previewClientIdx=-1;previewAccountIdx=-1;previewMonth='';
      renderStudio();rebuildAllSelects();renderFeedGrid();renderStoriesGrid();updateFeedHeader();updateStoriesHeader();
      showToast('\u2713 Importato \u2014 '+clients.length+' client'+(clients.length===1?'e':'i'));
    }catch(err){alert('Errore importazione: '+err.message);}
    input.value='';
  };
  reader.readAsText(file);
}

/* \u2500\u2500 TOAST \u2500\u2500 */
function showToast(msg,type){
  const t=document.getElementById('toast');if(!t)return;
  t.textContent=msg;t.className='toast'+(type==='warn'?' warn':'');
  setTimeout(()=>t.classList.add('show'),10);
  setTimeout(()=>t.classList.remove('show'),2800);
}

/* \u2500\u2500 INIT \u2500\u2500 */
function init(){
  initBackend();
  const fdz=document.getElementById('feed-drop-zone');
  if(fdz){fdz.addEventListener('dragover',e=>{e.preventDefault();fdz.classList.add('drag-over');});fdz.addEventListener('dragleave',e=>{if(!fdz.contains(e.relatedTarget))fdz.classList.remove('drag-over');});fdz.addEventListener('drop',e=>{e.preventDefault();fdz.classList.remove('drag-over');queueFeedFiles(e.dataTransfer.files);});}
  const sdz=document.getElementById('stories-drop-zone');
  if(sdz){sdz.addEventListener('dragover',e=>{e.preventDefault();sdz.classList.add('drag-over');});sdz.addEventListener('dragleave',e=>{if(!sdz.contains(e.relatedTarget))sdz.classList.remove('drag-over');});sdz.addEventListener('drop',e=>{e.preventDefault();sdz.classList.remove('drag-over');queueStoryFiles(e.dataTransfer.files);});}
  const cuzEl=document.getElementById('c-upload-zone');
  if(cuzEl){cuzEl.addEventListener('dragover',e=>{e.preventDefault();cuzEl.classList.add('drag-over');});cuzEl.addEventListener('dragleave',()=>cuzEl.classList.remove('drag-over'));cuzEl.addEventListener('drop',e=>{e.preventDefault();cuzEl.classList.remove('drag-over');addCarouselFiles(e.dataTransfer.files);});}
  const hluz=document.getElementById('hl-upload-zone');
  if(hluz){hluz.addEventListener('dragover',e=>{e.preventDefault();hluz.classList.add('drag-over');});hluz.addEventListener('dragleave',()=>hluz.classList.remove('drag-over'));hluz.addEventListener('drop',e=>{e.preventDefault();hluz.classList.remove('drag-over');setHlCover(e.dataTransfer.files);});}
  const msEl=document.getElementById('copy-src-month');
  if(msEl){msEl.innerHTML='<option value="">\u2014 seleziona mese \u2014</option>';MONTH_OPTIONS.forEach(m=>{const o=document.createElement('option');o.value=m;o.textContent=m;msEl.appendChild(o);});}
  renderStudio();rebuildAllSelects();renderFeedGrid();renderStoriesGrid();updateFeedHeader();updateStoriesHeader();
  document.getElementById('icon-feed')?.classList.add('active');
}
document.addEventListener('DOMContentLoaded',init);

async function uploadMediaToDropbox(file, clientName) {
  if (!dbx) return URL.createObjectURL(file);
  const safeClient = (clientName || 'General').replace(/[^a-z0-9]/gi, '_');
  const path = `/nassa studio/nassaportal/${safeClient}/media/${Date.now()}_${file.name}`;
  try {
    const response = await dbx.filesUpload({ path: path, contents: file, autorename: true });
    const linkRes = await dbx.sharingCreateSharedLinkWithSettings({ path: response.result.path_display });
    let url = linkRes.result.url;
    url = url.replace('?dl=0', '?raw=1').replace('www.dropbox.com', 'dl.dropboxusercontent.com');
    return url;
  } catch (err) {
    console.error('Upload error', err);
    alert('Errore upload: ' + err.message);
    return URL.createObjectURL(file);
  }
}

async function syncToSupabase(showToastMsg = true) {
  const syncBtn = document.getElementById('dbx-sync-btn');
  if (syncBtn) {
    syncBtn.textContent = 'Saving...';
    syncBtn.style.opacity = '0.7';
    syncBtn.style.pointerEvents = 'none';
  }

  if (showToastMsg) {
    const loader = document.getElementById('dbx-loader');
    if(loader) loader.style.display = 'flex';
    const ltext = document.getElementById('dbx-loader-text');
    if(ltext) ltext.textContent = 'Salvataggio in corso...';
  }
  try {
    const stateJson = { clients, feeds, stories, highlights, pedPlans, meta: { showAllDates, showAllCopy } };
    
    const { error } = await supabase.from('app_state').upsert({ id: 1, state_json: stateJson });
    if (error) throw error;

    lastStateStr = JSON.stringify({clients, feeds, stories, highlights, pedPlans});
    
    if (syncBtn) {
      syncBtn.textContent = 'Saved \u2713';
      syncBtn.style.opacity = '1';
      syncBtn.style.pointerEvents = 'auto';
      setTimeout(() => { if (syncBtn.textContent === 'Saved \u2713') syncBtn.textContent = 'Sync DB'; }, 2000);
    }

    if (showToastMsg) {
      const loader = document.getElementById('dbx-loader');
      if(loader) loader.style.display = 'none';
      showToast('\u2713 Salvataggio completato');
    }
  } catch (err) {
    console.error('Supabase sync error:', err);
    if (syncBtn) {
      syncBtn.textContent = 'Sync DB';
      syncBtn.style.opacity = '1';
      syncBtn.style.pointerEvents = 'auto';
    }
    if (showToastMsg) {
      const loader = document.getElementById('dbx-loader');
      if(loader) loader.style.display = 'none';
      alert('Errore sincronizzazione: ' + err.message);
    }
  }
}

async function loadFromSupabase(silent = false) {
  const loader = document.getElementById('dbx-loader');
  if (!silent) {
    if(loader) loader.style.display = 'flex';
    const ltext = document.getElementById('dbx-loader-text');
    if(ltext) ltext.textContent = 'Caricamento database...';
  }

  try {
    const { data, error } = await supabase.from('app_state').select('state_json').eq('id', 1).single();
    if (error && error.code !== 'PGRST116') console.error(error);
    
    if (data && data.state_json) {
      const globalData = data.state_json;
      clients = globalData.clients || [];
      pedPlans = globalData.pedPlans || {};
      feeds = globalData.feeds || {};
      stories = globalData.stories || {};
      highlights = globalData.highlights || {};
      if (globalData.meta) { 
        showAllDates = globalData.meta.showAllDates !== false; 
        showAllCopy = globalData.meta.showAllCopy !== false; 
      }
    }

    feedClientIdx = -1; feedAccountIdx = -1; feedMonth = '';
    storiesClientIdx = -1; storiesAccountIdx = -1; storiesMonth = '';
    renderStudio(); rebuildAllSelects(); renderFeedGrid(); renderStoriesGrid(); updateFeedHeader(); updateStoriesHeader();
    lastStateStr = JSON.stringify({clients, feeds, stories, highlights, pedPlans});
    if (!silent) showToast('\u2713 Dati caricati');
  } catch (err) {
    console.error('Supabase load error:', err);
    if (!silent) alert('Errore caricamento da Supabase: ' + err.message);
  } finally {
    if (!silent && loader) loader.style.display = 'none';
  }
}