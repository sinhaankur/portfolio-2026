// Hubble Space Telescope — isometric part-by-part exploded teardown.
// Standalone HTML (open the written file directly; no server). Same engine +
// label/explode mechanics as the ISS teardown; Hubble's real structure.
//
// Truth: Hubble is a ~13.2 m long, 4.2 m diameter tube (the Optical Telescope
// Assembly). Light enters the APERTURE DOOR at the front (+z), travels down the
// baffled tube to the 2.4 m PRIMARY MIRROR at the back, bounces to the small
// SECONDARY MIRROR near the front, back through a hole in the primary to the
// SCIENCE INSTRUMENTS at the focal plane. Two SOLAR ARRAY WINGS fan off the
// sides; HIGH-GAIN ANTENNAS on booms relay data; REACTION WHEELS + fine-guidance
// sensors point it. Each part here is a real, named Hubble element. Sources:
// NASA Hubble fact sheet + lib/craft-anatomy.ts (hubble).
import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { homedir } from "node:os";

const KIT = join(homedir(), ".claude", "skills", "anatomy");
const k = await import(pathToFileURL(join(KIT, "kit", "iso-kit.mjs")).href);
const { kitScript } = await import(pathToFileURL(join(KIT, "scripts", "inline-kit.mjs")).href);

const HERE = dirname(fileURLToPath(import.meta.url));
const theme = process.argv.includes("--light") ? "light" : "dark";

// ---- world layout (units ~ a schematic 0.5 m) -----------------------------
// z = along the optical axis: front/aperture at +z, mirror at -z.
// x = left/right (solar wings fan here). y = up.
const R = 4.2;               // tube radius (schematic)
const TUBE_LEN = 26;         // tube length along z
const WIDTH = 1120, HEIGHT = 600;
const FIG_W = 820;
const MARGIN = (WIDTH - FIG_W) / 2;

// fit the assembled telescope: tube span + solar wings + antenna booms
const Pc = k.fitProjection(
  [
    [0, 0, -TUBE_LEN / 2 - 3], [0, 0, TUBE_LEN / 2 + 3],
    [-R - 20, 0, 0], [R + 20, 0, 0],        // solar wings L/R
    [0, R + 8, 0], [0, -R - 8, 0],          // antenna booms up/down
  ],
  FIG_W, HEIGHT,
  { pad: 20, headroom: 140, azimuth: 40, elevation: 22 },
);
const P = { ...Pc, origin: [Pc.origin[0] + MARGIN, Pc.origin[1]] };

const at = (p) => k.iso(p, P);
const S = (paths, style) => k.solidSvg(paths, style);
const L = (d, style) => k.lineSvg(d, style);
const px = (p) => k.iso(p, P);

// a cylindrical tube SECTION centred at z=cz, length len, radius rad
function tubeSection(cz, len, rad, tone = "mid", lit = false) {
  // build as a rounded slab stretched along z (same trick the ISS modules use)
  const plan = { x: -rad, y: cz - len / 2, w: rad * 2, d: len, r: rad * 0.95 };
  const out = [S(k.slabOf(plan, -rad, rad * 2, P, 10, 0.4), { tone, lit })];
  // ring seams so it reads as a tube
  for (const t of [0.25, 0.5, 0.75]) {
    const zz = cz - len / 2 + len * t;
    out.push(L(k.planOutline({ x: -rad, y: zz - 0.15, w: rad * 2, d: 0.3, r: rad * 0.95 }, rad, P, 10), { tone: "lo" }));
  }
  return out.join("");
}

// a flat disc (mirror) facing along z at z=cz
function disc(cz, rad, tone = "hi", lit = false) {
  const plan = { x: -rad, y: cz - 0.4, w: rad * 2, d: 0.8, r: rad * 0.98 };
  return S(k.slabOf(plan, -rad, rad * 2, P, 12, 0.3), { tone, lit });
}

// a solar array wing extending in ±x from the tube
function solarWing(dir, len = 18, w = 6) {
  const out = [];
  const x0 = dir > 0 ? R + 1 : -(R + 1);
  const xB = dir > 0 ? R + 1 + len : -(R + 1 + len);
  const corners = [
    at([x0, 0, -w / 2]), at([xB, 0, -w / 2]),
    at([xB, 0, w / 2]), at([x0, 0, w / 2]),
  ];
  out.push(`<path class="iso-fill" d="${k.pathOf(corners, true)}" style="fill:var(--anatomy-shade-1)"/>`);
  out.push(L(k.pathOf(corners, true), { tone: "mid" }));
  const rows = 8;
  for (let i = 1; i < rows; i++) {
    const t = i / rows, xx = x0 + (xB - x0) * t;
    out.push(L(k.pathOf([at([xx, 0, -w / 2]), at([xx, 0, w / 2])]), { tone: "faint" }));
  }
  out.push(L(k.pathOf([at([x0, 0, 0]), at([xB, 0, 0])]), { tone: "lo" }));
  return out.join("");
}

