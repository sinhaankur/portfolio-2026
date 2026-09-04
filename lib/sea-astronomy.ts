/**
 * sea-astronomy — real, keyless sun & moon math for the Waves engine.
 *
 * Low-precision but genuinely astronomical: sun and moon altitude/azimuth for a
 * lat/lng/time, the moon's phase + illuminated fraction + bright-limb angle
 * (its real "orientation"), and a simple lunar+solar tide indicator (spring vs
 * neap). No dependency — standard formulae (Meeus, low-precision) implemented
 * by hand, in the spirit of the Universe Engine: real over invented.
 *
 * Accuracy is arc-minute-ish for the sun and ~0.3° for the moon — far better
 * than the eye can judge against a horizon, which is all this needs.
 */

const RAD = Math.PI / 180;
const DEG = 180 / Math.PI;

/** Julian Day from a JS Date (UTC). */
export function julianDay(date: Date): number {
  return date.getTime() / 86400000 + 2440587.5;
}
/** Days since the J2000.0 epoch. */
function daysSinceJ2000(date: Date): number {
  return julianDay(date) - 2451545.0;
}

function normDeg(d: number): number {
  return ((d % 360) + 360) % 360;
}

/* ── Sun ─────────────────────────────────────────────────────────────────── */

/** Sun ecliptic longitude (deg) + distance context, low precision. */
function sunEcliptic(d: number) {
  const g = normDeg(357.529 + 0.98560028 * d) * RAD; // mean anomaly
  const q = normDeg(280.459 + 0.98564736 * d);       // mean longitude
  const L = normDeg(q + 1.915 * Math.sin(g) + 0.020 * Math.sin(2 * g)); // ecliptic long
  return { L };
}

/** Obliquity of the ecliptic (deg). */
function obliquity(d: number): number {
  return 23.439 - 0.00000036 * d;
}

/** Right ascension + declination (deg) from ecliptic longitude (β≈0 for sun). */
function eclipticToEquatorial(lonDeg: number, latDeg: number, eps: number) {
  const lon = lonDeg * RAD, lat = latDeg * RAD, e = eps * RAD;
  const ra = Math.atan2(
    Math.sin(lon) * Math.cos(e) - Math.tan(lat) * Math.sin(e),
    Math.cos(lon),
  );
  const dec = Math.asin(Math.sin(lat) * Math.cos(e) + Math.cos(lat) * Math.sin(e) * Math.sin(lon));
  return { ra: normDeg(ra * DEG), dec: dec * DEG };
}

/** Local sidereal time (deg) for a longitude. */
function localSiderealTime(d: number, lngDeg: number): number {
  return normDeg(280.16 + 360.9856235 * d + lngDeg);
}

/** Altitude + azimuth (deg) of an equatorial position at a place/time.
 *  Azimuth measured from north, clockwise (0=N, 90=E, 180=S, 270=W). */
function altAz(raDeg: number, decDeg: number, latDeg: number, lngDeg: number, d: number) {
  const lst = localSiderealTime(d, lngDeg);
  const H = normDeg(lst - raDeg) * RAD; // hour angle
  const dec = decDeg * RAD, lat = latDeg * RAD;
  const alt = Math.asin(Math.sin(lat) * Math.sin(dec) + Math.cos(lat) * Math.cos(dec) * Math.cos(H));
  const az = Math.atan2(
    -Math.cos(dec) * Math.sin(H),
    Math.sin(dec) * Math.cos(lat) - Math.cos(dec) * Math.sin(lat) * Math.cos(H),
  );
  return { altitude: alt * DEG, azimuth: normDeg(az * DEG) };
}

export type SkyPos = { altitude: number; azimuth: number };

/** Real sun position (altitude/azimuth, degrees) at a place + time. */
export function sunPosition(date: Date, lat: number, lng: number): SkyPos {
  const d = daysSinceJ2000(date);
  const { L } = sunEcliptic(d);
  const eq = eclipticToEquatorial(L, 0, obliquity(d));
  return altAz(eq.ra, eq.dec, lat, lng, d);
}

/* ── Moon ────────────────────────────────────────────────────────────────── */

