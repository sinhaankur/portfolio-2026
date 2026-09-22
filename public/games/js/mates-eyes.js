/* mates-eyes.js — the friendly "watching eyes" used across the Simple Games.
 *
 * Two things, no dependencies:
 *   1. MatesEyes.make(host)  → builds a little face (two eyes) inside `host`
 *      whose pupils follow the pointer / gaze cursor, blink on their own, and
 *      can be told a mood (happy / sad). This is the charm from Blockmates,
 *      reusable anywhere.
 *   2. MatesEyes.track(x, y) → feed it the current pointer position (client
 *      coords). Every registered face aims its pupils toward that point.
 *
 * All drawn art is original + generated in code; no images.
 */
(function () {
  "use strict";

  var faces = [];   // { el, eyes:[{eye,pupil}], mood }
  var target = null; // {x,y} client-space point the eyes look toward

  function el(tag, cls) { var e = document.createElement(tag); if (cls) e.className = cls; return e; }

  function make(host, opts) {
    opts = opts || {};
    var n = opts.eyes || 2;
    var face = el("div", "face");
    var eyes = el("div", "eyes");
    var rec = { el: face, eyes: [], mood: "idle" };
    for (var i = 0; i < n; i++) {
      var eye = el("div", "eye");
      var pupil = el("div", "pupil");
      eye.appendChild(pupil);
      eyes.appendChild(eye);
      rec.eyes.push({ eye: eye, pupil: pupil });
    }
    face.appendChild(eyes);
    host.appendChild(face);
    faces.push(rec);
    // occasional blink
    scheduleBlink(rec);
    return rec;
  }

  function scheduleBlink(rec) {
    var t = 2200 + Math.random() * 3600;
    setTimeout(function () {
      rec.eyes.forEach(function (e) {
        e.eye.style.animation = "af-blink .18s ease";
        setTimeout(function () { e.eye.style.animation = ""; }, 200);
      });
      scheduleBlink(rec);
    }, t);
  }

  function track(x, y) { target = { x: x, y: y }; }

  function mood(rec, m) {
    if (rec) rec.mood = m;
  }

  // aim every pupil toward `target` each frame
  function tick() {
    if (target) {
      for (var i = 0; i < faces.length; i++) {
        var rec = faces[i];
        for (var j = 0; j < rec.eyes.length; j++) {
          var e = rec.eyes[j];
          var r = e.eye.getBoundingClientRect();
          if (!r.width) continue;
          var cx = r.left + r.width / 2, cy = r.top + r.height / 2;
          var dx = target.x - cx, dy = target.y - cy;
          var d = Math.hypot(dx, dy) || 1;
          var reach = r.width * 0.22;
          var px = (dx / d) * reach, py = (dy / d) * reach;
          e.pupil.style.transform = "translate(" + px.toFixed(1) + "px," + py.toFixed(1) + "px)";
        }
      }
    }
    requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);

  // Default: any pointer move on the page feeds the eyes (games can also call
  // MatesEyes.track directly, e.g. with a gaze cursor).
  window.addEventListener("pointermove", function (e) { track(e.clientX, e.clientY); }, { passive: true });
  window.addEventListener("touchmove", function (e) {
    if (e.touches && e.touches[0]) track(e.touches[0].clientX, e.touches[0].clientY);
  }, { passive: true });

  window.MatesEyes = { make: make, track: track, mood: mood };
})();
