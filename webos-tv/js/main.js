/* Universe Engine TV — launcher logic.
 *
 * QA contract (LG Pretest):
 *  - 5-way: one focusable control (Enter the sky), autofocused; OK activates.
 *  - Back (keyCode 461) on this page exits the app via window.close().
 *  - Network loss shows a clear message + OK retries (no silent hang).
 *
 * The sky itself is the live engine at sinhaankur.com/sky?tv=1 (that page
 * handles OK = piano toggle and Back = exit once loaded). Keeping the engine
 * hosted means every fidelity improvement ships to TVs with no app update.
 */
(function () {
  "use strict";

  var SKY_URL = "https://www.sinhaankur.com/sky?tv=1";
  var PING_URL = "https://www.sinhaankur.com/favicon.ico";
  var btn = document.getElementById("enterBtn");
  var status = document.getElementById("statusText");
  var checking = false;

  function setStatus(text) {
    if (status) status.textContent = text;
  }

  function enter() {
    if (checking) return;
    checking = true;
    setStatus("Opening the sky…");
    // Connectivity gate: a tiny fetch with a timeout. Online -> go; offline ->
    // honest message + retry on OK.
    var done = false;
    var timer = setTimeout(function () {
      if (done) return;
      done = true;
      checking = false;
      setStatus("No connection — the sky needs the internet. Press OK to try again.");
    }, 6000);
    fetch(PING_URL + "?t=" + Date.now(), { mode: "no-cors", cache: "no-store" })
      .then(function () {
        if (done) return;
        done = true;
        clearTimeout(timer);
        window.location.href = SKY_URL;
      })
      .catch(function () {
        if (done) return;
        done = true;
        clearTimeout(timer);
        checking = false;
        setStatus("No connection — the sky needs the internet. Press OK to try again.");
      });
  }

  if (btn) {
    btn.addEventListener("click", enter);
    btn.focus();
  }

  document.addEventListener("keydown", function (e) {
    if (e.keyCode === 461) {
      // webOS remote Back: exit the app from the launcher.
      e.preventDefault();
      window.close();
    } else if (e.keyCode === 13) {
      enter();
    }
  });
})();
