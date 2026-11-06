// Mars Reconnaissance Orbiter — isometric part-by-part exploded teardown.
// Standalone HTML. Same engine/label/explode/blend mechanics as the other
// teardowns; MRO's EXACT real configuration.
//
// Truth (Wikipedia MRO, verified 2026-11-06): a boxy bus with a large 3 m
// HIGH-GAIN ANTENNA dish on top, two SOLAR WINGS (each 5.35 × 2.53 m), and the
// instrument suite — HiRISE (a 0.5 m reflecting TELESCOPE, the famous camera),
// CTX + MARCI context/weather cameras, CRISM spectrometer, the MCS climate
// sounder, and the SHARAD ground-penetrating radar antenna. Six 170 N main
// thrusters. Each part here is a real, named MRO element.
import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { homedir } from "node:os";

const KIT = join(homedir(), ".claude", "skills", "anatomy");
const k = await import(pathToFileURL(join(KIT, "kit", "iso-kit.mjs")).href);
const { kitScript } = await import(pathToFileURL(join(KIT, "scripts", "inline-kit.mjs")).href);

const HERE = dirname(fileURLToPath(import.meta.url));
const theme = process.argv.includes("--light") ? "light" : "dark";

// ---- world layout (units ~ 0.5 m) -----------------------------------------
// y = up (antenna top). x = solar wings span. z = toward/away (HiRISE looks -y to Mars).
const WIDTH = 1120, HEIGHT = 620;
const FIG_W = 820;
const MARGIN = (WIDTH - FIG_W) / 2;
const BUS = 3.0;           // bus half-size

const Pc = k.fitProjection(
  [
    [0, 12, 0], [0, -10, 0],
    [-24, 2, 0], [24, 2, 0],       // solar wings span
    [0, 0, -BUS - 4], [0, 0, BUS + 6],
  ],
  FIG_W, HEIGHT,
  { pad: 20, headroom: 140, azimuth: 40, elevation: 22 },
);
const P = { ...Pc, origin: [Pc.origin[0] + MARGIN, Pc.origin[1]] };

const at = (p) => k.iso(p, P);
const S = (paths, style) => k.solidSvg(paths, style);
const L = (d, style) => k.lineSvg(d, style);
const px = (p) => k.iso(p, P);

// the 3 m high-gain dish on top
function antenna(y) {
  const out = [S(k.cylinder(0, 0, 4.4, y, 0.6, P, 20), { tone: "hi", lit: true })];
  out.push(L(k.pathOf([at([0, y + 0.6, 0]), at([0, y + 2.6, 0])]), { tone: "mid" }));
  return out.join("");
}

// the boxy bus body
function bus(y) {
  const plan = { x: -BUS, y: -BUS, w: BUS * 2, d: BUS * 2, r: 0.4 };
  return S(k.slabOf(plan, y - 2, 4, P, 2, 0.3), { tone: "mid", lit: true });
}

// a solar wing — long panel in the x-z plane, splayed left/right
function wing(dir) {
  const out = [];
  const x0 = dir > 0 ? BUS + 1 : -(BUS + 1), x1 = dir > 0 ? BUS + 1 + 18 : -(BUS + 1 + 18);
  const w = 6;
  const corners = [at([x0, 2, -w / 2]), at([x1, 2, -w / 2]), at([x1, 2, w / 2]), at([x0, 2, w / 2])];
  out.push(`<path class="iso-fill" d="${k.pathOf(corners, true)}" style="fill:var(--anatomy-shade-1)"/>`);
  out.push(L(k.pathOf(corners, true), { tone: "mid" }));
  for (let i = 1; i < 6; i++) { const t = i / 6, xx = x0 + (x1 - x0) * t; out.push(L(k.pathOf([at([xx, 2, -w / 2]), at([xx, 2, w / 2])]), { tone: "faint" })); }
  return out.join("");
}

