// International Space Station — isometric part-by-part exploded teardown.
// Standalone HTML (open the written file directly; no server).
//
// Truth: the real ISS structure. The backbone is the Integrated Truss Structure
// (ITS), a long port→starboard beam of 11 segments (P6 P5 P4 P3 P1 S0 S1 S3 S4
// S5 S6). The pressurized MODULES run fore-aft, mounted to the truss at S0 via
// Destiny. Eight Solar Array Wings fan off the outboard truss (P6 P4 S4 S6).
// Three radiator panels + Canadarm2 complete it. Every part here is a real,
// named ISS element — it comes apart along the truss + lifts the modules so you
// see how the station is actually assembled, segment by segment.
import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { homedir } from "node:os";

const KIT = join(homedir(), ".claude", "skills", "anatomy");
const k = await import(pathToFileURL(join(KIT, "kit", "iso-kit.mjs")).href);
const { kitScript } = await import(pathToFileURL(join(KIT, "scripts", "inline-kit.mjs")).href);

const HERE = dirname(fileURLToPath(import.meta.url));
const theme = process.argv.includes("--light") ? "light" : "dark";

// ---- world layout (units ~ a schematic metre; the real ITS is ~109 m wide) --
// x = port(-)→starboard(+) along the truss. y = up (out of the orbital plane).
// z = fore(-)→aft(+) for the modules.
const TRUSS_SEG_W = 9;          // each truss segment width along x
const TRUSS_H = 2.2, TRUSS_D = 2.2;   // truss cross-section
const SEG_N = 11;
const TRUSS_LEN = SEG_N * TRUSS_SEG_W;

const WIDTH = 1120, HEIGHT = 620;
const FIG_W = 820;
const MARGIN = (WIDTH - FIG_W) / 2;

// fit the assembled station (truss span + solar arrays + module stack)
const Pc = k.fitProjection(
  [
    [-TRUSS_LEN / 2 - 4, -2, 0], [TRUSS_LEN / 2 + 4, 2, 0],
    [0, 0, -34], [0, 0, 28],      // module stack fore/aft
    [-TRUSS_LEN / 2, 20, 0], [TRUSS_LEN / 2, -20, 0],   // solar arrays up/down
  ],
  FIG_W, HEIGHT,
  { pad: 20, headroom: 150, azimuth: 42, elevation: 26 },
);
const P = { ...Pc, origin: [Pc.origin[0] + MARGIN, Pc.origin[1]] };

const at = (p) => k.iso(p, P);
const S = (paths, style) => k.solidSvg(paths, style);
const L = (d, style) => k.lineSvg(d, style);
const D = (pts, style) => k.dotsSvg(pts, style);
const px = (p) => k.iso(p, P);

// a truss segment centred at truss-x = cx
function trussSeg(cx, tone = "mid") {
  const plan = { x: cx - TRUSS_SEG_W / 2 + 0.4, y: -TRUSS_D / 2, w: TRUSS_SEG_W - 0.8, d: TRUSS_D, r: 0.3 };
  const out = [S(k.slabOf(plan, -TRUSS_H / 2, TRUSS_H, P, 2, 0.3), { tone })];
  // truss lattice: a few diagonal struts as lines on the near face
  const x0 = plan.x, x1 = plan.x + plan.w, zf = plan.y + plan.d;
  for (let i = 0; i < 3; i++) {
    const a = x0 + (i * plan.w) / 3, b = x0 + ((i + 1) * plan.w) / 3;
    out.push(L(k.pathOf([at([a, zf, -TRUSS_H / 2]), at([b, zf, TRUSS_H / 2])]), { tone: "lo" }));
    out.push(L(k.pathOf([at([a, zf, TRUSS_H / 2]), at([b, zf, -TRUSS_H / 2])]), { tone: "lo" }));
  }
  return out.join("");
}

