// Voyager spacecraft — isometric part-by-part exploded teardown.
// Standalone HTML. Same engine/label/explode/blend mechanics as the other
// teardowns; Voyager's EXACT real configuration (Voyager 1 & 2 are identical).
//
// Truth (Wikipedia Voyager program, verified 2026-11-06): a 3.7 m high-gain
// antenna DISH on top of a hollow DECAGONAL electronics bus. Three RTGs mounted
// end-to-end on a lower BOOM (470 W at launch — nuclear, for the dark outer
// system). A 13 m MAGNETOMETER BOOM extends opposite. A SCIENCE BOOM carries the
// steerable SCAN PLATFORM (IRIS + UVS spectrometers, two vidicon cameras, PPS).
// The GOLDEN RECORD is bolted to a bus side. Each part here is a real, named
// Voyager element.
import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { homedir } from "node:os";

const KIT = join(homedir(), ".claude", "skills", "anatomy");
const k = await import(pathToFileURL(join(KIT, "kit", "iso-kit.mjs")).href);
const { kitScript } = await import(pathToFileURL(join(KIT, "scripts", "inline-kit.mjs")).href);

const HERE = dirname(fileURLToPath(import.meta.url));
const theme = process.argv.includes("--light") ? "light" : "dark";

// ---- world layout (units ~ 0.35 m) ----------------------------------------
// y = up (dish on top). x = the booms splay left/right. z = toward/away.
const WIDTH = 1120, HEIGHT = 640;
const FIG_W = 820;
const MARGIN = (WIDTH - FIG_W) / 2;
const RDISH = 5.3;          // 3.7 m dish
const RBUS = 2.4;           // decagonal bus radius