// HiRISE — the big 0.5 m reflecting telescope tube, pointing down (-y, at Mars)
function hirise() {
  const out = [S(k.cylinder(0, BUS + 1.5, 1.8, -5, 5, P, 14), { tone: "hi", lit: true })];
  // aperture ring at the bottom
  out.push(L(k.planOutline({ x: -1.8, y: BUS + 1.5 - 1.8, w: 3.6, d: 3.6, r: 1.7 }, 1.8, P, 14), { tone: "lo" }));
  return out.join("");
}

// smaller instrument boxes (CTX/MARCI/CRISM/MCS) on the bus
function instruments(side) {
  const out = [];
  const cx = side * (BUS - 0.4);
  for (const [bz, by] of [[-1, -1], [1, -2.5]]) {
    const plan = { x: cx - 0.7, y: bz - 0.7, w: 1.4, d: 1.4, r: 0.15 };
    out.push(S(k.slabOf(plan, by - 0.7, 1.4, P, 2, 0.12), { tone: "hi" }));
  }
  return out.join("");
}

// SHARAD radar — two long thin antenna rods out the sides
function sharad() {
  const out = [];
  out.push(L(k.pathOf([at([-BUS, 1, 3]), at([-18, 1, 3])]), { tone: "hi" }));
  out.push(L(k.pathOf([at([BUS, 1, 3]), at([18, 1, 3])]), { tone: "hi" }));
  return out.join("");
}

// main thrusters at the base
function engine(y) {
  return S(k.cylinder(0, 0, 1.0, y - 1.2, 1.4, P, 10), { tone: "mid" });
}

// ---- the parts: real MRO elements, exploded ---------------------------------
const PARTS = [
  { id: "antenna", name: "High-Gain Antenna",  role: "the 3 m dish — the data firehose home; MRO relays most Mars-mission data",     grp: "comms",  vec: [0, 16, 0],  num: 1, anchor: [0, 6, 0],   draw: () => antenna(6) },
  { id: "bus",     name: "Spacecraft Bus",     role: "the boxy body — avionics, propulsion + the instrument mounts",                 grp: "bus",    vec: [0, 8, 0],   num: 2, anchor: [0, 0, 0],   lit: true, draw: () => bus(0) },
  { id: "hirise",  name: "HiRISE Telescope",   role: "a 0.5 m reflecting telescope — resolves objects ~30 cm across from orbit",      grp: "science",vec: [0, -8, 10], num: 3, anchor: [0, -2, BUS + 1.5], lit: true, draw: () => hirise() },
  { id: "wing-l",  name: "Solar Wing — Left",  role: "one of two 5.35 × 2.53 m wings — 600–2000 W depending on Sun angle",            grp: "power",  vec: [-20, 2, 0], num: 4, anchor: [-(BUS + 10), 2, 0], draw: () => wing(-1) },
  { id: "wing-r",  name: "Solar Wing — Right", role: "the second wing — also used to AEROBRAKE, dipping into Mars's upper air",        grp: "power",  vec: [20, 2, 0],  num: 5, anchor: [BUS + 10, 2, 0], draw: () => wing(+1) },
  { id: "sharad",  name: "SHARAD Radar",       role: "a 10 m dipole antenna — HF radar that sees LAYERS + ice beneath the surface",    grp: "science",vec: [0, 10, 6],  num: 6, anchor: [-12, 1, 3], draw: () => sharad() },
  { id: "instruments",name:"CTX · MARCI · CRISM · MCS", role: "context + weather cameras, a mineral spectrometer, and a climate sounder", grp: "science",vec: [-10, 2, 12],num: 7, anchor: [-(BUS - 0.4), -1, 0], draw: () => instruments(-1) + instruments(1) },
  { id: "engine",  name: "Main Thrusters",     role: "six 170 N engines — the burn that captured MRO into Mars orbit in 2006",        grp: "propulsion",vec:[0, -14, 0],num: 8, anchor: [0, -3, 0],  draw: () => engine(-3) },
];

