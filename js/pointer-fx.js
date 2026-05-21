// Pointer FX — cursor-following spotlight + per-card tilt/glow.
// No-op on touch devices and under prefers-reduced-motion.
(function () {
  if (!window.matchMedia) return;
  if (window.matchMedia('(hover: none)').matches) return;
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  var root = document.documentElement;
  var rafId = null;
  var lastX = window.innerWidth / 2;
  var lastY = window.innerHeight / 2;

  function applyGlobal() {
    rafId = null;
    root.style.setProperty('--px', lastX + 'px');
    root.style.setProperty('--py', lastY + 'px');
  }

  window.addEventListener('pointermove', function (e) {
    lastX = e.clientX;
    lastY = e.clientY;
    if (rafId === null) rafId = requestAnimationFrame(applyGlobal);
  }, { passive: true });

  // Per-card tilt + glow
  var cardSelectors = [
    '.arc-beat',
    '.open-source-card',
    'a.card-hover-link',
    '.chip-tile',
    '.intro-cta-primary',
    '.intro-cta-secondary'
  ].join(', ');

  document.querySelectorAll(cardSelectors).forEach(function (el) {
    var cardRaf = null;
    var nextX = 0.5, nextY = 0.5;

    function applyCard() {
      cardRaf = null;
      el.style.setProperty('--tilt-x', ((nextY - 0.5) * -5).toFixed(2) + 'deg');
      el.style.setProperty('--tilt-y', ((nextX - 0.5) * 5).toFixed(2) + 'deg');
      el.style.setProperty('--glow-x', (nextX * 100).toFixed(1) + '%');
      el.style.setProperty('--glow-y', (nextY * 100).toFixed(1) + '%');
    }

    el.addEventListener('pointermove', function (e) {
      var r = el.getBoundingClientRect();
      nextX = (e.clientX - r.left) / r.width;
      nextY = (e.clientY - r.top) / r.height;
      if (cardRaf === null) cardRaf = requestAnimationFrame(applyCard);
    }, { passive: true });

    el.addEventListener('pointerleave', function () {
      el.style.setProperty('--tilt-x', '0deg');
      el.style.setProperty('--tilt-y', '0deg');
    });
  });
})();
