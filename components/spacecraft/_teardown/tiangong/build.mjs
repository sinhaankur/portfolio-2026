// Tiangong Space Station — isometric part-by-part exploded teardown.
// Standalone HTML. Same engine/label/explode/blend mechanics as the other
// teardowns; Tiangong's EXACT real configuration.
//
// Truth (Wikipedia / CMSA, verified 2026-11-05): a T-shaped station ~55.6 m long,
// ~100 t. The TIANHE core module (16.6 m × 4.2 m) sits at the centre with a
// forward node + three docking ports. Two lab modules hang off its sides to form
// the T: WENTIAN (17.9 m, starboard) and MENGTIAN (17.9 m, port). Each module
// carries two steerable flexible SOLAR ARRAYS. A 10 m core robotic ARM + a 5 m
// experiment arm walk the exterior. Visiting SHENZHOU (crew) + TIANZHOU (cargo)
// dock at the node. Each part here is a real, named Tiangong element.
import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { homedir } from "node:os";

const KIT = join(homedir(), ".claude", "skills", "anatomy");
const k = await import(pathToFileURL(join(KIT, "kit", "iso-kit.mjs")).href);
const { kitScript } = await import(pathToFileURL(join(KIT, "scripts", "inline-kit.mjs")).href);

const HERE = dirname(fileURLToPath(import.meta.url));
const theme = process.argv.includes("--light") ? "light" : "dark";

// ---- world layout (units ~ 0.9 m) -----------------------------------------
// z = fore/aft along the core module. x = the T cross-bar (lab modules). y = up.
const WIDTH = 1120, HEIGHT = 600;
const FIG_W = 820;
const MARGIN = (WIDTH - FIG_W) / 2;
const RCORE = 2.3;            // module radius (schematic)
const CORE_LEN = 18;         // Tianhe length along z
const LAB_LEN = 19;          // lab module length

const Pc = k.fitProjection(
  [
    [0, 0, -CORE_LEN / 2 - 4], [0, 0, CORE_LEN / 2 + 6],
    [-LAB_LEN - 2, 0, 0], [LAB_LEN + 2, 0, 0],     // the T cross-bar labs
    [0, 12, 0], [0, -12, 0],                        // solar arrays up/down
  ],
  FIG_W, HEIGHT,
  { pad: 20, headroom: 140, azimuth: 42, elevation: 24 },
);
const P = { ...Pc, origin: [Pc.origin[0] + MARGIN, Pc.origin[1]] };

const at = (p) => k.iso(p, P);
const S = (paths, style) => k.solidSvg(paths, style);
const L = (d, style) => k.lineSvg(d, style);
const px = (p) => k.iso(p, P);

// a cylindrical module along z, centred (cz), length len — Tianhe + the node.
function moduleZ(cz, len, rad = RCORE, tone = "mid", lit = false) {
  const plan = { x: -rad, y: cz - len / 2, w: rad * 2, d: len, r: rad * 0.95 };
  const out = [S(k.slabOf(plan, -rad, rad * 2, P, 10, 0.4), { tone, lit })];
  for (const t of [0.3, 0.7]) {
    const zz = cz - len / 2 + len * t;
    out.push(L(k.planOutline({ x: -rad, y: zz - 0.12, w: rad * 2, d: 0.24, r: rad * 0.95 }, rad, P, 10), { tone: "lo" }));
  }
  return out.join("");
}

// a cylindrical module along x (the lab modules forming the T cross-bar), centred (cx)
function moduleX(cx, len, rad = RCORE, tone = "mid", lit = false) {
  // build in z-oriented local then it reads as the cross-bar: use a slab whose
  // long axis is x by swapping plan dims
  const plan = { x: cx - len / 2, y: -rad, w: len, d: rad * 2, r: rad * 0.95 };
  const out = [S(k.slabOf(plan, -rad, rad * 2, P, 10, 0.4), { tone, lit })];
  for (const t of [0.3, 0.7]) {
    const xx = cx - len / 2 + len * t;
    out.push(L(k.planOutline({ x: xx - 0.12, y: -rad, w: 0.24, d: rad * 2, r: rad * 0.95 }, rad, P, 10), { tone: "lo" }));
  }
  return out.join("");
}

