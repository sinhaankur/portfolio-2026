// James Webb Space Telescope — isometric part-by-part exploded teardown.
// Standalone HTML. Same engine/label/explode mechanics as the ISS + Hubble
// figures; JWST's EXACT real configuration.
//
// Truth (NASA JWST): a 6.5 m primary of 18 HEXAGONAL gold-coated beryllium
// segments (a honeycomb — 2 rings around a centre, but the centre segment is
// absent where light passes, so 18 total in the real 3-6-9 layout). A SECONDARY
// mirror on a tripod boom stands out front. Behind the primary sits the ISIM
// instrument module (NIRCam, NIRSpec, MIRI, FGS/NIRISS). All of it rides ABOVE a
// five-layer, kite-shaped SUNSHIELD (21 × 14 m) that keeps the cold side at ~40 K;
// the warm SPACECRAFT BUS (solar array, antenna, computers, propulsion) hangs on
// the Sun side, below the shield. Sources: NASA JWST fact sheet + observatory
// configuration diagrams. Each part here is a real, named Webb element.
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
// y = up (the optical axis points +y, toward the sky; the sunshield is below).
// x,z = the mirror plane + the sunshield footprint.
const WIDTH = 1120, HEIGHT = 640;
const FIG_W = 820;
const MARGIN = (WIDTH - FIG_W) / 2;
const HEX_R = 2.0;            // one mirror segment radius
const SHIELD_W = 30;         // sunshield half-width

const Pc = k.fitProjection(
  [
    [-SHIELD_W / 2 - 2, 0, -20], [SHIELD_W / 2 + 2, 0, 16],
    [0, 20, 0], [0, -22, 0],      // mirror up / bus down
  ],
  FIG_W, HEIGHT,
  { pad: 20, headroom: 150, azimuth: 36, elevation: 24 },
);
const P = { ...Pc, origin: [Pc.origin[0] + MARGIN, Pc.origin[1]] };

const at = (p) => k.iso(p, P);
const S = (paths, style) => k.solidSvg(paths, style);
const L = (d, style) => k.lineSvg(d, style);
const px = (p) => k.iso(p, P);

// a flat hexagonal mirror segment lying in the x-z plane at height y, centred (cx,cz)
function hexSeg(cx, cz, y, tone = "lit", lit = true) {
  const pts = [];
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2 + Math.PI / 6;
    pts.push([cx + HEX_R * Math.cos(a), y, cz + HEX_R * Math.sin(a)]);
  }
  const face = pts.map((p) => at(p));
  const out = [];
  out.push(`<path class="iso-fill" d="${k.pathOf(face, true)}" style="fill:var(--anatomy-${lit ? "lit-top" : "top"})"/>`);
  out.push(L(k.pathOf(face, true), { tone: lit ? "lit" : "mid" }));
  return out.join("");
}

// the 18-segment primary = JWST's real layout: a hexagon-of-hexagons — the
// centre + ring-1 (6) + ring-2 (12) = 19 positions, with the CENTRE removed
// (light passes through there to the secondary) → 18 segments. Generated with
// proper axial hex coordinates so the honeycomb is geometrically exact.
function primaryMirror(y) {
  const out = [];
  // flat-top hex axial → pixel: spacing by HEX_R
  const sx = HEX_R * Math.sqrt(3);          // column pitch
  const sz = HEX_R * 1.5;                    // row pitch
  const coords = [];
  const RING = 2;
  for (let q = -RING; q <= RING; q++) {
    for (let r = -RING; r <= RING; r++) {
      const s = -q - r;
      if (Math.max(Math.abs(q), Math.abs(r), Math.abs(s)) > RING) continue; // hex disc of radius 2
      if (q === 0 && r === 0) continue;       // drop centre → 18 segments
      const cx = sx * (q + r / 2);
      const cz = sz * r;
      coords.push([cx, cz]);
    }
  }
  for (const [cx, cz] of coords) out.push(hexSeg(cx, cz, y));
  return out.join("");
}

