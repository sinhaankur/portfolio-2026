// Mars HAWC icon library. 24 px grid, 1.5 px stroke, square caps and mitred joins, currentColor only.
// Groups: system, power, weapons, pilot, ops, world. Each entry: [group, path data, usage].
export const ICONS = {
  close: ['system', 'M6 6 18 18M18 6 6 18', 'Close any panel or overlay'],
  back: ['system', 'M15 5 8 12l7 7', 'Return to the previous screen'],
  next: ['system', 'M9 5l7 7-7 7', 'Advance, deploy, continue'],
  play: ['system', 'M7 4l13 8-13 8Z', 'Resume a paused mission'],
  pause: ['system', 'M8 5v14M16 5v14', 'Pause'],
  settings: ['system', 'M12 3l7.8 4.5v9L12 21l-7.8-4.5v-9ZM15 12a3 3 0 1 1-6 0a3 3 0 1 1 6 0', 'Settings'],
  sound: ['system', 'M4 9h4l5-4v14l-5-4H4ZM16.5 9a4.5 4.5 0 0 1 0 6M19 6.5a8 8 0 0 1 0 11', 'Sound on'],
  mute: ['system', 'M4 9h4l5-4v14l-5-4H4ZM16 9.5l5 5M21 9.5l-5 5', 'Sound off'],
  voice: ['system', 'M4 15v-3a8 8 0 0 1 16 0v3M4 14h3v6H4ZM17 14h3v6h-3ZM20 20c0 1.5-1.5 2-4 2h-2', 'Radio voice'],
  info: ['system', 'M21 12a9 9 0 1 1-18 0a9 9 0 1 1 18 0M12 11v6M12 7.5v.5', 'Intel, briefing detail'],
  warning: ['system', 'M12 3 22 20H2ZM12 9.5v4.5M12 16.5v.5', 'Under attack, low cells'],
  check: ['system', 'M4 12.5l5 5L20 6', 'Objective done'],
  globe: ['system', 'M21 12a9 9 0 1 1-18 0a9 9 0 1 1 18 0M12 3c-2.5 2.5-3.8 5.5-3.8 9s1.3 6.5 3.8 9c2.5-2.5 3.8-5.5 3.8-9S14.5 5.5 12 3ZM3 12h18', 'War room, campaign map'],
  radar: ['system', 'M21 12a9 9 0 1 1-9-9M17 12a5 5 0 1 1-5-5M12 12l6.4-6.4', 'Radar'],
  eye: ['system', 'M2 12c3-5 6.3-7 10-7s7 2 10 7c-3 5-6.3 7-10 7S5 17 2 12ZM15 12a3 3 0 1 1-6 0a3 3 0 1 1 6 0', 'Cycle camera view'],
  nightvision: ['system', 'M3 9h18v7h-6l-2-2h-2l-2 2H3ZM6.5 12.5h1M16.5 12.5h1M8 9V6h8v3', 'Night vision'],
  controller: ['system', 'M7 8h10l4 9.5a2 2 0 0 1-3.4 1.6L15 16H9l-2.6 3.1A2 2 0 0 1 3 17.5ZM8.5 10.5v3M7 12h3M15.5 11.5h.5M17.5 13.5h.5', 'Controller input'],
  keyboard: ['system', 'M2 6h20v12H2ZM6 10h1M10 10h1M14 10h1M18 10h1M7 14h10', 'Keyboard input'],

  cell: ['power', 'M7 5h10v16H7ZM10 2h4v3M7 11h10M10 15.5h4', 'Methalox fuel cell'],
  dock: ['power', 'M5 5h8v16H5ZM7.5 2h3v3M10 9l-2 3.5h3L9 16M17 8v8M15 12h6', 'Cell charging dock'],
  ore: ['power', 'M4 15 8 6l7-2 5 6-2 9-9 1ZM8 6l3 7 9-3M11 13l-2 7M11 13l7 6', 'Ore, mine output'],
  ice: ['power', 'M12 2v20M3.3 7l17.4 10M20.7 7 3.3 17M9.5 3.5 12 5l2.5-1.5M9.5 20.5 12 19l2.5 1.5', 'Buried ice, plant feedstock'],
  plant: ['power', 'M3 21V10l5 3v-3l5 3V6h3V3h3v18ZM3 21h18M7 17h2M12 17h2', 'Sabatier and electrolysis plant'],
  reactor: ['power', 'M10 2h4v6h-4ZM12 8v3M6 11h12l-3 10H9ZM7.5 16h9', 'Kilopower-class reactor'],
  solar: ['power', 'M3 15 7 5h14l-4 10ZM5 10h14M10.5 5l-3 10M15 5l-3 10M12 15v5M8 20h8', 'Solar blanket'],
  heat: ['power', 'M7 4c-2 3 2 5 0 8s2 5 0 8M12 4c-2 3 2 5 0 8s2 5 0 8M17 4c-2 3 2 5 0 8s2 5 0 8', 'Heat'],
  power: ['power', 'M12 3v8M7 6.3a8 8 0 1 0 10 0', 'Power state, shutdown'],

  autocannon: ['weapons', 'M2 10h13v4H2ZM15 9h4v6h-4ZM19 11h3M19 13h3M6 14v3h4v-3', 'P2MEC autocannon'],
  missile: ['weapons', 'M5 10h10l5 2-5 2H5ZM5 10 2.5 7M5 14l-2.5 3M9 10V8M9 14v2M15 10v4', 'TCROCK missiles'],
  gashr: ['weapons', 'M3 14h9v5H3ZM12 15.5h3M15 15.5 20 10.5M18 3l-3 5h4l-3 5', 'GASHR, forces a pilot out'],
  rifle: ['weapons', 'M2 11h15l2-2h3v4h-3l-2 2H9l-2 4H4l1-4H2Z', 'PRIF44 rifle'],
  lock: ['weapons', 'M4 9V4h5M15 4h5v5M20 15v5h-5M9 20H4v-5M12 10v4M10 12h4', 'Missile lock'],
  reticle: ['weapons', 'M12 2v5M12 17v5M2 12h5M17 12h5M19 12a7 7 0 1 1-14 0a7 7 0 1 1 14 0', 'Aim'],
  strike: ['weapons', 'M12 2v14M8 12l4 4 4-4M4 21h16M7.5 18 6 21M16.5 18l1.5 3', 'Orbital strike'],
  drop: ['weapons', 'M4 10a8 6 0 0 1 16 0ZM4 10l5 6M20 10l-5 6M12 10v6M9 16h6v5H9Z', 'Supply drop'],

  hawc: ['pilot', 'M8 3h8v5H8ZM6 8h12l-1 6H7ZM3.5 9h2.5v5H3.5ZM18 9h2.5v5H18ZM8 14l-1 7h3l2-5 2 5h3l-1-7', 'HAWC'],
  pilot: ['pilot', 'M5 12a7 7 0 0 1 14 0v6H5ZM8 10.5h8V14H8ZM7 18v3M17 18v3', 'Pilot on foot'],
  eject: ['pilot', 'M12 4 5 12h14ZM5 16h14M5 20h14', 'Eject'],
  board: ['pilot', 'M3 12h10M9 8l4 4-4 4M14 4h7v16h-7', 'Board a hull'],
  jetpack: ['pilot', 'M8 4h8v10H8ZM12 2v2M10 14l-1 4M14 14l1 4M9 18l-1 3M15 18l1 3', 'Jetpack'],
  armor: ['pilot', 'M12 2 20 5v7c0 5-4 8-8 10-4-2-8-5-8-10V5ZM12 6v12', 'Armor, suit integrity'],
  repair: ['pilot', 'M15 3a5 5 0 0 0-4 7L3 18l3 3 8-8a5 5 0 0 0 7-4l-3 1-2-2 1-3Z', 'Repair'],
  cockpit: ['pilot', 'M3 19 7 5h10l4 14M7 5l2 7h6l2-7M3 19h18', 'Cockpit view'],

  defend: ['ops', 'M3 21V9h4v3h3V9h4v3h3V9h4v12Z', 'Defend'],
  capture: ['ops', 'M6 21V3M6 4h11l-3 4 3 4H6', 'Capture'],
  raid: ['ops', 'M3 21 13 11M8 5c5-2 9 0 12 4-4-1-7-1-9 1Z', 'Raid mine'],
  destroy: ['ops', 'M12 2l2 6 6-3-3 6 6 2-6 2 3 6-6-3-2 6-2-6-6 3 3-6-6-2 6-2-3-6 6 3Z', 'Destroy towers'],
  hijack: ['ops', 'M3 16h8v4H3ZM7 16v-4h5l3-4h6M17 4l4 4-4 4', 'Hijack'],
  escort: ['ops', 'M4 6l6 6-6 6M11 6l6 6-6 6M20 6v12', 'Escort convoy'],
  intercept: ['ops', 'M3 20 21 4M3 4l7 7M14 13l7 7M16 4h5v5', 'Intercept'],
  lander: ['ops', 'M10 3.5c1-1 3-1 4 0L15 6v11H9V6ZM9 17l-3 4M15 17l3 4M12 17v4M9 9.5h6', 'Protect lander'],
  orbital: ['ops', 'M21 12a9 3.5 0 1 1-18 0a9 3.5 0 1 1 18 0M15 12a3 3 0 1 1-6 0a3 3 0 1 1 6 0', 'Orbital assault'],

  station: ['world', 'M12 3v18M8 21l4-12 4 12M6 7a8 8 0 0 1 12 0M8.5 9.5a4.5 4.5 0 0 1 7 0', 'Station relay'],
  city: ['world', 'M2 20h20M3 20a6 6 0 0 1 12 0M13 20a4.5 4.5 0 0 1 9 0M9 14v6M3.8 17h10.4M17.5 15.5V20', 'Town or city'],
  mine: ['world', 'M4 21 9 5h6l5 16M7 13h10M12 5V2M10 21v-4h4v4', 'Ice pit and mine'],
  rover: ['world', 'M3 16v-6l3-3h8v9M14 10h5l2 3v3M3 16h18M7 19a2 2 0 1 1-4 0a2 2 0 1 1 4 0M14 19a2 2 0 1 1-4 0a2 2 0 1 1 4 0M21 19a2 2 0 1 1-4 0a2 2 0 1 1 4 0', 'Haul rover'],
  fighter: ['world', 'M12 2l2 8 7 5v2l-7-2-1 5h-2l-1-5-7 2v-2l7-5Z', 'Fighter'],
  probe: ['world', 'M3 15h15v-4H3ZM15 11V4M13 4h5v2h-5ZM18 13h3M7 18.5a1.5 1.5 0 1 1-3 0a1.5 1.5 0 1 1 3 0M12 18.5a1.5 1.5 0 1 1-3 0a1.5 1.5 0 1 1 3 0M17 18.5a1.5 1.5 0 1 1-3 0a1.5 1.5 0 1 1 3 0', 'Heritage probe'],
  crate: ['world', 'M4 7l8-4 8 4v10l-8 4-8-4ZM4 7l8 4 8-4M12 11v10', 'Supply crate'],
  flag: ['world', 'M5 21V3M5 4h14v8H5', 'Faction flag'],
};
export const GROUPS = [['system', 'System'], ['power', 'Power and resources'], ['weapons', 'Weapons and support'], ['pilot', 'Pilot and HAWC'], ['ops', 'Operations'], ['world', 'World']];
export function svg(name, size = 24, stroke = 1.5) {
  const d = ICONS[name]?.[1] || '';
  return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${stroke}" stroke-linecap="square" stroke-linejoin="miter" aria-hidden="true"><path d="${d}"/></svg>`;
}
