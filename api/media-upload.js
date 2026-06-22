// Supabase Storage upload — replaces Dropbox
// Uses same SUPABASE_URL + SUPABASE_SERVICE_KEY already in Vercel env vars
// No tokens to refresh, no expiry, URLs are permanent public CDN links
import { createClient } from '@supabase/supabase-js';
import formidable from 'formidable';
import { readFileSync, unlinkSync } from 'fs';
import { basename, extname } from 'path';

const BUCKET = 'nassa-media'; // created once in Supabase dashboard

const ALLOWED_MIME = new Set([
  'image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml',
  'video/mp4', 'video/quicktime', 'video/x-msvideo', 'video/webm', 'video/mpeg',
]);

const ALLOWED_ORIGINS = [
  'https://nassa-ped-yp63.vercel.app',
  'http://localhost:3000',
];

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

function safeName(raw) {
  return basename(String(raw || 'file'))
    .replace(/[^a-zA-Z0-9._\-]/g, '_')
    .slice(0, 200);
}

export const config = { api: { bodyParser: false } };

export default async function handler(req, res) {
  const origin = req.headers.origin;
  const allowedOrigin = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  res.setHeader('Access-Control-Allow-Origin', allowedOrigin);
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-nassa-key');
  res.setHeader('Vary', 'Origin');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const key = req.headers['x-nassa-key'];
  if (!key || key !== process.env.NASSA_API_KEY)
    return res.status(401).json({ error: 'Unauthorized' });
  if (req.method !== 'POST')
    return res.status(405).json({ error: 'Method not allowed' });

  let file = null;
  try {
    const form = formidable({ maxFileSize: 200 * 1024 * 1024 }); // 200MB
    const [fields, files] = await new Promise((resolve, reject) => {
      form.parse(req, (err, fields, files) => {
        if (err) reject(err); else resolve([fields, files]);
      });
    });

    file = Array.isArray(files.file) ? files.file[0] : files.file;
    if (!file) return res.status(400).json({ error: 'No file provided' });

    const mime = file.mimetype || '';
    if (!ALLOWED_MIME.has(mime)) {
      try { unlinkSync(file.filepath); } catch (_) {}
      return res.status(400).json({ error: `Tipo file non consentito: ${mime}` });
    }

    const user = (Array.isArray(fields.user) ? fields.user[0] : fields.user) || 'shared';
    const safeUser = String(user).replace(/[^a-zA-Z0-9_\-@.]/g, '_').slice(0, 50);
    const ext = extname(file.originalFilename || '').toLowerCase() || '.jpg';
    const name = safeName(file.originalFilename || 'upload');
    // Path: user/timestamp_filename — stays organized per user
    const storagePath = `${safeUser}/${Date.now()}_${name}`;

    const buffer = readFileSync(file.filepath);
    try { unlinkSync(file.filepath); } catch (_) {}

    const supabase = getSupabase();

    // Upload to Supabase Storage
    const { data, error } = await supabase.storage
      .from(BUCKET)
      .upload(storagePath, buffer, {
        contentType: mime,
        upsert: false, // never overwrite — timestamp prefix guarantees uniqueness
      });

    if (error) {
      console.error('[media-upload] Supabase storage error:', error.message);
      return res.status(500).json({ error: error.message });
    }

    // Get permanent public URL — no token, no expiry
    const { data: urlData } = supabase.storage
      .from(BUCKET)
      .getPublicUrl(storagePath);

    const publicUrl = urlData?.publicUrl;
    if (!publicUrl) {
      return res.status(500).json({ error: 'Failed to get public URL' });
    }

    console.log('[media-upload] ✅ Uploaded:', storagePath, '→', publicUrl.slice(0, 80));
    return res.status(200).json({ url: publicUrl, shared_link: publicUrl });

  } catch (err) {
    if (file?.filepath) { try { unlinkSync(file.filepath); } catch (_) {} }
    console.error('[media-upload]', err.message);
    return res.status(500).json({ error: err.message });
  }
}
