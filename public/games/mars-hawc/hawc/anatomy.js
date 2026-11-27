// Anatomy specs for every inspectable asset: how to build it, which meshes stay solid in x-ray, internal systems for imported hulls, and numbered callouts.
// Coordinates: `L(x,y,z)` is the asset's own build space; `f(fx,fy,fz)` is a fraction of its bounding box. Both resolve to hangar-holder space.
import { THREE } from './lib.js?v=19';
import { mats, buildRelay, buildMeson, habDome, hab, mineRig, tanks, solarRow, pad, rover } from './base.js?v=19';
import { loadPilot, makePilot } from './units.js?v=19';
import { lander, launchTower, controlTower, percy } from './kit2.js?v=19';
import { kestrel, raptor, courier } from './flight.js?v=19';
import { buildMech } from './mechs.js?v=19';
import { halberd } from './ships2.js?v=19';
import { buildWalker } from './mechs2.js?v=19';
import { buildRifle } from './kit2.js?v=19';

const Y = new THREE.Vector3(0, 1, 0);
export function kit(g) {
  const std = (c, m, r) => new THREE.MeshStandardMaterial({ color: c, metalness: m, roughness: r });
  const K = { g, mG: std(0x2b2d31, 0.6, 0.45), mS: std(0x9aa1a8, 1, 0.3), mCu: std(0xb87333, 1, 0.38), mCe: std(0xdcd5c4, 0, 0.82), mCl: std(0x313a35, 0.5, 0.42), mHV: std(0xd8742a, 0.1, 0.55), mWh: std(0xe4e1da, 0.1, 0.6), lit: (c) => new THREE.MeshBasicMaterial({ color: c, toneMapped: false }) };
  K.add = (geo, mat, p, rot) => { const o = new THREE.Mesh(geo, mat); o.position.copy(p); if (rot) o.rotation.set(...rot); g.add(o); return o; };
  K.rod = (a, b, r, mat) => { const d = b.clone().sub(a), o = K.add(new THREE.CylinderGeometry(r, r, d.length(), 12), mat, a.clone().addScaledVector(d, 0.5)); o.quaternion.setFromUnitVectors(Y, d.normalize()); return o; };
  K.motor = (p, r, len, axis = 'x') => { const m = new THREE.Group(); m.position.copy(p); if (axis === 'x') m.rotation.z = Math.PI / 2; else if (axis === 'z') m.rotation.x = Math.PI / 2; g.add(m);
    const a = (geo, mat, y = 0) => { const o = new THREE.Mesh(geo, mat); o.position.y = y; m.add(o); return o; };
    a(new THREE.CylinderGeometry(r, r, len, 32, 1, true), K.mG).material.side = THREE.DoubleSide; a(new THREE.CylinderGeometry(r * 0.84, r * 0.84, len * 0.7, 32), K.mCu); a(new THREE.CylinderGeometry(r * 0.4, r * 0.4, len * 1.14, 20), K.mS);
    for (const s of [-1, 1]) a(new THREE.TorusGeometry(r, r * 0.09, 8, 36), K.mS, s * len / 2).rotation.x = Math.PI / 2;
    a(new THREE.TorusGeometry(r * 1.03, r * 0.03, 6, 40), K.lit(0xffb066), len * 0.16).rotation.x = Math.PI / 2; return m; };
  K.cells = (p, r, len, n = 4) => { for (let i = 0; i < n; i++) { const q = p.clone().add(new THREE.Vector3(0, (i % 2 ? 1 : -1) * r * 1.3, (i < 2 ? 1 : -1) * r * 1.3)); K.add(new THREE.CylinderGeometry(r, r, len, 20), K.mCl, q, [0, 0, Math.PI / 2]); K.add(new THREE.CylinderGeometry(r * 1.02, r * 1.02, len * 0.08, 20), K.lit(0x7dffa0), q.clone().add(new THREE.Vector3(-len * 0.28, 0, 0)), [0, 0, Math.PI / 2]); } };
  K.sofc = (p, s) => { for (let i = 0; i < 14; i++) K.add(new THREE.BoxGeometry(s, s * 0.045, s), i % 2 ? K.mS : K.mCe, p.clone().add(new THREE.Vector3(0, i * s * 0.065, 0))); K.add(new THREE.BoxGeometry(s * 1.08, s * 0.1, s * 1.08), K.mG, p.clone().add(new THREE.Vector3(0, s * 0.95, 0))); };
  K.gyro = (p, r) => { K.add(new THREE.SphereGeometry(r, 24, 16), K.mS, p); for (const rot of [[Math.PI / 2, 0, 0], [0, Math.PI / 2, 0]]) K.add(new THREE.TorusGeometry(r * 1.22, r * 0.06, 8, 40), K.mG, p, rot); K.add(new THREE.TorusGeometry(r * 1.01, r * 0.03, 6, 40), K.lit(0xb5d9fd), p, [Math.PI / 2, 0, 0]); };
  K.seat = (p, s) => { K.add(new THREE.BoxGeometry(0.6 * s, 0.1 * s, 0.56 * s), K.mG, p.clone().add(new THREE.Vector3(0, -0.34 * s, 0))); K.add(new THREE.BoxGeometry(0.6 * s, 0.95 * s, 0.1 * s), K.mG, p.clone().add(new THREE.Vector3(0, 0.12 * s, -0.3 * s)), [-0.16, 0, 0]); for (const sx of [-1, 1]) K.add(new THREE.BoxGeometry(0.28 * s, 0.2 * s, 0.03 * s), K.lit(sx < 0 ? 0x8fe3a8 : 0x94bce3), p.clone().add(new THREE.Vector3(sx * 0.3 * s, 0.16 * s, 0.55 * s)), [-0.35, 0, 0]); };
  K.barrel = (p, r, len) => K.add(new THREE.CylinderGeometry(r, r, len, 16), K.mS, p, [Math.PI / 2, 0, 0]);
  K.fan = (p, r) => { K.add(new THREE.TorusGeometry(r, r * 0.12, 10, 40), K.mG, p, [Math.PI / 2, 0, 0]); for (let i = 0; i < 9; i++) { const a = i / 9 * Math.PI * 2; const bl = K.add(new THREE.BoxGeometry(r * 0.85, r * 0.03, r * 0.22), K.mS, p.clone().add(new THREE.Vector3(Math.cos(a) * r * 0.45, 0, Math.sin(a) * r * 0.45)), [0.35, -a, 0]); } K.add(new THREE.CylinderGeometry(r * 0.18, r * 0.18, r * 0.3, 16), K.mCu, p); };
  K.hv = (a, b, r) => K.add(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([a, a.clone().lerp(b, 0.5).add(new THREE.Vector3(0, r * 8, 0)), b]), 20, r, 6), K.mHV, new THREE.Vector3());
  return K;
}

