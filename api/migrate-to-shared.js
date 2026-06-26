// ONE-TIME migration: merges all user data into nassa_studio
// Call: POST /api/migrate-to-shared with x-nassa-key header
import { createClient } from '@supabase/supabase-js';

function getSupabase() {
  return createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_KEY,
    { auth: { persistSession: false } }
  );
}

function mergeData(base, override) {
  if (!base) return override;
  if (!override) return base;
  const result = { ...base };
  // Merge clients array — combine unique clients by name
  const baseClients = base.clients || [];
  const overrideClients = override.clients || [];
  const mergedClients = [...baseClients];
  for (const oc of overrideClients) {
    const exists = mergedClients.find(c => c.name === oc.name);
    if (!exists) mergedClients.push(oc);
  }
  result.clients = mergedClients;
  // Merge feeds, stories, highlights, pilastri, pedPlans, notes, ads — all keyed objects
  for (const key of ['feeds','stories','highlights','pilastri','pedPlans','notesData','adsCampaigns','nassaDocs']) {
    const baseObj = base[key] || {};
    const overObj = override[key] || {};
    result[key] = { ...baseObj, ...overObj };
  }
  return result;
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') return res.status(200).end();
  const key = req.headers['x-nassa-key'];
  if (key !== (process.env.NASSA_API_KEY || 'NASSA_SECRET_2026'))
    return res.status(401).json({ error: 'Non autorizzato' });

  try {
    const supabase = getSupabase();
    // Load all rows
    const { data: rows, error } = await supabase
      .from('projects')
      .select('user_id, data, updated_at');
    if (error) return res.status(500).json({ error: error.message });

    const users = rows.map(r => r.user_id);
    let merged = null;

    // Merge all user data together
    for (const row of rows) {
      if (row.user_id === 'nassa_studio') continue; // skip existing shared if any
      merged = mergeData(merged, row.data);
    }

    if (!merged) return res.status(200).json({ ok: true, message: 'Nothing to merge', users });

    // Write merged data to nassa_studio
    const { error: upsertError } = await supabase
      .from('projects')
      .upsert(
        { user_id: 'nassa_studio', data: merged, updated_at: new Date().toISOString() },
        { onConflict: 'user_id' }
      );
    if (upsertError) return res.status(500).json({ error: upsertError.message });

    return res.status(200).json({
      ok: true,
      message: 'Migration complete',
      users_merged: users,
      clients_count: merged.clients?.length || 0
    });
  } catch(err) {
    return res.status(500).json({ error: err.message });
  }
}