// ---- labels overlay (balanced + robust de-collision) -----------------------
function labelOverlay() {
  const out = [];
  PARTS.forEach((s, i) => {
    const side = i % 2 === 0 ? -1 : 1;
    out.push(
      `<g class="mr-label" data-label="${s.id}" data-side="${side < 0 ? "l" : "r"}" opacity="0">` +
        `<line class="mr-leader" x1="0" y1="0" x2="0" y2="0"/>` +
        `<circle class="mr-ldot" r="1.6"/>` +
        `<g class="mr-card">` +
          `<text class="mr-num" y="-5">${String(s.num).padStart(2, "0")}</text>` +
          `<text class="mr-name" y="6">${s.name}</text>` +
          `<text class="mr-role" y="17">${s.role}</text>` +
        `</g>` +
      `</g>`,
    );
  });
  return `<svg xmlns="http://www.w3.org/2000/svg" class="iso-svg mr-labels" viewBox="0 0 ${WIDTH} ${HEIGHT}" aria-hidden="true">${out.join("")}</svg>`;
}

const part = (id, inner) => `<g data-part="${id}" transform="${k.translateAlong(P, [0, 0, 0])}">${inner}</g>`;

const svg = k.figureSvg({
  width: WIDTH, height: HEIGHT, className: "mr-fig",
  label: "The Mars Reconnaissance Orbiter, taken apart into its real assemblies — the 3 m high-gain antenna, the bus, the HiRISE telescope, the two solar wings, the SHARAD radar antenna, the context/spectrometer/climate instruments, and the main thrusters. Hover to take it apart; each part is a real, named MRO element.",
  body: PARTS.map((s) => part(s.id, s.draw())),
});

