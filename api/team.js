/**
 * /api/team
 * Fonte di verità unica per i membri del team Nassa Studio.
 *
 * GET → { team: [...] }
 *
 * Ogni membro ha:
 *   initials  — sigla 2 lettere (chiave usata in index.html / nplan tasks)
 *   id        — slug lowercase (usato in tweek.html / nplan TEAM_MEMBERS)
 *   nome      — nome completo
 *   label     — nome breve (per UI compatte)
 *   email     — email aziendale
 *   role      — Manager | Member | Extern
 *   bg        — colore sfondo avatar (hex)
 *   color     — colore testo avatar (hex)
 *   costH     — costo orario interno (€)
 *   rateH     — tariffa oraria cliente (€)
 *   active    — bool, false = nascosto dai picker ma dati storici intatti
 */

import { jwtVerify } from 'jose';

const SESSION_COOKIE = 'nassa_session';
const ALLOWED_ORIGINS = [
  'https://nassa-ped-yp63.vercel.app',
  'http://localhost:3000',
];

async function getUser(req) {
  const raw = req.headers.cookie || '';
  const match = raw.match(new RegExp(`(?:^|;\\s*)${SESSION_COOKIE}=([^;]+)`));
  if (!match) return null;
  try {
    const secret = new TextEncoder().encode(process.env.JWT_SECRET || 'nassa_fallback_secret_2026');
    const { payload } = await jwtVerify(match[1], secret);
    return payload;
  } catch { return null; }
}

// ── Fonte di verità ───────────────────────────────────────────────────────
// Per aggiungere un membro: aggiungi qui + aggiorna nassa_users in Supabase.
// I colori bg/color sono quelli usati negli avatar in tutta la suite.
const TEAM = [
  {
    initials: 'LG', id: 'luca',    label: 'Luca',
    nome: 'Luca Giunta',
    email: 'luca.giunta@nassastudio.it',
    role: 'Manager',
    bg: '#F5C842', color: '#1a1a1a',
    costH: 30, rateH: 50,
    active: true,
  },
  {
    initials: 'AA', id: 'alberto', label: 'Alberto',
    nome: 'Alberto Arcidiacono',
    email: 'alberto@nassastudio.it',
    role: 'Manager',
    bg: '#3B5BDB', color: '#ffffff',
    costH: 30, rateH: 50,
    active: true,
  },
  {
    initials: 'GC', id: 'giacomo', label: 'Giacomo',
    nome: 'Giacomo Cannizzaro',
    email: 'giacomo@nassastudio.it',
    role: 'Member',
    bg: '#0F6E56', color: '#ffffff',
    costH: 25, rateH: 40,
    active: true,
  },
  {
    initials: 'PF', id: 'paolone', label: 'Paolone',
    nome: 'Paolone (Paolo F.)',
    email: 'paolo.f@nassastudio.it',
    role: 'Member',
    bg: '#7C3AED', color: '#ffffff',
    costH: 25, rateH: 40,
    active: true,
  },
  {
    initials: 'AK', id: 'akash',   label: 'Akash',
    nome: 'Akash',
    email: 'akash@nassastudio.it',
    role: 'Member',
    bg: '#C2185B', color: '#ffffff',
    costH: 20, rateH: 35,
    active: true,
  },
  {
    initials: 'PC', id: 'paoletto',label: 'Paoletto',
    nome: 'Paoletto (Paolo C.)',
    email: 'paolo.c@nassastudio.it',
    role: 'Member',
    bg: '#E65100', color: '#ffffff',
    costH: 20, rateH: 35,
    active: true,
  },
];

export default async function handler(req, res) {
  const origin = req.headers.origin;
  const allowed = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  res.setHeader('Access-Control-Allow-Origin', allowed);
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Cache-Control', 'private, max-age=300'); // cache 5min lato browser
  if (req.method === 'OPTIONS') return res.status(200).end();

  // Auth — team data non è sensibile ma limitiamo agli utenti loggati
  const user = await getUser(req);
  if (!user) return res.status(401).json({ error: 'Non autorizzato' });

  if (req.method === 'GET') {
    return res.status(200).json({ team: TEAM });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
