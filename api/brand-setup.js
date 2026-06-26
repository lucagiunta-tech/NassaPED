// One-time setup: creates brand_data table in Supabase
// Call: POST /api/brand-setup with x-nassa-key
import { createClient } from '@supabase/supabase-js';

export default async function handler(req, res) {
  const key = req.headers['x-nassa-key'];
  if (key !== (process.env.NASSA_API_KEY || 'NASSA_SECRET_2026')) return res.status(401).json({ error: 'Non autorizzato' });

  const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY, { auth: { persistSession: false } });

  // Create table via raw SQL
  const { error } = await supabase.rpc('exec_sql', {
    sql: `CREATE TABLE IF NOT EXISTS brand_data (
      client_id TEXT PRIMARY KEY,
      data JSONB NOT NULL DEFAULT '{}',
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );`
  }).catch(() => ({ error: 'rpc not available' }));

  // Try direct insert to check if table exists
  const { error: testError } = await supabase.from('brand_data').select('client_id').limit(1);

  if (testError?.code === '42P01') {
    return res.status(200).json({ ok: false, message: 'Tabella brand_data non esiste — creala manualmente in Supabase con: CREATE TABLE brand_data (client_id TEXT PRIMARY KEY, data JSONB DEFAULT \'{}\', updated_at TIMESTAMPTZ DEFAULT NOW());' });
  }

  return res.status(200).json({ ok: true, message: 'Tabella brand_data OK' });
}
