/**
 * satellite-refs — the loose-coupling bridge refs between the DOM chrome (the
 * explorer's search box, filter chips) and the R3F SatelliteField.
 *
 * These live in their OWN module, deliberately free of Three.js / R3F imports,
 * so the DOM side (celestial-explorer.tsx) can read/write them WITHOUT statically
 * pulling in the ~800 KB Three.js engine bundle. The engine (satellite-field.tsx)
 * re-exports these so its internal imports keep working unchanged; the heavy
 * engine itself stays behind the dynamic import.
 */

/** Selection bridge — the search box (DOM) writes the chosen NORAD id here;
 *  SatelliteField (R3F) reads it to highlight + follow + ring the satellite. */
export const selectedSatRef: { current: number | null } = { current: null }

/** The chosen satellite-group filter (index into the group list; -1 = all). */
export const satGroupFilterRef: { current: number } = { current: -1 }

/** Whether to show the full swarm vs. just a focused subset. */
export const showAllSatsRef: { current: boolean } = { current: false }

/**
 * CONJUNCTION ENCOUNTER FOCUS — the close-approach the user tapped in the
 * Conjunction Watch panel, so the 3D scene can VISUALISE the encounter (mark both
 * objects, draw the line between them, show the miss distance tightening toward
 * TCA). The panel (DOM) writes it; SatelliteField (R3F) reads it each frame.
 *
 * All geometry, no probability: the numbers are the two objects' real SGP4 states
 * at closest approach — miss distance + relative speed — never a fabricated Pc
 * (public TLEs carry no covariance). null = no encounter is being shown.
 *
 * ── USER JOURNEY ──
 *   1. User opens "Conjunction Watch", taps a row (e.g. "0.12 km · COSMOS × …").
 *   2. The panel writes THIS ref {aId, bId, tcaMs, missKm, relSpeedKms} and scrubs
 *      the clock to ~90 s before closest approach at real-time rate.
 *   3. SatelliteField sees the ref, finds both objects in the swarm, and draws the
 *      encounter: a marker on each, a connecting line, and a miss-distance readout
 *      that updates as the two dots visibly converge toward the tightest point.
 *   4. The user watches them reach closest approach, then drift apart. Clearing the
 *      panel (or selecting elsewhere) sets this back to null and the overlay lifts.
 */
export type ConjunctionFocus = {
  aId: number
  bId: number
  tcaMs: number
  missKm: number
  relSpeedKms: number
}
export const conjunctionFocusRef: { current: ConjunctionFocus | null } = { current: null }

/** LAUNCH→ORBIT JOURNEY — opt-in. The animated ascent sweep (glowing head
 *  riding the launch-pad → orbit arc) is a bright, looping element; it only
 *  shows when the user explicitly asks to trace a craft's journey from the
 *  selected-satellite card, never automatically on selection. The card (DOM)
 *  writes this + dispatches `universe:journey-toggle`; the field renders it. */
export const showJourneyRef: { current: boolean } = { current: false }
