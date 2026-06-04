import type { NamedBody, SkyPoint } from "./types"

type SkyAffordance = {
  core: string
  halo: string
  coreRadiusMul: number
  coreOpacity: number
  haloRadiusMul: number
  haloOpacity: number
  hitRadiusMul: number
  minHitRadius: number
}

type SkyAffordanceOverride = Partial<SkyAffordance> & {
  core?: string
  halo?: string
}

const STAR_PROFILES: Record<string, SkyAffordanceOverride> = {
  // Brightest night-sky star: tight bright core with strong blue-white halo.
  sirius: {
    coreRadiusMul: 0.34,
    haloRadiusMul: 0.82,
    haloOpacity: 0.48,
    hitRadiusMul: 2.1,
  },
  // Red supergiant: wider, softer envelope.
  betelgeuse: {
    coreRadiusMul: 0.36,
    haloRadiusMul: 0.95,
    haloOpacity: 0.54,
    hitRadiusMul: 2.2,
  },
  rigel: {
    coreRadiusMul: 0.31,
    haloRadiusMul: 0.78,
    haloOpacity: 0.43,
    hitRadiusMul: 2.0,
  },
  vega: {
    coreRadiusMul: 0.30,
    haloRadiusMul: 0.75,
    haloOpacity: 0.40,
  },
  antares: {
    coreRadiusMul: 0.35,
    haloRadiusMul: 0.92,
    haloOpacity: 0.52,
    hitRadiusMul: 2.1,
  },
  aldebaran: {
    coreRadiusMul: 0.33,
    haloRadiusMul: 0.86,
    haloOpacity: 0.47,
    hitRadiusMul: 2.0,
  },
  "vy-cma": {
    coreRadiusMul: 0.37,
    haloRadiusMul: 0.98,
    haloOpacity: 0.56,
    hitRadiusMul: 2.25,
  },
  "eta-carinae": {
    coreRadiusMul: 0.34,
    haloRadiusMul: 0.86,
    haloOpacity: 0.50,
    hitRadiusMul: 2.05,
  },
}

const BLACK_HOLE_SKY_PROFILES: Record<string, SkyAffordanceOverride> = {
  "m87-star": { hitRadiusMul: 2.2, minHitRadius: 1.4 },
  "ton-618": { hitRadiusMul: 2.4, minHitRadius: 1.5 },
  "cygnus-x1": { hitRadiusMul: 2.1, minHitRadius: 1.35 },
  "v404-cygni": { hitRadiusMul: 2.0, minHitRadius: 1.3 },
}

const BLACK_HOLE_DETAIL_PROFILES: Record<string, { haloOpacity: number; haloColorDark: string; haloColorLight: string }> = {
  "m87*": { haloOpacity: 0.24, haloColorDark: "#ffd8b3", haloColorLight: "#442b1e" },
  "ton 618": { haloOpacity: 0.27, haloColorDark: "#ffe0bf", haloColorLight: "#4a2f20" },
  "cygnus x-1": { haloOpacity: 0.19, haloColorDark: "#ffcfa3", haloColorLight: "#3a2519" },
  "v404 cygni": { haloOpacity: 0.18, haloColorDark: "#ffc99a", haloColorLight: "#362316" },
}

const COMET_PROFILES: Record<string, { hitMul: number; labelMul: number; idleMul: number; hoverMul: number }> = {
  "comet hale-bopp": { hitMul: 1.18, labelMul: 1.12, idleMul: 1.1, hoverMul: 1.12 },
  "comet hyakutake": { hitMul: 1.16, labelMul: 1.10, idleMul: 1.08, hoverMul: 1.10 },
  "comet tsuchinshan-atlas": { hitMul: 1.2, labelMul: 1.16, idleMul: 1.12, hoverMul: 1.16 },
  "comet ikeya-seki": { hitMul: 1.15, labelMul: 1.08, idleMul: 1.1, hoverMul: 1.12 },
  "comet neowise": { hitMul: 1.14, labelMul: 1.08, idleMul: 1.08, hoverMul: 1.1 },
  "comet halley": { hitMul: 1.12, labelMul: 1.06, idleMul: 1.05, hoverMul: 1.08 },
}

function clamp01(v: number) {
  return Math.max(0, Math.min(1, v))
}

function clampRadius(v: number) {
  return Math.max(0.12, Math.min(3.2, v))
}

