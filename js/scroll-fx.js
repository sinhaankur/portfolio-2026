// Scroll FX — toggles .is-in-view on observed elements as they enter the viewport.
// CSS does all the visual work; this just flips the class.
// No-op under prefers-reduced-motion or when IntersectionObserver is missing.
(function () {
  if (!('IntersectionObserver' in window)) {
    document.querySelectorAll('[data-scroll-fx]').forEach(function (el) {
      el.classList.add('is-in-view');
    });
    return;
  }
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    document.querySelectorAll('[data-scroll-fx]').forEach(function (el) {
      el.classList.add('is-in-view');
    });
    return;
  }

  var io = new IntersectionObserver(function (entries) {
    entries.forEach(function (entry) {
      if (entry.isIntersecting) {
        entry.target.classList.add('is-in-view');
        io.unobserve(entry.target);
      }
    });
  }, { threshold: 0.18, rootMargin: '0px 0px -60px 0px' });

  // Default selectors that should animate in when scrolled to
  var selectors = [
    '.arc-section',
    '.unhosted-card',
    '.experience-overview',
    '.open-source-card',
    '[data-scroll-fx]'
  ];
  selectors.forEach(function (sel) {
    document.querySelectorAll(sel).forEach(function (el) {
      io.observe(el);
    });
  });
})();