const live = `
(function(){
  const PARTS = ${JSON.stringify(PARTS.map((s) => ({ id: s.id, name: s.name, role: s.role, vec: s.vec, anchor: s.anchor, grp: s.grp, num: s.num })))};
  const P = ${JSON.stringify(P)};
  const SPRING = { stagger: 0.03, stiffness: 70, damping: 15, substeps: 4 };
  const root = document.getElementById("mrfig");
  if (!root) return;
  const stage = root.querySelector(".iso-stage");
  const svg = stage.querySelector("svg.iso-svg:not(.mr-labels)") || stage.querySelector("svg");
  const labelSvg = stage.querySelector(".mr-labels");
  const readout = root.querySelector("[data-readout]");
  const still = matchMedia("(prefers-reduced-motion: reduce)");
  const groups = Object.fromEntries(PARTS.map((s)=>[s.id, svg.querySelector('[data-part="'+s.id+'"]')]));
  const labels = Object.fromEntries(PARTS.map((s)=>[s.id, labelSvg && labelSvg.querySelector('[data-label="'+s.id+'"]')]));
  const springs = Object.fromEntries(PARTS.map((s)=>[s.id, {at:0,rate:0,target:0,pending:null}]));
  let clock=0, frame=0, visible=false, touring=true, tourClock=0, demoClock=0, userTouched=false, selected=null;
  const order = PARTS.map((s)=>s.id);
  const maxOpen = ()=>PARTS.reduce((m,s)=>Math.max(m,springs[s.id].at),0);
  function isoPt(p){ const a=iso(p,P); return [a[0],a[1]]; }
  const LABEL_ROW = 42;
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
      for(const it of col) it.cy=it.ideal;
      for(let i=1;i<col.length;i++){ if(col[i].cy < col[i-1].cy + LABEL_ROW) col[i].cy = col[i-1].cy + LABEL_ROW; }
      if(col[col.length-1].cy > bot){
        col[col.length-1].cy = bot;
        for(let i=col.length-2;i>=0;i--){ if(col[i].cy > col[i+1].cy - LABEL_ROW) col[i].cy = col[i+1].cy - LABEL_ROW; }
      }
      if(col[0].cy < top){ const shift = top - col[0].cy; for(const it of col) it.cy += shift; }
      const cx=(side<0?16:${WIDTH}-16);
      for(const it of col){
        const { g, ax, ay, cy }=it;
        g.querySelector(".mr-card").setAttribute("transform","translate("+cx+" "+cy+")");
        const leader=g.querySelector(".mr-leader");
        leader.setAttribute("x1",ax); leader.setAttribute("y1",ay);
        leader.setAttribute("x2", side<0?150:${WIDTH}-150); leader.setAttribute("y2",cy);
        const dot=g.querySelector(".mr-ldot"); dot.setAttribute("cx",ax); dot.setAttribute("cy",ay);
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
    else if(open>0.9) text="apart · 8 real MRO elements";
    else text="the Mars Reconnaissance Orbiter · assembled";
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
    if(readout) readout.textContent=selected?DETAIL[selected]:(maxOpen()>0.5?"apart · tap a part":"the Mars Reconnaissance Orbiter · assembled");
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
  fig: "MRO",
  title: "Mars Reconnaissance Orbiter",
  hint: "Hover or tap to take it apart · tap a part to name it",
  readout: "the Mars Reconnaissance Orbiter · assembled",
  keys: [
    { mark: "lit", label: "The big dish + the HiRISE telescope dominate — a camera + a radio relay in one" },
    { mark: "raised", label: "8 real elements — antenna, bus, HiRISE, two solar wings, SHARAD, instruments + engines" },
  ],
  caption:
    "MRO, part by part. It does two jobs at once: it's the sharpest camera ever sent to Mars, and the main radio relay that most Mars rovers and landers send their data home through. The 3-metre dish carries that firehose; the HiRISE telescope — a real half-metre reflector — resolves things as small as 30 cm from orbit; SHARAD's long antennas see layers and buried ice underground; and the two big solar wings both power the craft and were used to aerobrake it into its final orbit. Hover to lift every real element clear, then tap any part to read what it is.",
  body: `<div class="iso-stage" tabindex="0" role="button" aria-label="Mars Reconnaissance Orbiter exploded teardown: press Enter to take it apart">${svg}${labelOverlay()}</div>`,
});
const stageHtml = `<div id="mrfig" class="mr-figroot">${card}</div>`;

const EXTRA_CSS = `
/* BLEND IN: strip the plate card chrome so the figure floats on the host page. */
html, body { background: transparent !important; }
.iso-page { margin: 0 auto !important; width: 100% !important; }
.iso-figure { margin: 0 !important; }
.iso-plate { background: transparent !important; box-shadow: none !important; padding: 20px 8px !important; --anatomy-paper: transparent !important; }
.iso-plate-corner[data-corner="fig"], .iso-plate-corner[data-corner="title"], .iso-plate-corner[data-corner="hint"] { display: none; }
.iso-legend { display: none; }
.mr-figroot{position:relative}
.iso-stage{position:relative}
.mr-labels{position:absolute;inset:0;pointer-events:none}
.mr-leader{stroke:var(--anatomy-lo);stroke-width:.8}
.mr-ldot{fill:var(--anatomy-mid)}
.mr-card .mr-num{fill:var(--anatomy-faint);font-family:var(--anatomy-mono);font-size:9px;letter-spacing:.08em}
.mr-card .mr-name{fill:var(--anatomy-hi);font-family:var(--anatomy-mono);font-size:11px;letter-spacing:.02em}
.mr-card .mr-role{fill:var(--anatomy-mid);font-family:var(--anatomy-mono);font-size:8.5px;letter-spacing:.01em}
.mr-label[data-side="l"] .mr-card text{text-anchor:start}
.mr-label[data-side="r"] .mr-card text{text-anchor:end}
`;

const outName = `mro-teardown${theme === "light" ? "-light" : ""}.html`;
writeFileSync(join(HERE, outName), k.pageHtml({ title: "MRO teardown", theme, body: `<style>${EXTRA_CSS}</style>${stageHtml}`, script: kitScript() + live, width: 1180 }));
console.log("wrote", outName);
