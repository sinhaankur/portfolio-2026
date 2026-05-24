/**
 * Defended worlds — the stakes of each level.
 *
 * These are REAL bodies. The Cleaver isn't destroying them; it's
 * keeping them intact. That's the entire moral architecture of
 * this build — the engine's reverence stance is preserved because
 * nothing real gets destroyed; aliens take damage, planets get
 * saved.
 *
 * Each world has:
 *  - id: stable key
 *  - name: display name (real)
 *  - kind: short qualifier ("home world", "moon", "exoplanet", …)
 *  - radius: scene-units for the background planet sphere
 *  - color1/color2: surface palette tuned to the real body
 *  - rotationSpeed: rad/s (cosmetic, just gives the disc life)
 *  - atmoColor: subtle rim glow tint
 *  - briefing: defender flavour copy for the briefing overlay
 */
export type DefendedWorld = {
  id: string
  name: string
  kind: string
  radius: number
  color1: string
  color2: string
  rotationSpeed: number
  atmoColor: string
  briefing: string
}

export const WORLDS: DefendedWorld[] = [
  {
    id: "earth",
    name: "Earth",
    kind: "home world",
    radius: 3.6,
    color1: "#3a76b8",
    color2: "#1a3a5a",
    rotationSpeed: 0.06,
    atmoColor: "#8ab6e8",
    briefing:
      "First contact, first front. Eight billion souls behind you. They will not know you stood here.",
  },
  {
    id: "mars",
    name: "Mars",
    kind: "outpost",
    radius: 3.0,
    color1: "#c46b3b",
    color2: "#5a2818",
    rotationSpeed: 0.07,
    atmoColor: "#e8a070",
    briefing:
      "Three thousand colonists in the dome cities. The dust will hide them if they hide low. Buy them time.",
  },
  {
    id: "europa",
    name: "Europa",
    kind: "moon (Jupiter)",
    radius: 2.4,
    color1: "#dfe4ec",
    color2: "#6c7888",
    rotationSpeed: 0.05,
    atmoColor: "#bfd2e8",
    briefing:
      "Liquid ocean under the ice. Whatever lives down there has never known a war. Keep it that way.",
  },
  {
    id: "titan",
    name: "Titan",
    kind: "moon (Saturn)",
    radius: 2.9,
    color1: "#caa66e",
    color2: "#5e3e1a",
    rotationSpeed: 0.05,
    atmoColor: "#f0c890",
    briefing:
      "Methane seas, organic haze. The most Earth-like sky outside Earth. The aliens want the haze too.",
  },
  {
    id: "proxima-b",
    name: "Proxima Centauri b",
    kind: "exoplanet · 4.2 ly",
    radius: 3.2,
    color1: "#a04c4c",
    color2: "#3a1818",
    rotationSpeed: 0.04,
    atmoColor: "#d68080",
    briefing:
      "The nearest exoplanet. If anyone listens to your distress signal it will be them — in four years and three months.",
  },
  {
    id: "trappist-1e",
    name: "TRAPPIST-1e",
    kind: "exoplanet · 40 ly",
    radius: 3.0,
    color1: "#5a8c6e",
    color2: "#1a3a2a",
    rotationSpeed: 0.05,
    atmoColor: "#90c8a8",
    briefing:
      "Habitable-zone candidate. The aliens have come this far. Hold the line — TRAPPIST-1 will not get a second chance.",
  },
  {
    id: "kepler-186f",
    name: "Kepler-186f",
    kind: "exoplanet · 580 ly",
    radius: 3.3,
    color1: "#7a6cb8",
    color2: "#1f1a3a",
    rotationSpeed: 0.04,
    atmoColor: "#a89cd6",
    briefing:
      "Final defense. If they take this one they take all of them. The Cleaver is warm. Open fire on contact.",
  },
]

export const WORLD_COUNT = WORLDS.length
