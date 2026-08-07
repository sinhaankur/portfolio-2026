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
