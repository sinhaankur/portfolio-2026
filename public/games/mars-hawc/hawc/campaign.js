// Conquest campaign: agencies, stations on real Martian sites, ore economy, operations, story.
import { AGENCIES } from './levels.js?v=22';

// Stations sit on real landing sites; 'probe' is the mission that put hardware there first.
export const STATIONS = [
  { id: 'jezero', city: 'Perseverance', site: 'Jezero Crater', probe: 'Perseverance, 2021', lat: 18.44, lon: 77.45, terrain: 'plains', owner: 'nasa', yield: 120 },
  { id: 'gale', city: 'Curiosity', site: 'Gale Crater', probe: 'Curiosity, 2012', lat: -4.59, lon: 137.44, terrain: 'craters', owner: 'nasa', yield: 100 },
  { id: 'elysium', city: 'InSight', site: 'Elysium Planitia', probe: 'InSight, 2018', lat: 4.5, lon: 135.62, terrain: 'plains', owner: 'nasa', yield: 80 },
  { id: 'candor', city: 'Mangalyaan', site: 'Candor Chasma', probe: 'Mangalyaan survey, 2014', lat: -6.5, lon: -70.8, terrain: 'canyon', owner: 'isro', yield: 140 },
  { id: 'coprates', city: 'Mangalyaan II', site: 'Coprates Chasma', probe: 'Mangalyaan survey, 2014', lat: -13.4, lon: -61.4, terrain: 'canyon', owner: 'isro', yield: 110 },
  { id: 'utopia', city: 'Zhurong', site: 'Utopia Planitia', probe: 'Zhurong, 2021', lat: 25.07, lon: 109.93, terrain: 'craters', owner: 'cnsa', yield: 110 },
  { id: 'utopian', city: 'Viking Two', site: 'Utopia North', probe: 'Viking 2, 1976', lat: 47.64, lon: 134.29, terrain: 'plains', owner: 'cnsa', yield: 90 },
  { id: 'isidis', city: 'Beagle', site: 'Isidis Planitia', probe: 'Beagle 2, 2003', lat: 11.53, lon: 90.43, terrain: 'plains', owner: 'esa', yield: 90 },
  { id: 'oxia', city: 'ExoMars', site: 'Oxia Planum', probe: 'Rosalind Franklin site', lat: 18.2, lon: -24.6, terrain: 'plains', owner: 'esa', yield: 100 },
  { id: 'sirenum', city: 'Mars-3', site: 'Terra Sirenum', probe: 'Mars 3, 1971', lat: -45, lon: -158, terrain: 'craters', owner: 'ros', yield: 100 },
  { id: 'margaritifer', city: 'Mars-6', site: 'Margaritifer Terra', probe: 'Mars 6, 1974', lat: -23.9, lon: -19.4, terrain: 'craters', owner: 'ros', yield: 90 },
  { id: 'nili', city: 'Nozomi', site: 'Nili Fossae', probe: 'MMX relay claim, JAXA', lat: 21.9, lon: 74.5, terrain: 'canyon', owner: 'jaxa', yield: 110 },
  { id: 'hellas', city: 'Nozomi II', site: 'Hellas Planitia', probe: 'Nozomi claim, 1998', lat: -42.4, lon: 70.5, terrain: 'craters', owner: 'jaxa', yield: 100 },
  { id: 'arabia', city: 'Al-Amal', site: 'Arabia Terra', probe: 'Hope orbiter survey, 2021', lat: 10.0, lon: 5.0, terrain: 'craters', owner: 'uae', yield: 110 },
  { id: 'syrtis', city: 'Al-Amal II', site: 'Syrtis Major', probe: 'Hope orbiter survey, 2021', lat: 8.4, lon: 69.5, terrain: 'plains', owner: 'uae', yield: 90 },
  { id: 'arcadia', city: 'Founder City', site: 'Founder City', probe: 'Starship candidate landing zone, Arcadia Planitia', lat: 40.5, lon: -171.5, terrain: 'plains', owner: 'starfall', yield: 180 },
  { id: 'chryse', city: 'Viking', site: 'Chryse Planitia', probe: 'Viking 1, 1976', lat: 22.27, lon: -47.95, terrain: 'plains', owner: 'darken', yield: 130 },
  { id: 'ares', city: 'Sojourner', site: 'Ares Vallis', probe: 'Pathfinder, 1997', lat: 19.1, lon: -33.25, terrain: 'canyon', owner: 'darken', yield: 110 },
  { id: 'gusev', city: 'Spirit', site: 'Gusev Crater', probe: 'Spirit, 2004', lat: -14.57, lon: 175.47, terrain: 'craters', owner: 'darken', yield: 100 },
  { id: 'meridiani', city: 'Opportunity', site: 'Meridiani Planum', probe: 'Opportunity, 2004', lat: -1.95, lon: -5.53, terrain: 'plains', owner: 'darken', yield: 150 },
  { id: 'vastitas', city: 'Phoenix', site: 'Vastitas Borealis', probe: 'Phoenix, 2008', lat: 68.22, lon: -125.75, terrain: 'plains', owner: 'darken', yield: 120 },
  { id: 'noctis', site: 'Noctis Labyrinthus', probe: 'Darken foundry', lat: -7.0, lon: -101.0, terrain: 'rugged', owner: 'darken', yield: 170, shield: true },
  { id: 'arsia', site: 'Arsia Mons', probe: 'Darken foundry', lat: -8.26, lon: -120.09, terrain: 'rugged', owner: 'darken', yield: 160, shield: true },
  { id: 'olympus', site: 'Olympus Mons', probe: 'Darken command', lat: 18.65, lon: -133.8, terrain: 'rugged', owner: 'darken', yield: 200, shield: true },
];
// Each town carries the name of the first probe or rover that reached its ground. Darken foundries carry no names.
export const nm = (s) => s.city || s.site;
export const ORBITAL = [
  { id: 'ring', site: 'Ares Ring', probe: 'Starfall ore terminal, areostationary', owner: 'starfall' },
  { id: 'phobos', site: 'Phobos', probe: 'MMX sample site (JAXA)', owner: 'neutral' },
];
const TERR = { canyon: [120, 7, 10], craters: [60, 5, 26], plains: [35, 4, 14], rugged: [100, 8, 6] };