// an antenna dish on a boom extending in ±y
function antenna(dir) {
  const yB = dir > 0 ? R + 7 : -(R + 7);
  const out = [];
  out.push(L(k.pathOf([at([0, dir > 0 ? R : -R, 2]), at([0, yB, 2])]), { tone: "hi" })); // boom
  out.push(S(k.cylinder(0, yB, 1.6, 2 - 0.3, 0.6, P, 20), { tone: "mid" }));             // dish
  return out.join("");
}

// instruments bay — a cluster of small boxes at the focal plane
function instruments(cz) {
  const out = [];
  const boxes = [[-1.6, -1.6], [1.6, -1.6], [-1.6, 1.6], [1.6, 1.6]];
  for (const [bx, by] of boxes) {
    const plan = { x: bx - 1.1, y: cz - 1.1, w: 2.2, d: 2.2, r: 0.2 };
    out.push(S(k.slabOf(plan, by - 1.1, 2.2, P, 2, 0.2), { tone: "hi" }));
  }
  return out.join("");
}

// reaction-wheel / pointing module — a short ring
function pointing(cz) {
  return S(k.cylinder(0, cz, 2.0, -1, 2, P, 24), { tone: "mid" });
}

// ---- the parts: real Hubble elements, each its own exploded group ----------
const PARTS = [
  { id: "door",      name: "Aperture Door",        role: "opens to admit starlight; shuts to shield the optics from the Sun",            grp: "optics",   vec: [0, 6, 22],  num: 1, anchor: [0, 0, TUBE_LEN / 2 + 1], draw: () => disc(TUBE_LEN / 2 + 1, R * 0.92, "hi", true) },
  { id: "secondary", name: "Secondary Mirror",     role: "0.3 m convex mirror near the front — folds the light back through the primary", grp: "optics",   vec: [0, 10, 12], num: 2, anchor: [0, 0, TUBE_LEN / 2 - 3], draw: () => disc(TUBE_LEN / 2 - 3, 1.0, "lit", true) },
  { id: "tube",      name: "Optical Tube (OTA)",   role: "the 13 m baffled tube — Hubble's body, holding the optics in rigid alignment",  grp: "structure",vec: [0, -14, 0], num: 3, anchor: [0, 0, 0],                 lit: true, draw: () => tubeSection(0, TUBE_LEN - 6, R, "mid", true) },
  { id: "primary",   name: "2.4 m Primary Mirror", role: "the heart — collects + focuses the light; the one with the famous 1990 flaw",   grp: "optics",   vec: [0, -8, -20],num: 4, anchor: [0, 0, -TUBE_LEN / 2 + 2], lit: true, draw: () => disc(-TUBE_LEN / 2 + 2, R * 0.95, "lit", true) },
  { id: "instruments",name:"Science Instruments",  role: "cameras + spectrographs at the focal plane (WFC3, COS, ACS, STIS)",             grp: "payload",  vec: [0, -12, -10],num: 5, anchor: [0, 0, -TUBE_LEN / 2 + 6], draw: () => instruments(-TUBE_LEN / 2 + 6) },
  { id: "wing-l",    name: "Solar Array — Port",   role: "one of two photovoltaic wings — makes ~2.8 kW, recharges the batteries",        grp: "power",    vec: [-26, 4, 0], num: 6, anchor: [-(R + 10), 0, 0], draw: () => solarWing(-1) },
  { id: "wing-r",    name: "Solar Array — Stbd",   role: "the second wing — Sun-tracking; both were upgraded on servicing missions",      grp: "power",    vec: [26, 4, 0],  num: 7, anchor: [R + 10, 0, 0],    draw: () => solarWing(+1) },
  { id: "ant-hi",    name: "High-Gain Antenna",    role: "steerable dish on a boom — relays data to the ground via the TDRS network",     grp: "comms",    vec: [0, 16, 4],  num: 8, anchor: [0, R + 7, 2],  draw: () => antenna(+1) },
  { id: "ant-lo",    name: "Low-Gain Antenna",     role: "the second boom-mounted antenna — commands + telemetry",                        grp: "comms",    vec: [0, -16, 4], num: 9, anchor: [0, -(R + 7), 2], draw: () => antenna(-1) },
  { id: "pointing",  name: "Reaction Wheels + FGS",role: "spins up/down to point Hubble to a few milliarcsec — no thrusters near the optics", grp: "control", vec: [0, -10, 18],num: 10,anchor: [0, 0, TUBE_LEN / 2 - 7], draw: () => pointing(TUBE_LEN / 2 - 7) },
];