// secondary mirror on a tripod boom, standing out front (+y) of the primary
function secondary(y) {
  const out = [];
  const topY = y;
  // tripod legs from three primary-rim points up to the secondary hub
  const legs = [[-3.5, 3], [3.5, 3], [0, -4.5]];
  for (const [lx, lz] of legs) out.push(L(k.pathOf([at([lx, 0.2, lz]), at([0, topY, 0])]), { tone: "mid" }));
  // the small secondary disc
  out.push(S(k.cylinder(0, 0, 1.0, topY - 0.3, 0.6, P, 6), { tone: "lit", lit: true }));
  return out.join("");
}

// one sunshield membrane: a flat kite/diamond in the x-z plane at height y
function shieldLayer(y, scale, tone = "mid") {
  const w = SHIELD_W * scale, d = (SHIELD_W * 0.66) * scale;
  const pts = [[0, y, -d / 2], [w / 2, y, 0], [0, y, d / 2], [-w / 2, y, 0]];
  const face = pts.map((p) => at(p));
  const out = [];
  out.push(`<path class="iso-fill" d="${k.pathOf(face, true)}" style="fill:var(--anatomy-shade-1)"/>`);
  out.push(L(k.pathOf(face, true), { tone }));
  // a few seam lines across so it reads as a membrane
  for (const t of [0.33, 0.66]) {
    const zz = -d / 2 + d * t;
    out.push(L(k.pathOf([at([-w / 2 * (1 - Math.abs(0.5 - t) * 2 * 0), y, zz]), at([w / 2 * (1 - 0), y, zz])]), { tone: "faint" }));
  }
  return out.join("");
}

// the spacecraft bus — a box below the sunshield (Sun side)
function bus(y) {
  const plan = { x: -3, y: -3, w: 6, d: 6, r: 0.4 };
  const out = [S(k.slabOf(plan, y, 3, P, 2, 0.3), { tone: "hi" })];
  return out.join("");
}

// solar array off the bus
function solar(y) {
  const out = [];
  const corners = [at([3, y + 1, -3]), at([11, y + 1, -3]), at([11, y + 1, 3]), at([3, y + 1, 3])];
  out.push(`<path class="iso-fill" d="${k.pathOf(corners, true)}" style="fill:var(--anatomy-shade-1)"/>`);
  out.push(L(k.pathOf(corners, true), { tone: "mid" }));
  for (let i = 1; i < 5; i++) { const t = i / 5, xx = 3 + 8 * t; out.push(L(k.pathOf([at([xx, y + 1, -3]), at([xx, y + 1, 3])]), { tone: "faint" })); }
  return out.join("");
}

// instruments module (ISIM) — a box behind the primary
function isim(y) {
  const plan = { x: -2.5, y: -2.5, w: 5, d: 5, r: 0.3 };
  return S(k.slabOf(plan, y, 2.2, P, 2, 0.3), { tone: "hi", lit: true });
}

