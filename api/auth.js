/**
 * /api/auth
 * Multi-user login backed by Supabase nassa_users table.
 * Passwords are bcrypt-hashed — never stored plain.
 *
 * POST   { username, password } → sets HttpOnly JWT cookie
 * GET                           → verifies current session
 * DELETE                        → logout
 *
 * Vercel env vars required:
 *   SUPABASE_URL, SUPABASE_SERVICE_KEY, JWT_SECRET
 */

import { createClient } from '@supabase/supabase-js';
import { SignJWT, jwtVerify } from 'jose';
import bcrypt from 'bcryptjs';

const SESSION_COOKIE = 'nassa_session';
const SESSION_DAYS   = 30;

const ORIGINS = [
  'https://nassa-ped-yp63.vercel.app',
  'http://localhost:3000',
];

// ── Supabase ────────────────────────────────────────────────
let _sb = null;
function getSB() {
  if (!_sb) {
    if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_KEY)
      throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_KEY');
    _sb = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_KEY,
      { auth: { persistSession: false } }
    );
  }
  return _sb;
}

// ── JWT ─────────────────────────────────────────────────────
async function getSecret() {
  const s = process.env.JWT_SECRET || 'nassa_fallback_secret_2026';
  return new TextEncoder().encode(s);
}

async function createToken(payload) {
  const secret = await getSecret();
  return new SignJWT(payload)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_DAYS}d`)
    .sign(secret);
}

async function verifyToken(token) {
  try {
    const secret = await getSecret();
    const { payload } = await jwtVerify(token, secret);
    return payload;
  } catch { return null; }
}

// ── Cookie ──────────────────────────────────────────────────
function setCookie(res, value, maxAge) {
  const cookie = [
    `${SESSION_COOKIE}=${value}`,
    `Max-Age=${maxAge}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Strict',
    process.env.NODE_ENV !== 'development' ? 'Secure' : '',
  ].filter(Boolean).join('; ');
  res.setHeader('Set-Cookie', cookie);
}

function getCookie(req) {
  const raw = req.headers.cookie || '';
  const match = raw.match(new RegExp(`(?:^|;\\s*)${SESSION_COOKIE}=([^;]+)`));
  return match ? match[1] : null;
}

// ── Handler ─────────────────────────────────────────────────
export default async function handler(req, res) {
  const origin = req.headers.origin;
  if (ORIGINS.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  }
  if (req.method === 'OPTIONS') return res.status(200).end();

  // ── POST: login ──────────────────────────────────────────
  if (req.method === 'POST') {
    const { username, password } = req.body || {};
    if (!username || !password)
      return res.status(400).json({ error: 'Username e password obbligatori' });

    try {
      const sb = getSB();
      const { data: user, error } = await sb
        .from('nassa_users')
        .select('username, password_hash, role')
        .eq('username', username.toLowerCase().trim())
        .maybeSingle();

      if (error) throw error;

      // Always run bcrypt compare (even on miss) to prevent timing attacks
      const hash = user?.password_hash || '$2b$12$invalidhashpadding000000000000000000000000000000000000';
      const match = await bcrypt.compare(password, hash);

      if (!user || !match)
        return res.status(401).json({ error: 'Credenziali non corrette' });

      const token = await createToken({
        app:      'nassa',
        username: user.username,
        role:     user.role,
        v:        3,
      });
      setCookie(res, token, SESSION_DAYS * 86400);
      return res.status(200).json({ ok: true, username: user.username, role: user.role });

    } catch (err) {
      console.error('[auth] login error:', err.message);
      return res.status(500).json({ error: 'Errore server' });
    }
  }

  // ── GET: verify session ──────────────────────────────────
  if (req.method === 'GET') {
    const token = getCookie(req);
    if (!token) return res.status(401).json({ ok: false });
    const payload = await verifyToken(token);
    if (!payload) return res.status(401).json({ ok: false });

    // Auto-renew if less than 7 days left
    const exp = payload.exp || 0;
    if (exp - Date.now() / 1000 < 7 * 86400) {
      const newToken = await createToken({
        app:      'nassa',
        username: payload.username,
        role:     payload.role,
        v:        3,
      });
      setCookie(res, newToken, SESSION_DAYS * 86400);
    }
    return res.status(200).json({ ok: true, username: payload.username, role: payload.role });
  }

  // ── DELETE: logout ───────────────────────────────────────
  if (req.method === 'DELETE') {
    setCookie(res, '', 0);
    return res.status(200).json({ ok: true });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