// a pair of solar array wings off a module end, extending in ±y
function solarPair(cx, cz, along = "z") {
  const out = [];
  const w = 4.5, len = 9;
  for (const dir of [+1, -1]) {
    const y0 = dir > 0 ? RCORE + 0.6 : -(RCORE + 0.6);
    const yB = dir > 0 ? RCORE + 0.6 + len : -(RCORE + 0.6 + len);
    // panel spans along the module axis
    const corners = along === "z"
      ? [at([cx - w / 2, y0, cz]), at([cx + w / 2, y0, cz]), at([cx + w / 2, yB, cz]), at([cx - w / 2, yB, cz])]
      : [at([cx, y0, -w / 2]), at([cx, y0, w / 2]), at([cx, yB, w / 2]), at([cx, yB, -w / 2])];
    out.push(`<path class="iso-fill" d="${k.pathOf(corners, true)}" style="fill:var(--anatomy-shade-1)"/>`);
    out.push(L(k.pathOf(corners, true), { tone: "mid" }));
    for (let i = 1; i < 5; i++) {
      const t = i / 5, yy = y0 + (yB - y0) * t;
      const row = along === "z"
        ? [at([cx - w / 2, yy, cz]), at([cx + w / 2, yy, cz])]
        : [at([cx, yy, -w / 2]), at([cx, yy, w / 2])];
      out.push(L(k.pathOf(row), { tone: "faint" }));
    }
  }
  return out.join("");
}

// the forward docking node — a short ring with ports at the core's forward end
function node(cz) {
  const out = [S(k.cylinder(0, cz, RCORE * 0.8, -1.4, 2.8, P, 16), { tone: "hi", lit: true })];
  return out.join("");
}

// robotic arm — a jointed line walking along the core
function arm() {
  const pts = [[0, RCORE, 2], [3, RCORE + 2, 1], [7, RCORE + 1, -1], [10, RCORE + 3, -3]];
  const out = [];
  for (let i = 0; i < pts.length - 1; i++) {
    out.push(L(k.pathOf([at(pts[i]), at(pts[i + 1])]), { tone: "hi" }));
    out.push(k.dotsSvg([at(pts[i])], { size: 0.6, tone: "hi" }));
  }
  out.push(k.dotsSvg([at(pts[pts.length - 1])], { size: 0.6, tone: "hi" }));
  return out.join("");
}

// a visiting craft (Shenzhou / Tianzhou) — a small capsule+module at a port
function visitor(cz) {
  const out = [S(k.cylinder(0, cz, 1.4, -1.0, 3.2, P, 14), { tone: "mid" })];
  out.push(S(k.cylinder(0, cz - 2.0, 1.1, -1.0, 1.4, P, 14), { tone: "lo" }));
  return out.join("");
}