export const OPS = {
  defend: { label: 'Defend', verb: 'Hold', title: (s) => `Hold ${nm(s)}` },
  capture: { label: 'Capture', verb: 'Take', title: (s) => `Take ${nm(s)}` },
  raid: { label: 'Raid mine', verb: 'Raid', title: (s) => `Raid the ${nm(s)} mine` },
  destroy: { label: 'Destroy towers', verb: 'Break', title: (s) => `Break the ${nm(s)} shield` },
  hijack: { label: 'Hijack', verb: 'Steal', title: (s) => `Borrowed iron at ${nm(s)}` },
  escort: { label: 'Escort convoy', verb: 'Escort', title: (s) => `Ore run from ${nm(s)}` },
  intercept: { label: 'Intercept', verb: 'Intercept', title: (s) => `Cut the ${nm(s)} ore road` },
  lander: { label: 'Protect lander', verb: 'Launch', title: (s) => `Lift-off at ${nm(s)}` },
  orbital: { label: 'Orbital assault', verb: 'Board', title: () => 'Board the Ares Ring' },
};

export const ARMORY = [
  { id: 'ac', name: 'P2MEC autocannon', desc: ['Twin arm cannons', 'Faster cycling, heavier rounds', 'Depleted-core rounds, 1.8x damage'], cost: [0, 600, 1400] },
  { id: 'msl', name: 'TCROCK missiles', desc: ['4-missile salvo', '6-missile salvo, faster lock', '8-missile salvo, heavier warheads'], cost: [0, 500, 1200] },
  { id: 'armor', name: 'Armor plating', desc: ['1,600 armor', '2,000 armor', '2,400 armor'], cost: [0, 800, 1600] },
  { id: 'rifle', name: 'PRIF44 rifle', desc: ['Pilot sidearm', 'Burst mode, 5 dmg', 'Rail rifle, 9 dmg'], cost: [0, 300, 700] },
  { id: 'jet', name: 'Pilot jetpack', desc: ['Short hops', 'Bigger tank', 'Sustained flight'], cost: [0, 350, 800] },
];
export const SUPPORT = [
  { id: 'strike', name: 'Orbital strike', key: '1', desc: 'The Ares Ring drops a kinetic rod on your aim point.', cost: 450 },
  { id: 'drop', name: 'Supply drop', key: '2', desc: 'Lander drops a crate: armor, missiles, GASHR.', cost: 250 },
];

