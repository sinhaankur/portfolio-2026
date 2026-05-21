import { animate, stagger } from "https://cdn.jsdelivr.net/npm/motion@11.11.17/+esm";

const root = document.documentElement;
const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

root.classList.add("motion-ready");

if (reduce) {
  root.classList.remove("js-animate");
} else {
  const settle = (el) => {
    el.style.opacity = "1";
    el.style.transform = "";
  };

  const settleAll = (els, after) => setTimeout(() => els.forEach(settle), after);

  const chips = document.querySelectorAll(".intro .chip");
  if (chips.length) {
    animate(
      chips,
      { opacity: [0, 1], transform: ["translateY(12px)", "translateY(0)"] },
      { delay: stagger(0.07), duration: 0.55, easing: [0.16, 1, 0.3, 1] }
    );
    settleAll(chips, 700 + chips.length * 70);
  }

  const fadeTargets = document.querySelectorAll(
    ".section, blockquote, .work-header"
  );

  const io = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        const el = entry.target;
        animate(
          el,
          { opacity: [0, 1], transform: ["translateY(24px)", "translateY(0)"] },
          { duration: 0.7, easing: [0.16, 1, 0.3, 1] }
        );
        setTimeout(() => settle(el), 750);
        io.unobserve(el);
      }
    },
    { threshold: 0.12, rootMargin: "0px 0px -6% 0px" }
  );

  fadeTargets.forEach((el) => io.observe(el));
}
