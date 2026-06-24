/**
 * /api/auth — senza dipendenze esterne (usa crypto nativo Node.js)
 * POST { user, password } → cookie HttpOnly session
 * GET                     → verifica sessione
 * DELETE                  → logout
 */

import { createHmac, randomBytes, timingSafeEqual } from 'crypto';

const SESSION_COOKIE = 'nassa_session';
const SESSION_DAYS   = 30;

function getSecret(){
  return process.env.JWT_SECRET || process.env.NASSA_API_KEY || 'nassa_fallback_2026';
}

// Token semplice: base64(payload).base64(hmac) — no dipendenze
function createToken(payload){
  const data = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const sig  = createHmac('sha256', getSecret()).update(data).digest('base64url');
  return `${data}.${sig}`;
}

function verifyToken(token){
  try {
    const [data, sig] = token.split('.');
    if(!data || !sig) return null;
    const expected = createHmac('sha256', getSecret()).update(data).digest('base64url');
    // timing-safe compare
    const a = Buffer.from(sig);
    const b = Buffer.from(expected);
    if(a.length !== b.length || !timingSafeEqual(a, b)) return null;
    const payload = JSON.parse(Buffer.from(data, 'base64url').toString());
    if(payload.exp && payload.exp < Date.now()/1000) return null;
    return payload;
  } catch { return null; }
}

function setCookie(res, value, maxAge){
  const parts = [
    `${SESSION_COOKIE}=${value}`,
    `Max-Age=${maxAge}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Strict',
  ];
  if(process.env.NODE_ENV !== 'development') parts.push('Secure');
  res.setHeader('Set-Cookie', parts.join('; '));
}

function getCookie(req){
  const raw = req.headers.cookie || '';
  const match = raw.match(new RegExp(`(?:^|;\\s*)${SESSION_COOKIE}=([^;]+)`));
  return match ? match[1] : null;
}

function checkCredentials(user, password){
  // NASSA_USERS: JSON map {"luca":"pass1","alberto":"pass2"}
  const usersEnv = process.env.NASSA_USERS;
  if(usersEnv){
    try {
      const users = JSON.parse(usersEnv);
      const key = (user||'').toLowerCase().trim();
      const found = Object.entries(users).find(([k,v]) =>
        k.toLowerCase() === key && v === password
      );
      if(found) return found[0];
    } catch(e) {}
  }
  // Fallback: password unica
  const PASS = process.env.NASSA_PASSWORD || process.env.NASSA_API_KEY || 'NASSA_SECRET_2026';
  if(password === PASS) return (user||'shared').toLowerCase().trim();
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

    const exp = Math.floor(Date.now()/1000) + SESSION_DAYS * 86400;
    const token = createToken({ app:'nassa', user:validUser, exp, v:2 });
    setCookie(res, token, SESSION_DAYS * 86400);
    return res.status(200).json({ ok:true, user:validUser });
  }

  // GET — verifica sessione
  if(req.method === 'GET'){
    const token = getCookie(req);
    if(!token) return res.status(401).json({ ok:false, reason:'no_session' });
    const payload = verifyToken(token);
    if(!payload) return res.status(401).json({ ok:false, reason:'invalid_token' });
    // Rinnova se scade entro 7 giorni
    if(payload.exp - Date.now()/1000 < 7*86400){
      const exp = Math.floor(Date.now()/1000) + SESSION_DAYS*86400;
      const newToken = createToken({ app:'nassa', user:payload.user, exp, v:2 });
      setCookie(res, newToken, SESSION_DAYS*86400);
    }
    return res.status(200).json({ ok:true, user:payload.user });
  }

  // DELETE — logout
  if(req.method === 'DELETE'){
    setCookie(res, '', 0);
    return res.status(200).json({ ok:true });
  }

  return res.status(405).json({ error:'Method not allowed' });
}