// ---- labels overlay (identical mechanics to the ISS figure) ---------------
function labelOverlay() {
  const out = [];
  // BALANCE the columns: Hubble's parts mostly anchor on the right, so splitting
  // by anchor-x piled 8 labels on one side (6 collisions). Alternate left/right
  // by order instead → ~5 each, clean columns. (The ISS parts spread naturally;
  // Hubble's tube-along-z does not.)
  PARTS.forEach((s, i) => {
    const side = i % 2 === 0 ? -1 : 1;
    out.push(
      `<g class="hb-label" data-label="${s.id}" data-side="${side < 0 ? "l" : "r"}" opacity="0">` +
        `<line class="hb-leader" x1="0" y1="0" x2="0" y2="0"/>` +
        `<circle class="hb-ldot" r="1.6"/>` +
        `<g class="hb-card">` +
          `<text class="hb-num" y="-5">${String(s.num).padStart(2, "0")}</text>` +
          `<text class="hb-name" y="6">${s.name}</text>` +
          `<text class="hb-role" y="17">${s.role}</text>` +
        `</g>` +
      `</g>`,
    );
  });
  return `<svg xmlns="http://www.w3.org/2000/svg" class="iso-svg hb-labels" viewBox="0 0 ${WIDTH} ${HEIGHT}" aria-hidden="true">${out.join("")}</svg>`;
}

const part = (id, inner) => `<g data-part="${id}" transform="${k.translateAlong(P, [0, 0, 0])}">${inner}</g>`;

const svg = k.figureSvg({
  width: WIDTH, height: HEIGHT, className: "hb-fig",
  label: "The Hubble Space Telescope, taken apart into its real assemblies — the aperture door, the secondary + 2.4 m primary mirror, the optical tube, the science instruments, the two solar array wings, the high- and low-gain antennas, and the reaction-wheel pointing system. Hover to take it apart; each part is a real, named Hubble element.",
  body: PARTS.map((s) => part(s.id, s.draw())),
});