const pilotEntry = (suit, accent) => ({
  ghost: false,
  async build() { await loadPilot(); const p = makePilot(suit, accent); p.animate(0, 0, false, false, { pitch: -0.1 }); p.animate(0.6, 0, false, false, { pitch: -0.1 }); p.root.userData.update = (t) => p.animate(t, 0, false, false, { pitch: -0.1 }); return p.root; },
  parts: ({ L }) => [
    ['Pressure helmet', 'Hard shell, gold-film visor, two lamps', L(0, 1.76, 0.12)],
    ['Life-support pack', 'Oxygen, CO2 scrubber and radio', L(0, 1.42, -0.3)],
    ['Jet pack', 'Two methalox bottles and nozzles for short hops', L(0.17, 1.22, -0.24)],
    ['Armour plates', 'Ceramic plates over a pressure undersuit', L(0.1, 0.75, 0.1)],
    ['PRIF44 + GASHR', 'Rifle barrel over a GASHR canister drum', L(-0.12, 1.25, 0.55)],
    ['Suit lights', 'Strips glow at night so the squad can find you', L(0.13, 1.33, 0.17)],
  ],
});

const mechEntry = (kind, make = buildMech, arms = null) => { const E = {
  build: () => { const r = make(kind); E._A = r.userData.anchors; return r; },
  inner: ({ L }, K) => { const A = E._A, P = (v) => L(v.x, v.y, v.z); for (const s of [-1, 1]) { K.motor(L(s * A.hip.x * 0.8, A.hip.y, 0), 0.42, 0.7); K.motor(L(s * A.knee.x, A.knee.y, 0), 0.38, 0.8); }
    K.cells(P(A.cells).add(new THREE.Vector3(0, 0, 0.5)), 0.16, 1.1); K.gyro(P(A.gyro), 0.38); K.seat(P(A.cockpit).add(new THREE.Vector3(0, -0.2, -0.7)), 1); },
  parts: ({ L }) => { const A = E._A, P = (v) => L(v.x, v.y, v.z); return [
    ['Cockpit', 'One pilot behind framed armour glass', P(A.cockpit)],
    A.stacks && ['Exhaust stacks', 'Vent cell and SOFC heat', P(A.stacks)],
    ['Cell bay', 'Methalox cells in the armoured back', P(A.cells)],
    A.roof && ['Roof kit', arms[2], P(A.roof)],
    ['Right arm', arms ? arms[0] : kind === 'bastion' ? 'Six-barrel rotary cannon, belt-fed' : 'Twin-barrel autocannon', P(A.right)],
    ['Left arm', arms ? arms[1] : kind === 'bastion' ? 'Nine-tube missile box' : 'Twin-barrel autocannon', P(A.left)],
    ['Waist slew ring', 'Torso turns over the hips', P(A.waist)],
    ['Gyro', 'Keeps the hull upright under recoil', P(A.gyro)],
    ['Hip actuators', 'Axial-flux motor in each hip', P(A.hip)],
    ['Knee rams', 'Twin hydraulic rams behind each shin', P(A.knee)],
    ['Feet', 'Wide pads with toe plates for loose regolith', P(A.foot)],
  ].filter(Boolean); } }; return E; };