const Pc = k.fitProjection(
  [
    [0, 14, 0], [0, -4, 0],              // dish top / bus
    [-30, -8, 0], [26, 2, 0],            // mag boom left / science boom right
    [0, -22, 0],                          // RTG boom down
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

// the 3.7 m high-gain dish (shallow disc facing +y) on top, + feed
function dish(y) {
  const out = [S(k.cylinder(0, 0, RDISH, y, 0.6, P, 24), { tone: "hi", lit: true })];
  out.push(L(k.pathOf([at([0, y + 0.6, 0]), at([0, y + 3.5, 0])]), { tone: "mid" }));   // feed tripod (one line)
  out.push(S(k.cylinder(0, 0, 0.5, y + 3.5, 0.7, P, 8), { tone: "mid" }));
  return out.join("");
}

// the decagonal electronics bus (10-sided short cylinder)
function bus(y) {
  return S(k.cylinder(0, 0, RBUS, y - 1.4, 2.8, P, 10, 0.15), { tone: "mid", lit: true });
}

// three RTGs end-to-end on a lower boom (down -y then out)
function rtgBoom() {
  const out = [];
  const x0 = -RBUS, yTop = -1.4;
  // boom out to the side then the three gens end-to-end along it
  const bx = -16;
  out.push(L(k.pathOf([at([x0, yTop, 0]), at([bx, yTop - 1, 0])]), { tone: "hi" }));
  for (let i = 0; i < 3; i++) {
    const gx = bx - i * 3.4;
    out.push(S(k.cylinder(gx, 0, 1.1, yTop - 1 - 1.5, 3.0, P, 10), { tone: "lit", lit: true }));
  }
  return out.join("");
}

// the 13 m magnetometer boom — a long thin line with a tip sensor
function magBoom() {
  const out = [];
  const x1 = 26;
  out.push(L(k.pathOf([at([RBUS, 1, 0]), at([x1, 2, 0])]), { tone: "hi" }));
  out.push(S(k.cylinder(x1, 0, 0.5, 2 - 0.4, 0.8, P, 8), { tone: "mid" }));
  return out.join("");
}

// the science boom + scan platform — a short boom holding an instrument cluster
function scanPlatform() {
  const out = [];
  const bx = 9, by = 3;
  out.push(L(k.pathOf([at([RBUS, by, 0]), at([bx, by, 0])]), { tone: "mid" }));
  // the platform box + a couple of instrument tubes (cameras / spectrometers)
  const plan = { x: bx - 1.6, y: -1.6, w: 3.2, d: 3.2, r: 0.3 };
  out.push(S(k.slabOf(plan, by - 1.4, 2.8, P, 2, 0.2), { tone: "hi", lit: true }));
  out.push(S(k.cylinder(bx + 1, 0.8, 0.6, by + 0.4, 2.2, P, 10), { tone: "mid" }));   // a camera tube
  return out.join("");
}

// the Golden Record — a disc bolted to a bus side
function goldenRecord() {
  const cx = 0, cz = RBUS + 1.4;
  return S(k.cylinder(cx, cz, 1.4, -0.9, 0.5, P, 18), { tone: "lit", lit: true });
}

// ---- the parts: real Voyager elements, exploded -----------------------------
const PARTS = [
  { id: "dish",     name: "High-Gain Antenna",     role: "the 3.7 m dish — points at Earth always; its signal now takes a day to arrive", grp: "comms",  vec: [0, 20, 0],  num: 1, anchor: [0, 10, 0],  draw: () => dish(10) },
  { id: "bus",      name: "Electronics Bus",       role: "the 10-sided body — the computers + the spacecraft's brain, hollow for mass",    grp: "bus",    vec: [0, 10, 0],  num: 2, anchor: [0, 0, 0],   lit: true, draw: () => bus(0) },
  { id: "rtg",      name: "RTGs (×3)",             role: "three plutonium generators end-to-end on a boom — ~470 W; no Sun this far out",  grp: "power",  vec: [-18, -10, 0],num: 3, anchor: [-16, -3, 0], draw: () => rtgBoom() },
  { id: "magboom",  name: "Magnetometer Boom",     role: "a 13 m boom holding the magnetometer far from the craft's own fields",           grp: "science",vec: [18, 8, 0],  num: 4, anchor: [20, 2, 0],  draw: () => magBoom() },
  { id: "scan",     name: "Scan Platform",         role: "the steerable instrument boom — IRIS + UVS spectrometers, two cameras, PPS",      grp: "science",vec: [14, 6, 6],  num: 5, anchor: [9, 3, 0],   draw: () => scanPlatform() },
  { id: "record",   name: "The Golden Record",     role: "a gold-plated phonograph of Earth's sounds + images, bolted to the bus side",    grp: "payload",vec: [0, -2, 16], num: 6, anchor: [0, -0.9, RBUS + 1.4], draw: () => goldenRecord() },
];

// ---- labels overlay (balanced + robust de-collision) -----------------------
function labelOverlay() {
  const out = [];
  PARTS.forEach((s, i) => {
    const side = i % 2 === 0 ? -1 : 1;
    out.push(
      `<g class="vy-label" data-label="${s.id}" data-side="${side < 0 ? "l" : "r"}" opacity="0">` +
        `<line class="vy-leader" x1="0" y1="0" x2="0" y2="0"/>` +
        `<circle class="vy-ldot" r="1.6"/>` +
        `<g class="vy-card">` +
          `<text class="vy-num" y="-5">${String(s.num).padStart(2, "0")}</text>` +
          `<text class="vy-name" y="6">${s.name}</text>` +
          `<text class="vy-role" y="17">${s.role}</text>` +
        `</g>` +
      `</g>`,
    );
  });
  return `<svg xmlns="http://www.w3.org/2000/svg" class="iso-svg vy-labels" viewBox="0 0 ${WIDTH} ${HEIGHT}" aria-hidden="true">${out.join("")}</svg>`;
}

const part = (id, inner) => `<g data-part="${id}" transform="${k.translateAlong(P, [0, 0, 0])}">${inner}</g>`;

const svg = k.figureSvg({
  width: WIDTH, height: HEIGHT, className: "vy-fig",
  label: "A Voyager spacecraft, taken apart into its real assemblies — the 3.7 m high-gain antenna, the decagonal electronics bus, the three RTGs on their boom, the 13 m magnetometer boom, the science scan platform, and the Golden Record. Hover to take it apart; each part is a real, named Voyager element.",
  body: PARTS.map((s) => part(s.id, s.draw())),
});

const live = `
(function(){
  const PARTS = ${JSON.stringify(PARTS.map((s) => ({ id: s.id, name: s.name, role: s.role, vec: s.vec, anchor: s.anchor, grp: s.grp, num: s.num })))};
  const P = ${JSON.stringify(P)};
  const SPRING = { stagger: 0.035, stiffness: 70, damping: 15, substeps: 4 };
  const root = document.getElementById("vyfig");
  if (!root) return;
  const stage = root.querySelector(".iso-stage");
  const svg = stage.querySelector("svg.iso-svg:not(.vy-labels)") || stage.querySelector("svg");
  const labelSvg = stage.querySelector(".vy-labels");
  const readout = root.querySelector("[data-readout]");
  const still = matchMedia("(prefers-reduced-motion: reduce)");
  const groups = Object.fromEntries(PARTS.map((s)=>[s.id, svg.querySelector('[data-part="'+s.id+'"]')]));
  const labels = Object.fromEntries(PARTS.map((s)=>[s.id, labelSvg && labelSvg.querySelector('[data-label="'+s.id+'"]')]));
  const springs = Object.fromEntries(PARTS.map((s)=>[s.id, {at:0,rate:0,target:0,pending:null}]));
  let clock=0, frame=0, visible=false, touring=true, tourClock=0, demoClock=0, userTouched=false, selected=null;
  const order = PARTS.map((s)=>s.id);
  const maxOpen = ()=>PARTS.reduce((m,s)=>Math.max(m,springs[s.id].at),0);
  function isoPt(p){ const a=iso(p,P); return [a[0],a[1]]; }
  const LABEL_ROW = 44;
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
        g.querySelector(".vy-card").setAttribute("transform","translate("+cx+" "+cy+")");
        const leader=g.querySelector(".vy-leader");
        leader.setAttribute("x1",ax); leader.setAttribute("y1",ay);
        leader.setAttribute("x2", side<0?150:${WIDTH}-150); leader.setAttribute("y2",cy);
        const dot=g.querySelector(".vy-ldot"); dot.setAttribute("cx",ax); dot.setAttribute("cy",ay);
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
    else if(open>0.9) text="apart · 6 real Voyager elements";
    else text="a Voyager spacecraft · assembled";
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
    if(readout) readout.textContent=selected?DETAIL[selected]:(maxOpen()>0.5?"apart · tap a part":"a Voyager spacecraft · assembled");
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
  fig: "VGR",
  title: "Voyager spacecraft",
  hint: "Hover or tap to take it apart · tap a part to name it",
  readout: "a Voyager spacecraft · assembled",
  keys: [
    { mark: "lit", label: "The dish always points home; the booms splay out — RTGs, magnetometer, instruments" },
    { mark: "raised", label: "6 real elements — the antenna, bus, RTGs, mag boom, scan platform + the Golden Record" },
  ],
  caption:
    "A Voyager, part by part — the twins are identical. The 3.7 m dish on top never stops pointing at Earth; below it, a ten-sided electronics bus. Three plutonium generators ride a boom on one side (there's no sunlight to run on this far out); a 13-metre boom holds the magnetometer clear of the craft's own fields on the other; and a steerable scan platform carries the cameras and spectrometers that gave us the first close-ups of the outer planets. Bolted to the bus is the Golden Record — a message from Earth, now in interstellar space. Hover to lift every real element clear, then tap any part to read what it is.",
  body: `<div class="iso-stage" tabindex="0" role="button" aria-label="Voyager spacecraft exploded teardown: press Enter to take it apart">${svg}${labelOverlay()}</div>`,
});
const stageHtml = `<div id="vyfig" class="vy-figroot">${card}</div>`;

const EXTRA_CSS = `
/* BLEND IN: strip the plate card chrome so the figure floats on the host page. */
html, body { background: transparent !important; }
.iso-page { margin: 0 auto !important; width: 100% !important; }
.iso-figure { margin: 0 !important; }
.iso-plate { background: transparent !important; box-shadow: none !important; padding: 20px 8px !important; --anatomy-paper: transparent !important; }
.iso-plate-corner[data-corner="fig"], .iso-plate-corner[data-corner="title"], .iso-plate-corner[data-corner="hint"] { display: none; }
.iso-legend { display: none; }
.vy-figroot{position:relative}
.iso-stage{position:relative}
.vy-labels{position:absolute;inset:0;pointer-events:none}
.vy-leader{stroke:var(--anatomy-lo);stroke-width:.8}
.vy-ldot{fill:var(--anatomy-mid)}
.vy-card .vy-num{fill:var(--anatomy-faint);font-family:var(--anatomy-mono);font-size:9px;letter-spacing:.08em}
.vy-card .vy-name{fill:var(--anatomy-hi);font-family:var(--anatomy-mono);font-size:11px;letter-spacing:.02em}
.vy-card .vy-role{fill:var(--anatomy-mid);font-family:var(--anatomy-mono);font-size:8.5px;letter-spacing:.01em}
.vy-label[data-side="l"] .vy-card text{text-anchor:start}
.vy-label[data-side="r"] .vy-card text{text-anchor:end}
`;

const outName = `voyager-teardown${theme === "light" ? "-light" : ""}.html`;
writeFileSync(join(HERE, outName), k.pageHtml({ title: "Voyager teardown", theme, body: `<style>${EXTRA_CSS}</style>${stageHtml}`, script: kitScript() + live, width: 1180 }));
console.log("wrote", outName);