const live = `
(function(){
  const PARTS = ${JSON.stringify(PARTS.map((s) => ({ id: s.id, name: s.name, role: s.role, vec: s.vec, anchor: s.anchor, grp: s.grp, num: s.num })))};
  const P = ${JSON.stringify(P)};
  const SPRING = { stagger: 0.03, stiffness: 70, damping: 15, substeps: 4 };
  const root = document.getElementById("hbfig");
  if (!root) return;
  const stage = root.querySelector(".iso-stage");
  const svg = stage.querySelector("svg.iso-svg:not(.hb-labels)") || stage.querySelector("svg");
  const labelSvg = stage.querySelector(".hb-labels");
  const readout = root.querySelector("[data-readout]");
  const still = matchMedia("(prefers-reduced-motion: reduce)");
  const groups = Object.fromEntries(PARTS.map((s)=>[s.id, svg.querySelector('[data-part="'+s.id+'"]')]));
  const labels = Object.fromEntries(PARTS.map((s)=>[s.id, labelSvg && labelSvg.querySelector('[data-label="'+s.id+'"]')]));
  const springs = Object.fromEntries(PARTS.map((s)=>[s.id, {at:0,rate:0,target:0,pending:null}]));
  let clock=0, frame=0, visible=false, touring=true, tourClock=0, demoClock=0, userTouched=false, selected=null;
  const order = PARTS.map((s)=>s.id);
  const maxOpen = ()=>PARTS.reduce((m,s)=>Math.max(m,springs[s.id].at),0);
  function isoPt(p){ const a=iso(p,P); return [a[0],a[1]]; }
  const LABEL_ROW = 40;
  function setApart(v){
    touring=false; demoClock=0; userTouched=true;
    const to=v?1:0, seq=v?order:[...order].reverse();
    seq.forEach((id,i)=>{ springs[id].pending={value:to, at:clock+i*SPRING.stagger}; });
    run();
  }
  function placeLabels(){
    if(!labelSvg) return;
    const rows={ "-1":[], "1":[] };
    for(const s of PARTS){
      const g=labels[s.id]; if(!g) continue;
      const sp=springs[s.id];
      const wp=[s.anchor[0]+s.vec[0]*sp.at, s.anchor[1]+s.vec[1]*sp.at, s.anchor[2]+s.vec[2]*sp.at];
      const [ax,ay]=isoPt(wp);
      const side=g.getAttribute("data-side")==="l"?-1:1;
      rows[side].push({ s, g, ax, ay, ideal: ay });
    }
    for(const side of [-1,1]){
      const col=rows[side]; if(!col.length) continue;
      col.sort((a,b)=>a.ideal-b.ideal);
      const top=30, bot=${HEIGHT}-24;
      // Robust de-collision: seed at each card's ideal y, then a FORWARD pass
      // pushes any card up against its neighbour down by LABEL_ROW, and a
      // BACKWARD pass pulls the whole column up if it ran past the bottom — but
      // clamped so the first card never crosses the top. Centres the stack when
      // it's shorter than the frame, so no re-collision at the edges.
      for(const it of col) it.cy=it.ideal;
      for(let i=1;i<col.length;i++){ if(col[i].cy < col[i-1].cy + LABEL_ROW) col[i].cy = col[i-1].cy + LABEL_ROW; }
      // if it overran the bottom, pull up from the bottom, then re-fix the top
      if(col[col.length-1].cy > bot){
        col[col.length-1].cy = bot;
        for(let i=col.length-2;i>=0;i--){ if(col[i].cy > col[i+1].cy - LABEL_ROW) col[i].cy = col[i+1].cy - LABEL_ROW; }
      }
      if(col[0].cy < top){ // whole stack shifted above the top → push it all down
        const shift = top - col[0].cy;
        for(const it of col) it.cy += shift;
      }
      const cx=(side<0?16:${WIDTH}-16);
      for(const it of col){
        const { g, ax, ay, cy }=it;
        g.querySelector(".hb-card").setAttribute("transform","translate("+cx+" "+cy+")");
        const leader=g.querySelector(".hb-leader");
        leader.setAttribute("x1",ax); leader.setAttribute("y1",ay);
        leader.setAttribute("x2", side<0?150:${WIDTH}-150); leader.setAttribute("y2",cy);
        const dot=g.querySelector(".hb-ldot"); dot.setAttribute("cx",ax); dot.setAttribute("cy",ay);
        g.setAttribute("opacity", Math.max(0,Math.min(1,(springs[it.s.id].at-0.2)/0.6)).toFixed(3));
      }
    }
  }
  function draw(){
    for(const s of PARTS){
      const sp=springs[s.id], [dx,dy,dz]=s.vec;
      groups[s.id].setAttribute("transform", translateAlong(P,[dx*sp.at,dy*sp.at,dz*sp.at]));
    }
    placeLabels();
    const open=maxOpen();
    const moving=PARTS.some((s)=>Math.abs(springs[s.id].rate)>0.002||springs[s.id].pending);
    let text;
    if(selected) text=null;
    else if(moving&&!touring) text=open>0.5?"taking apart":"closing up";
    else if(open>0.9) text="apart · 10 real Hubble elements";
    else text="the Hubble Space Telescope · assembled";
    if(text!==null && readout && readout.textContent!==text) readout.textContent=text;
  }
  function tick(now){
    const dt=Math.min((now-(tick.last||now))/1000,1/30); tick.last=now; clock+=dt;
    if(touring) tourClock+=dt;
    const calm=still.matches;
    if(touring&&!calm&&!userTouched){
      demoClock+=dt; const phase=demoClock%8.0;
      const want=phase<4?0.14*(phase/4):0.14*(1-(phase-4)/4);
      for(const s of PARTS) springs[s.id].target=want;
    }
    for(const s of PARTS){
      const sp=springs[s.id];
      if(sp.pending&&clock>=sp.pending.at){ sp.target=sp.pending.value; sp.pending=null; }
      const stiff=SPRING.stiffness, drag=calm?2*Math.sqrt(stiff):SPRING.damping;
      for(let i=0;i<SPRING.substeps;i++){ sp.rate+=((sp.target-sp.at)*stiff-sp.rate*drag)*dt/SPRING.substeps; sp.at+=sp.rate*dt/SPRING.substeps; }
      if(Math.abs(sp.target-sp.at)<0.0005&&Math.abs(sp.rate)<0.002){ sp.at=sp.target; sp.rate=0; }
    }
    draw();
    const moving=PARTS.some((s)=>Math.abs(springs[s.id].rate)>0.0005||springs[s.id].pending);
    frame=visible&&(touring||moving)?requestAnimationFrame(tick):0;
  }
  const run=()=>{ if(!frame&&visible){ tick.last=0; frame=requestAnimationFrame(tick); } };
  const DETAIL=Object.fromEntries(PARTS.map((s)=>[s.id, s.num.toString().padStart(2,"0")+" · "+s.name+" — "+s.role]));
  function selectPart(id){
    selected=(selected===id)?null:id;
    for(const s of PARTS){ const g=groups[s.id]; if(!g) continue; g.style.opacity=(!selected||s.id===selected)?"1":"0.28"; g.style.transition="opacity .4s ease"; }
    if(readout) readout.textContent=selected?DETAIL[selected]:(maxOpen()>0.5?"apart · tap a part":"the Hubble Space Telescope · assembled");
  }
  for(const s of PARTS){ const g=groups[s.id]; if(!g) continue; g.style.cursor="pointer"; g.style.pointerEvents="auto"; g.addEventListener("click",(ev)=>{ ev.stopPropagation(); if(maxOpen()<0.3){ setApart(true); return; } selectPart(s.id); }); }
  new IntersectionObserver((e)=>{ visible=e[e.length-1].isIntersecting; if(visible) run(); else if(frame){ cancelAnimationFrame(frame); frame=0; } },{rootMargin:"120px 0px"}).observe(stage);
  if(still.matches){ touring=false; }
  stage.addEventListener("pointerenter",()=>setApart(true));
  stage.addEventListener("pointerleave",()=>setApart(false));
  stage.addEventListener("click",()=>setApart(maxOpen()<0.5));
  stage.addEventListener("keydown",(ev)=>{ if(ev.key==="Enter"||ev.key===" "){ ev.preventDefault(); setApart(maxOpen()<0.5); } });
  draw();
})();
`;