// ---- the parts: real Tiangong elements, exploded ---------------------------
const PARTS = [
  { id: "tianhe",   name: "Tianhe (Core Module)",  role: "16.6 m core — crew quarters, control, propulsion; the T's centre",          grp: "module",  vec: [0, -12, 0], num: 1, anchor: [0, 0, 0],                 lit: true, draw: () => moduleZ(0, CORE_LEN, RCORE, "mid", true) },
  { id: "node",     name: "Forward Node + Ports",  role: "the docking hub — 3 Chinese docking ports for crew + cargo ships",          grp: "docking", vec: [0, 8, 14],  num: 2, anchor: [0, 0, CORE_LEN / 2 + 1.6], draw: () => node(CORE_LEN / 2 + 1.6) },
  { id: "wentian",  name: "Wentian (Lab, Stbd)",   role: "17.9 m science lab + airlock + a backup control post — the T's right arm",  grp: "module",  vec: [18, -4, 0], num: 3, anchor: [LAB_LEN / 2 + RCORE, 0, 0], draw: () => moduleX(LAB_LEN / 2 + RCORE, LAB_LEN) },
  { id: "mengtian", name: "Mengtian (Lab, Port)",  role: "17.9 m science lab — microgravity experiment cabinets + a payload airlock", grp: "module",  vec: [-18, -4, 0],num: 4, anchor: [-(LAB_LEN / 2 + RCORE), 0, 0], draw: () => moduleX(-(LAB_LEN / 2 + RCORE), LAB_LEN) },
  { id: "sa-core",  name: "Solar Arrays — Core",   role: "two steerable flexible wings on Tianhe — Sun-tracking for power",            grp: "power",   vec: [0, 16, -6], num: 5, anchor: [0, 8, -CORE_LEN / 2 + 3], draw: () => solarPair(0, -CORE_LEN / 2 + 3, "z") },
  { id: "sa-wen",   name: "Solar Arrays — Wentian",role: "the starboard lab's two wings — each module makes its own power",            grp: "power",   vec: [16, 14, 0], num: 6, anchor: [LAB_LEN + RCORE, 8, 0], draw: () => solarPair(LAB_LEN + RCORE - 1, 0, "x") },
  { id: "sa-meng",  name: "Solar Arrays — Mengtian",role:"the port lab's two wings — ~340 m³ of pressurised volume to keep lit",       grp: "power",   vec: [-16, 14, 0],num: 7, anchor: [-(LAB_LEN + RCORE), 8, 0], draw: () => solarPair(-(LAB_LEN + RCORE - 1), 0, "x") },
  { id: "arm",      name: "Robotic Arm (CMM)",     role: "10 m Core Module Manipulator — walks the hull to berth modules + payloads", grp: "robotics",vec: [6, 12, 4],  num: 8, anchor: [5, RCORE + 2, 0], draw: () => arm() },
  { id: "shenzhou", name: "Shenzhou (crew)",       role: "the crew ferry docked at the node — three taikonauts up and back",           grp: "visiting",vec: [0, 4, 20],  num: 9, anchor: [0, 0, CORE_LEN / 2 + 6], draw: () => visitor(CORE_LEN / 2 + 6) },
  { id: "tianzhou", name: "Tianzhou (cargo)",      role: "the robotic cargo freighter — fuel, water, experiments; reboosts the station", grp: "visiting",vec: [0, -8, -18],num: 10,anchor: [0, 0, -CORE_LEN / 2 - 4], draw: () => visitor(-CORE_LEN / 2 - 4) },
];

// ---- labels overlay (balanced + robust de-collision) -----------------------
function labelOverlay() {
  const out = [];
  PARTS.forEach((s, i) => {
    const side = i % 2 === 0 ? -1 : 1;
    out.push(
      `<g class="tg-label" data-label="${s.id}" data-side="${side < 0 ? "l" : "r"}" opacity="0">` +
        `<line class="tg-leader" x1="0" y1="0" x2="0" y2="0"/>` +
        `<circle class="tg-ldot" r="1.6"/>` +
        `<g class="tg-card">` +
          `<text class="tg-num" y="-5">${String(s.num).padStart(2, "0")}</text>` +
          `<text class="tg-name" y="6">${s.name}</text>` +
          `<text class="tg-role" y="17">${s.role}</text>` +
        `</g>` +
      `</g>`,
    );
  });
  return `<svg xmlns="http://www.w3.org/2000/svg" class="iso-svg tg-labels" viewBox="0 0 ${WIDTH} ${HEIGHT}" aria-hidden="true">${out.join("")}</svg>`;
}

const part = (id, inner) => `<g data-part="${id}" transform="${k.translateAlong(P, [0, 0, 0])}">${inner}</g>`;

const svg = k.figureSvg({
  width: WIDTH, height: HEIGHT, className: "tg-fig",
  label: "The Tiangong space station, taken apart into its real assemblies — the Tianhe core module, the forward docking node, the Wentian and Mengtian lab modules forming the T, the steerable solar arrays, the robotic arm, and the visiting Shenzhou crew + Tianzhou cargo ships. Hover to take it apart; each part is a real, named Tiangong element.",
  body: PARTS.map((s) => part(s.id, s.draw())),
});