// ---- the parts: real JWST elements, exploded ------------------------------
const PARTS = [
  { id: "secondary", name: "Secondary Mirror",   role: "0.74 m convex mirror on a tripod boom — folds light back into the instruments", grp: "optics",  vec: [0, 20, 0],  num: 1, anchor: [0, 15, 0],  draw: () => secondary(15) },
  { id: "primary",   name: "Primary Mirror (×18)",role: "6.5 m of 18 hexagonal gold-coated beryllium segments — the light bucket",       grp: "optics",  vec: [0, 11, 0],  num: 2, anchor: [0, 6, 0],   lit: true, draw: () => primaryMirror(6) },
  { id: "isim",      name: "Instruments (ISIM)",  role: "NIRCam, NIRSpec, MIRI, FGS/NIRISS — the cameras + spectrographs at the focus",  grp: "payload", vec: [0, 3, -8],  num: 3, anchor: [0, 2.5, 0], draw: () => isim(2.5) },
  { id: "shield1",   name: "Sunshield — Layer 1", role: "the hottest, Sun-facing membrane — Kapton coated in aluminium + doped silicon", grp: "shield",  vec: [-18, -4, 0],num: 4, anchor: [0, -2, 0],  draw: () => shieldLayer(-2, 1.00, "hi") },
  { id: "shield2",   name: "Sunshield — Layer 2", role: "second of five — each gap radiates heat sideways into space",                    grp: "shield",  vec: [-13, -7, 0],num: 5, anchor: [0, -3.4, 0],draw: () => shieldLayer(-3.4, 0.98) },
  { id: "shield3",   name: "Sunshield — Layer 3", role: "the middle membrane — the temperature has already dropped hundreds of degrees",  grp: "shield",  vec: [-8, -10, 0],num: 6, anchor: [0, -4.8, 0],draw: () => shieldLayer(-4.8, 0.96) },
  { id: "shield4",   name: "Sunshield — Layer 4", role: "fourth layer — tennis-court-sized (21 × 14 m) when deployed",                    grp: "shield",  vec: [-3, -13, 0],num: 7, anchor: [0, -6.2, 0],draw: () => shieldLayer(-6.2, 0.94) },
  { id: "shield5",   name: "Sunshield — Layer 5", role: "the coldest, telescope-side membrane — holds the cold side below 50 K (−223 °C)", grp: "shield",  vec: [3, -16, 0], num: 8, anchor: [0, -7.6, 0],draw: () => shieldLayer(-7.6, 0.92, "lo") },
  { id: "bus",       name: "Spacecraft Bus",      role: "the warm Sun-side body — computers, gyros, propulsion, momentum wheels",         grp: "bus",     vec: [0, -20, 6], num: 9, anchor: [0, -11, 0], lit: true, draw: () => bus(-11) },
  { id: "solar",     name: "Solar Array + Antenna",role: "powers the observatory + the high-gain dish that beams data home via the DSN", grp: "bus",     vec: [16, -14, 0],num: 10,anchor: [7, -10, 0], draw: () => solar(-11) },
];

// ---- labels overlay (balanced columns + robust de-collision, as in Hubble) --
function labelOverlay() {
  const out = [];
  PARTS.forEach((s, i) => {
    const side = i % 2 === 0 ? -1 : 1;
    out.push(
      `<g class="jw-label" data-label="${s.id}" data-side="${side < 0 ? "l" : "r"}" opacity="0">` +
        `<line class="jw-leader" x1="0" y1="0" x2="0" y2="0"/>` +
        `<circle class="jw-ldot" r="1.6"/>` +
        `<g class="jw-card">` +
          `<text class="jw-num" y="-5">${String(s.num).padStart(2, "0")}</text>` +
          `<text class="jw-name" y="6">${s.name}</text>` +
          `<text class="jw-role" y="17">${s.role}</text>` +
        `</g>` +
      `</g>`,
    );
  });
  return `<svg xmlns="http://www.w3.org/2000/svg" class="iso-svg jw-labels" viewBox="0 0 ${WIDTH} ${HEIGHT}" aria-hidden="true">${out.join("")}</svg>`;
}

const part = (id, inner) => `<g data-part="${id}" transform="${k.translateAlong(P, [0, 0, 0])}">${inner}</g>`;

const svg = k.figureSvg({
  width: WIDTH, height: HEIGHT, className: "jw-fig",
  label: "The James Webb Space Telescope, taken apart into its real assemblies — the secondary mirror on its tripod, the 18-segment hexagonal primary mirror, the ISIM instrument module, the five sunshield membranes, the spacecraft bus, and the solar array + antenna. Hover to take it apart; each part is a real, named Webb element.",
  body: PARTS.map((s) => part(s.id, s.draw())),
});