export function getSkyAffordance({
  kind,
  pointId,
  visualSize,
  invert,
  shade,
}: {
  kind: SkyPoint["kind"]
  pointId?: string
  visualSize: number
  invert: boolean
  shade?: string
}): SkyAffordance {
  const starShade = shade ?? "#ffffff"

  const base: SkyAffordance =
    kind === "galaxy"
      ? {
          core: invert ? "#3a1d12" : "#ffd9c2",
          halo: invert ? "#6b3a20" : "#d68a5c",
          coreRadiusMul: 0.45,
          coreOpacity: 0.55,
          haloRadiusMul: 1.0,
          haloOpacity: invert ? 0.18 : 0.22,
          hitRadiusMul: 1.5,
          minHitRadius: 1.0,
        }
      : kind === "nebula"
        ? {
            core: invert ? "#1e2a45" : "#a8d2ff",
            halo: invert ? "#3a5085" : "#5587d0",
            coreRadiusMul: 0.45,
            coreOpacity: 0.55,
            haloRadiusMul: 1.0,
            haloOpacity: invert ? 0.18 : 0.22,
            hitRadiusMul: 2.6,
            minHitRadius: 1.0,
          }
        : kind === "cluster"
          ? {
              core: invert ? "#0a0a0a" : "#ffffff",
              halo: invert ? "#2a2a2a" : "#cfd7ff",
              coreRadiusMul: 0.45,
              coreOpacity: 0.55,
              haloRadiusMul: 1.0,
              haloOpacity: invert ? 0.16 : 0.2,
              hitRadiusMul: 1.4,
              minHitRadius: 1.0,
            }
          : kind === "star"
            ? {
                core: starShade,
                halo: invert ? "#5a4a18" : starShade,
                coreRadiusMul: 0.30,
                coreOpacity: 1,
                haloRadiusMul: 0.72,
                haloOpacity: invert ? 0.32 : 0.40,
                hitRadiusMul: 1.9,
                minHitRadius: 1.2,
              }
            : kind === "black-hole"
              ? {
                  core: "#000000",
                  halo: invert ? "#b34a13" : "#ff7a1a",
                  coreRadiusMul: 0.50,
                  coreOpacity: 1,
                  haloRadiusMul: 1.0,
                  haloOpacity: invert ? 0.14 : 0.2,
                  hitRadiusMul: 1.8,
                  minHitRadius: 1.2,
                }
              : {
                  core: invert ? "#b34a13" : "#ffd66b",
                  halo: invert ? "#7a3a16" : "#ffb84d",
                  coreRadiusMul: 1.0,
                  coreOpacity: 1,
                  haloRadiusMul: 1.0,
                  haloOpacity: invert ? 0.18 : 0.24,
                  hitRadiusMul: 1.4,
                  minHitRadius: 1.0,
                }

  const perObject: SkyAffordanceOverride | undefined =
    kind === "star"
      ? (pointId ? STAR_PROFILES[pointId] : undefined)
      : kind === "black-hole"
        ? (pointId ? BLACK_HOLE_SKY_PROFILES[pointId] : undefined)
        : undefined

  return {
    core: perObject?.core ?? base.core,
    halo: perObject?.halo ?? base.halo,
    coreRadiusMul: perObject?.coreRadiusMul ?? base.coreRadiusMul,
    coreOpacity: clamp01(perObject?.coreOpacity ?? base.coreOpacity),
    haloRadiusMul: perObject?.haloRadiusMul ?? base.haloRadiusMul,
    haloOpacity: clamp01(perObject?.haloOpacity ?? base.haloOpacity),
    hitRadiusMul: clampRadius(perObject?.hitRadiusMul ?? base.hitRadiusMul),
    minHitRadius: Math.min(
      Math.max(perObject?.minHitRadius ?? base.minHitRadius, visualSize * 0.2),
      2.8,
    ),
  }
}

export function getBlackHoleAffordance({
  invert,
  name,
  massSolar,
}: {
  invert: boolean
  name?: string
  massSolar?: number
}) {
  const profile = name ? BLACK_HOLE_DETAIL_PROFILES[name.toLowerCase()] : undefined
  const massBoost =
    massSolar && massSolar > 1e10 ? 0.03 :
    massSolar && massSolar < 100 ? -0.02 :
    0
  const baseOpacity = profile?.haloOpacity ?? 0.22
  return {
    haloColor: invert
      ? (profile?.haloColorLight ?? "#3a2418")
      : (profile?.haloColorDark ?? "#ffd6a8"),
    haloOpacity: clamp01((invert ? baseOpacity * 0.64 : baseOpacity) + massBoost),
  }
}

export function getCometAffordance({
  kind,
  name,
  visualRadius,
  isLoop,
  invert,
}: {
  kind: NamedBody["kind"]
  name: string
  visualRadius: number
  isLoop: boolean
  invert: boolean
}) {
  const isCometFamily = kind === "comet" || kind === "interstellar"
  const profile = COMET_PROFILES[name.toLowerCase()]
  const hitMul = profile?.hitMul ?? 1
  const labelMul = profile?.labelMul ?? 1
  const idleMul = profile?.idleMul ?? 1
  const hoverMul = profile?.hoverMul ?? 1

  const hitRadius = Math.max(
    isCometFamily ? 0.20 : 0.16,
    visualRadius * (isCometFamily ? 3.6 : 3.0) * hitMul,
  )
  const labelOffset = Math.max(visualRadius * (isCometFamily ? 4.2 : 3.5) * labelMul, 0.35)
  const trailIdleBase = isLoop ? (invert ? 0.18 : 0.10) : (invert ? 0.14 : 0.08)
  const trailHoverBase = isLoop ? (invert ? 0.65 : 0.50) : (invert ? 0.55 : 0.42)
  const trailIdle = clamp01(trailIdleBase * idleMul)
  const trailHover = clamp01(trailHoverBase * hoverMul)

  return {
    hitRadius,
    labelOffset,
    trailIdle,
    trailHover,
  }
}
