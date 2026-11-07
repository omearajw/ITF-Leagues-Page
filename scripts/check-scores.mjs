// Checks the scores the site stores and shows against FPL's own figures. Read-only: it uses the
// public database key and FPL's public API, and writes nothing.
//
//   node --env-file=.env.local scripts/check-scores.mjs [site address] [--verbose]
//
// --verbose also lists every team's live figures, the site's next to FPL's.
// The site address defaults to the live site; pass http://localhost:3002 to check a local build.
// Exits with code 1 if anything in a finished week disagrees with FPL. Live-week differences are
// reported as warnings, because live points can move while the check runs and the site's live
// copy can be up to two minutes old.

import { createClient } from '@supabase/supabase-js';

const VERBOSE = process.argv.includes('--verbose');
const SITE = (process.argv.slice(2).find(a => !a.startsWith('--')) || 'https://itf-leagues-page.vercel.app').replace(/\/$/, '');
const SEASON = '2026-27';
// The same leagues as lib/divisions.ts.
const LEAGUES = { 'Premier League': 894360, 'Championship': 868856, 'League One': 1089643 };

const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, { auth: { persistSession: false } });

// FPL requests go six at a time with one retry, the same courtesy the site itself keeps.
let inFlight = 0;
const queue = [];
async function fpl(path) {
  if (inFlight >= 6) await new Promise(resolve => queue.push(resolve)); else inFlight++;
  try {
    for (let attempt = 0; ; attempt++) {
      const res = await fetch(`https://fantasy.premierleague.com/api${path}`, { signal: AbortSignal.timeout(15_000) }).catch(e => e);
      if (res.ok) return await res.json();
      if (attempt === 1) throw new Error(`FPL ${path}: ${res.status ?? res.message}`);
      await new Promise(r => setTimeout(r, 1500));
    }
  } finally {
    const next = queue.shift();
    if (next) next(); else inFlight--;
  }
}

const errors = [];
const warnings = [];
const fail = (section, msg) => errors.push(`[${section}] ${msg}`);
const warn = (section, msg) => warnings.push(`[${section}] ${msg}`);
const net = h => h.points - (h.event_transfers_cost || 0);

// ---- Load our data and FPL's ----------------------------------------------------------------
const [{ data: managers }, { data: scores }, { data: h2h }, { data: gameweeks }, { data: elimStatus }, { data: elimConfig }, { data: cupTies }] = await Promise.all([
  db.from('season_managers').select('manager_fpl_id, team_name, division').eq('season_id', SEASON),
  db.from('manager_gw_scores').select('manager_fpl_id, gw_number, points, bench_points, transfers_cost, classic_total_points').eq('season_id', SEASON),
  db.from('h2h_fixtures').select('manager_fpl_id, opponent_fpl_id, gw_number, manager_score, opponent_score, result').eq('season_id', SEASON),
  db.from('gameweeks').select('gw_number, is_finished').eq('season_id', SEASON),
  db.from('eliminator_status').select('manager_fpl_id, is_eliminated, eliminated_gw').eq('season_id', SEASON),
  db.from('eliminator_config').select('start_gw').eq('season_id', SEASON).maybeSingle(),
  db.from('tournament_fixtures').select('stage, gw_number, manager_1_id, manager_2_id, manager_1_score, manager_2_score, winner_id').eq('season_id', SEASON).eq('tournament_type', 'CHAMPIONS_LEAGUE'),
]);
if (!managers?.length) { console.error('Could not read the league from the database (is .env.local loaded?).'); process.exit(2); }

const name = Object.fromEntries(managers.map(m => [Number(m.manager_fpl_id), m.team_name]));
const ids = managers.map(m => Number(m.manager_fpl_id));
const boot = await fpl('/bootstrap-static/');
const fplChecked = new Set(boot.events.filter(e => e.finished && e.data_checked).map(e => e.id));
const liveEvent = boot.events.find(e => e.is_current && !(e.finished && e.data_checked));
const ourFinished = new Set((gameweeks || []).filter(g => g.is_finished).map(g => Number(g.gw_number)));
const finished = [...ourFinished].filter(gw => fplChecked.has(gw)).sort((a, b) => a - b);
for (const gw of fplChecked) if (!ourFinished.has(gw) && scores.some(s => s.gw_number === gw)) fail('weeks', `GW${gw} is confirmed on FPL but not marked finished here`);

