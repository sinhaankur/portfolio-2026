// Cassini orbiter — isometric part-by-part exploded teardown.
// Standalone HTML. Same engine/label/explode/blend mechanics as the other
// teardowns; Cassini's EXACT real configuration.
//
// Truth (Wikipedia Cassini–Huygens, verified 2026-11-06): 6.8 m tall × 4 m wide.
// A stacked bus — a 4 m HIGH-GAIN ANTENNA dish on top, then the electronics bus
// (a dodecagonal prism), a conical frustum, and the lower propulsion cylinder
// with the R-4D main engine at the bottom. Three GPHS-RTGs (plutonium, ~885 W)
// hang off the sides. An 11 m MAGNETOMETER BOOM extends out; the REMOTE-SENSING
// INSTRUMENT PALLET (cameras, spectrometers) + the FIELDS/PARTICLES pallet ride
// the bus; and the HUYGENS probe (ESA's Titan lander) is bolted to one side.
// Each part here is a real, named Cassini element.
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
// y = up the stack (antenna on top, engine at bottom). x,z = around the bus.
const WIDTH = 1120, HEIGHT = 640;
const FIG_W = 820;
const MARGIN = (WIDTH - FIG_W) / 2;
const RBUS = 4.0;            // bus radius (~4 m wide craft)

const Pc = k.fitProjection(
  [
    [0, 16, 0], [0, -14, 0],          // antenna top / engine bottom
    [-22, 0, 0], [RBUS + 4, 0, 0],    // mag boom left / huygens right
    [0, 0, -RBUS - 3], [0, 0, RBUS + 3],
  ],
  FIG_W, HEIGHT,
  { pad: 20, headroom: 150, azimuth: 38, elevation: 20 },
);
const P = { ...Pc, origin: [Pc.origin[0] + MARGIN, Pc.origin[1]] };

const at = (p) => k.iso(p, P);
const S = (paths, style) => k.solidSvg(paths, style);
const L = (d, style) => k.lineSvg(d, style);
const px = (p) => k.iso(p, P);

// the 4 m high-gain antenna dish (a shallow disc facing +y) on top
function antenna(y) {
  const out = [S(k.cylinder(0, 0, RBUS, y, 0.7, P, 20), { tone: "hi", lit: true })];
  // feed horn poking up from the centre
  out.push(L(k.pathOf([at([0, y + 0.7, 0]), at([0, y + 3, 0])]), { tone: "mid" }));
  out.push(S(k.cylinder(0, 0, 0.5, y + 3, 0.8, P, 10), { tone: "mid" }));
  return out.join("");
}

// a bus section cylinder centred at height y, radius rad, height h
function busSection(y, h, rad, steps = 12, tone = "mid", lit = false) {
  return S(k.cylinder(0, 0, rad, y - h / 2, h, P, steps, 0.2), { tone, lit });
}

// a conical frustum (approx with a short tapered cylinder stack)
function frustum(y, h, rTop, rBot) {
  const out = [];
  const N = 4;
  for (let i = 0; i < N; i++) {
    const t = i / N;
    const r = rTop + (rBot - rTop) * t;
    out.push(S(k.cylinder(0, 0, r, y - h / 2 + h * t, h / N + 0.05, P, 12), { tone: "mid" }));
  }
  return out.join("");
}

// an RTG — a finned cylinder on a short boom off the side
function rtg(angleDeg, y) {
  const a = (angleDeg * Math.PI) / 180;
  const bx = Math.cos(a) * (RBUS + 2.0), bz = Math.sin(a) * (RBUS + 2.0);
  const out = [];
  out.push(L(k.pathOf([at([Math.cos(a) * RBUS, y, Math.sin(a) * RBUS]), at([bx, y, bz])]), { tone: "mid" }));
  out.push(S(k.cylinder(bx, bz, 1.0, y - 1.6, 3.2, P, 12), { tone: "lit", lit: true }));
  return out.join("");
}

// the 11 m magnetometer boom — a long thin line out the side with a tip sensor
function magBoom() {
  const out = [];
  const x0 = -RBUS, x1 = -22;
  out.push(L(k.pathOf([at([x0, 2, 0]), at([x1, 2, 0])]), { tone: "hi" }));
  out.push(S(k.cylinder(x1, 0, 0.5, 2 - 0.4, 0.8, P, 8), { tone: "mid" }));
  return out.join("");
}

// the Huygens probe — a shallow conical disc bolted to the +x side
function huygens(y) {
  const out = [];
  const cx = RBUS + 2.2;
  out.push(S(k.cylinder(cx, 0, 1.6, y - 0.8, 1.6, P, 14), { tone: "hi", lit: true }));
  out.push(L(k.pathOf([at([RBUS, y, 0]), at([cx - 1.6, y, 0])]), { tone: "lo" })); // mount strut
  return out.join("");
}

