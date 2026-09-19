/* Shared fullscreen toggle for the mini-games.
 *
 * Drops a small ⛶ button in the top-right corner that enters/exits true
 * fullscreen via the Fullscreen API. Works on Android Chrome, desktop, and
 * most browsers. iPhone Safari does NOT support element fullscreen — there the
 * button hides itself, because the games already use a 100dvh full-bleed layout
 * that fills the screen anyway (add to Home Screen for a truly chromeless view).
 *
 * Self-contained: no dependencies, no framework. Just include this script.
 */
(function () {
  "use strict";

  var docEl = document.documentElement;

  function fsElement() {
    return document.fullscreenElement || document.webkitFullscreenElement || null;
  }
  function canFullscreen() {
    return !!(docEl.requestFullscreen || docEl.webkitRequestFullscreen);
  }
  function enter() {
    var el = docEl;
    if (el.requestFullscreen) return el.requestFullscreen().catch(function () {});
    if (el.webkitRequestFullscreen) return el.webkitRequestFullscreen();
  }
  function exit() {
    if (document.exitFullscreen) return document.exitFullscreen().catch(function () {});
    if (document.webkitExitFullscreen) return document.webkitExitFullscreen();
  }

  function build() {
    // iPhone Safari can't do element fullscreen — don't show a dead button.
    if (!canFullscreen()) return;

    var btn = document.createElement("button");
    btn.id = "fsToggle";
    btn.type = "button";
    btn.setAttribute("aria-label", "Toggle fullscreen");
    btn.title = "Fullscreen";
    btn.textContent = "⛶";
    btn.style.cssText = [
      "position:fixed",
      "top:calc(env(safe-area-inset-top,0px) + 10px)",
      "right:calc(env(safe-area-inset-right,0px) + 10px)",
      "z-index:2147483000",
      "width:40px", "height:40px",
      "display:flex", "align-items:center", "justify-content:center",
      "font-size:18px", "line-height:1",
      "cursor:pointer",
      "border-radius:10px",
      "border:2px solid rgba(128,128,128,.5)",
      "background:rgba(0,0,0,.35)",
      "color:#fff",
      "backdrop-filter:blur(6px)",
      "-webkit-backdrop-filter:blur(6px)",
      "-webkit-tap-highlight-color:transparent",
      "touch-action:manipulation"
    ].join(";");

    btn.addEventListener("click", function (e) {
      e.preventDefault();
      if (fsElement()) exit(); else enter();
    });

    function sync() { btn.textContent = fsElement() ? "⤢" : "⛶"; }
    document.addEventListener("fullscreenchange", sync);
    document.addEventListener("webkitfullscreenchange", sync);

    document.body.appendChild(btn);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", build);
  } else {
    build();
  }
})();
