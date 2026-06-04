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

export function getSkyAffordance({
  kind,
  visualSize,
  invert,
  shade,
}: {
  kind: SkyPoint["kind"]
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

  return {
    ...base,
    minHitRadius: Math.min(Math.max(base.minHitRadius, visualSize * 0.2), 2.4),
  }
}

export function getBlackHoleAffordance(invert: boolean) {
  return {
    haloColor: invert ? "#3a2418" : "#ffd6a8",
    haloOpacity: invert ? 0.14 : 0.22,
  }
}

export function getCometAffordance({
  kind,
  visualRadius,
  isLoop,
  invert,
}: {
  kind: NamedBody["kind"]
  visualRadius: number
  isLoop: boolean
  invert: boolean
}) {
  const isCometFamily = kind === "comet" || kind === "interstellar"
  const hitRadius = Math.max(isCometFamily ? 0.20 : 0.16, visualRadius * (isCometFamily ? 3.6 : 3.0))
  const labelOffset = Math.max(visualRadius * (isCometFamily ? 4.2 : 3.5), 0.35)
  const trailIdle = isLoop ? (invert ? 0.18 : 0.10) : (invert ? 0.14 : 0.08)
  const trailHover = isLoop ? (invert ? 0.65 : 0.50) : (invert ? 0.55 : 0.42)

  return {
    hitRadius,
    labelOffset,
    trailIdle,
    trailHover,
  }
}