// Ice is the whole economy: water + CO2 -> methane and oxygen. Propellant fills the fuel cells every HAWC, rover and Hab runs on,
// and the tankers that are the only way home. Buried ice is shallow toward the poles, deep near the equator.
export const iceOf = (s) => { const a = Math.abs(s.lat); return a >= 40 ? 3 : a >= 25 ? 2 : 1; };
export const ICE_LABEL = ['', 'Deep ice, slow plant', 'Mid-latitude ice', 'Shallow glacier, rich plant'];
export const cellIncome = (c) => held(c).reduce((n, s) => n + iceOf(s), 0);

export const COMMANDERS = {
  nasa: 'Commander Ruth Alvarez, Jezero', isro: 'Commander Kavya Raman, Candor', cnsa: 'Commander Lin Wei, Utopia', esa: 'Commander Mathilde Brandt, Oxia',
  ros: 'Commander Arkady Sokolov, Sirenum', jaxa: 'Commander Haruto Mori, Nili Fossae', uae: 'Commander Noura Al Hammadi, Arabia Terra',
};
export const STORY = {
  intro: (ag, side) => [
    'Mars, 2061. Seven agencies live here, each on the ground its first probe reached. The Phobos Accord kept the peace: shared landing pads, no weapons on the surface.',
    'Everything on Mars runs on ice. Dig it, split it, add carbon dioxide from the air, and you get methane and oxygen: fuel for the cells in every HAWC, rover and Hab, and for the tankers that are the only ride home.',
    'Then came the Dust Year. Five months of storm, solar fields dead, reactors running everything. Reserves ran dry and every agency started counting the ice under its neighbours.',
    'Starfall Industries owns the Ares Ring, the fuel depot in orbit. Its Founder calls himself Administrator of Mars and doubled the price of a seat home.',
    'The Darken Syndicate built every HAWC on the planet under contract. When the Accord cracked it kept the machines, took the old landing sites and their glaciers, and started selling propellant to whoever pays most.',
    `${COMMANDERS[side] || 'Your commander'}: "Whoever holds the ice decides who stays and who goes home. You fly a Striker for ${ag.name}. Hold our plant, take back the ice, and end Darken before the next window closes."`,
  ],
  acts: [
    { at: 0, title: 'Act I · Hold the plant', line: 'Keep your colony and its propellant plant running. Every cell you burn is one you made.' },
    { at: 4, title: 'Act II · The ice war', line: 'The agencies are fighting each other for glaciers while Darken sells fuel to both sides.' },
    { at: 8, title: 'Act III · The window', line: 'The launch window opens in forty sols. Darken is lifting fuel to the Ares Ring to buy Starfall\'s fleet.' },
  ],
  beats: [
    [3, 'Darken has noticed you. The Foreman has put a price on your Striker.'],
    [4, 'Act II. CNSA and ESA are fighting over the Utopia glacier. Darken is selling fuel to both.'],
    [6, 'The other agencies will talk ceasefire if you break a Darken shield first.'],
    [8, 'Act III. Darken is lifting propellant to the Ares Ring. If the Founder sells them the fleet, nobody else goes home.'],
    [10, 'Every agency is watching you now. Take the last Darken stations and the Accord comes back to the table.'],
  ],
  ending: (c, ag) => `No Darken station is left on Mars. The agencies meet at Phobos to rewrite the Accord. ${ag.name} holds ${held(c).length} of ${STATIONS.length} stations and ${cellIncome(c)} cells of propellant a sol. That is your seat at the table.`,
};
export const actOf = (c) => { const n = held(c).length; let a = STORY.acts[0]; for (const x of STORY.acts) if (n >= x.at) a = x; return a; };

const rng = (s) => () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
const KEY = 'marsHawc.campaign.v1';
export function loadCampaign() { try { return JSON.parse(localStorage.getItem(KEY) || 'null'); } catch (e) { return null; } }
export function saveCampaign(c) { try { localStorage.setItem(KEY, JSON.stringify(c)); } catch (e) {} }
export function clearCampaign() { try { localStorage.removeItem(KEY); } catch (e) {} }

export function forceOp(c, kind) { const s = STATIONS.find((x) => c.owners[x.id] !== c.side && x.owner !== 'darken'); const op = { id: 'dbg-' + kind, kind, station: s.id, owner: c.owners[s.id], threat: 1, attacker: 'darken' }; c.ops.unshift(op); return op; }
export function newCampaign(side) {
  const owners = {}; for (const s of STATIONS) owners[s.id] = s.owner;
  const c = { side, turn: 1, ore: 600, cells: 10, owners, mk: { ac: 1, msl: 1, armor: 1, rifle: 1, jet: 1 }, support: { strike: 1, drop: 1 }, threats: {}, raided: {}, log: [], beat: 0, seed: (Math.random() * 1e9) | 0, won: false };
  c.ops = genOps(c); return c;
}
export const held = (c) => STATIONS.filter((s) => c.owners[s.id] === c.side);
export const income = (c) => held(c).reduce((a, s) => a + Math.round(s.yield * (c.raided[s.id] ? 0.5 : 1)), 0);
export const station = (id) => STATIONS.find((s) => s.id === id);