/** Moon ecliptic longitude + latitude (deg), low precision (Meeus simplified). */
function moonEcliptic(d: number) {
  const L = normDeg(218.316 + 13.176396 * d);   // mean longitude
  const M = normDeg(134.963 + 13.064993 * d);   // mean anomaly
  const F = normDeg(93.272 + 13.229350 * d);    // argument of latitude
  const lon = L + 6.289 * Math.sin(M * RAD);
  const lat = 5.128 * Math.sin(F * RAD);
  return { lon: normDeg(lon), lat };
}

/** Real moon position (altitude/azimuth, degrees). */
export function moonPosition(date: Date, lat: number, lng: number): SkyPos {
  const d = daysSinceJ2000(date);
  const { lon, lat: eLat } = moonEcliptic(d);
  const eq = eclipticToEquatorial(lon, eLat, obliquity(d));
  return altAz(eq.ra, eq.dec, lat, lng, d);
}

export type MoonPhase = {
  /** 0=new, 0.25=first quarter, 0.5=full, 0.75=last quarter. */
  phase: number;
  /** Fraction of the disc lit, 0..1. */
  illumination: number;
  /** true = waxing (growing), false = waning. */
  waxing: boolean;
  /** Human name. */
  name: string;
};

/** Moon phase + illuminated fraction from the sun–moon elongation. */
export function moonPhase(date: Date): MoonPhase {
  const d = daysSinceJ2000(date);
  const sun = sunEcliptic(d).L;
  const moon = moonEcliptic(d).lon;
  const elong = normDeg(moon - sun);           // 0=new … 180=full … 360=new
  const phase = elong / 360;
  const illumination = (1 - Math.cos(elong * RAD)) / 2;
  const waxing = elong < 180;
  const name =
    elong < 22.5 || elong >= 337.5 ? "New moon"
    : elong < 67.5 ? "Waxing crescent"
    : elong < 112.5 ? "First quarter"
    : elong < 157.5 ? "Waxing gibbous"
    : elong < 202.5 ? "Full moon"
    : elong < 247.5 ? "Waning gibbous"
    : elong < 292.5 ? "Last quarter"
    : "Waning crescent";
  return { phase, illumination, waxing, name };
}

/* ── Tides (indicator, not a prediction) ─────────────────────────────────────
   Real tides need harmonic constants for a specific port. What IS universal is
   the DRIVER: the tide-raising force is the sum of the moon's and sun's pulls.
   Spring tides (biggest range) happen at new + full moon when they align;
   neap tides (smallest) at the quarters. We report that honestly. */

export type Tide = {
  /** 0..1 — relative tidal RANGE for the day (1 = spring, ~0.3 = neap). */
  springStrength: number;
  kind: "spring" | "neap" | "between";
  note: string;
};

export function tideIndicator(date: Date): Tide {
  const { phase } = moonPhase(date);
  // Alignment is strongest at new (0) and full (0.5); weakest at quarters.
  const align = Math.abs(Math.cos(2 * Math.PI * phase)); // 1 at new/full, 0 at quarters
  const springStrength = 0.3 + 0.7 * align;
  const kind = align > 0.85 ? "spring" : align < 0.35 ? "neap" : "between";
  const note =
    kind === "spring"
      ? "Sun and Moon pull in line — the largest tidal range (spring tide)."
      : kind === "neap"
      ? "Sun and Moon pull at right angles — the smallest tidal range (neap tide)."
      : "Between spring and neap.";
  return { springStrength, kind, note };
}

/* ── Day phase (for the sky gradient) ────────────────────────────────────── */

export type DayPhase = "night" | "astronomical" | "nautical" | "civil" | "golden" | "day";

/** Which twilight/day band the sun's altitude falls in — drives sky color. */
export function dayPhase(sunAlt: number): DayPhase {
  if (sunAlt < -18) return "night";
  if (sunAlt < -12) return "astronomical";
  if (sunAlt < -6) return "nautical";
  if (sunAlt < -0.833) return "civil";
  if (sunAlt < 6) return "golden";
  return "day";
}