const card = k.plateHtml({
  fig: "HST",
  title: "Hubble Space Telescope",
  hint: "Hover or tap to take it apart · tap a part to name it",
  readout: "the Hubble Space Telescope · assembled",
  keys: [
    { mark: "lit", label: "The optical path: aperture door → 2.4 m primary mirror → instruments" },
    { mark: "raised", label: "10 real elements — the optics, the tube, instruments, solar wings, antennas & pointing" },
  ],
  caption:
    "The Hubble Space Telescope, part by part. It's really one long tube — the Optical Telescope Assembly — with the 2.4 m primary mirror at the back. Starlight enters the aperture door, runs down the baffled tube to the primary, folds off the small secondary near the front, and lands on the science instruments at the focal plane. Two solar wings power it, boom-mounted antennas relay the data, and spinning reaction wheels point it to a few thousandths of an arcsecond — no thrusters near the optics. Hover to lift every real element clear, then tap any part to read what it is.",
  body: `<div class="iso-stage" tabindex="0" role="button" aria-label="Hubble Space Telescope exploded teardown: press Enter to take it apart">${svg}${labelOverlay()}</div>`,
});
const stageHtml = `<div id="hbfig" class="hb-figroot">${card}</div>`;

const EXTRA_CSS = `
.hb-figroot{position:relative}
.iso-stage{position:relative}
.hb-labels{position:absolute;inset:0;pointer-events:none}
.hb-leader{stroke:var(--anatomy-lo);stroke-width:.8}
.hb-ldot{fill:var(--anatomy-mid)}
.hb-card .hb-num{fill:var(--anatomy-faint);font-family:var(--anatomy-mono);font-size:9px;letter-spacing:.08em}
.hb-card .hb-name{fill:var(--anatomy-hi);font-family:var(--anatomy-mono);font-size:11px;letter-spacing:.02em}
.hb-card .hb-role{fill:var(--anatomy-mid);font-family:var(--anatomy-mono);font-size:8.5px;letter-spacing:.01em}
.hb-label[data-side="l"] .hb-card text{text-anchor:start}
.hb-label[data-side="r"] .hb-card text{text-anchor:end}
`;

const outName = `hubble-teardown${theme === "light" ? "-light" : ""}.html`;
writeFileSync(join(HERE, outName), k.pageHtml({ title: "Hubble teardown", theme, body: `<style>${EXTRA_CSS}</style>${stageHtml}`, script: kitScript() + live, width: 1180 }));
console.log("wrote", outName);
