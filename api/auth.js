/**
 * /api/auth
 * POST { password } → imposta cookie HttpOnly nassa_session
 * GET              → verifica sessione corrente
 * DELETE           → logout (cancella cookie)
 *
 * La password è in NASSA_PASSWORD env var su Vercel.
 * Il JWT_SECRET è in JWT_SECRET env var su Vercel.
 */

import { SignJWT, jwtVerify } from 'jose';

const SESSION_COOKIE = 'nassa_session';
const SESSION_DAYS   = 30;

async function getSecret(){
  const s = process.env.JWT_SECRET || process.env.NASSA_API_KEY || 'nassa_fallback_secret_2026';
  return new TextEncoder().encode(s);
}

async function createToken(payload){
  const secret = await getSecret();
  return new SignJWT(payload)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_DAYS}d`)
    .sign(secret);
}

async function verifyToken(token){
  try {
    const secret = await getSecret();
    const { payload } = await jwtVerify(token, secret);
    return payload;
  } catch { return null; }
}

function setCookie(res, value, maxAge){
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

function getCookie(req){
  const raw = req.headers.cookie || '';
  const match = raw.match(new RegExp(`(?:^|;\\s*)${SESSION_COOKIE}=([^;]+)`));
  return match ? match[1] : null;
}

const ORIGINS = [
  'https://nassa-ped-yp63.vercel.app',
  'http://localhost:3000',
];

export default async function handler(req, res){
  const origin = req.headers.origin;
  if(ORIGINS.includes(origin)){
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  }
  if(req.method === 'OPTIONS') return res.status(200).end();

  // POST — login
  if(req.method === 'POST'){
    const { password, user } = req.body || {};
    const PASS = process.env.NASSA_PASSWORD || process.env.NASSA_API_KEY || 'NASSA_SECRET_2026';
    if(!password || password !== PASS)
      return res.status(401).json({ error: 'Password non corretta' });

    const token = await createToken({ app: 'nassa', user: user || 'default', v: 2 });
    setCookie(res, token, SESSION_DAYS * 86400);
    return res.status(200).json({ ok: true, user: user || 'default' });
  }

  // GET — verifica sessione
  if(req.method === 'GET'){
    const token = getCookie(req);
    if(!token) return res.status(401).json({ ok: false });
    const payload = await verifyToken(token);
    if(!payload) return res.status(401).json({ ok: false });
    // Rinnova il cookie se mancano meno di 7 giorni alla scadenza
    const exp = payload.exp || 0;
    if(exp - Date.now()/1000 < 7 * 86400){
      const newToken = await createToken({ app: 'nassa', user: payload.user, v: 2 });
      setCookie(res, newToken, SESSION_DAYS * 86400);
    }
    return res.status(200).json({ ok: true, user: payload.user });
  }

  // DELETE — logout
  if(req.method === 'DELETE'){
    setCookie(res, '', 0);
    return res.status(200).json({ ok: true });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