const live = `
(function(){
  const PARTS = ${JSON.stringify(PARTS.map((s) => ({ id: s.id, name: s.name, role: s.role, vec: s.vec, anchor: s.anchor, grp: s.grp, num: s.num })))};
  const P = ${JSON.stringify(P)};
  const SPRING = { stagger: 0.03, stiffness: 70, damping: 15, substeps: 4 };
  const root = document.getElementById("jwfig");
  if (!root) return;
  const stage = root.querySelector(".iso-stage");
  const svg = stage.querySelector("svg.iso-svg:not(.jw-labels)") || stage.querySelector("svg");
  const labelSvg = stage.querySelector(".jw-labels");
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
        g.querySelector(".jw-card").setAttribute("transform","translate("+cx+" "+cy+")");
        const leader=g.querySelector(".jw-leader");
        leader.setAttribute("x1",ax); leader.setAttribute("y1",ay);
        leader.setAttribute("x2", side<0?150:${WIDTH}-150); leader.setAttribute("y2",cy);
        const dot=g.querySelector(".jw-ldot"); dot.setAttribute("cx",ax); dot.setAttribute("cy",ay);
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
    else if(open>0.9) text="apart · 10 real Webb elements";
    else text="the James Webb Space Telescope · assembled";
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
    if(readout) readout.textContent=selected?DETAIL[selected]:(maxOpen()>0.5?"apart · tap a part":"the James Webb Space Telescope · assembled");
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
  fig: "JWST",
  title: "James Webb Space Telescope",
  hint: "Hover or tap to take it apart · tap a part to name it",
  readout: "the James Webb Space Telescope · assembled",
  keys: [
    { mark: "lit", label: "The cold side: 18-segment gold mirror + instruments, held at ~40 K" },
    { mark: "raised", label: "10 real elements — the optics, the 5-layer sunshield, the warm bus" },
  ],
  caption:
    "The James Webb Space Telescope, part by part. Everything above the sunshield is kept brutally cold (~40 K) so its own heat doesn't blind it in the infrared: the 18 hexagonal gold-coated segments of the 6.5 m primary, the secondary on its tripod, and the instruments behind the mirror. Everything below the five-layer, tennis-court-sized sunshield stays warm in the Sun — the spacecraft bus, solar array and antenna. Hover to lift every real element clear, then tap any part to read what it is.",
  body: `<div class="iso-stage" tabindex="0" role="button" aria-label="James Webb Space Telescope exploded teardown: press Enter to take it apart">${svg}${labelOverlay()}</div>`,
});
const stageHtml = `<div id="jwfig" class="jw-figroot">${card}</div>`;

const EXTRA_CSS = `
/* BLEND IN (Ankur: "nothing should be separate"): strip the plate card chrome —
   no background, no border box, transparent page — so the figure floats directly
   on the host section instead of sitting in a boxed widget. Keep the readout. */
html, body { background: transparent !important; }
.iso-page { margin: 0 auto !important; width: 100% !important; }
.iso-figure { margin: 0 !important; }
.iso-plate { background: transparent !important; box-shadow: none !important; padding: 20px 8px !important; --anatomy-paper: transparent !important; }
.iso-plate-corner[data-corner="fig"], .iso-plate-corner[data-corner="title"], .iso-plate-corner[data-corner="hint"] { display: none; }
.iso-legend { display: none; }
.jw-figroot{position:relative}
.iso-stage{position:relative}
.jw-labels{position:absolute;inset:0;pointer-events:none}
.jw-leader{stroke:var(--anatomy-lo);stroke-width:.8}
.jw-ldot{fill:var(--anatomy-mid)}
.jw-card .jw-num{fill:var(--anatomy-faint);font-family:var(--anatomy-mono);font-size:9px;letter-spacing:.08em}
.jw-card .jw-name{fill:var(--anatomy-hi);font-family:var(--anatomy-mono);font-size:11px;letter-spacing:.02em}
.jw-card .jw-role{fill:var(--anatomy-mid);font-family:var(--anatomy-mono);font-size:8.5px;letter-spacing:.01em}
.jw-label[data-side="l"] .jw-card text{text-anchor:start}
.jw-label[data-side="r"] .jw-card text{text-anchor:end}
`;

const outName = `jwst-teardown${theme === "light" ? "-light" : ""}.html`;
writeFileSync(join(HERE, outName), k.pageHtml({ title: "JWST teardown", theme, body: `<style>${EXTRA_CSS}</style>${stageHtml}`, script: kitScript() + live, width: 1180 }));
console.log("wrote", outName);
