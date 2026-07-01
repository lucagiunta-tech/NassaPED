/**
 * /api/planning
 * Supabase proxy per i task del planning home hub.
 * Persistenza per user: nassa_planning table.
 *
 * GET  → carica tasks dell'utente corrente
 * POST { tasks, clienti, progetti } → salva (upsert)
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
    const secret = new TextEncoder().encode(process.env.JWT_SECRET || 'nassa_fallback_secret_2026');
    const { payload } = await jwtVerify(token, secret);
    return payload.user || 'default';
  } catch { return null; }
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
  const legacyOk = legacyKey && legacyKey === (process.env.NASSA_API_KEY || 'NASSA_SECRET_2026');
  const authedUser = user || (legacyOk ? 'shared' : null);
  if (!authedUser) return res.status(401).json({ error: 'Non autorizzato.' });

  const sb = getSB();

  // GET — load
  if (req.method === 'GET') {
    const { data, error } = await sb
      .from('nassa_planning')
      .select('data')
      .eq('user_id', authedUser)
      .single();

    if (error && error.code !== 'PGRST116') {
      return res.status(500).json({ error: error.message });
    }
    return res.status(200).json({ data: data?.data || null });
  }

  // POST — save
  if (req.method === 'POST') {
    let body;
    try { body = await new Promise((r, j) => { let b = ''; req.on('data', c => b += c); req.on('end', () => r(JSON.parse(b))); req.on('error', j); }); }
    catch { return res.status(400).json({ error: 'Body non valido' }); }

    const { tasks, clienti, progetti } = body;
    const { error } = await sb
      .from('nassa_planning')
      .upsert({ user_id: authedUser, data: { tasks, clienti, progetti }, updated_at: new Date().toISOString() });

    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ ok: true });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
