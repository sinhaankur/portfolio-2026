// Juno spacecraft — isometric part-by-part exploded teardown.
// Standalone HTML. Same engine/label/explode/blend mechanics as the other
// teardowns; Juno's EXACT real configuration.
//
// Truth (Wikipedia Juno, verified 2026-11-06): a HEXAGONAL bus with THREE huge
// solar wings (each 2.7 × 8.9 m) arranged symmetrically in a Y — ~20 m across,
// the widest planetary craft, and the only SOLAR-powered one out at Jupiter
// (435 W there). A titanium RADIATION VAULT shields the electronics (1 cm walls,
// radiation cut ~800×). A high-gain ANTENNA on top; the MWR + JunoCam instruments
// on the bus; the magnetometer at one wing tip; and the LEROS-1b MAIN ENGINE
// (645 N) below. Each part here is a real, named Juno element.
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
// y = up (antenna top, engine bottom). x,z = the three wings splay in-plane.
const WIDTH = 1120, HEIGHT = 640;
const FIG_W = 820;
const MARGIN = (WIDTH - FIG_W) / 2;
const RBUS = 3.2;          // hexagonal bus radius
const WING_LEN = 17;       // ~8.9 m wing
const WING_W = 5.0;        // ~2.7 m wide

const Pc = k.fitProjection(
  [
    [0, 10, 0], [0, -10, 0],                       // antenna / engine
    [-WING_LEN - 4, 0, 0], [WING_LEN + 4, 0, 0],   // wings span
    [0, 0, -WING_LEN - 4], [0, 0, WING_LEN + 4],
  ],
  FIG_W, HEIGHT,
  { pad: 20, headroom: 150, azimuth: 36, elevation: 26 },
);
const P = { ...Pc, origin: [Pc.origin[0] + MARGIN, Pc.origin[1]] };

const at = (p) => k.iso(p, P);
const S = (paths, style) => k.solidSvg(paths, style);
const L = (d, style) => k.lineSvg(d, style);
const px = (p) => k.iso(p, P);

// one solar wing — a long flat panel in the x-z plane, splayed at angle `deg`
function wing(deg, withMag = false) {
  const a = (deg * Math.PI) / 180;
  const ux = Math.cos(a), uz = Math.sin(a);        // out-direction
  const px0 = -uz, pz0 = ux;                        // perpendicular (panel width)
  const r0 = RBUS + 0.5, r1 = RBUS + 0.5 + WING_LEN;
  const hw = WING_W / 2;
  const corners = [
    at([ux * r0 + px0 * hw, 0, uz * r0 + pz0 * hw]),
    at([ux * r1 + px0 * hw, 0, uz * r1 + pz0 * hw]),
    at([ux * r1 - px0 * hw, 0, uz * r1 - pz0 * hw]),
    at([ux * r0 - px0 * hw, 0, uz * r0 - pz0 * hw]),
  ];
  const out = [];
  out.push(`<path class="iso-fill" d="${k.pathOf(corners, true)}" style="fill:var(--anatomy-shade-1)"/>`);
  out.push(L(k.pathOf(corners, true), { tone: "mid" }));
  // panel segment seams (the hinged panels)
  for (let i = 1; i < 4; i++) {
    const t = i / 4, rr = r0 + (r1 - r0) * t;
    out.push(L(k.pathOf([at([ux * rr + px0 * hw, 0, uz * rr + pz0 * hw]), at([ux * rr - px0 * hw, 0, uz * rr - pz0 * hw])]), { tone: "faint" }));
  }
  // a magnetometer sensor at the tip of the third wing
  if (withMag) out.push(S(k.cylinder(ux * (r1 + 1), uz * (r1 + 1), 0.6, -0.4, 0.8, P, 8), { tone: "hi" }));
  return out.join("");
}

// the hexagonal bus body
function bus(y) {
  return S(k.cylinder(0, 0, RBUS, y - 1.6, 3.2, P, 6, 0.2), { tone: "mid", lit: true });
}

// the radiation vault — a smaller titanium box inside/under the bus
function vault(y) {
  const plan = { x: -1.6, y: -1.6, w: 3.2, d: 3.2, r: 0.2 };
  return S(k.slabOf(plan, y - 1.2, 2.4, P, 2, 0.2), { tone: "lit", lit: true });
}

// the high-gain antenna dish on top
function antenna(y) {
  const out = [S(k.cylinder(0, 0, 2.6, y, 0.6, P, 18), { tone: "hi", lit: true })];
  out.push(L(k.pathOf([at([0, y + 0.6, 0]), at([0, y + 2.2, 0])]), { tone: "mid" }));
  return out.join("");
}

