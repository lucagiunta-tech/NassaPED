/**
 * /api/auth
 * POST { user, password } → cookie HttpOnly nassa_session (JWT)
 * GET                     → verifica sessione corrente
 * DELETE                  → logout
 *
 * Credenziali in Vercel env:
 *   NASSA_USERS = JSON con mappa { "luca":"pass1", "alberto":"pass2", ... }
 *   oppure fallback NASSA_PASSWORD per password unica
 *   JWT_SECRET per firmare i token
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

// Verifica credenziali — supporta utenti multipli o password unica
function checkCredentials(user, password){
  // Prima: prova con NASSA_USERS (JSON map)
  const usersEnv = process.env.NASSA_USERS;
  if(usersEnv){
    try {
      const users = JSON.parse(usersEnv);
      // Normalizza: chiavi lowercase
      const userKey = (user || '').toLowerCase().trim();
      if(users[userKey] && users[userKey] === password) return userKey;
      // Cerca anche chiavi non-lowercase
      const match = Object.entries(users).find(([k,v]) =>
        k.toLowerCase() === userKey && v === password
      );
      if(match) return match[0];
    } catch(e) {
      console.warn('[auth] NASSA_USERS parse error:', e.message);
    }
  }
  // Fallback: password unica (retrocompatibilità)
  const PASS = process.env.NASSA_PASSWORD || process.env.NASSA_API_KEY || 'NASSA_SECRET_2026';
  if(password === PASS) return (user || 'shared').toLowerCase().trim();
  return null;
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
    if(!password || !user)
      return res.status(400).json({ error: 'Utente e password obbligatori' });

    const validUser = checkCredentials(user, password);
    if(!validUser)
      return res.status(401).json({ error: 'Credenziali non corrette' });

    const token = await createToken({ app: 'nassa', user: validUser, v: 2 });
    setCookie(res, token, SESSION_DAYS * 86400);
    return res.status(200).json({ ok: true, user: validUser });
  }

  // GET — verifica sessione
  if(req.method === 'GET'){
    const token = getCookie(req);
    if(!token) return res.status(401).json({ ok: false, reason: 'no_session' });
    const payload = await verifyToken(token);
    if(!payload) return res.status(401).json({ ok: false, reason: 'invalid_token' });
    // Rinnova cookie se scade entro 7 giorni
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