// an instrument pallet — a cluster of small boxes on the bus side
function instruments(y, side) {
  const out = [];
  const cx = side * (RBUS - 0.4);
  const boxes = [[-0.5, 0.8], [0.5, 0.8], [0, -0.8]];
  for (const [bz, by] of boxes) {
    const plan = { x: cx - 0.7, y: bz - 0.7, w: 1.4, d: 1.4, r: 0.15 };
    out.push(S(k.slabOf(plan, y + by - 0.7, 1.4, P, 2, 0.15), { tone: "hi" }));
  }
  return out.join("");
}

// the main engine bell at the bottom
function engine(y) {
  return S(k.cylinder(0, 0, 1.2, y - 1.4, 1.6, P, 12), { tone: "mid" });
}

// ---- the parts: real Cassini elements, exploded -----------------------------
const PARTS = [
  { id: "hga",      name: "High-Gain Antenna",     role: "the 4 m dish on top — talks to Earth + doubled as a sunshade near the Sun", grp: "comms",  vec: [0, 20, 0],  num: 1, anchor: [0, 11, 0],  draw: () => antenna(11) },
  { id: "bus",      name: "Electronics Bus",       role: "the 12-sided upper bus — computers, gyros, the spacecraft's brain",         grp: "bus",    vec: [0, 11, 0],  num: 2, anchor: [0, 6, 0],   lit: true, draw: () => busSection(6, 4, RBUS - 0.3, 12, "mid", true) },
  { id: "frustum",  name: "Conical Adapter",       role: "the tapering mid-section joining the bus to the propulsion module",          grp: "structure",vec: [0, 2, -6],num: 3, anchor: [0, 1.5, 0], draw: () => frustum(1.5, 3, RBUS - 0.3, 2.4) },
  { id: "prop",     name: "Propulsion Module",     role: "the lower cylinder — fuel + oxidiser tanks for the orbit-insertion burns",   grp: "propulsion",vec:[0, -10, 0],num: 4, anchor: [0, -3, 0],  draw: () => busSection(-3, 4, 2.4, 12, "mid") },
  { id: "engine",   name: "Main Engine (R-4D)",    role: "490 N bipropellant engine (one prime, one backup) — the big orbit burns",   grp: "propulsion",vec:[0, -16, 0],num: 5, anchor: [0, -6, 0],  draw: () => engine(-6) },
  { id: "rtg",      name: "RTGs (×3)",             role: "three plutonium generators — ~885 W; no sunlight at Saturn, so nuclear heat", grp: "power",  vec: [16, -2, 8], num: 6, anchor: [RBUS + 3, 2, 0], draw: () => rtg(0, 2) + rtg(120, 2) + rtg(240, 2) },
  { id: "magboom",  name: "Magnetometer Boom",     role: "an 11 m boom holding the magnetometer far from the craft's own fields",      grp: "science",vec: [-14, 6, 0], num: 7, anchor: [-14, 2, 0], draw: () => magBoom() },
  { id: "remote",   name: "Remote-Sensing Pallet", role: "cameras + IR/UV spectrometers — the imaging that mapped Saturn + its moons", grp: "science",vec: [0, 6, 14],  num: 8, anchor: [-(RBUS - 0.4), 5, 0], draw: () => instruments(5, -1) },
  { id: "fields",   name: "Fields & Particles",    role: "plasma, dust + radio instruments — tasting Saturn's magnetosphere directly", grp: "science",vec: [0, -4, 14], num: 9, anchor: [RBUS - 0.4, 4, 0], draw: () => instruments(4, +1) },
  { id: "huygens",  name: "Huygens Probe (ESA)",   role: "the Titan lander bolted to the side — released in 2004, landed Jan 2005",    grp: "payload",vec: [18, 2, 0],  num: 10,anchor: [RBUS + 2.2, 4, 0], draw: () => huygens(4) },
];

// ---- labels overlay (balanced + robust de-collision) -----------------------
function labelOverlay() {
  const out = [];
  PARTS.forEach((s, i) => {
    const side = i % 2 === 0 ? -1 : 1;
    out.push(
      `<g class="cs-label" data-label="${s.id}" data-side="${side < 0 ? "l" : "r"}" opacity="0">` +
        `<line class="cs-leader" x1="0" y1="0" x2="0" y2="0"/>` +
        `<circle class="cs-ldot" r="1.6"/>` +
        `<g class="cs-card">` +
          `<text class="cs-num" y="-5">${String(s.num).padStart(2, "0")}</text>` +
          `<text class="cs-name" y="6">${s.name}</text>` +
          `<text class="cs-role" y="17">${s.role}</text>` +
        `</g>` +
      `</g>`,
    );
  });
  return `<svg xmlns="http://www.w3.org/2000/svg" class="iso-svg cs-labels" viewBox="0 0 ${WIDTH} ${HEIGHT}" aria-hidden="true">${out.join("")}</svg>`;
}

const part = (id, inner) => `<g data-part="${id}" transform="${k.translateAlong(P, [0, 0, 0])}">${inner}</g>`;