console.log(`Checking ${ids.length} teams against FPL: finished weeks GW${finished[0]}-GW${finished.at(-1)}${liveEvent ? `, live week GW${liveEvent.id}` : ''}; site ${SITE}\n`);

const history = Object.fromEntries(await Promise.all(ids.map(async id => [id, Object.fromEntries((await fpl(`/entry/${id}/history/`)).current.map(h => [h.event, h]))])));

// ---- 1. Finished weeks: stored scores ---------------------------------------------------------
let checked = 0;
for (const s of scores.filter(s => finished.includes(s.gw_number))) {
  const id = Number(s.manager_fpl_id), h = history[id]?.[s.gw_number], who = `${name[id]} GW${s.gw_number}`;
  checked++;
  if (!h) { fail('scores', `${who}: no FPL history for this week`); continue; }
  if (s.points !== net(h)) fail('scores', `${who}: score ${s.points}, FPL ${net(h)}`);
  if (s.bench_points !== h.points_on_bench) fail('scores', `${who}: bench ${s.bench_points}, FPL ${h.points_on_bench}`);
  if ((s.transfers_cost || 0) !== (h.event_transfers_cost || 0)) fail('scores', `${who}: hits ${s.transfers_cost}, FPL ${h.event_transfers_cost}`);
  if (s.classic_total_points !== h.total_points) fail('scores', `${who}: season total ${s.classic_total_points}, FPL ${h.total_points}`);
}
for (const gw of finished) for (const id of ids) {
  if (history[id][gw] && !scores.some(s => s.gw_number === gw && Number(s.manager_fpl_id) === id)) fail('scores', `${name[id]} GW${gw}: no stored score`);
}
console.log(`1. Finished-week scores: ${checked} rows checked`);

// ---- 2. Finished weeks: H2H ties ------------------------------------------------------------
let ties = 0;
for (const gw of finished) for (const league of Object.values(LEAGUES)) {
  const matches = (await fpl(`/leagues-h2h-matches/league/${league}/?event=${gw}`)).results.filter(m => m.entry_1_entry && m.entry_2_entry);
  for (const m of matches) {
    const sides = [[m.entry_1_entry, m.entry_2_entry, m.entry_1_points, m.entry_2_points, m], [m.entry_2_entry, m.entry_1_entry, m.entry_2_points, m.entry_1_points, null]];
    for (const [me, them, mine, theirs, first] of sides) {
      ties++;
      const row = h2h.find(r => r.gw_number === gw && Number(r.manager_fpl_id) === me);
      const who = `${name[me]} v ${name[them]} GW${gw}`;
      if (!row) { fail('h2h', `${who}: no stored tie`); continue; }
      if (Number(row.opponent_fpl_id) !== them) fail('h2h', `${who}: stored opponent is ${name[Number(row.opponent_fpl_id)]}`);
      if (row.manager_score !== mine || row.opponent_score !== theirs) fail('h2h', `${who}: stored ${row.manager_score}-${row.opponent_score}, FPL ${mine}-${theirs}`);
      // FPL marks league results in entry_1_win/draw/loss; its `winner` field is only for knockouts.
      const fplResult = first ? (m.entry_1_win ? 'W' : m.entry_1_loss ? 'L' : 'D') : (m.entry_2_win ? 'W' : m.entry_2_loss ? 'L' : 'D');
      if (row.result !== fplResult) fail('h2h', `${who}: stored result ${row.result}, FPL ${fplResult}`);
    }
  }
}
console.log(`2. Finished-week H2H ties: ${ties} sides checked`);

