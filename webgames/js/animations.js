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

  // Gamelist hero: eyebrow → h1 → p, sequential
  const heroParts = document.querySelectorAll(
    ".retro-hero .retro-eyebrow, .retro-hero h1, .retro-hero p"
  );
  if (heroParts.length) {
    animate(
      heroParts,
      { opacity: [0, 1], transform: ["translateY(16px)", "translateY(0)"] },
      { delay: stagger(0.1), duration: 0.6, easing: [0.16, 1, 0.3, 1] }
    );
    settleAll(heroParts, 800 + heroParts.length * 100);
  }

  // Gamelist cards: stagger fade-up when grid scrolls into view
  const cards = document.querySelectorAll(".retro-grid .retro-card");
  if (cards.length) {
    const cardObserver = new IntersectionObserver(
      (entries, obs) => {
        if (!entries.some((e) => e.isIntersecting)) return;
        animate(
          cards,
          { opacity: [0, 1], transform: ["translateY(24px)", "translateY(0)"] },
          { delay: stagger(0.1), duration: 0.65, easing: [0.16, 1, 0.3, 1] }
        );
        settleAll(cards, 800 + cards.length * 100);
        cards.forEach((c) => obs.unobserve(c));
      },
      { threshold: 0.15 }
    );
    cards.forEach((c) => cardObserver.observe(c));
  }

  // Emoji Tetris: stagger fade-up the game shell
  const gameParts = document.querySelectorAll(
    ".game-container > h1, .game-container .score-panel, .game-container #game, .game-container #startButton"
  );
  if (gameParts.length) {
    animate(
      gameParts,
      { opacity: [0, 1], transform: ["translateY(20px)", "translateY(0)"] },
      { delay: stagger(0.08), duration: 0.55, easing: [0.16, 1, 0.3, 1] }
    );
    settleAll(gameParts, 750 + gameParts.length * 80);
  }

  // Theme toggle button (both pages)
  const toggle = document.getElementById("themeToggle");
  if (toggle) {
    animate(
      toggle,
      { opacity: [0, 1], transform: ["scale(0.85)", "scale(1)"] },
      { duration: 0.5, easing: [0.16, 1, 0.3, 1] }
    );
    setTimeout(() => settle(toggle), 600);
  }
}
