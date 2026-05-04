// Shared page animations. Drop-in for any page that adds the inline pre-hide
// style + .js-animate class on <html> in its <head>. Plain HTML, no build,
// matches the conservative motion vocabulary already used on index.html.

import { animate, stagger } from "https://cdn.jsdelivr.net/npm/motion@11.11.17/+esm";

const root = document.documentElement;
const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

root.classList.add("motion-ready");

if (reduce) {
  root.classList.remove("js-animate");
} else {
  const EASE = [0.16, 1, 0.3, 1];
  const DUR = 0.5;
  const Y = 16;

  const settle = (el) => {
    el.style.opacity = "1";
    el.style.transform = "";
  };

  const TARGET_SELECTOR = [
    ".work-header",
    "blockquote",
    ".hero-card",
    ".hero",
    ".pillar",
    ".project-story",
    ".project-arc",
    ".collection-item",
    ".moments-item",
    ".panel",
    ".principal-section .card",
    ".metric-card",
    ".skill-item",
    ".insight-card",
    ".form-card",
    ".tool-card",
    ".stat-card",
    ".dimension-card",
    ".persona-card",
    ".essay-hero",
    ".public-chip",
    ".intro .chip",
  ].join(",");

  // Children of these parents stagger by sibling index, so a grid reveals
  // smoothly instead of all at once.
  const STAGGER_PARENT_SELECTOR =
    ".project-stack, .pillar-grid, .moments-gallery, .collection, .public-list, .intro";

  const targets = Array.from(document.querySelectorAll(TARGET_SELECTOR));

  // Pre-hide programmatically too, so any element the page CSS missed still
  // starts invisible (prevents visible jump if CSS pre-hide is incomplete).
  if (root.classList.contains("js-animate")) {
    targets.forEach((el) => {
      if (el.style.opacity === "") el.style.opacity = "0";
    });
  }

  const indexInStaggerParent = (el) => {
    const parent = el.closest(STAGGER_PARENT_SELECTOR);
    if (!parent) return 0;
    const sibs = Array.from(parent.querySelectorAll(TARGET_SELECTOR)).filter(
      (s) => s.closest(STAGGER_PARENT_SELECTOR) === parent
    );
    return Math.min(sibs.indexOf(el), 6);
  };

  const io = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        const el = entry.target;
        const idx = indexInStaggerParent(el);
        const delay = idx * 0.06;
        animate(
          el,
          {
            opacity: [0, 1],
            transform: [`translateY(${Y}px)`, "translateY(0)"],
          },
          { duration: DUR, easing: EASE, delay }
        );
        setTimeout(() => settle(el), (DUR + delay) * 1000 + 80);
        io.unobserve(el);
      }
    },
    { threshold: 0.08, rootMargin: "0px 0px -4% 0px" }
  );

  targets.forEach((el) => io.observe(el));

  // Fallback: anything still pre-hidden after 2.5s gets revealed (covers
  // elements the IntersectionObserver may not see — e.g. inside a closed tab).
  setTimeout(() => {
    targets.forEach((el) => {
      if (el.style.opacity === "0") settle(el);
    });
    root.classList.remove("js-animate");
  }, 2500);

  // Smooth open animation for <details> accordions (Oracle project stories).
  document.querySelectorAll("details.project-story").forEach((det) => {
    det.addEventListener("toggle", () => {
      if (!det.open) return;
      const body = det.querySelector(".ps-body");
      if (!body) return;
      animate(
        body,
        {
          opacity: [0, 1],
          transform: ["translateY(-6px)", "translateY(0)"],
        },
        { duration: 0.32, easing: EASE }
      );
    });
  });
}