export const ANATOMY = {
  bastion: mechEntry('bastion'), warden: mechEntry('warden'),
  jackal: mechEntry('jackal', buildWalker, ['Six-barrel rotary cannon, drum-fed', 'Six-tube missile pod', 'Four-tube launcher beside a light gun turret']),
  lancer: mechEntry('lancer', buildWalker, ['Long single-barrel cannon', 'Long single-barrel cannon', 'Search radar under a radome']),
  ballista: mechEntry('ballista', buildWalker, ['Six-tube missile pod', 'Six-tube missile pod', 'Six-tube roof battery']),
  rifle: { ghost: false, build: () => { const r = buildRifle(); r.scale.setScalar(4); r.position.y = 1.2; const w = new THREE.Group(); w.add(r); return w; },
    parts: ({ L }) => [['Twin muzzle', 'Rifle bore over the GASHR tube', L(0, 1.25, 2.3)], ['PRIF44 barrel', 'Kinetic rounds, semi and burst', L(0, 1.3, 1.7)], ['GASHR tube', 'Fires gas canisters that force a pilot out', L(0, 1.06, 1.5)],
      ['Canister drum', 'Holds five GASHR canisters', L(0.24, 1.12, 0.24)], ['Curved magazine', 'Cyan strip shows rounds left', L(0, 0.75, -1.1)], ['Optic', 'Links to the helmet display', L(0, 1.62, 0.1)], ['Bullpup stock', 'Short enough to use inside a cockpit', L(0, 1.15, -1.45)]] },
  relay: {
    build: () => buildRelay(),
    solid: ({ L }) => { const b = [[6, 48.2, 0, 0.7, 0.7, 0.7], [6, 40, 0, 2.6, 2.4, 2.6], [6, 34, 2.4, 3.6, 3.6, 3.6], [6, 21, 0, 3.6, 1, 2], [-6, 3.5, 6, 6.5, 3, 4], [-6, 1.9, -3, 6, 1.6, 1.6]];
      for (let i = 0; i < 3; i++) { const a = i * 2.094 + 0.5; b.push([6 + Math.cos(a) * 27, 0.35, Math.sin(a) * 27, 1.2, 1, 1.2]); } return b.map(([x, y, z, ...h]) => [L(x, y, z), h]); },
    parts: ({ L }) => [
      ['Aviation beacon', 'Lit at night for landers and pilots', L(6, 48.2, 0)],
      ['Sector antennas', 'Three panels, 120° apart, carry the base radio net', L(6, 40, 0)],
      ['Orbital uplink', '3.4 m dish for the Ares Ring and relay satellites', L(6, 34, 2.4)],
      ['Microwave links', 'Line-of-sight hops to the next station', L(8.5, 21, 0.9)],
      ['Service decks', 'At 13 m and 27 m, railed for crews in suits', L(6, 13.2, 4.3)],
      ['Lattice mast', 'Four-leg steel truss, 38 m to the top deck', L(9.07, 6, 3.07)],
      ['Equipment hut', 'Radios, batteries and the uplink computer', L(-6, 3.2, 9.5)],
      ['Methalox tanks', 'Run the tower fuel cells through the night', L(-6, 1.9, -3)],
      ['Guy anchors', 'Regolith-filled blocks hold three guy lines', L(29.7, 0.4, 12.9)],
    ],
  },
  meson: {
    build: () => buildMeson(),
    solid: () => { const m = mats(); return (o, c) => o.material === m.core || (Math.hypot(c.x, c.z) > 9.5 && c.y < 2.5); },
    parts: ({ L }) => [
      ['Emitter core', 'Projects the shield dome over the base', L(0, 25, 0)],
      ['Field lenses', 'Six floating shards shape the dome', L(3.8, 25.5, 0)],
      ['Focus rings', 'Three tilted loops spread the field', L(0, 13.6, 4.1)],
      ['Power column', 'Hex trunk carrying the core feed up 22 m', L(0, 9, 3.2)],
      ['Radiator fins', 'Three fins shed core heat', L(4.6, 8.5, 0)],
      ['Capacitor banks', 'Three ground banks charge the core', L(5.24, 0.8, 9.1)],
      ['Plinth', 'Hex footing set into bedrock', L(0, 1.1, 7.5)],
    ],
  },
  habdome: {
    build: () => habDome(),
    solid: () => { const m = mats(); return (o) => o.material !== m.fabric; },
    parts: ({ L }) => [
      ['Airlock', 'Outer and inner doors. Walk in on foot', L(0, 1.4, 12.45)],
      ['Pressure shell', 'Fabric skin held up by cabin air, tied down by steel rings', L(6.5, 3.3, 0)],
      ['Grow beds', 'Six beds of potatoes in treated regolith', L(4.9, 0.6, -0.6)],
      ['Grow lights', 'LED bars over every bed', L(2.4, 2.45, -1.2)],
      ['Life support', 'Oxygen plant and CO2 scrubber', L(-3, 1.6, -7.3)],
      ['Control desk', 'Climate and water controls', L(3.4, 1.3, -7.3)],
    ],
  },
  hab: {
    build: () => hab(14),
    solid: () => { const m = mats(); return (o) => o.material !== m.panel; },
    parts: ({ L }) => [
      ['Pressure hull', '6.4 m tube for 4 to 6 crew', L(0, 4.6, 2.2)],
      ['Airlock', 'Suit up here before going outside', L(8.6, 1.6, 1.3)],
      ['Viewports', 'Four angled windows', L(-4.6, 3.3, 2.95)],
      ['Air plant', 'Scrubs CO2 and tops up oxygen', L(-2.8, 5.6, 0)],
      ['Stiffening rings', 'Four steel hoops carry the pressure load', L(-6.4, 5.5, 0)],
    ],
  },
  mine: {
    build: () => mineRig(),
    solid: ({ L }) => [[-10, 8, 0, 1.3, 9, 1.3], [-6.2, 1.6, -2.6, 2, 2.2, 1.6], [-3.5, 3, 0, 2.3, 2.2, 2.3], [-7, 2, -10, 3.3, 2.4, 2.8]].map(([x, y, z, ...h]) => [L(x, y, z), h]),
    parts: ({ L }) => [
      ['Derrick', '15 m steel tower over the drill hole', L(-8, 11, 1.2)],
      ['Drill string', 'Spins down to the buried ice', L(-10, 4, 0)],
      ['Crown block', 'Hoists the string to change bits', L(-10, 15.5, 0)],
      ['Power house', 'Drive motors and the rig’s cell rack', L(-6.2, 1.1, -1.4)],
      ['Ore hopper', 'Takes ice-bearing regolith off the drill', L(-3.5, 3.8, 2.1)],
      ['Conveyor', 'Carries ore 15 m up to the stockpile', L(4.5, 4.8, 0.7)],
      ['Crew shed', 'Suit lockers and a warm room', L(-7, 2, -7.5)],
    ],
  },
  tanks: {
    build: () => tanks(),
    solid: ({ L }) => [[2.6, 3.4, 0, 2.3, 2.3, 2.3], [-2.6, 3.4, 0, 2.3, 2.3, 2.3], [0, 1.2, 0, 2.7, 0.3, 0.3]].map(([x, y, z, ...h]) => [L(x, y, z), h]),
    parts: ({ L }) => [
      ['Oxygen sphere', 'Liquid O2 from electrolysis', L(2.6, 3.4, 2.2)],
      ['Methane sphere', 'Liquid CH4 from the Sabatier reactor', L(-2.6, 3.4, 2.2)],
      ['Crossfeed line', 'Feeds the cell filler and the lander', L(0, 1.2, 0)],
      ['Legs', 'Four struts per sphere', L(3.9, 1.2, 1.3)],
    ],
  },
  solar: {
    build: () => solarRow(6, 0.5),
    solid: () => { const m = mats(); return (o) => o.material === m.solar; },
    parts: ({ L }) => [
      ['Solar blanket', 'Thin-film cells. Mars gets about 43% of Earth’s sunlight', L(0, 1.65, 0)],
      ['Tilt frame', 'Set to the site latitude', L(1.8, 1.9, 0.9)],
      ['Ground posts', 'Driven into the regolith', L(-9, 0.75, 0)],
    ],
  },
  pad: {
    build: () => pad(14),
    solid: () => { const m = mats(); return (o) => o.material === m.lamp || o.material === m.padLine; },
    parts: ({ L }) => [
      ['Pad surface', 'Sintered regolith, so exhaust does not dig a crater', L(5, 0.4, 5)],
      ['Landing ring', 'Target for the descent camera', L(0, 0.37, 10.9)],
      ['Edge lamps', 'Ten lamps around the rim', L(13.4, 0.5, 0)],
    ],
  },
  rover: {
    build: () => rover().g,
    solid: () => { const m = mats(); return (o) => ![m.panel, m.accent, m.glass].includes(o.material); },
    parts: ({ L }) => [
      ['Crew cab', 'Pressurised. Two crew without suits', L(0, 2.1, 2.9)],
      ['Suitports', 'Crew climb straight into suits on the back wall', L(0.6, 2.1, 0.45)],
      ['Radiator', 'Sheds cell and cabin heat', L(0, 3.25, 1.6)],
      ['Ore bin', 'Open bin, tipped at the plant', L(0, 2.2, -1.45)],
      ['Cell rack', 'Six methalox cells, three a side', L(1.3, 1.55, -1.05)],
      ['Hub motors', 'One per wheel, on swing arms', L(1.62, 0.66, 2.3)],
    ],
  },
  lander: {
    build: () => lander(),
    inner: ({ L }, K) => { const t = (y0, y1, c) => K.add(new THREE.CylinderGeometry(4.2, 4.2, y1 - y0, 40), c, L(0, (y0 + y1) / 2, 0)); t(4.5, 17, K.mCe); t(17.5, 30, K.mCl); K.add(new THREE.SphereGeometry(1.2, 16, 10), K.mCe, L(0, 46, 0)); K.add(new THREE.SphereGeometry(1.4, 16, 10), K.mCl, L(0, 24, 0));
      K.add(new THREE.BoxGeometry(7, 7, 7), K.mG, L(0, 36, 0)).material = new THREE.MeshStandardMaterial({ color: 0x3d5f82, transparent: true, opacity: 0.25 }); },
    solid: () => (o) => o.geometry.type === 'CylinderGeometry' && o.position.y < 3.5,
    parts: ({ L }) => [
      ['Cargo bay', 'Pressurised deck behind the hatch, 7 m across', L(0, 36, 4.5)],
      ['Forward flaps', 'Steer the hull during the belly-first fall', L(3.9, 43.8, -1.2)],
      ['Header tanks', 'Small tanks that feed the landing burn', L(0, 46, 0)],
      ['Methane tank', 'Upper main tank', L(0, 24, 4.4)],
      ['Oxygen tank', 'Lower main tank', L(0, 10, 4.4)],
      ['Heat shield', 'Hex tiles on the windward side', L(0, 20, -4.6)],
      ['Aft flaps', 'Largest control surfaces', L(4.7, 10, -1.4)],
      ['Engines', '3 sea-level and 3 vacuum bells, methalox', L(3, 0.8, 1.7)],
      ['Landing legs', 'Six, for unprepared ground', L(7.2, 0.4, 0)],
    ],
  },
  ltower: {
    build: () => launchTower(),
    solid: () => { const m = null; return (o, c) => c.y > 20 && c.y < 44 && c.x > -10; },
    parts: ({ L }) => [
      ['Jib crane', 'Lifts engines and cargo pods, 26 m reach', L(-6, 68.2, 0)],
      ['Crew access arm', 'Swings to the lander hatch at 40 m', L(-5.5, 41.4, 1.3)],
      ['Propellant arm', 'Quick-disconnect lines for methane and oxygen', L(-9.5, 22, 2)],
      ['Elevator', 'Crew car inside the lattice', L(-15.6, 30, -1.6)],
      ['Lattice', 'Steel truss, 9 m square', L(-9.5, 12, 4.5)],
      ['Ground lines', 'Feed from the propellant plant', L(-12, 0.9, 12)],
      ['Launch mount', 'Ring and flame trench under the lander', L(6, 0.8, 7.4)],
    ],
  },
  ctower: {
    build: () => controlTower(),
    solid: () => { const m = null; return (o, c) => c.y < 22.5; },
    parts: ({ L }) => [
      ['Radar', 'Tracks landers and HAWCs, 360°', L(2.4, 31.4, 0)],
      ['Comms mast', 'Base radio and the relay link', L(-2.6, 36, 1.5)],
      ['Ops cab', 'Pressurised. Controllers run lander slots and convoys', L(0, 26, 4.2)],
      ['Signal lights', 'Clear, hold, abort for pilots on the pad', L(5.3, 24.9, 3.6)],
      ['Power module', 'Fuel cells and batteries', L(-3.6, 14, 1.5)],
      ['Air plant', 'Scrubs CO2 and tops up oxygen', L(5.8, 7, 0)],
      ['Elevator', 'Glass shaft up the pylon', L(0, 9, 1.3)],
      ['Cable trays', 'Power in red, data in blue', L(1.9, 16, 0.6)],
    ],
  },
  percy: {
    build: () => percy(),
    ghost: false,
    parts: ({ L }) => [
      ['SuperCam and Mastcam-Z', 'Laser spectrometer and zoom cameras on the mast head', L(0.62, 2.22, 1.06)],
      ['Remote sensing mast', '2.2 m above the ground', L(0.62, 1.75, 0.92)],
      ['High-gain antenna', 'Talks straight to Earth', L(-0.55, 1.5, -0.55)],
      ['MMRTG', 'Plutonium-238 heat source, about 110 W', L(0, 1.25, -1.45)],
      ['Robotic arm', '2.1 m, with drill, PIXL and SHERLOC on the turret', L(0.5, 0.9, 1.4)],
      ['Rocker-bogie', 'Six wheels stay on the ground over rocks', L(1.05, 0.6, -0.5)],
      ['Wheels', '52.5 cm aluminium, titanium spokes', L(1.18, 0.26, 1.05)],
    ],
  },
  kestrel: {
    build: () => { const g = kestrel(); g.position.y = 3; const w = new THREE.Group(); w.add(g); return w; },
    inner: ({ L }, K) => { K.seat(L(0, 3.7, 3.4), 1); K.cells(L(0, 3, -0.8), 0.22, 1.6); for (const s of [-1, 1]) K.motor(L(s * 1.62, 3.72, -4.2), 0.5, 1.4, 'z'); },
    parts: ({ L }) => [
      ['Cockpit', 'One pilot. The canopy blows for EVA', L(0, 4.1, 3.6)],
      ['Shoulder engines', 'Two methalox engines, throttled by the power split', L(1.62, 3.72, -4.5)],
      ['Twin tails', 'Canted fins, white tips', L(2.7, 6.6, -5.6)],
      ['Chin cannons', 'Kinetic rounds at 1,100 m/s', L(0.38, 1.95, 7.6)],
      ['Delta wing', 'Carries two missile rails per side', L(5.0, 2.6, -2.6)],
      ['Cell bay', 'Splits power between engines, guns and shield', L(0, 3, -0.8)],
      ['Intakes', 'Feed coolant loops for the cells', L(1.5, 2.7, 2.3)],
    ],
  },
  raptor: {
    build: () => { const g = raptor(); g.position.y = 2; const w = new THREE.Group(); w.add(g); return w; },
    inner: ({ L }, K) => { K.seat(L(0, 2.4, 2.4), 0.9); K.cells(L(0, 2, -1.5), 0.2, 1.4); K.motor(L(0, 2, -5.4), 0.8, 1.2, 'z'); },
    parts: ({ L }) => [
      ['Cockpit', 'Slit canopy, armoured', L(0, 2.65, 2.8)],
      ['Forward-swept wings', 'Carry the guns and nav lights', L(5.2, 2.2, -0.4)],
      ['Main engine', 'One large bell. Kill it and the Raptor drifts', L(0, 2, -6.2)],
      ['Pulse cannons', 'One under each wing root', L(3.3, 1.75, 1.6)],
      ['Cell bay', 'Behind the pilot', L(0, 2, -1.5)],
    ],
  },
  courier: {
    build: () => { const g = courier(); g.position.y = 3.5; const w = new THREE.Group(); w.add(g); return w; },
    parts: ({ L }) => [
      ['Cab', 'Two crew, forward', L(0, 4.6, 13.6)],
      ['Cargo cradle', 'Three pods on the spine', L(2.3, 3.5, 3.4)],
      ['Propellant spheres', 'Four tanks, methane and oxygen', L(4.3, 3.5, -3)],
      ['Engines', 'Four bells', L(1.6, 5.1, -11.6)],
    ],
  },
  halberd: {
    build: () => { const g = halberd(); g.position.y = 3; const w = new THREE.Group(); w.add(g); return w; },
    parts: ({ L }) => [
      ['Bridge', 'Four crew under the prow canopy', L(0, 6.6, 18)],
      ['Dorsal spine', 'Cell bays, reactor shielding, hatch', L(0, 7.6, 5.2)],
      ['Shoulder engines', 'Two methalox cruise engines', L(5.5, 4.9, 6.6)],
      ['Wing nacelles', 'Cannon and manoeuvring engine each side', L(10.9, 4.3, -5.6)],
      ['Main engines', 'Two spiked vacuum bells', L(4.6, 4.6, -18)],
      ['Chin guns', 'Twin long-barrel cannons', L(1.5, 3.5, 18.5)],
    ],
  },
  pilot: pilotEntry(0xdad6cd, 0x5980a6),
  dpilot: pilotEntry(0x6b6a66, 0x8a3a24),
  stalker: {
    inner: ({ f, S }, K) => { const k = S.y / 9.2;
      K.seat(f(0.5, 0.76, 0.74), k); K.cells(f(0.5, 0.64, 0.3), 0.14 * k, 1.0 * k); K.sofc(f(0.64, 0.54, 0.34), 0.55 * k); K.gyro(f(0.5, 0.47, 0.5), 0.32 * k);
      for (const x of [0.33, 0.67]) { K.motor(f(x, 0.47, 0.5), 0.38 * k, 0.6 * k); K.motor(f(x - 0.03 * Math.sign(x - 0.5), 0.25, 0.55), 0.32 * k, 0.5 * k); K.hv(f(0.5, 0.6, 0.35), f(x, 0.5, 0.5), 0.04 * k); }
      for (const x of [0.1, 0.9]) K.barrel(f(x, 0.62, 0.82), 0.09 * k, 2.2 * k);
      for (let i = 0; i < 6; i++) K.barrel(f(0.44 + (i % 3) * 0.06, 0.9 + (i < 3 ? 0.02 : -0.02), 0.42), 0.08 * k, 0.9 * k); },
    parts: ({ f }) => [
      ['Cockpit', 'One pilot on a rail ejection seat', f(0.5, 0.8, 0.78)],
      ['Missile rack', 'Six tubes on the shoulders', f(0.5, 0.92, 0.42)],
      ['Cell bay', 'Methalox cells behind the cockpit', f(0.5, 0.66, 0.3)],
      ['SOFC stack', 'Turns cell propellant into power', f(0.64, 0.6, 0.34)],
      ['Twin cannon', 'One per arm, 240 m reach', f(0.9, 0.62, 0.9)],
      ['Control-moment gyro', 'Keeps 9 m of HAWC upright', f(0.5, 0.47, 0.5)],
      ['Hip motors', 'Axial-flux, fed by the orange HV lines', f(0.67, 0.47, 0.5)],
      ['Knee motors', 'Slow but strong. Why it walks slowly', f(0.7, 0.25, 0.55)],
    ],
  },
  vulture: {
    inner: ({ f, S }, K) => { const k = S.z / 8.5;
      for (const x of [0.25, 0.75]) for (const z of [0.25, 0.75]) { K.fan(f(x, 0.22, z), 0.6 * k); K.hv(f(0.5, 0.45, 0.45), f(x, 0.26, z), 0.035 * k); }
      K.seat(f(0.5, 0.6, 0.82), k * 0.9); K.cells(f(0.5, 0.45, 0.45), 0.13 * k, 0.9 * k); K.motor(f(0.5, 0.45, 0.1), 0.42 * k, 0.6 * k, 'z'); K.barrel(f(0.5, 0.72, 0.8), 0.08 * k, 1.8 * k); },
    parts: ({ f }) => [
      ['Pulse emitter', 'Fires plasma bolts, 170 m reach', f(0.5, 0.72, 0.9)],
      ['Cockpit', 'One pilot, low and forward', f(0.5, 0.64, 0.82)],
      ['Cell bay', 'Methalox cells. Drains fast at full speed', f(0.5, 0.48, 0.45)],
      ['Thrust fan', 'Rear duct, pushes it to 54 km/h', f(0.5, 0.45, 0.08)],
      ['Lift fans', 'Four ducted fans hold it 1.6 m up', f(0.75, 0.22, 0.25)],
    ],
  },
  boulder: {
    inner: ({ f, S }, K) => { const k = S.z / 9.6;
      for (const x of [0.09, 0.91]) for (const z of [0.18, 0.34, 0.5, 0.66, 0.82]) K.motor(f(x, 0.16, z), 0.3 * k, 0.3 * k);
      K.cells(f(0.5, 0.36, 0.16), 0.15 * k, 1.2 * k); K.sofc(f(0.5, 0.3, 0.3), 0.6 * k);
      const r = K.add(new THREE.TorusGeometry(S.x * 0.22, 0.06 * k, 10, 48), K.mS, f(0.5, 0.55, 0.52), [Math.PI / 2, 0, 0]);
      K.add(new THREE.BoxGeometry(0.5 * k, 0.5 * k, 1.4 * k), K.mG, f(0.5, 0.7, 0.5)); K.barrel(f(0.5, 0.72, 0.8), 0.1 * k, 3.4 * k);
      for (let i = 0; i < 5; i++) K.add(new THREE.CylinderGeometry(0.1 * k, 0.1 * k, 0.6 * k, 12), K.mCu, f(0.5, 0.7, 0.3).add(new THREE.Vector3((i - 2) * 0.22 * k, 0, 0)), [Math.PI / 2, 0, 0]);
      for (const x of [0.38, 0.62]) K.seat(f(x, 0.62, 0.62), k * 0.8); },
    parts: ({ f }) => [
      ['Gun breech', 'Heavy shell, 9 m splash', f(0.5, 0.74, 0.52)],
      ['Autoloader', 'Feeds the breech from the turret bustle', f(0.5, 0.7, 0.3)],
      ['Crew', 'Two Darken crew under the turret', f(0.62, 0.66, 0.62)],
      ['Turret ring', 'Turns 360°', f(0.72, 0.55, 0.52)],
      ['Cell bay', 'Armoured, in the rear hull', f(0.5, 0.36, 0.16)],
      ['SOFC stack', 'Power for drive and turret', f(0.5, 0.34, 0.3)],
      ['Hub motors', 'Five per side, each on the cell bus', f(0.91, 0.16, 0.66)],
    ],
  },
};
