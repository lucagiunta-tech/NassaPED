/**
 * /api/client-view
 *
 * Endpoint pubblico per il portale cliente — nessuna auth richiesta.
 * La sicurezza è data dallo shareToken nell'URL (opaco, 12 char hex).
 *
 * GET  ?slug=xxx  → restituisce i dati del cliente (feeds, approvazioni)
 * POST { slug, field, data } → scrive solo campi approvazione (feeds)
 *
 * Non espone dati interni (costi, note interne, dati altri clienti).
 * Legge/scrive su Supabase projects table, user_id = 'nassa_studio'.
 */

import { createClient } from '@supabase/supabase-js';

const ALLOWED_ORIGINS = [
  'https://nassa-ped-yp63.vercel.app',
  'http://localhost:3000',
];

// Campi che il cliente può modificare — whitelist stretta
const WRITABLE_FEED_FIELDS = ['apprStato', 'apprNote', 'apprBy', 'apprDate', 'revision'];

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

function safeSlug(raw) {
  return String(raw || '').replace(/[^a-zA-Z0-9_\-%.]/g, '').slice(0, 200);
}

export default async function handler(req, res) {
  const origin = req.headers.origin;
  const allowed = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  res.setHeader('Access-Control-Allow-Origin', allowed);
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Vary', 'Origin');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const sb = getSB();

  // ── GET: carica dati cliente pubblici ─────────────────────────────────
  if (req.method === 'GET') {
    const rawSlug = req.query.slug || '';
    if (!rawSlug) return res.status(400).json({ error: 'slug mancante' });
    const slug = safeSlug(rawSlug);

    const { data, error } = await sb
      .from('projects')
      .select('data')
      .eq('user_id', 'nassa_studio')
      .single();

    if (error) return res.status(500).json({ error: error.message });
    if (!data?.data) return res.status(404).json({ error: 'Nessun dato' });

    const projectData = data.data;

    // Trova il cliente tramite shareToken, id, o nome encodato
    const client = (projectData.clients || []).find(c =>
      c.shareToken === slug ||
      c.id         === slug ||
      encodeURIComponent(c.name) === slug
    );

    if (!client) return res.status(404).json({ error: 'Cliente non trovato' });

    // Restituisce solo i dati necessari al portale — no dati interni
    const clientFeeds = {};
    const clientAccIds = new Set((client.accounts || []).map(a => a.id));
    Object.entries(projectData.feeds || {}).forEach(([k, v]) => {
      const accId = k.split('|||')[0];
      if (clientAccIds.has(accId)) clientFeeds[k] = v;
    });

    return res.status(200).json({
      client: {
        id:           client.id,
        name:         client.name,
        slug:         client.slug || '',
        shareToken:   client.shareToken || '',
        pkg:          client.pkg || '',
        color:        client.color || '',
        accounts:     client.accounts || [],
        approvals:    client.approvals || [],
        moodboard:    client.moodboard || [],
        brand:        client.brand || {},
        pilastri:     projectData.pilastri?.[client.name] || [],
        formati:      projectData.formati?.[client.name] || [],
        pedPlans:     projectData.pedPlans?.[client.id] || {},
      },
      feeds: clientFeeds,
    });
  }

  // ── POST: aggiorna stato approvazione feed ─────────────────────────────
  if (req.method === 'POST') {
    let body;
    try {
      await new Promise((resolve, reject) => {
        let b = '';
        req.on('data', c => b += c);
        req.on('end', () => { try { body = JSON.parse(b); resolve(); } catch { reject(new Error('JSON non valido')); } });
        req.on('error', reject);
      });
    } catch(e) {
      return res.status(400).json({ error: e.message });
    }

    const { slug: rawSlug, feedKey, itemIndex, updates } = body || {};
    if (!rawSlug || !feedKey || itemIndex == null || !updates) {
      return res.status(400).json({ error: 'Parametri mancanti: slug, feedKey, itemIndex, updates' });
    }
    const slug = safeSlug(rawSlug);

    // Whitelist: solo campi approvazione consentiti
    const safeUpdates = {};
    Object.entries(updates).forEach(([k, v]) => {
      if (WRITABLE_FEED_FIELDS.includes(k)) safeUpdates[k] = v;
    });
    if (Object.keys(safeUpdates).length === 0) {
      return res.status(400).json({ error: 'Nessun campo scrivibile nella richiesta' });
    }

    // Load current data
    const { data: existing, error: loadErr } = await sb
      .from('projects')
      .select('data')
      .eq('user_id', 'nassa_studio')
      .single();

    if (loadErr) return res.status(500).json({ error: loadErr.message });

    const projectData = existing?.data || {};

    // Verify client exists
    const client = (projectData.clients || []).find(c =>
      c.shareToken === slug || c.id === slug || encodeURIComponent(c.name) === slug
    );
    if (!client) return res.status(404).json({ error: 'Cliente non trovato' });

    // Verify feedKey belongs to this client
    const clientAccIds = new Set((client.accounts || []).map(a => a.id));
    const feedAccId = feedKey.split('|||')[0];
    if (!clientAccIds.has(feedAccId)) {
      return res.status(403).json({ error: 'Feed non appartiene a questo cliente' });
    }

    // Apply update — only to the specific item
    const feed = projectData.feeds?.[feedKey] || [];
    if (itemIndex < 0 || itemIndex >= feed.length) {
      return res.status(400).json({ error: 'itemIndex fuori range' });
    }
    feed[itemIndex] = { ...feed[itemIndex], ...safeUpdates };
    if (!projectData.feeds) projectData.feeds = {};
    projectData.feeds[feedKey] = feed;

    // Write back
    const { error: saveErr } = await sb
      .from('projects')
      .upsert(
        { user_id: 'nassa_studio', data: projectData, updated_at: new Date().toISOString() },
        { onConflict: 'user_id' }
      );

    if (saveErr) return res.status(500).json({ error: saveErr.message });
    return res.status(200).json({ ok: true });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