const live = `
(function(){
  const PARTS = ${JSON.stringify(PARTS.map((s) => ({ id: s.id, name: s.name, role: s.role, vec: s.vec, anchor: s.anchor, grp: s.grp, num: s.num })))};
  const P = ${JSON.stringify(P)};
  const SPRING = { stagger: 0.03, stiffness: 70, damping: 15, substeps: 4 };
  const root = document.getElementById("tgfig");
  if (!root) return;
  const stage = root.querySelector(".iso-stage");
  const svg = stage.querySelector("svg.iso-svg:not(.tg-labels)") || stage.querySelector("svg");
  const labelSvg = stage.querySelector(".tg-labels");
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
        g.querySelector(".tg-card").setAttribute("transform","translate("+cx+" "+cy+")");
        const leader=g.querySelector(".tg-leader");
        leader.setAttribute("x1",ax); leader.setAttribute("y1",ay);
        leader.setAttribute("x2", side<0?150:${WIDTH}-150); leader.setAttribute("y2",cy);
        const dot=g.querySelector(".tg-ldot"); dot.setAttribute("cx",ax); dot.setAttribute("cy",ay);
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
    else if(open>0.9) text="apart · 10 real Tiangong elements";
    else text="the Tiangong Space Station · assembled";
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
    if(readout) readout.textContent=selected?DETAIL[selected]:(maxOpen()>0.5?"apart · tap a part":"the Tiangong Space Station · assembled");
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
  fig: "CSS",
  title: "Tiangong Space Station",
  hint: "Hover or tap to take it apart · tap a part to name it",
  readout: "the Tiangong Space Station · assembled",
  keys: [
    { mark: "lit", label: "The T: Tianhe core in the centre, Wentian + Mengtian labs on the arms" },
    { mark: "raised", label: "10 real elements — the 3 modules, docking node, solar arrays, arm + visiting ships" },
  ],
  caption:
    "Tiangong, China's space station, part by part. It's a T: the Tianhe core module runs fore-and-aft with the crew quarters and a three-port docking node at the front, and the two science labs — Wentian and Mengtian — hang off its sides to make the crossbar. Every module carries its own pair of steerable solar wings; a 10-metre robotic arm walks the hull; and Shenzhou crew ships + Tianzhou cargo freighters come and go at the node. Hover to lift every real element clear, then tap any part to read what it is.",
  body: `<div class="iso-stage" tabindex="0" role="button" aria-label="Tiangong space station exploded teardown: press Enter to take it apart">${svg}${labelOverlay()}</div>`,
});
const stageHtml = `<div id="tgfig" class="tg-figroot">${card}</div>`;

const EXTRA_CSS = `
/* BLEND IN: strip the plate card chrome so the figure floats on the host page. */
html, body { background: transparent !important; }
.iso-page { margin: 0 auto !important; width: 100% !important; }
.iso-figure { margin: 0 !important; }
.iso-plate { background: transparent !important; box-shadow: none !important; padding: 20px 8px !important; --anatomy-paper: transparent !important; }
.iso-plate-corner[data-corner="fig"], .iso-plate-corner[data-corner="title"], .iso-plate-corner[data-corner="hint"] { display: none; }
.iso-legend { display: none; }
.tg-figroot{position:relative}
.iso-stage{position:relative}
.tg-labels{position:absolute;inset:0;pointer-events:none}
.tg-leader{stroke:var(--anatomy-lo);stroke-width:.8}
.tg-ldot{fill:var(--anatomy-mid)}
.tg-card .tg-num{fill:var(--anatomy-faint);font-family:var(--anatomy-mono);font-size:9px;letter-spacing:.08em}
.tg-card .tg-name{fill:var(--anatomy-hi);font-family:var(--anatomy-mono);font-size:11px;letter-spacing:.02em}
.tg-card .tg-role{fill:var(--anatomy-mid);font-family:var(--anatomy-mono);font-size:8.5px;letter-spacing:.01em}
.tg-label[data-side="l"] .tg-card text{text-anchor:start}
.tg-label[data-side="r"] .tg-card text{text-anchor:end}
`;

const outName = `tiangong-teardown${theme === "light" ? "-light" : ""}.html`;
writeFileSync(join(HERE, outName), k.pageHtml({ title: "Tiangong teardown", theme, body: `<style>${EXTRA_CSS}</style>${stageHtml}`, script: kitScript() + live, width: 1180 }));
console.log("wrote", outName);
