/* gaze-control.js — OPT-IN, on-device "play with your eyes" for the Simple Games.
 *
 * Off by default. When the player taps the 👁 button, we ask for the webcam and
 * try to drive a soft on-screen cursor from where their FACE is pointing, and
 * fire a "smile" signal when they smile. Everything runs locally in the browser
 * (getUserMedia + the native FaceDetector where available) — no frames ever
 * leave the device, nothing is recorded or uploaded.
 *
 * Because real gaze estimation needs a heavy model, this uses a deliberately
 * simple, honest heuristic: the face's horizontal/vertical offset from centre
 * maps to a cursor, and FaceDetector's landmark spread hints at a smile. It's a
 * fun accessibility toy, not medical-grade eye tracking — and it degrades to a
 * clear "not supported on this browser" message instead of breaking the game.
 *
 * API:
 *   GazeControl.attach({
 *     onMove(xNorm, yNorm),   // 0..1 across the frame; a soft-smoothed cursor
 *     onSmile(),              // fired once per smile (debounced)
 *     onStatus(msg, ok),      // status text for the banner
 *   })
 *   GazeControl.toggle()      // start/stop; returns the new on-state (bool)
 *   GazeControl.active        // current on-state
 */
(function () {
  "use strict";

  var video = null, stream = null, detector = null, raf = null;
  var cbs = { onMove: null, onSmile: null, onStatus: null };
  var smoothing = { x: 0.5, y: 0.5 };
  var lastSmile = 0;
  var api = { active: false };

  function status(msg, ok) { if (cbs.onStatus) cbs.onStatus(msg, ok); }

  function attach(callbacks) { cbs = Object.assign(cbs, callbacks || {}); }

  async function start() {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      status("Camera not available on this browser", false);
      return false;
    }
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: 320, height: 240 }, audio: false,
      });
    } catch (e) {
      status("Camera permission denied", false);
      return false;
    }
    video = document.createElement("video");
    video.setAttribute("playsinline", "");
    video.muted = true;
    video.srcObject = stream;
    await video.play().catch(function () {});

    if ("FaceDetector" in window) {
      try { detector = new window.FaceDetector({ fastMode: true, maxDetectedFaces: 1 }); }
      catch (e) { detector = null; }
    }
    if (!detector) {
      // no face model → we can still show the camera is on, but movement won't
      // be reliable. Be honest about it.
      status("Eye-control isn't supported here — using taps", false);
      stop();
      return false;
    }
    api.active = true;
    status("Move your head to aim · smile to act", true);
    loop();
    return true;
  }

  function stop() {
    api.active = false;
    if (raf) cancelAnimationFrame(raf), (raf = null);
    if (stream) { stream.getTracks().forEach(function (t) { t.stop(); }); stream = null; }
    if (video) { video.srcObject = null; video = null; }
    detector = null;
  }

  async function loop() {
    if (!api.active || !video || !detector) return;
    try {
      var faces = await detector.detect(video);
      if (faces && faces.length) {
        var f = faces[0].boundingBox;
        var vw = video.videoWidth || 320, vh = video.videoHeight || 240;
        // face centre, normalised; mirror X so leaning right moves the cursor right
        var cx = 1 - (f.x + f.width / 2) / vw;
        var cy = (f.y + f.height / 2) / vh;
        // amplify around centre so small head moves reach the edges
        cx = Math.min(1, Math.max(0, (cx - 0.5) * 1.8 + 0.5));
        cy = Math.min(1, Math.max(0, (cy - 0.5) * 1.8 + 0.5));
        smoothing.x += (cx - smoothing.x) * 0.25;
        smoothing.y += (cy - smoothing.y) * 0.25;
        if (cbs.onMove) cbs.onMove(smoothing.x, smoothing.y);

        // smile heuristic: FaceDetector landmarks (mouth) width vs face width.
        var lm = faces[0].landmarks || [];
        var mouth = lm.filter(function (l) { return l.type === "mouth"; });
        if (mouth.length >= 2) {
          var mw = Math.hypot(mouth[0].locations[0].x - mouth[1].locations[0].x,
                              mouth[0].locations[0].y - mouth[1].locations[0].y);
          var ratio = mw / (f.width || 1);
          var now = performance.now();
          if (ratio > 0.42 && now - lastSmile > 900) {
            lastSmile = now;
            if (cbs.onSmile) cbs.onSmile();
          }
        }
      }
    } catch (e) { /* transient detect error — keep looping */ }
    raf = requestAnimationFrame(loop);
  }

  function toggle() {
    if (api.active) { stop(); status("Eye-control off", true); return false; }
    start();
    return true; // start is async; caller re-reads api.active
  }

  window.GazeControl = { attach: attach, toggle: toggle, get active() { return api.active; } };
})();