// MWR / JunoCam instruments — a couple of boxes on a bus face
function instruments(y) {
  const out = [];
  const cx = RBUS - 0.3;
  for (const [bz, by] of [[-0.9, 0.6], [0.9, -0.4]]) {
    const plan = { x: cx - 0.6, y: bz - 0.6, w: 1.2, d: 1.2, r: 0.12 };
    out.push(S(k.slabOf(plan, y + by - 0.6, 1.2, P, 2, 0.12), { tone: "hi" }));
  }
  return out.join("");
}

// the main engine bell below
function engine(y) {
  return S(k.cylinder(0, 0, 1.0, y - 1.2, 1.4, P, 12), { tone: "mid" });
}

// ---- the parts: real Juno elements, exploded --------------------------------
const PARTS = [
  { id: "antenna",  name: "High-Gain Antenna",     role: "the dish on top — the data link home across ~600 million km",                 grp: "comms",  vec: [0, 16, 0],  num: 1, anchor: [0, 6, 0],   draw: () => antenna(6) },
  { id: "bus",      name: "Hexagonal Bus",         role: "the 6-sided body — holds the avionics, propulsion + the science",             grp: "bus",    vec: [0, 8, 0],   num: 2, anchor: [0, 0, 0],   lit: true, draw: () => bus(0) },
  { id: "vault",    name: "Radiation Vault",       role: "a 1 cm titanium box shielding the brain — cuts Jupiter's radiation ~800×",     grp: "bus",    vec: [0, 4, -8],  num: 3, anchor: [0, 0.2, 0], draw: () => vault(0.2) },
  { id: "wing1",    name: "Solar Wing 1",          role: "one of three 2.7 × 8.9 m wings — the only solar craft ever flown at Jupiter",  grp: "power",  vec: [-18, 2, 0], num: 4, anchor: [-(RBUS + WING_LEN / 2), 0, 0], draw: () => wing(180) },
  { id: "wing2",    name: "Solar Wing 2",          role: "the second wing — 50 m² of cells for just ~435 W out at Jupiter",              grp: "power",  vec: [12, 2, 14], num: 5, anchor: [Math.cos(Math.PI/3)*(RBUS+WING_LEN/2), 0, Math.sin(Math.PI/3)*(RBUS+WING_LEN/2)], draw: () => wing(60) },
  { id: "wing3",    name: "Solar Wing 3 + Mag",    role: "the third wing — carries the magnetometer at its far tip, away from the bus", grp: "power",  vec: [12, 2, -14],num: 6, anchor: [Math.cos(-Math.PI/3)*(RBUS+WING_LEN/2), 0, Math.sin(-Math.PI/3)*(RBUS+WING_LEN/2)], draw: () => wing(-60, true) },
  { id: "instruments",name:"MWR + JunoCam",        role: "the microwave radiometer (6 antennas) + the camera that gave us Jupiter's poles", grp: "science",vec: [0, 2, 12], num: 7, anchor: [RBUS - 0.3, 0, 0], draw: () => instruments(0) },
  { id: "engine",   name: "Main Engine (LEROS-1b)",role: "645 N engine — the burn that braked Juno into Jupiter orbit in 2016",          grp: "propulsion",vec:[0, -14, 0],num: 8, anchor: [0, -3, 0],  draw: () => engine(-3) },
];

// ---- labels overlay (balanced + robust de-collision) -----------------------
function labelOverlay() {
  const out = [];
  PARTS.forEach((s, i) => {
    const side = i % 2 === 0 ? -1 : 1;
    out.push(
      `<g class="jn-label" data-label="${s.id}" data-side="${side < 0 ? "l" : "r"}" opacity="0">` +
        `<line class="jn-leader" x1="0" y1="0" x2="0" y2="0"/>` +
        `<circle class="jn-ldot" r="1.6"/>` +
        `<g class="jn-card">` +
          `<text class="jn-num" y="-5">${String(s.num).padStart(2, "0")}</text>` +
          `<text class="jn-name" y="6">${s.name}</text>` +
          `<text class="jn-role" y="17">${s.role}</text>` +
        `</g>` +
      `</g>`,
    );
  });
  return `<svg xmlns="http://www.w3.org/2000/svg" class="iso-svg jn-labels" viewBox="0 0 ${WIDTH} ${HEIGHT}" aria-hidden="true">${out.join("")}</svg>`;
}

const part = (id, inner) => `<g data-part="${id}" transform="${k.translateAlong(P, [0, 0, 0])}">${inner}</g>`;

const svg = k.figureSvg({
  width: WIDTH, height: HEIGHT, className: "jn-fig",
  label: "The Juno spacecraft, taken apart into its real assemblies — the high-gain antenna, the hexagonal bus, the titanium radiation vault, the three huge solar wings (one carrying the magnetometer), the MWR + JunoCam instruments, and the main engine. Hover to take it apart; each part is a real, named Juno element.",
  body: PARTS.map((s) => part(s.id, s.draw())),
});