// ---- 3. Champions League ties ---------------------------------------------------------------
const played = (cupTies || []).filter(t => finished.includes(t.gw_number));
for (const t of played) {
  const who = `${name[t.manager_1_id]} v ${name[t.manager_2_id]} GW${t.gw_number} (${t.stage})`;
  const a = history[t.manager_1_id]?.[t.gw_number], b = history[t.manager_2_id]?.[t.gw_number];
  if (!a || !b) { fail('cup', `${who}: missing FPL history`); continue; }
  if (t.manager_1_score !== net(a) || t.manager_2_score !== net(b)) fail('cup', `${who}: stored ${t.manager_1_score}-${t.manager_2_score}, FPL ${net(a)}-${net(b)}`);
  const winner = net(a) > net(b) ? t.manager_1_id : net(b) > net(a) ? t.manager_2_id : null;
  if ((t.winner_id ?? null) !== winner) fail('cup', `${who}: stored winner ${name[t.winner_id] ?? 'none'}, should be ${name[winner] ?? 'none (draw)'}`);
}
const keys = (cupTies || []).map(t => `${t.stage}|${t.gw_number}|${t.manager_1_id}|${t.manager_2_id}`);
if (new Set(keys).size !== keys.length) fail('cup', `${keys.length - new Set(keys).size} duplicate Champions League ties`);
console.log(`3. Champions League: ${played.length} played ties checked, ${(cupTies || []).length} ties in all`);

// ---- 4. Eliminator replay -------------------------------------------------------------------
if (elimConfig) {
  const alive = new Set(ids);
  for (const gw of finished.filter(gw => gw >= elimConfig.start_gw)) {
    if (alive.size <= 1) break;
    const field = [...alive].map(id => ({ id, pts: net(history[id][gw]) }));
    const low = Math.min(...field.map(f => f.pts));
    const lowest = field.filter(f => f.pts === low).map(f => f.id);
    const ours = (elimStatus || []).find(e => e.eliminated_gw === gw);
    const out = ours ? Number(ours.manager_fpl_id) : null;
    if (!out) fail('eliminator', `GW${gw}: nobody eliminated; lowest was ${lowest.map(id => name[id]).join(', ')} on ${low}`);
    else if (!lowest.includes(out)) fail('eliminator', `GW${gw}: ${name[out]} eliminated, but the lowest was ${lowest.map(id => name[id]).join(', ')} on ${low}`);
    else if (lowest.length > 1) warn('eliminator', `GW${gw}: ${name[out]} went out on a tie at ${low} with ${lowest.filter(id => id !== out).map(id => name[id]).join(', ')} (tie-break not re-checked here)`);
    if (out) alive.delete(out);
  }
  console.log(`4. Eliminator: cuts GW${elimConfig.start_gw}-GW${finished.at(-1)} replayed from FPL scores`);
}

