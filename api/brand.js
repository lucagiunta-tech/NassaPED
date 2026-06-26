// NassaBrand API — legge clienti da nassa_studio, gestisce brand data separati
// Tabella Supabase: projects (user_id='nassa_studio') per clienti
// Tabella Supabase: brand_data (client_id, data JSON) per assets/approvals/moodboard
import { createClient } from '@supabase/supabase-js';

let _supabase = null;
function getSupabase() {
  if (!_supabase) _supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY, { auth: { persistSession: false } });
  return _supabase;
}

const ALLOWED_ORIGINS = ['https://nassa-ped-yp63.vercel.app', 'http://localhost:3000'];

export default async function handler(req, res) {
  const origin = req.headers.origin;
  const allowedOrigin = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  res.setHeader('Access-Control-Allow-Origin', allowedOrigin);
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-nassa-key');
  if (req.method === 'OPTIONS') return res.status(200).end();

  // Auth — public GET for /portal/:slug (client view), protected otherwise
  const isPublic = req.method === 'GET' && req.query.public === '1';
  if (!isPublic) {
    const cookie = (req.headers.cookie||'').match(/nassa_session=([^;]+)/)?.[1];
    const key = req.headers['x-nassa-key'];
    const validKey = process.env.NASSA_API_KEY || 'NASSA_SECRET_2026';
    if (!cookie && key !== validKey) return res.status(401).json({ error: 'Non autorizzato' });
  }

  const supabase = getSupabase();

  try {
    if (req.method === 'GET') {
      const slug = req.query.slug;

      // Load base clients from nassa_studio project
      const { data: proj } = await supabase.from('projects').select('data').eq('user_id', 'nassa_studio').single();
      const rawClients = proj?.data?.clients || [];

      // Load brand data
      const { data: brandRows } = await supabase.from('brand_data').select('*');
      const brandMap = {};
      (brandRows || []).forEach(r => { brandMap[r.client_id] = r.data || {}; });

      // Merge
      const clients = rawClients.map(c => {
        const bd = brandMap[c.id] || {};
        return {
          id: c.id,
          slug: c.id,
          name: c.name,
          color: c.color || '#1A8C3F',
          claim: bd.claim || '',
          archetype: bd.archetype || '',
          manager: bd.manager || '',
          brand: bd.brand || { colors: [], fonts: [], logos: [], templates: [] },
          approvals: bd.approvals || [],
          moodboard: bd.moodboard || [],
        };
      });

      if (slug) {
        const client = clients.find(c => c.slug === slug);
        if (!client) return res.status(404).json({ error: 'Cliente non trovato' });
        return res.status(200).json({ client });
      }

      return res.status(200).json({ clients });
    }

    if (req.method === 'POST') {
      const { clientId, field, data } = req.body || {};
      if (!clientId || !field) return res.status(400).json({ error: 'Missing clientId or field' });

      // Upsert brand_data for this client
      const { data: existing } = await supabase.from('brand_data').select('data').eq('client_id', clientId).single();
      const current = existing?.data || {};
      current[field] = data;

      const { error } = await supabase.from('brand_data').upsert(
        { client_id: clientId, data: current, updated_at: new Date().toISOString() },
        { onConflict: 'client_id' }
      );
      if (error) return res.status(500).json({ error: error.message });
      return res.status(200).json({ ok: true });
    }

  } catch(e) {
    return res.status(500).json({ error: e.message });
  }
}
