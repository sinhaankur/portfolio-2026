/**
 * Copyright (c) 2026 Ankur Sinha. All rights reserved.
 * Part of the Universe Engine. Others may reference this work.
 * https://github.com/sinhaankur/portfolio-2026
 *
 * ground-station — a small table of REAL satellite ground stations, so the
 * pass planner answers the operator's question: "from THIS dish, when is the
 * satellite overhead, where in the sky, and for how long?"
 *
 * This is the ground↔space link made legible: pick a station, pick a satellite
 * (ISS by default), and read its rise/peak/set exactly the way a tracking
 * station schedules a contact. The heavy lifting (real SGP4 + topocentric
 * look-angles + rise/set refinement) lives in lib/sat-passes.ts — this file
 * just names the real places you'd track from.
 *
 * Coordinates are the published locations of each station's primary antenna
 * complex, accurate to the ~0.01° that matters for az/el pointing. `heightKm`
 * is the site's approximate elevation above the ellipsoid.
 */

import type { Observer } from "./sat-passes"

export type GroundStation = Observer & {
  id: string
  /** Display name of the station. */
  name: string
  /** Operating agency / network. */
  agency: string
  /** Country, for the location line. */
  country: string
  /** One honest line on what the site actually does. */
  note: string
}

/**
 * Real tracking stations across the major networks. ISTRAC (ISRO) leads the
 * list because the ISS-from-India view is the flagship "ground and up" story;
 * the rest span the networks that actually schedule contacts worldwide.
 */
export const GROUND_STATIONS: GroundStation[] = [
  {
    id: "istrac-bengaluru",
    name: "ISTRAC Bengaluru",
    agency: "ISRO",
    country: "India",
    latDeg: 13.0349,
    lonDeg: 77.5119,
    heightKm: 0.9,
    note: "ISRO's primary tracking, telemetry & command hub for LEO missions.",
  },
  {
    id: "istrac-lucknow",
    name: "ISTRAC Lucknow",
    agency: "ISRO",
    country: "India",
    latDeg: 26.9124,
    lonDeg: 80.9668,
    heightKm: 0.12,
    note: "Northern-India ground terminal — early-orbit and routine LEO support.",
  },
  {
    id: "svalbard-svalsat",
    name: "Svalbard (SvalSat)",
    agency: "KSAT",
    country: "Norway",
    latDeg: 78.2299,
    lonDeg: 15.3894,
    heightKm: 0.46,
    note: "At 78°N it sees nearly every polar-orbit pass — the busiest LEO dish on Earth.",
  },
  {
    id: "guiana-kourou",
    name: "Kourou",
    agency: "ESA",
    country: "French Guiana",
    latDeg: 5.2515,
    lonDeg: -52.8046,
    heightKm: 0.01,
    note: "ESA's equatorial station beside the Ariane launch range.",
  },
  {
    id: "goldstone-dsn",
    name: "Goldstone (DSN)",
    agency: "NASA",
    country: "United States",
    latDeg: 35.4267,
    lonDeg: -116.89,
    heightKm: 1.0,
    note: "A Deep Space Network complex — also tracks high-value near-Earth craft.",
  },
  {
    id: "vandenberg-sfb",
    name: "Vandenberg SFB",
    agency: "USSF",
    country: "United States",
    latDeg: 34.742,
    lonDeg: -120.5724,
    heightKm: 0.1,
    note: "West-coast launch + tracking site favouring polar and sun-synchronous orbits.",
  },
  {
    id: "usuda-jaxa",
    name: "Usuda",
    agency: "JAXA",
    country: "Japan",
    latDeg: 36.1329,
    lonDeg: 138.3624,
    heightKm: 1.46,
    note: "JAXA deep-space + LEO tracking station in the Nagano highlands.",
  },
  {
    id: "dongara-ksat",
    name: "Dongara",
    agency: "KSAT",
    country: "Australia",
    latDeg: -29.0464,
    lonDeg: 115.3487,
    heightKm: 0.05,
    note: "Southern-hemisphere polar-pass coverage — the counterpart to Svalbard.",
  },
]

/** Look up a station by id (falls back to the first entry, ISTRAC Bengaluru). */
export function stationById(id: string): GroundStation {
  return GROUND_STATIONS.find((s) => s.id === id) ?? GROUND_STATIONS[0]
}