// ---- 5. Live week, as the website shows it ---------------------------------------------------
if (liveEvent) {
  const gw = liveEvent.id;
  const picks = Object.fromEntries(await Promise.all(ids.map(async id => [id, await fpl(`/entry/${id}/event/${gw}/picks/`)])));
  const snapshot = async () => {
    const live = Object.fromEntries((await fpl(`/event/${gw}/live/`)).elements.map(e => [e.id, e.stats.total_points]));
    return Object.fromEntries(ids.map(id => {
      const p = picks[id], pts = el => live[el] ?? 0;
      const gross = p.picks.reduce((sum, x) => sum + pts(x.element) * x.multiplier, 0);
      const hits = p.entry_history.event_transfers_cost || 0;
      return [id, { gross, net: gross - hits, bench: p.picks.filter(x => x.position > 11).reduce((sum, x) => sum + pts(x.element), 0) }];
    }));
  };
  const opponents = {};
  for (const [, league] of Object.entries(LEAGUES)) {
    for (const m of (await fpl(`/leagues-h2h-matches/league/${league}/?event=${gw}`)).results) {
      if (m.entry_1_entry && m.entry_2_entry) { opponents[m.entry_1_entry] = m.entry_2_entry; opponents[m.entry_2_entry] = m.entry_1_entry; }
    }
  }

  const before = await snapshot();
  const pages = {};
  for (const id of ids) {
    const html = await (await fetch(`${SITE}/manager/${id}`, { signal: AbortSignal.timeout(30_000) })).text();
    const text = html.replace(/<[^>]+>/g, ' ').replace(/&amp;/g, '&').replace(/&#x27;|&#39;/g, "'").replace(/\s+/g, ' ');
    const num = re => { const m = text.match(re); return m ? Number(m[1]) : null; };
    const subs = text.match(/Score \d+ includes \+(\d+) due from the bench · (-?\d+) before subs/);
    const match = text.match(/League match (\d+) - (\d+)/);
    pages[id] = {
      score: num(/Score (-?\d+)/), due: subs ? Number(subs[1]) : 0, beforeSubs: subs ? Number(subs[2]) : num(/Score (-?\d+)/),
      teamPoints: num(/Team points (\d+)/), bench: num(/On bench (\d+)/), season: num(/Season points (\d+)/),
      match: match ? [Number(match[1]), Number(match[2])] : null,
    };
  }
  const after = await snapshot();

  // A site figure counts as right if it matches FPL at either end of the check.
  const either = (id, key, value) => value === before[id][key] || value === after[id][key];
  for (const id of ids) {
    const s = pages[id], who = `${name[id]} GW${gw}`;
    if (s.score === null) { warn('live', `${who}: could not read the team page`); continue; }
    if (!either(id, 'gross', s.teamPoints)) warn('live', `${who}: team points ${s.teamPoints}, FPL ${after[id].gross}`);
    if (!either(id, 'bench', s.bench)) warn('live', `${who}: on bench ${s.bench}, FPL ${after[id].bench}`);
    if (!either(id, 'net', s.beforeSubs)) warn('live', `${who}: score before subs ${s.beforeSubs}, FPL ${after[id].net}`);
    if (s.score !== s.beforeSubs + s.due) fail('live', `${who}: score ${s.score} is not ${s.beforeSubs} + ${s.due} subs`);
    const prev = history[id][gw - 1]?.total_points ?? 0;
    if (s.season !== null && !(s.season - s.due === prev + before[id].net || s.season - s.due === prev + after[id].net)) warn('live', `${who}: season points ${s.season}, expected ${prev + after[id].net + s.due} (GW${gw - 1} total ${prev} + live ${after[id].net} + ${s.due} subs)`);
    const opp = opponents[id];
    if (opp && s.match) {
      if (s.match[0] !== s.score) fail('live', `${who}: league match shows ${s.match[0]} for them, but their score is ${s.score}`);
      const theirPage = pages[opp];
      if (theirPage?.score !== null && theirPage.score !== s.match[1]) warn('live', `${who}: league match shows ${name[opp]} on ${s.match[1]}, their own page says ${theirPage.score}`);
    }
  }
  console.log(`5. Live week GW${gw}: ${ids.length} team pages on ${SITE} checked against FPL's live feed`);
  if (VERBOSE) {
    console.log('   team                          site: score (subs) pts bench season | FPL: net pts bench');
    for (const id of ids) {
      const s = pages[id], f = after[id];
      console.log(`   ${String(name[id]).padEnd(29)} ${String(s.score).padStart(5)} (+${s.due}) ${String(s.teamPoints).padStart(3)} ${String(s.bench).padStart(4)} ${String(s.season).padStart(6)} | ${String(f.net).padStart(7)} ${String(f.gross).padStart(3)} ${String(f.bench).padStart(4)}`);
    }
  }
}

// ---- Report ---------------------------------------------------------------------------------
console.log('');
if (warnings.length) { console.log(`Warnings (${warnings.length}), live figures or tie-breaks worth a look:`); warnings.forEach(w => console.log('  ' + w)); console.log(''); }
if (errors.length) { console.log(`PROBLEMS (${errors.length}):`); errors.forEach(e => console.log('  ' + e)); process.exit(1); }
console.log('Everything stored matches FPL.' + (warnings.length ? ' (See the warnings above.)' : ''));