export function genOps(c) {
  const R = rng(c.seed + c.turn * 977), ops = [], pick = (a) => a[Math.floor(R() * a.length)];
  const mine = held(c), enemy = STATIONS.filter((s) => c.owners[s.id] !== c.side);
  const add = (kind, s, extra = {}) => ops.push({ id: `t${c.turn}-${ops.length}`, kind, station: s.id, owner: c.owners[s.id], threat: Math.min(3, 1 + Math.floor(c.turn / 4) + (c.owners[s.id] === 'darken' ? 1 : 0)), ...extra });
  for (const id of Object.keys(c.threats)) { const s = station(id); if (s && c.owners[id] === c.side) add('defend', s, { attacker: c.threats[id], urgent: true }); }
  const pool = enemy.slice().sort(() => R() - 0.5);
  for (const s of pool.slice(0, 4)) {
    const kinds = c.owners[s.id] === 'darken' ? (s.shield ? ['destroy', 'hijack'] : ['capture', 'raid']) : ['capture', 'raid', 'intercept'];
    add(pick(kinds), s);
  }
  if (mine.length) add(R() < 0.5 ? 'escort' : 'lander', pick(mine));
  return ops;
}

// Apply a mission result; returns news lines for the debrief.
export function resolve(c, op, won, stats = {}) {
  const s = station(op.station), news = [], ag = (k) => AGENCIES[k]?.name || k;
  c.score = (c.score || 0) + (stats.points || 0);
  let loot = 0;
  if (won) {
    if (['capture', 'destroy', 'hijack'].includes(op.kind)) { news.push(`${nm(s)} is now an ${ag(c.side)} station. Its mine adds ${s.yield} t of ore a sol.`); c.owners[s.id] = c.side; delete c.raided[s.id]; }
    if (op.kind === 'raid') { loot = Math.round(s.yield * 2.5); c.raided[s.id] = 3; news.push(`${ag(op.owner)} output at ${nm(s)} is halved for 3 sols. You took ${loot} t of ore.`); }
    if (op.kind === 'intercept') { loot = 520; news.push(`The ${ag(op.owner)} convoy never reached its lander. ${loot} t recovered.`); }
    if (op.kind === 'escort') { loot = 480; news.push(`Convoy delivered. ${loot} t of ore on its way to orbit.`); }
    if (op.kind === 'lander') { loot = 650; news.push(`Lander reached the Ares Ring with ${loot} t.`); }
    if (op.kind === 'defend') { delete c.threats[s.id]; news.push(`${nm(s)} held.`); }
  } else {
    if (op.kind === 'defend') { c.owners[s.id] = op.attacker; delete c.threats[s.id]; news.push(`${nm(s)} fell to ${ag(op.attacker)}.`); }
    else news.push(`Operation at ${nm(s)} failed.`);
  }
  for (const o of c.ops) if (o.urgent && o !== op && c.owners[o.station] === c.side) { const R = rng(c.seed + c.turn); if (R() < 0.6) { c.owners[o.station] = o.attacker; news.push(`Nobody answered the call from ${station(o.station).site}. It fell to ${ag(o.attacker)}.`); } delete c.threats[o.station]; }
  const inc = income(c), ci = cellIncome(c); c.ore += inc + loot; c.cells = (c.cells ?? 10) + ci; news.unshift(`Income this sol: ${inc} t of ore and ${ci} fuel cells from ${held(c).length} station${held(c).length === 1 ? '' : 's'}${loot ? `, plus ${loot} t taken` : ''}.`);
  for (const k of Object.keys(c.raided)) if (--c.raided[k] <= 0) delete c.raided[k];
  // the rest of Mars moves
  const R = rng(c.seed + c.turn * 31 + 7);
  const mine = held(c);
  if (mine.length && R() < Math.min(0.75, 0.25 + c.turn * 0.05)) { const t = mine[Math.floor(R() * mine.length)], foes = Object.keys(AGENCIES).filter((k) => k !== c.side); const att = R() < 0.55 ? 'darken' : foes[Math.floor(R() * foes.length)]; c.threats[t.id] = att; news.push(`${ag(att)} HAWCs are massing outside ${nm(t)}.`); }
  if (R() < 0.3) { const rivals = STATIONS.filter((x) => !['darken', c.side].includes(c.owners[x.id])); if (rivals.length) { const t = rivals[Math.floor(R() * rivals.length)]; news.push(`Darken took ${nm(t)} from ${ag(c.owners[t.id])}.`); c.owners[t.id] = 'darken'; } }
  const n = held(c).length; for (const [k, line] of STORY.beats) if (n >= k && c.beat < k) { c.beat = k; news.push(line); }
  if (!STATIONS.some((x) => c.owners[x.id] === 'darken')) { c.won = true; news.push(STORY.ending(c, AGENCIES[c.side])); }
  if (!held(c).length) { c.lost = true; news.push('Your agency has no station left on Mars.'); }
  c.turn++; c.ops = genOps(c); c.log = news;
  return news;
}