const svg = k.figureSvg({
  width: WIDTH, height: HEIGHT, className: "cs-fig",
  label: "The Cassini orbiter, taken apart into its real assemblies — the high-gain antenna, the electronics bus, the conical adapter, the propulsion module + main engine, the three RTGs, the magnetometer boom, the remote-sensing + fields-and-particles instrument pallets, and the Huygens probe. Hover to take it apart; each part is a real, named Cassini element.",
  body: PARTS.map((s) => part(s.id, s.draw())),
});

const live = `
(function(){
  const PARTS = ${JSON.stringify(PARTS.map((s) => ({ id: s.id, name: s.name, role: s.role, vec: s.vec, anchor: s.anchor, grp: s.grp, num: s.num })))};
  const P = ${JSON.stringify(P)};
  const SPRING = { stagger: 0.03, stiffness: 70, damping: 15, substeps: 4 };
  const root = document.getElementById("csfig");
  if (!root) return;
  const stage = root.querySelector(".iso-stage");
  const svg = stage.querySelector("svg.iso-svg:not(.cs-labels)") || stage.querySelector("svg");
  const labelSvg = stage.querySelector(".cs-labels");
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
        g.querySelector(".cs-card").setAttribute("transform","translate("+cx+" "+cy+")");
        const leader=g.querySelector(".cs-leader");
        leader.setAttribute("x1",ax); leader.setAttribute("y1",ay);
        leader.setAttribute("x2", side<0?150:${WIDTH}-150); leader.setAttribute("y2",cy);
        const dot=g.querySelector(".cs-ldot"); dot.setAttribute("cx",ax); dot.setAttribute("cy",ay);
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
    else if(open>0.9) text="apart · 10 real Cassini elements";
    else text="the Cassini orbiter · assembled";
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
    if(readout) readout.textContent=selected?DETAIL[selected]:(maxOpen()>0.5?"apart · tap a part":"the Cassini orbiter · assembled");
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
  fig: "CAS",
  title: "Cassini orbiter",
  hint: "Hover or tap to take it apart · tap a part to name it",
  readout: "the Cassini orbiter · assembled",
  keys: [
    { mark: "lit", label: "The stack: 4 m antenna on top → bus → propulsion → engine, RTGs on the sides" },
    { mark: "raised", label: "10 real elements — the antenna, bus, engine, RTGs, mag boom, instruments + Huygens" },
  ],
  caption:
    "Cassini, part by part — a bus the size of a small bus, 6.8 m tall. The 4 m high-gain antenna sits on top (it also shaded the craft near the Sun), over the electronics bus, a conical adapter, and the propulsion module with its main engine at the base. With no sunlight to speak of at Saturn, three plutonium RTGs supplied the power. An 11 m boom held the magnetometer clear of the craft's own fields; the cameras + spectrometers rode the bus; and ESA's Huygens probe — which parachuted onto Titan in 2005 — was bolted to the side. Hover to lift every real element clear, then tap any part to read what it is.",
  body: `<div class="iso-stage" tabindex="0" role="button" aria-label="Cassini orbiter exploded teardown: press Enter to take it apart">${svg}${labelOverlay()}</div>`,
});
const stageHtml = `<div id="csfig" class="cs-figroot">${card}</div>`;

const EXTRA_CSS = `
/* BLEND IN: strip the plate card chrome so the figure floats on the host page. */
html, body { background: transparent !important; }
.iso-page { margin: 0 auto !important; width: 100% !important; }
.iso-figure { margin: 0 !important; }
.iso-plate { background: transparent !important; box-shadow: none !important; padding: 20px 8px !important; --anatomy-paper: transparent !important; }
.iso-plate-corner[data-corner="fig"], .iso-plate-corner[data-corner="title"], .iso-plate-corner[data-corner="hint"] { display: none; }
.iso-legend { display: none; }
.cs-figroot{position:relative}
.iso-stage{position:relative}
.cs-labels{position:absolute;inset:0;pointer-events:none}
.cs-leader{stroke:var(--anatomy-lo);stroke-width:.8}
.cs-ldot{fill:var(--anatomy-mid)}
.cs-card .cs-num{fill:var(--anatomy-faint);font-family:var(--anatomy-mono);font-size:9px;letter-spacing:.08em}
.cs-card .cs-name{fill:var(--anatomy-hi);font-family:var(--anatomy-mono);font-size:11px;letter-spacing:.02em}
.cs-card .cs-role{fill:var(--anatomy-mid);font-family:var(--anatomy-mono);font-size:8.5px;letter-spacing:.01em}
.cs-label[data-side="l"] .cs-card text{text-anchor:start}
.cs-label[data-side="r"] .cs-card text{text-anchor:end}
`;

const outName = `cassini-teardown${theme === "light" ? "-light" : ""}.html`;
writeFileSync(join(HERE, outName), k.pageHtml({ title: "Cassini teardown", theme, body: `<style>${EXTRA_CSS}</style>${stageHtml}`, script: kitScript() + live, width: 1180 }));
console.log("wrote", outName);
