/**
 * Middleware di autenticazione condiviso tra tutte le API.
 * Verifica il cookie nassa_session (JWT HttpOnly) OPPURE,
 * per retrocompatibilità durante la migrazione, l'header x-nassa-key.
 *
 * Uso:
 *   import { requireAuth } from '../lib/auth-middleware.js';
 *   export default async function handler(req, res){
 *     if(!await requireAuth(req, res)) return;
 *     // ... logica API
 *   }
 */

import { jwtVerify } from 'jose';

const SESSION_COOKIE = 'nassa_session';
const LEGACY_KEY     = process.env.NASSA_API_KEY;

async function getSecret(){
  const s = process.env.JWT_SECRET || process.env.NASSA_API_KEY || 'nassa_fallback_secret_2026';
  return new TextEncoder().encode(s);
}

function getCookie(req){
  const raw = req.headers.cookie || '';
  const match = raw.match(new RegExp(`(?:^|;\\s*)${SESSION_COOKIE}=([^;]+)`));
  return match ? match[1] : null;
}

/**
 * Verifica autenticazione. Ritorna true se ok, false se ha già risposto con 401.
 */
export async function requireAuth(req, res){
  // 1. Cookie HttpOnly (nuovo sistema)
  const token = getCookie(req);
  if(token){
    try {
      const secret = await getSecret();
      await jwtVerify(token, secret);
      return true;
    } catch {
      // token invalido — prova fallback
    }
  }

  // 2. Header x-nassa-key (retrocompatibilità durante migrazione)
  const key = req.headers['x-nassa-key'];
  if(key && key === LEGACY_KEY) return true;

  // 3. Non autenticato
  res.status(401).json({ error: 'Non autorizzato. Effettua il login.' });
  return false;
}

export function getUserFromReq(req){
  // Estrae user dal cookie se presente
  const cookie = getCookie(req);
  if(!cookie) return req.headers['x-nassa-key'] ? 'legacy' : null;
  try {
    // Decode senza verify (già verificato in requireAuth)
    const [, payload] = cookie.split('.');
    const data = JSON.parse(Buffer.from(payload, 'base64url').toString());
    return data.user || 'default';
  } catch { return 'default'; }
}