const live = `
(function(){
  const PARTS = ${JSON.stringify(PARTS.map((s) => ({ id: s.id, name: s.name, role: s.role, vec: s.vec, anchor: s.anchor, grp: s.grp, num: s.num })))};
  const P = ${JSON.stringify(P)};
  const SPRING = { stagger: 0.03, stiffness: 70, damping: 15, substeps: 4 };
  const root = document.getElementById("jnfig");
  if (!root) return;
  const stage = root.querySelector(".iso-stage");
  const svg = stage.querySelector("svg.iso-svg:not(.jn-labels)") || stage.querySelector("svg");
  const labelSvg = stage.querySelector(".jn-labels");
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
        g.querySelector(".jn-card").setAttribute("transform","translate("+cx+" "+cy+")");
        const leader=g.querySelector(".jn-leader");
        leader.setAttribute("x1",ax); leader.setAttribute("y1",ay);
        leader.setAttribute("x2", side<0?150:${WIDTH}-150); leader.setAttribute("y2",cy);
        const dot=g.querySelector(".jn-ldot"); dot.setAttribute("cx",ax); dot.setAttribute("cy",ay);
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
    else if(open>0.9) text="apart · 8 real Juno elements";
    else text="the Juno spacecraft · assembled";
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
    if(readout) readout.textContent=selected?DETAIL[selected]:(maxOpen()>0.5?"apart · tap a part":"the Juno spacecraft · assembled");
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
  fig: "JNO",
  title: "Juno spacecraft",
  hint: "Hover or tap to take it apart · tap a part to name it",
  readout: "the Juno spacecraft · assembled",
  keys: [
    { mark: "lit", label: "Three huge solar wings fan off a hexagonal bus — the only solar craft at Jupiter" },
    { mark: "raised", label: "8 real elements — the antenna, bus, radiation vault, 3 wings, instruments + engine" },
  ],
  caption:
    "Juno, part by part — and it's mostly wings. To run on sunlight at Jupiter, where the Sun is 25× fainter than at Earth, Juno spread three enormous solar panels (each 2.7 × 8.9 m) off a hexagonal bus, ~20 m across — the widest planetary spacecraft, and the only solar-powered one ever flown that far out. A titanium radiation vault shields the electronics from Jupiter's brutal belts; the microwave radiometer + JunoCam ride the bus; the magnetometer sits at the end of one wing; and the LEROS-1b engine braked it into orbit in 2016. Hover to lift every real element clear, then tap any part to read what it is.",
  body: `<div class="iso-stage" tabindex="0" role="button" aria-label="Juno spacecraft exploded teardown: press Enter to take it apart">${svg}${labelOverlay()}</div>`,
});
const stageHtml = `<div id="jnfig" class="jn-figroot">${card}</div>`;

const EXTRA_CSS = `
/* BLEND IN: strip the plate card chrome so the figure floats on the host page. */
html, body { background: transparent !important; }
.iso-page { margin: 0 auto !important; width: 100% !important; }
.iso-figure { margin: 0 !important; }
.iso-plate { background: transparent !important; box-shadow: none !important; padding: 20px 8px !important; --anatomy-paper: transparent !important; }
.iso-plate-corner[data-corner="fig"], .iso-plate-corner[data-corner="title"], .iso-plate-corner[data-corner="hint"] { display: none; }
.iso-legend { display: none; }
.jn-figroot{position:relative}
.iso-stage{position:relative}
.jn-labels{position:absolute;inset:0;pointer-events:none}
.jn-leader{stroke:var(--anatomy-lo);stroke-width:.8}
.jn-ldot{fill:var(--anatomy-mid)}
.jn-card .jn-num{fill:var(--anatomy-faint);font-family:var(--anatomy-mono);font-size:9px;letter-spacing:.08em}
.jn-card .jn-name{fill:var(--anatomy-hi);font-family:var(--anatomy-mono);font-size:11px;letter-spacing:.02em}
.jn-card .jn-role{fill:var(--anatomy-mid);font-family:var(--anatomy-mono);font-size:8.5px;letter-spacing:.01em}
.jn-label[data-side="l"] .jn-card text{text-anchor:start}
.jn-label[data-side="r"] .jn-card text{text-anchor:end}
`;

const outName = `juno-teardown${theme === "light" ? "-light" : ""}.html`;
writeFileSync(join(HERE, outName), k.pageHtml({ title: "Juno teardown", theme, body: `<style>${EXTRA_CSS}</style>${stageHtml}`, script: kitScript() + live, width: 1180 }));
console.log("wrote", outName);