export function buy(c, kind, id) {
  if (kind === 'mk') { const a = ARMORY.find((x) => x.id === id), lv = c.mk[id]; if (lv >= 3 || c.ore < a.cost[lv]) return false; c.ore -= a.cost[lv]; c.mk[id] = lv + 1; return true; }
  const s = SUPPORT.find((x) => x.id === id); if (c.ore < s.cost) return false; c.ore -= s.cost; c.support[id] = (c.support[id] || 0) + 1; return true;
}

// Build a playable mission definition from an operation.
export function missionFor(c, op) {
  const s = station(op.station), R = rng(c.seed + c.turn * 131 + s.lat * 10), [relief, rough, craters] = TERR[s.terrain];
  const th = op.threat, enemy = op.kind === 'defend' ? op.attacker : op.owner === c.side ? 'darken' : op.owner, eA = AGENCIES[enemy];
  const hours = [7.6, 9.5, 11.8, 14.2, 16.4, 17.5, 20.5, 23.2], hour = hours[Math.floor(R() * hours.length)];
  const sky = R() < 0.18 ? 'dust' : 'day', ls = Math.floor(R() * 360);
  const time = hour < 6 || hour > 19 ? 'Night' : hour > 17 ? 'Dusk' : hour < 10 ? 'Morning' : hour < 15 ? 'Midday' : 'Afternoon';
  const T = (base) => base.slice(0, 2 + th).map((g) => g);
  const pool = [['talon', 'rush', 2], ['talon', 'flank', 2], ['vulture', 'rush', 1 + (th > 1)], ['boulder', 'snipe', 1], ['talon', 'rush', 1 + th]];
  const waves = []; const nW = 1 + th; for (let i = 0; i < nW; i++) { const w = [pool[Math.floor(R() * 3)]]; if (i > 0) w.push(pool[2 + Math.floor(R() * 3)]); if (i === nW - 1 && th >= 3) w.push(['stalker', 'rush', 1]); waves.push(w); }
  const arc0 = Math.floor(R() * 360), arc = [arc0, arc0 + 80];
  const guards = (n, cx, cz, rad) => { const g = []; for (let i = 0; i < n; i++) { const a = R() * 6.28, r = rad * (0.4 + R() * 0.6); g.push([i === 0 && th >= 3 ? 'stalker' : ['talon', 'talon', 'boulder', 'vulture'][Math.floor(R() * 4)], ['anchor', 'patrol', 'sentry'][i % 3], [cx + Math.cos(a) * r, cz + Math.sin(a) * r]]); } return g; };
  const L = {
    id: op.id, n: String(c.turn).padStart(2, '0'), opKind: op.kind, title: OPS[op.kind].title(s), site: s.site, region: eA ? `vs ${eA.name}` : '', lat: s.lat, lon: s.lon,
    terrain: s.terrain, relief, rough, craters, seed: (c.seed + c.turn * 13) % 997, type: op.kind, typeLabel: OPS[op.kind].label, time, hour, ls, sky, haze: sky === 'dust' ? 0.0032 : 0.0015,
    sunElev: 30, sunAz: 120, side: c.side, enemy, mk: { ...c.mk }, support: { ...c.support }, threat: th, stationName: nm(s), city: s.city,
  };
  const k = op.kind;
  if (k === 'defend' || k === 'lander') {
    L.layout = { relay: [0, 0], dropship: [-40, -20], start: [8, 46], spawnArc: arc, flag: c.side };
    L.waves = k === 'lander' ? waves.slice(0, 2 + (th > 2)) : waves; L.goal = k; L.tips = c.turn === 1;
    L.brief = k === 'defend' ? `${eA.name} HAWCs are walking on ${nm(s)}. Hold the relay through ${waves.length} waves or the station, its Hab and its mine change hands.`
      : `The ore lander at ${nm(s)} is fuelled and loaded. Keep it alive on the pad for two minutes until the launch window opens.`;
  } else if (k === 'capture' || k === 'raid') {
    L.layout = { relay: [0, 0], dropship: [-40, -20], start: [30, 360], spawnArc: [150, 210], flag: enemy, guards: guards(2 + th, 0, 20, 140) };
    L.relayFaction = 'neutral'; L.goal = k; L.reinforce = { every: 70, group: [['talon', 'rush', 1 + (th > 1)]], max: th };
    L.brief = k === 'capture' ? `Clear the ${eA.name} defenders at ${nm(s)}, then hold position at the relay until the uplink switches to your codes. The Hab, the mine and the lander pad come with it.`
      : `Leave ${nm(s)} standing but put its mine out of action. Destroy the drill rig and the ore stops for three sols.`;
  } else if (k === 'destroy' || k === 'hijack') {
    const a = R() * 6.28, cx = Math.cos(a) * 260, cz = -Math.abs(Math.sin(a)) * 260 - 120;
    const mesons = k === 'hijack' ? [[cx - 40, cz - 30], [cx + 40, cz + 30]] : [[cx - 220, cz], [cx, cz - 120], [cx + 220, cz + 20]];
    L.layout = { dropship: [-34, 16], start: [0, 0], mesons, flag: c.side };
    if (k === 'hijack') { L.layout.shield = [cx, cz, 78]; L.layout.guards = [['talon', 'sentry', [cx - 100, cz + 110]], ...guards(th, cx, cz, 120)]; }
    else { L.layout.guards = mesons.flatMap(([x, z]) => guards(1 + (th > 1), x, z, 60)); L.reinforce = { every: 80, group: [['talon', 'rush', 2]], max: th }; }
    L.goal = k; L.brief = k === 'hijack' ? `An IFF shield over ${nm(s)} stops your fire. Leave your Striker, GASHR the Talon on sentry, take its seat and drop the towers from inside.` : `Three Meson towers project the Darken shield over ${nm(s)}. Bring them down and the station is yours.`;
  } else if (k === 'escort' || k === 'intercept') {
    const flip = R() < 0.5 ? 1 : -1, path = [[-440 * flip, 380], [-220 * flip, 170], [-40 * flip, 210], [160 * flip, -40], [250 * flip, -260], [420 * flip, -380]];
    L.layout = { dropship: path[path.length - 1], start: k === 'escort' ? [path[0][0] + 30 * flip, path[0][1] - 26] : [path[2][0] - 60, path[2][1] + 90], flag: k === 'escort' ? c.side : enemy, road: path };
    L.convoy = { path, n: 3, faction: k === 'escort' ? 'union' : 'darken' };
    if (k === 'escort') L.ambush = waves.slice(0, 1 + th); else L.layout.guards = guards(1 + th, path[1][0], path[1][1], 50).map((g) => [g[0], 'escort', g[2]]);
    L.goal = k; L.brief = k === 'escort' ? `Three ore rovers are leaving the ${nm(s)} mine for the lander pad. Darken knows the road. Get at least one through.` : `${eA.name} is moving ore from ${nm(s)} to its lander. Stop all three rovers before they reach the pad.`;
  }
  const ice = iceOf(s), why = { defend: `Lose it and you lose ${ice} cell${ice > 1 ? 's' : ''} of propellant a sol.`, lander: 'That ore pays for the Ares Ring docking fee.', capture: `Its plant makes ${ice} cell${ice > 1 ? 's' : ''} a sol from ${ICE_LABEL[ice].toLowerCase()}.`, raid: 'Their HAWCs run on what that mine pays for.', destroy: `Under the shield is ${ICE_LABEL[ice].toLowerCase()}.`, hijack: 'A stolen Talon reads as Darken to their shield.', escort: 'Every rover that arrives is fuel for your HAWCs.', intercept: 'Every rover you stop is a cell their HAWCs never burn.' }[k] || '';
  L.brief = `${L.brief} ${why}`.trim(); L.ice = ice;
  L.intel = `${eA ? eA.name : 'Darken'} threat ${'I'.repeat(th)} · ${time}${sky === 'dust' ? ', dust storm' : ''}`;
  return L;
}
