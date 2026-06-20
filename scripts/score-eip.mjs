/**
 * EIP Auto-Scorer
 *
 * Scores all investment sites (sez/park/factory/port/airport/logistics)
 * against the IFC/UNIDO/World Bank EIP Framework v2.0 across 4 pillars:
 *   Management   (0–25)
 *   Environmental(0–25)
 *   Social       (0–25)
 *   Economic     (0–25)
 *   Total        (0–100) → Bronze ≥40 / Silver ≥65 / Gold ≥80
 *
 * Usage: node scripts/score-eip.mjs
 * Reads credentials from .env (VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY)
 */

import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dir = dirname(fileURLToPath(import.meta.url));
try {
  const env = readFileSync(resolve(__dir, '../.env'), 'utf8');
  for (const line of env.split('\n')) {
    const [k, ...v] = line.split('=');
    if (k && v.length) process.env[k.trim()] = v.join('=').trim();
  }
} catch {}

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = process.env.VITE_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('❌ Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY');
  process.exit(1);
}

// ─── PILLAR 1: MANAGEMENT (0–25) ────────────────────────────────────────────
// Criteria: energy policy, metering, status, notes quality, operator presence
function scoreManagement(s) {
  let pts = 0;

  // Status maturity (0–8)
  if (s.status === 'Operational')          pts += 8;
  else if (s.status === 'Under Construction') pts += 4;
  else if (s.status === 'Planned')         pts += 1;

  // Energy management systems (0–8)
  if (s.energy_policy === true)   pts += 4;
  if (s.tenant_metering === true) pts += 4;

  // Quality of data / documentation (0–5)
  // Proxy: has notes + strengths + recommendation = managed park
  if (s.notes && s.notes.length > 50)                       pts += 2;
  if (s.strengths && s.strengths.length >= 2)               pts += 2;
  if (s.recommendation && s.recommendation.length > 20)     pts += 1;

  // Backup power = management maturity (0–4)
  if (s.backup_power === true) pts += 4;

  return Math.min(25, pts);
}

// ─── PILLAR 2: ENVIRONMENTAL (0–25) ─────────────────────────────────────────
// Criteria: renewable %, flood risk, elevation, energy intensity, proximity to protected areas
function scoreEnvironmental(s) {
  let pts = 0;

  // Renewable energy share (0–8)
  const ren = s.renewable_pct ?? 30; // Cambodia grid default ~30%
  if (ren >= 60)      pts += 8;
  else if (ren >= 40) pts += 6;
  else if (ren >= 20) pts += 4;
  else                pts += 2;

  // Flood risk (0–6)
  if (s.flood_risk === false) {
    const elev = s.elevation_m ?? 10;
    if (elev >= 15)      pts += 6;
    else if (elev >= 8)  pts += 5;
    else if (elev >= 5)  pts += 4;
    else                 pts += 2;
  }
  // flood_risk = true → 0 pts (high risk zone)

  // Energy tariff as proxy for energy efficiency (0–5)
  // Lower tariff = better energy efficiency infrastructure
  const tariff = s.energy_tariff_usd;
  if (tariff) {
    if (tariff <= 0.085)      pts += 5;
    else if (tariff <= 0.095) pts += 4;
    else if (tariff <= 0.11)  pts += 3;
    else                      pts += 1;
  } else {
    pts += 2; // unknown — partial credit
  }

  // Own renewable generation (0–4)
  if ((s.own_generation_mw ?? 0) >= 10) pts += 4;
  else if ((s.own_generation_mw ?? 0) >= 2) pts += 2;

  // Grid reliability proxy for efficient energy use (0–2)
  if ((s.grid_uptime_pct ?? 0) >= 99) pts += 2;
  else if ((s.grid_uptime_pct ?? 0) >= 97) pts += 1;

  return Math.min(25, pts);
}

// ─── PILLAR 3: SOCIAL (0–25) ────────────────────────────────────────────────
// Criteria: labor availability (TVET/university proximity), port/road access for workers,
//           flood risk to workers, province development level
function scoreSocial(s) {
  let pts = 0;

  // Province labor pool score (0–8)
  // Based on province population and TVET presence
  const laborProvinces = {
    'Phnom Penh': 8, 'Kandal': 7, 'Kampong Speu': 6,
    'Preah Sihanouk': 5, 'Kampong Cham': 6, 'Svay Rieng': 5,
    'Kampot': 4, 'Koh Kong': 3, 'Banteay Meanchey': 5,
    'Siem Reap': 5, 'Takeo': 5, 'Kampong Chhnang': 4,
    'Stung Treng': 2, 'Ratanakiri': 2, 'Mondulkiri': 2,
  };
  const province = s.province?.split('/')?.[0]?.trim();
  pts += laborProvinces[province] ?? 3;

  // Target industries diversity = more employment types (0–4)
  const inds = s.target_industries?.length ?? 0;
  if (inds >= 4) pts += 4;
  else if (inds >= 2) pts += 2;
  else if (inds >= 1) pts += 1;

  // Road access quality (0–5) — proxy: port_distance and road field
  if (s.road) {
    if (s.road.includes('NR1') || s.road.includes('NR3') || s.road.includes('NR4'))
      pts += 5;
    else if (s.road.includes('NR'))
      pts += 3;
    else
      pts += 1;
  } else if (s.port_distance_km) {
    // Infer from port distance — closer = better road access
    if (s.port_distance_km <= 50)      pts += 5;
    else if (s.port_distance_km <= 200) pts += 4;
    else if (s.port_distance_km <= 350) pts += 3;
    else                                pts += 1;
  }

  // Worker safety — flood risk (0–4)
  if (s.flood_risk === false) pts += 4;
  else if (s.flood_risk === null || s.flood_risk === undefined) pts += 2;

  // Backup power for worker welfare (0–4)
  if (s.backup_power === true) pts += 4;
  else pts += 1;

  return Math.min(25, pts);
}

