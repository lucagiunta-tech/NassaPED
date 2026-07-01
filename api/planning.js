/**
 * /api/planning
 * Supabase proxy — home planning hub + Nassa Plan data
 *
 * GET  → carica dati { tasks, contenuti, projects, logged, planningTasks, clienti, progetti }
 * POST { ...any fields } → upsert (merge con dati esistenti)
 *
 * Vercel env vars: SUPABASE_URL, SUPABASE_SERVICE_KEY, JWT_SECRET
 */
import { createClient } from '@supabase/supabase-js';
import { jwtVerify } from 'jose';

const SESSION_COOKIE = 'nassa_session';
const ALLOWED_ORIGINS = [
  'https://nassa-ped-yp63.vercel.app',
  'http://localhost:3000',
];

let _sb = null;
function getSB() {
  if (!_sb) {
    _sb = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_KEY,
      { auth: { persistSession: false } }
    );
  }
  return _sb;
}

function getCookie(req) {
  const raw = req.headers.cookie || '';
  const match = raw.match(new RegExp(`(?:^|;\\s*)${SESSION_COOKIE}=([^;]+)`));
  return match ? match[1] : null;
}

async function getUser(req) {
  const token = getCookie(req);
  if (!token) return null;
  try {
    const secret = new TextEncoder().encode(process.env.JWT_SECRET);
    const { payload } = await jwtVerify(token, secret);
    return payload.user || 'default';
  } catch { return null; }
}

const MAX_PLANNING_BYTES = 8 * 1024 * 1024; // 8MB hard limit for planning blob

async function readBody(req) {
  return new Promise((resolve, reject) => {
    let b = '';
    let size = 0;
    req.on('data', chunk => {
      size += chunk.length;
      if (size > MAX_PLANNING_BYTES) {
        req.destroy();
        reject(new Error(`Payload troppo grande: ${Math.round(size/1024)}KB (max ${Math.round(MAX_PLANNING_BYTES/1024)}KB)`));
        return;
      }
      b += chunk;
    });
    req.on('end', () => { try { resolve(JSON.parse(b)); } catch { reject(new Error('Invalid JSON')); } });
    req.on('error', reject);
  });
}

export default async function handler(req, res) {
  const origin = req.headers.origin;
  const allowedOrigin = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  res.setHeader('Access-Control-Allow-Origin', allowedOrigin);
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-nassa-key');
  res.setHeader('Vary', 'Origin');
  if (req.method === 'OPTIONS') return res.status(200).end();

  // Auth
  const user = await getUser(req);
  const legacyKey = req.headers['x-nassa-key'];
  const legacyOk = legacyKey && legacyKey === process.env.NASSA_API_KEY;
  const authedUser = user || (legacyOk ? 'shared' : null);
  if (!authedUser) return res.status(401).json({ error: 'Non autorizzato.' });

  const sb = getSB();

  // GET — load all data for this user
  if (req.method === 'GET') {
    const { data, error } = await sb
      .from('nassa_planning')
      .select('data')
      .eq('user_id', authedUser)
      .single();

    if (error && error.code !== 'PGRST116') {
      return res.status(500).json({ error: error.message });
    }
    const dataBlob = data?.data || null;
    const sizeKB = dataBlob ? Math.round(JSON.stringify(dataBlob).length / 1024) : 0;
    if (sizeKB > 2048) console.warn(`[planning] GET blob ${sizeKB}KB for ${authedUser}`);
    return res.status(200).json({ data: dataBlob, sizeKB });
  }

  // POST — merge and save
  if (req.method === 'POST') {
    let body;
    try { body = await readBody(req); }
    catch { return res.status(400).json({ error: 'Body non valido' }); }

    // Load existing data first, then merge
    const { data: existing } = await sb
      .from('nassa_planning')
      .select('data')
      .eq('user_id', authedUser)
      .single();

    const current = existing?.data || {};

    // ── Namespace fix: keep homeTasks and tasks separate ──────────────────
    // homeTasks = Home Planning tasks (index.html)
    // tasks     = Nassa Plan tasks    (nplan.html)
    // If client sends 'homeTasks', never let it overwrite 'tasks' and vice versa.
    // Also: one-time migration — if old data has 'tasks' from index.html
    // (detected by absence of nplan-specific fields like 'contenuti'),
    // rename it to 'homeTasks' to prevent future collisions.
    const merged = { ...current };

    // Apply incoming fields
    for (const [k, v] of Object.entries(body)) {
      merged[k] = v;
    }

    // One-time migration: if we have tasks but no homeTasks and no contenuti,
    // the tasks blob is from the old index.html — move it safely.
    if (merged.tasks && !merged.homeTasks && !merged.contenuti) {
      merged.homeTasks = merged.tasks;
      delete merged.tasks;
    }

    merged.updated_at = new Date().toISOString();

    // Warn when blob grows large (soft limit: 2MB)
    const blobSize = JSON.stringify(merged).length;
    if (blobSize > 2 * 1024 * 1024) {
      console.warn(`[planning] Blob large: ${Math.round(blobSize/1024)}KB for user ${authedUser}`);
    }

    const { error } = await sb
      .from('nassa_planning')
      .upsert({ user_id: authedUser, data: merged, updated_at: new Date().toISOString() });

    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ ok: true, sizeKB: Math.round(blobSize / 1024) });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}