// a solar array wing: a long thin panel extending in +y (up) or -y (down) from
// an outboard truss segment, with blue cell rows.
function solarWing(cx, dir, len = 18, tone = "mid") {
  const w = 5.2;
  const plan = { x: cx - w / 2, y: -0.3, w, d: 0.6, r: 0.2 };
  const y0 = dir > 0 ? 0.6 : -0.6 - len;
  const out = [];
  // the panel as a thin tall slab lying in the x-y plane (rotate by building in z=0, tall in y via height trick)
  // simpler: draw it as a flat quad in the truss plane using explicit corners
  const yA = dir > 0 ? 1.0 : -1.0, yB = dir > 0 ? 1.0 + len : -1.0 - len;
  const corners = [
    at([cx - w / 2, 0, yA]), at([cx + w / 2, 0, yA]),
    at([cx + w / 2, 0, yB]), at([cx - w / 2, 0, yB]),
  ];
  out.push(`<path class="iso-fill" d="${k.pathOf(corners, true)}" style="fill:var(--anatomy-shade-1)"/>`);
  out.push(L(k.pathOf(corners, true), { tone: "mid" }));
  // cell rows (lines across the panel)
  const rows = 7;
  for (let i = 1; i < rows; i++) {
    const t = i / rows, yy = yA + (yB - yA) * t;
    out.push(L(k.pathOf([at([cx - w / 2, 0, yy]), at([cx + w / 2, 0, yy])]), { tone: "faint" }));
  }
  // centre mast
  out.push(L(k.pathOf([at([cx, 0, yA]), at([cx, 0, yB])]), { tone: "lo" }));
  return out.join("");
}

// a pressurized module: a cylinder lying along z (fore-aft), centred at (cx, zc)
function moduleCyl(cx, zc, len, r = 1.6, tone = "hi", lit = false) {
  // build as a cylinder whose axis is z: use the kit cylinder (axis = z up) then
  // we fake a horizontal module by drawing an isometric capsule via two end
  // circles + body. Simplest: a rounded slab stretched along z.
  const plan = { x: cx - r, y: zc - len / 2, w: r * 2, d: len, r: r * 0.9 };
  const out = [S(k.slabOf(plan, -r, r * 2, P, 6, 0.4), { tone, lit })];
  // module ring seams
  for (const t of [0.3, 0.7]) {
    const zz = zc - len / 2 + len * t;
    out.push(L(k.planOutline({ x: cx - r, y: zz - 0.2, w: r * 2, d: 0.4, r: 0.2 }, r, P, 6), { tone: "lo" }));
  }
  return out.join("");
}

// ---- the parts: real ISS elements, each its own exploded group ------------
// explode vec spreads the truss along x, lifts modules along z/y, fans arrays.
// num = label order. anchor = where the leader lands (assembled position).
const segX = (i) => -TRUSS_LEN / 2 + TRUSS_SEG_W / 2 + i * TRUSS_SEG_W;  // i=0 port .. 10 stbd