// ─── PILLAR 4: ECONOMIC (0–25) ──────────────────────────────────────────────
// Criteria: port distance, grid reliability, tariff, capacity, SEZ incentives
function scoreEconomic(s) {
  let pts = 0;

  // Port distance to Sihanoukville (0–8)
  const dist = s.port_distance_km;
  if (dist !== null && dist !== undefined) {
    if (dist <= 30)       pts += 8;  // on-site / adjacent (ports themselves)
    else if (dist <= 100) pts += 7;
    else if (dist <= 200) pts += 6;
    else if (dist <= 300) pts += 5;
    else if (dist <= 400) pts += 3;
    else                  pts += 1;  // >400km = significant logistics cost
  }

  // Grid reliability (0–6)
  const uptime = s.grid_uptime_pct;
  if (uptime) {
    if (uptime >= 99.5)    pts += 6;
    else if (uptime >= 99) pts += 5;
    else if (uptime >= 97) pts += 4;
    else if (uptime >= 95) pts += 2;
    else                   pts += 1;
  } else {
    pts += 3; // unknown — median credit
  }

  // Power tariff competitiveness (0–5)
  // Vietnam avg ~$0.07, Thailand ~$0.09, Cambodia range $0.08–$0.16
  const tariff = s.energy_tariff_usd;
  if (tariff) {
    if (tariff <= 0.082)      pts += 5;
    else if (tariff <= 0.090) pts += 4;
    else if (tariff <= 0.10)  pts += 3;
    else if (tariff <= 0.12)  pts += 2;
    else                      pts += 1;
  } else {
    pts += 2; // unknown — partial credit
  }

  // Grid capacity available (0–3)
  const cap = s.grid_capacity_mw;
  if (cap) {
    if (cap >= 100)     pts += 3;
    else if (cap >= 40) pts += 2;
    else                pts += 1;
  }

  // Zone size = economic scale (0–3)
  const sizeStr = s.size ?? '';
  const sizeHa = parseFloat(sizeStr.replace(/[^0-9.]/g, '')) || 0;
  if (sizeHa >= 500)       pts += 3;
  else if (sizeHa >= 100)  pts += 2;
  else if (sizeHa >= 50)   pts += 1;

  return Math.min(25, pts);
}

// ─── TIER ───────────────────────────────────────────────────────────────────
function getTier(total) {
  if (total >= 80) return 'Gold';
  if (total >= 65) return 'Silver';
  if (total >= 40) return 'Bronze';
  return null;
}

async function patchSite(id, patch) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/sites?id=eq.${encodeURIComponent(id)}`, {
    method: 'PATCH',
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
      'Content-Type': 'application/json',
      Prefer: 'return=minimal',
    },
    body: JSON.stringify(patch),
  });
  if (!res.ok) throw new Error(`PATCH failed ${res.status}: ${await res.text()}`);
}

async function main() {
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/sites?kind=in.(sez,park,factory,port,airport,logistics)&select=*`,
    { headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` } }
  );
  const sites = await res.json();
  console.log(`\n📊 Scoring ${sites.length} investment sites against EIP Framework\n`);

  const summary = { Gold: [], Silver: [], Bronze: [], Unrated: [] };

  for (const s of sites) {
    const mgmt  = scoreManagement(s);
    const env   = scoreEnvironmental(s);
    const soc   = scoreSocial(s);
    const econ  = scoreEconomic(s);
    const total = mgmt + env + soc + econ;
    const tier  = getTier(total);

    const patch = {
      eip_management:   mgmt,
      eip_environmental: env,
      eip_social:       soc,
      eip_economic:     econ,
      score:            total,
      eip_tier:         tier,
    };

    await patchSite(s.id, patch);

    const bar = '█'.repeat(Math.round(total / 5)) + '░'.repeat(20 - Math.round(total / 5));
    const tierLabel = tier ?? 'none';
    console.log(`${tierLabel.padEnd(6)} [${bar}] ${total}/100  M:${mgmt} E:${env} S:${soc} Ec:${econ}  ${s.name}`);

    summary[tier ?? 'Unrated'].push(s.name);
  }

  console.log(`\n${'─'.repeat(70)}`);
  console.log(`🥇 Gold   (≥80): ${summary.Gold.length}   — ${summary.Gold.join(', ') || 'none'}`);
  console.log(`🥈 Silver (≥65): ${summary.Silver.length}   — ${summary.Silver.join(', ') || 'none'}`);
  console.log(`🥉 Bronze (≥40): ${summary.Bronze.length}   — ${summary.Bronze.join(', ') || 'none'}`);
  console.log(`   Unrated (<40): ${summary.Unrated.length}  — ${summary.Unrated.join(', ') || 'none'}`);
  console.log(`${'─'.repeat(70)}\n`);
}

main().catch(err => { console.error('Fatal:', err); process.exit(1); });
