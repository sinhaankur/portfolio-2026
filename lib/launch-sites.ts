/**
 * Launch-site catalogue — CelesTrak SATCAT `LAUNCH_SITE` codes → real coordinates.
 *
 * Each satellite's SATCAT record carries a launch-site code (e.g. "AFETR" =
 * Cape Canaveral). This maps the codes to the actual spaceport's latitude /
 * longitude + a human name, so the engine can draw each object's ORIGIN (where
 * it left Earth) and connect it to its DESTINATION (its orbit).
 *
 * Coordinates are the real pad locations (public knowledge). Codes are the
 * standard CelesTrak/USSPACECOM site abbreviations. Where a code covers a broad
 * range (e.g. AFETR = the whole Eastern Range), we use the primary pad complex.
 */

export type LaunchSite = {
  /** Human name of the spaceport. */
  name: string
  /** Country / operator (for the label). */
  country: string
  lat: number
  lon: number
}

/** CelesTrak SATCAT launch-site code → real spaceport. Not exhaustive of every
 *  historical code, but covers the sites behind the vast majority of the active
 *  catalogue. Unknown codes fall back to `null` (no origin line drawn). */
export const LAUNCH_SITES: Record<string, LaunchSite> = {
  // United States (codes as they actually appear in the CelesTrak catalogue)
  AFETR: { name: "Cape Canaveral (Eastern Range)", country: "USA", lat: 28.488, lon: -80.577 },
  AFWTR: { name: "Vandenberg (Western Range)", country: "USA", lat: 34.742, lon: -120.573 },
  KSCUT: { name: "Kennedy Space Center", country: "USA", lat: 28.573, lon: -80.649 },
  WLPIS: { name: "Wallops Island", country: "USA", lat: 37.940, lon: -75.466 },
  KODAK: { name: "Kodiak (Pacific Spaceport)", country: "USA", lat: 57.435, lon: -152.338 },
  ERAS: { name: "Eastern Range (air/sea launch)", country: "USA", lat: 28.5, lon: -80.5 },
  WRAS: { name: "Western Range (air/sea launch)", country: "USA", lat: 34.7, lon: -120.6 },
  // Russia / former USSR
  TYMSC: { name: "Baikonur Cosmodrome (Tyuratam)", country: "Kazakhstan (RUS)", lat: 45.965, lon: 63.305 },
  PLMSC: { name: "Plesetsk Cosmodrome", country: "Russia", lat: 62.926, lon: 40.577 },
  KYMSC: { name: "Kapustin Yar", country: "Russia", lat: 48.577, lon: 45.998 },
  VOSTO: { name: "Vostochny Cosmodrome", country: "Russia", lat: 51.884, lon: 128.334 },
  SVOBO: { name: "Svobodny", country: "Russia", lat: 51.884, lon: 128.334 },
  // Europe
  FRGUI: { name: "Guiana Space Centre (Kourou)", country: "ESA / France", lat: 5.239, lon: -52.768 },
  // China
  JSC: { name: "Jiuquan Satellite Launch Center", country: "China", lat: 40.958, lon: 100.291 },
  TAISC: { name: "Taiyuan Satellite Launch Center", country: "China", lat: 38.849, lon: 111.608 },
  XICLF: { name: "Xichang Satellite Launch Center", country: "China", lat: 28.246, lon: 102.027 },
  WSC: { name: "Wenchang Space Launch Site", country: "China", lat: 19.614, lon: 110.951 },
  SCSLA: { name: "South China Sea (sea launch)", country: "China", lat: 18.0, lon: 111.0 },
  YSLA: { name: "Yellow Sea (sea launch)", country: "China", lat: 34.9, lon: 121.2 },
  // Japan
  TANSC: { name: "Tanegashima Space Center", country: "Japan", lat: 30.401, lon: 130.968 },
  KSCUR: { name: "Uchinoura Space Center", country: "Japan", lat: 31.251, lon: 131.079 },
  // India
  SRILR: { name: "Satish Dhawan Space Centre (Sriharikota)", country: "India", lat: 13.733, lon: 80.235 },
  DLS: { name: "Dr. Abdul Kalam Island (Wheeler)", country: "India", lat: 20.757, lon: 87.093 },
  // Other
  RLLB: { name: "Rocket Lab (Māhia LC-1)", country: "New Zealand", lat: -39.261, lon: 177.865 },
  SEAL: { name: "Sea Launch (Odyssey, equatorial Pacific)", country: "Intl.", lat: 0.0, lon: -154.0 },
  SEMLS: { name: "Semnan Space Center", country: "Iran", lat: 35.234, lon: 53.921 },
  SMTS: { name: "Shahroud Missile Test Site", country: "Iran", lat: 36.2, lon: 55.3 },
  NSC: { name: "Naro Space Center", country: "South Korea", lat: 34.432, lon: 127.535 },
  SNMLP: { name: "San Marco Platform", country: "Italy (Kenya)", lat: -2.94, lon: 40.213 },
  YUN: { name: "Sohae (Tongch'ang-ri)", country: "North Korea", lat: 39.66, lon: 124.705 },
}

/** Resolve a SATCAT launch-site code to its spaceport, or null if unknown. */
export function launchSiteFor(code: string | undefined | null): LaunchSite | null {
  if (!code) return null
  return LAUNCH_SITES[code] ?? null
}