const PARTS = [
  // --- truss segments (the backbone), port → starboard ---
  { id: "p6", name: "P6 Truss", role: "port-6 — outermost port truss + solar arrays", grp: "truss", vec: [-40, 14, 0], num: 1, anchor: [segX(0), 0, 0], draw: () => trussSeg(segX(0)) },
  { id: "p5", name: "P5 Truss", role: "port-5 spacer segment", grp: "truss", vec: [-30, 8, 0], num: 2, anchor: [segX(1), 0, 0], draw: () => trussSeg(segX(1)) },
  { id: "p4", name: "P4 Truss", role: "port-4 — solar array + rotary joint (SARJ)", grp: "truss", vec: [-22, 4, 0], num: 3, anchor: [segX(2), 0, 0], draw: () => trussSeg(segX(2)) },
  { id: "p3", name: "P3 Truss", role: "port-3 — carries the port SARJ", grp: "truss", vec: [-14, 0, 0], num: 4, anchor: [segX(3), 0, 0], draw: () => trussSeg(segX(3)) },
  { id: "p1", name: "P1 Truss", role: "port-1 — port thermal radiators + rail", grp: "truss", vec: [-8, -10, 0], num: 5, anchor: [segX(4), 0, 0], draw: () => trussSeg(segX(4)) },
  { id: "s0", name: "S0 Truss", role: "centre keel — mounts to Destiny, the structural heart", grp: "truss", vec: [0, -18, 0], num: 6, anchor: [segX(5), 0, 0], lit: true, draw: () => trussSeg(segX(5), "hi") },
  { id: "s1", name: "S1 Truss", role: "starboard-1 — starboard thermal radiators", grp: "truss", vec: [8, -10, 0], num: 7, anchor: [segX(6), 0, 0], draw: () => trussSeg(segX(6)) },
  { id: "s3", name: "S3 Truss", role: "starboard-3 — carries the stbd SARJ + payloads", grp: "truss", vec: [14, 0, 0], num: 8, anchor: [segX(7), 0, 0], draw: () => trussSeg(segX(7)) },
  { id: "s4", name: "S4 Truss", role: "starboard-4 — solar array + rotary joint", grp: "truss", vec: [22, 4, 0], num: 9, anchor: [segX(8), 0, 0], draw: () => trussSeg(segX(8)) },
  { id: "s5", name: "S5 Truss", role: "starboard-5 spacer segment", grp: "truss", vec: [30, 8, 0], num: 10, anchor: [segX(9), 0, 0], draw: () => trussSeg(segX(9)) },
  { id: "s6", name: "S6 Truss", role: "starboard-6 — outermost stbd truss + arrays", grp: "truss", vec: [40, 14, 0], num: 11, anchor: [segX(10), 0, 0], draw: () => trussSeg(segX(10)) },

  // --- solar array wings (8, in 4 pairs on the outboard segments) ---
  { id: "saw-p6", name: "Solar Arrays — P6", role: "2 wings · 2B/4B channels", grp: "power", vec: [-40, 34, 0], num: 12, anchor: [segX(0), 10, 0], draw: () => solarWing(segX(0), +1) + solarWing(segX(0), -1) },
  { id: "saw-p4", name: "Solar Arrays — P4", role: "2 wings · 2A/4A channels", grp: "power", vec: [-22, 30, 0], num: 13, anchor: [segX(2), 10, 0], draw: () => solarWing(segX(2), +1) + solarWing(segX(2), -1) },
  { id: "saw-s4", name: "Solar Arrays — S4", role: "2 wings · 1A/3A channels", grp: "power", vec: [22, 30, 0], num: 14, anchor: [segX(8), 10, 0], draw: () => solarWing(segX(8), +1) + solarWing(segX(8), -1) },
  { id: "saw-s6", name: "Solar Arrays — S6", role: "2 wings · 1B/3B channels — 8 wings, ~120 kW total", grp: "power", vec: [40, 34, 0], num: 15, anchor: [segX(10), 10, 0], draw: () => solarWing(segX(10), +1) + solarWing(segX(10), -1) },

  // --- radiators ---
  { id: "rad-p1", name: "Port Radiators", role: "deployable ammonia thermal panels on P1", grp: "thermal", vec: [-8, -26, 0], num: 16, anchor: [segX(4), -5, 0], draw: () => radiator(segX(4), -1) },
  { id: "rad-s1", name: "Stbd Radiators", role: "deployable ammonia thermal panels on S1", grp: "thermal", vec: [8, -26, 0], num: 17, anchor: [segX(6), -5, 0], draw: () => radiator(segX(6), -1) },

  // --- pressurized module stack (fore-aft at S0) ---
  { id: "destiny", name: "Destiny (US Lab)", role: "primary US research lab — mounts the station to S0", grp: "module", vec: [0, -4, -2], num: 18, anchor: [0, -4, 0], lit: true, draw: () => moduleCyl(0, -4, 7, 1.7, "hi", true) },
  { id: "harmony", name: "Harmony (Node 2)", role: "forward hub — connects Columbus, Kibo + the docking ports", grp: "module", vec: [0, 0, -10], num: 19, anchor: [0, -11, 0], draw: () => moduleCyl(0, -11, 4, 1.6) },
  { id: "columbus", name: "Columbus (ESA)", role: "European research laboratory", grp: "module", vec: [-10, 2, -14], num: 20, anchor: [-5, -11, 0], draw: () => moduleCyl(-5, -11, 4.5, 1.4) },
  { id: "kibo", name: "Kibō (JAXA)", role: "Japanese lab + exposed facility — the largest module", grp: "module", vec: [10, 2, -14], num: 21, anchor: [5, -11, 0], draw: () => moduleCyl(5, -11, 5.5, 1.5) },
  { id: "unity", name: "Unity (Node 1)", role: "first US node — the original hub", grp: "module", vec: [0, 2, 6], num: 22, anchor: [0, 4, 0], draw: () => moduleCyl(0, 4, 3.5, 1.5) },
  { id: "tranquility", name: "Tranquility + Cupola", role: "life support (Node 3) + the 7-window observation dome", grp: "module", vec: [-8, 4, 10], num: 23, anchor: [-4, 7, 0], draw: () => moduleCyl(-4, 7, 3.5, 1.4) },
  { id: "zarya", name: "Zarya (FGB)", role: "first module launched, 1998 — cargo + propulsion origin", grp: "module", vec: [0, 4, 16], num: 24, anchor: [0, 12, 0], draw: () => moduleCyl(0, 12, 5, 1.5) },
  { id: "zvezda", name: "Zvezda", role: "Russian service module — crew quarters + propulsion", grp: "module", vec: [0, 4, 22], num: 25, anchor: [0, 18, 0], draw: () => moduleCyl(0, 18, 5, 1.6) },

  // --- docking + robotics ---
  { id: "pma", name: "PMA / IDA ports", role: "pressurized mating adapters + docking adapters (Dragon/Starliner)", grp: "docking", vec: [0, 2, -20], num: 26, anchor: [0, -15, 0], draw: () => dockPort(0, -15) },
  { id: "canadarm", name: "Canadarm2 (SSRMS)", role: "17 m robotic arm on the Mobile Base System", grp: "robotics", vec: [-14, -8, 6], num: 27, anchor: [-6, 2, 3], draw: () => canadarm() },
];

