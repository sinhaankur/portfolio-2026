// Directional cross-document page transitions using the View Transitions API
// + pageswap / pagereveal events. Falls back silently to the default
// @view-transition cross-fade (defined in css/style.css) when these events
// are unsupported (Safari ≤18, Firefox).

const isCaseStudy = (pathname) => /\/projects\//.test(pathname);

const directionFor = (fromPath, toPath) => {
  const fromIsCase = isCaseStudy(fromPath);
  const toIsCase = isCaseStudy(toPath);
  if (toIsCase && !fromIsCase) return "forward";
  if (fromIsCase && !toIsCase) return "back";
  return "lateral";
};

const setDirection = (dir) => {
  document.documentElement.dataset.viewDirection = dir;
};

const safeUrl = (raw) => {
  try {
    return new URL(raw, location.href);
  } catch (_) {
    return null;
  }
};

// Outgoing page: read where we're going, tag the root before the snapshot.
window.addEventListener("pageswap", (event) => {
  const activation = event.activation;
  if (!activation || !activation.from || !activation.entry) return;
  const from = safeUrl(activation.from.url);
  const to = safeUrl(activation.entry.url);
  if (!from || !to || from.origin !== to.origin) return;
  setDirection(directionFor(from.pathname, to.pathname));
});

// Incoming page: same calculation from the referrer side.
window.addEventListener("pagereveal", () => {
  if (!document.referrer) return;
  const from = safeUrl(document.referrer);
  if (!from || from.origin !== location.origin) return;
  setDirection(directionFor(from.pathname, location.pathname));
});
