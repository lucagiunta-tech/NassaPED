// Supabase proxy — all credentials server-side
// Required Vercel env vars: SUPABASE_URL, SUPABASE_SERVICE_KEY, NASSA_API_KEY
import { createClient } from '@supabase/supabase-js';

let _supabase = null;
function getSupabase() {
  if (!_supabase) {
    if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_KEY)
      throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_KEY');
    _supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_KEY,
      { auth: { persistSession: false } }
    );
  }
  return _supabase;
}

// FIX QA: CORS ristretto — non più wildcard *
const ALLOWED_ORIGINS = [
  'https://nassa-ped-yp63.vercel.app',
  'http://localhost:3000',
];

// FIX QA: sanitizza lo user ID — previene injection su query Supabase
// Supabase usa parametri preparati quindi il rischio SQL injection è basso,
// ma un user ID malformato può creare chiavi errate nel DB.
function safeUser(user) {
  return String(user || 'shared')
    .replace(/[^a-zA-Z0-9_\-@.]/g, '_')
    .slice(0, 100);
}

// FIX QA: validazione dimensione body — previene oversized payload
const MAX_BODY_BYTES = 15 * 1024 * 1024; // 15MB soft limit (Vercel bodyParser set to 16MB)

// Increase body parser limit above Vercel's 4MB default
export const config = {
  api: {
    bodyParser: {
      sizeLimit: '16mb', // matches MAX_BODY_BYTES below; Vercel enforces this first
    },
  },
};

export default async function handler(req, res) {
  // FIX QA: CORS ristretto
  const origin = req.headers.origin;
  const allowedOrigin = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  res.setHeader('Access-Control-Allow-Origin', allowedOrigin);
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-nassa-key');
  res.setHeader('Vary', 'Origin');
  if (req.method === 'OPTIONS') return res.status(200).end();

  // Auth: cookie HttpOnly (nuovo) o x-nassa-key (legacy)
  const sessionCookie = (req.headers.cookie||'').match(/nassa_session=([^;]+)/)?.[1];
  const key = req.headers['x-nassa-key'];
  if (!sessionCookie && (!key || key !== process.env.NASSA_API_KEY))
    return res.status(401).json({ error: 'Non autorizzato' });

  const rawUser = req.method === 'GET' ? req.query.user : req.body?.user;
  if (!rawUser) return res.status(400).json({ error: 'Missing user' });
  const user = safeUser(rawUser);

  try {
    const supabase = getSupabase();

    if (req.method === 'GET') {
      const { data, error } = await supabase
        .from('projects')
        .select('data, updated_at')
        .eq('user_id', user)
        .maybeSingle();
      if (error) return res.status(500).json({ error: error.message });
      return res.status(200).json({ data: data?.data ?? null, updatedAt: data?.updated_at ?? null });
    }

    if (req.method === 'POST') {
      const { data: projectData } = req.body;
      if (projectData === undefined) return res.status(400).json({ error: 'Missing data' });

      // FIX QA: controlla dimensione payload prima di scrivere su DB
      const payloadSize = JSON.stringify(projectData).length;
      if (payloadSize > MAX_BODY_BYTES) {
        console.warn('[api/project] Payload too large:', Math.round(payloadSize/1024), 'KB');
        return res.status(413).json({ error: `Progetto troppo grande: ${Math.round(payloadSize/1024)}KB (max ${Math.round(MAX_BODY_BYTES/1024/1024)}MB). Contatta il supporto.` });
      }

      const { error } = await supabase
        .from('projects')
        .upsert(
          { user_id: user, data: projectData, updated_at: new Date().toISOString() },
          { onConflict: 'user_id' }
        );
      if (error) return res.status(500).json({ error: error.message });
      return res.status(200).json({ ok: true });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    console.error('[api/project]', err.message);
    return res.status(500).json({ error: err.message });
  }
}