// radiator: a set of fanned flat panels extending in -y from a truss seg
function radiator(cx, dir) {
  const out = [], w = 4, len = 7, y0 = dir > 0 ? 1.2 : -1.2;
  for (let p = 0; p < 3; p++) {
    const zc = -3 + p * 3;
    const yB = y0 + dir * len;
    const corners = [
      at([cx - w / 2, 0, zc - 0.8]), at([cx + w / 2, 0, zc - 0.8]),
      at([cx + w / 2, 0, zc - 0.8 + 0]), at([cx - w / 2, 0, zc - 0.8]),
    ];
    // a flat panel in the x-y plane going out in y
    const c2 = [
      at([cx - w / 2, y0, zc]), at([cx + w / 2, y0, zc]),
      at([cx + w / 2, yB, zc]), at([cx - w / 2, yB, zc]),
    ];
    out.push(`<path class="iso-fill" d="${k.pathOf(c2, true)}" style="fill:var(--anatomy-shade-0)"/>`);
    out.push(L(k.pathOf(c2, true), { tone: "lo" }));
    for (let i = 1; i < 4; i++) { const t = i / 4, yy = y0 + (yB - y0) * t; out.push(L(k.pathOf([at([cx - w / 2, yy, zc]), at([cx + w / 2, yy, zc])]), { tone: "faint" })); }
  }
  return out.join("");
}

// docking port: a short ring/cone at the forward end
function dockPort(cx, zc) {
  return S(k.cylinder(cx, zc, 1.0, -1, 2, P, 16), { tone: "mid" });
}

// canadarm: a jointed arm — a few segments as lines/thin slabs
function canadarm() {
  const pts = [[-6, 2, 3], [-4, 5, 2], [0, 6, 0], [3, 4, -2]];
  const out = [];
  for (let i = 0; i < pts.length - 1; i++) {
    out.push(L(k.pathOf([at(pts[i]), at(pts[i + 1])]), { tone: "hi" }));
    out.push(D([at(pts[i])], { size: 0.7, tone: "hi" }));
  }
  out.push(D([at(pts[pts.length - 1])], { size: 0.7, tone: "hi" }));
  return out.join("");
}

// ---- labels overlay --------------------------------------------------------
function labelOverlay() {
  const out = [];
  for (const s of PARTS) {
    const a0 = px(s.anchor);
    const side = a0[0] < WIDTH / 2 ? -1 : 1;
    out.push(
      `<g class="iss-label" data-label="${s.id}" data-side="${side < 0 ? "l" : "r"}" opacity="0">` +
        `<line class="iss-leader" x1="0" y1="0" x2="0" y2="0"/>` +
        `<circle class="iss-ldot" r="1.6"/>` +
        `<g class="iss-card">` +
          `<text class="iss-num" y="-5">${String(s.num).padStart(2, "0")}</text>` +
          `<text class="iss-name" y="6">${s.name}</text>` +
          `<text class="iss-role" y="17">${s.role}</text>` +
        `</g>` +
      `</g>`,
    );
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" class="iso-svg iss-labels" viewBox="0 0 ${WIDTH} ${HEIGHT}" aria-hidden="true">${out.join("")}</svg>`;
}

const part = (id, inner) => `<g data-part="${id}" transform="${k.translateAlong(P, [0, 0, 0])}">${inner}</g>`;

const svg = k.figureSvg({
  width: WIDTH, height: HEIGHT, className: "iss-fig",
  label: "The International Space Station, taken apart into its real assemblies — the 11 truss segments (P6 to S6), the eight solar array wings, the thermal radiators, the pressurized module stack (Destiny, Harmony, Columbus, Kibō, Unity, Tranquility, Zarya, Zvezda), the docking ports and Canadarm2. Hover to take it apart; each part is a real, named ISS element.",
  body: PARTS.map((s) => part(s.id, s.draw())),
});

const GROUP_COLOR = { truss: "the backbone", power: "solar power", thermal: "cooling", module: "pressurized modules", docking: "docking", robotics: "robotics" };

const live = `
(function(){
  const PARTS = ${JSON.stringify(PARTS.map((s) => ({ id: s.id, name: s.name, role: s.role, vec: s.vec, anchor: s.anchor, grp: s.grp, num: s.num })))};
  const P = ${JSON.stringify(P)};
  const SPRING = { stagger: 0.028, stiffness: 70, damping: 15, substeps: 4 };
  const root = document.getElementById("issfig");
  if (!root) return;
  const stage = root.querySelector(".iso-stage");
  const svg = stage.querySelector("svg.iso-svg:not(.iss-labels)") || stage.querySelector("svg");
  const labelSvg = stage.querySelector(".iss-labels");
  const readout = root.querySelector("[data-readout]");
  const still = matchMedia("(prefers-reduced-motion: reduce)");
  const groups = Object.fromEntries(PARTS.map((s)=>[s.id, svg.querySelector('[data-part="'+s.id+'"]')]));
  const labels = Object.fromEntries(PARTS.map((s)=>[s.id, labelSvg && labelSvg.querySelector('[data-label="'+s.id+'"]')]));
  const springs = Object.fromEntries(PARTS.map((s)=>[s.id, {at:0,rate:0,target:0,pending:null}]));
  let clock=0, frame=0, visible=false, touring=true, tourClock=0, demoClock=0, userTouched=false, selected=null;
  const order = PARTS.map((s)=>s.id);
  const maxOpen = ()=>PARTS.reduce((m,s)=>Math.max(m,springs[s.id].at),0);
  function isoPt(p){ const a=iso(p,P); return [a[0],a[1]]; }
  function setApart(v){
    touring=false; demoClock=0; userTouched=true;
    const to=v?1:0, seq=v?order:[...order].reverse();
    seq.forEach((id,i)=>{ springs[id].pending={value:to, at:clock+i*SPRING.stagger}; });
    run();
  }
  // Row height a label card needs (num + name + role ≈ 3 lines) plus breathing
  // room, so stacked cards never overlap — the old placement let any two parts
  // that exploded to a similar height collide into an unreadable pile.
  const LABEL_ROW = 30;
  function placeLabels(){
    if(!labelSvg) return;
    // pass 1 — each label's anchor on the part + its ideal (uncollided) y.
    const rows = { "-1": [], "1": [] };
    for(const s of PARTS){
      const g=labels[s.id]; if(!g) continue;
      const sp=springs[s.id];
      const wp=[s.anchor[0]+s.vec[0]*sp.at, s.anchor[1]+s.vec[1]*sp.at, s.anchor[2]+s.vec[2]*sp.at];
      const [ax,ay]=isoPt(wp);
      const side=g.getAttribute("data-side")==="l"?-1:1;
      rows[side].push({ s, g, ax, ay, ideal: ay });
    }
    // pass 2 — per side, sort by ideal y and push cards apart to >= LABEL_ROW,
    // then clamp the whole column into the frame (shift up if it overflows).
    for(const side of [-1,1]){
      const col = rows[side]; if(!col.length) continue;
      col.sort((a,b)=>a.ideal-b.ideal);
      const top=30, bot=${HEIGHT}-24;
      let y=Math.max(top, col[0].ideal);
      for(const it of col){ y=Math.max(y, it.ideal); it.cy=y; y+=LABEL_ROW; }
      const overflow=col[col.length-1].cy-bot;
      if(overflow>0){ for(const it of col) it.cy=Math.max(top, it.cy-overflow); }
      // Cards hug each edge and the text grows INWARD (both columns are
      // end-anchored at the right edge via the gutter x below, see CSS), so no
      // role line ever clips off the frame. Left edge: anchor at the left gutter.
      const cx=(side<0?16:${WIDTH}-16);
      for(const it of col){
        const { g, ax, ay, cy }=it;
        g.querySelector(".iss-card").setAttribute("transform","translate("+cx+" "+cy+")");
        const leader=g.querySelector(".iss-leader");
        leader.setAttribute("x1",ax); leader.setAttribute("y1",ay);
        // leader lands at the card's inner edge: left column text runs rightward
        // from x=16 so leader meets it at ~x=150; right column runs leftward from
        // x=WIDTH-16 so leader meets it at ~WIDTH-150.
        leader.setAttribute("x2", side<0 ? 150 : ${WIDTH}-150); leader.setAttribute("y2",cy);
        const dot=g.querySelector(".iss-ldot"); dot.setAttribute("cx",ax); dot.setAttribute("cy",ay);
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
    else if(open>0.9) text="apart · 27 real ISS elements";
    else text="the International Space Station · assembled";
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
  // click a part → select + show its role in the readout
  const DETAIL=Object.fromEntries(PARTS.map((s)=>[s.id, s.num.toString().padStart(2,"0")+" · "+s.name+" — "+s.role]));
  function selectPart(id){
    selected=(selected===id)?null:id;
    for(const s of PARTS){ const g=groups[s.id]; if(!g) continue; g.style.opacity=(!selected||s.id===selected)?"1":"0.28"; g.style.transition="opacity .4s ease"; }
    if(readout) readout.textContent=selected?DETAIL[selected]:(maxOpen()>0.5?"apart · tap a part":"the International Space Station · assembled");
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
  fig: "ISS",
  title: "International Space Station",
  hint: "Hover or tap to take it apart · tap a part to name it",
  readout: "the International Space Station · assembled",
  keys: [
    { mark: "lit", label: "S0 truss + Destiny: the structural heart the station is built around" },
    { mark: "raised", label: "27 real elements — 11 truss segments, 8 solar wings, the module stack, radiators & Canadarm2" },
  ],
  caption:
    "The International Space Station, part by part. The Integrated Truss Structure (ITS) is the backbone — eleven segments from P6 (far port) to S6 (far starboard), bolted end to end, built up over dozens of assembly missions. The pressurized modules hang fore-and-aft off the centre at S0 via Destiny; eight solar array wings fan off the outboard truss (~120 kW); ammonia radiators dump the heat; and Canadarm2 walks the structure. Hover to lift every real element clear of the station, then tap any part to read what it is.",
  body: `<div class="iso-stage" tabindex="0" role="button" aria-label="International Space Station exploded teardown: press Enter to take it apart">${svg}${labelOverlay()}</div>`,
});
const stageHtml = `<div id="issfig" class="iss-figroot">${card}</div>`;

const EXTRA_CSS = `

/* BLEND IN: strip the plate card chrome so the figure floats on the host page. */
html, body { background: transparent !important; }
.iso-page { margin: 0 auto !important; width: 100% !important; }
.iso-figure { margin: 0 !important; }
.iso-plate { background: transparent !important; box-shadow: none !important; padding: 20px 8px !important; --anatomy-paper: transparent !important; }
.iso-plate-corner[data-corner="fig"], .iso-plate-corner[data-corner="title"], .iso-plate-corner[data-corner="hint"] { display: none; }
.iso-legend { display: none; }
.iss-figroot{position:relative}
.iso-stage{position:relative}
.iss-labels{position:absolute;inset:0;pointer-events:none}
.iss-leader{stroke:var(--anatomy-lo);stroke-width:.8}
.iss-ldot{fill:var(--anatomy-mid)}
.iss-card .iss-num{fill:var(--anatomy-faint);font-family:var(--anatomy-mono);font-size:9px;letter-spacing:.08em}
.iss-card .iss-name{fill:var(--anatomy-hi);font-family:var(--anatomy-mono);font-size:11px;letter-spacing:.02em}
.iss-card .iss-role{fill:var(--anatomy-mid);font-family:var(--anatomy-mono);font-size:8.5px;letter-spacing:.01em}
/* Left column grows rightward from the left gutter (start); right column grows
   leftward from the right gutter (end). Either way text runs INWARD, never off
   the frame. */
.iss-label[data-side="l"] .iss-card text{text-anchor:start}
.iss-label[data-side="r"] .iss-card text{text-anchor:end}
`;

const outName = `iss-teardown${theme === "light" ? "-light" : ""}.html`;
writeFileSync(join(HERE, outName), k.pageHtml({ title: "ISS teardown", theme, body: `<style>${EXTRA_CSS}</style>${stageHtml}`, script: kitScript() + live, width: 1180 }));
console.log("wrote", outName);
