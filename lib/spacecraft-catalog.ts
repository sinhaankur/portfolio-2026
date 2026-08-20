/**
 * Spacecraft catalog — the data spine for the /reference/spacecraft gallery.
 *
 * A reference list of real human-made craft, each with its real agency, orbit,
 * launch date, size, and a one-paragraph history — plus the path to the actual
 * GLB mesh the Universe Engine renders for it, so the gallery can show a live,
 * rotating 3D model of each craft (the same models built in blender/space-assets).
 *
 * Facts + parameters mirror HERO_CRAFT (scene-satellites.tsx) and the named-body
 * catalog (astronomy.ts) — this is the reference view of the same real data, not
 * a new invented set. Pure data, no React.
 */

export interface SpacecraftEntry {
  id: string
  name: string
  /** Path to the real GLB mesh (public/models). Rendered live in the card. */
  model: string
  agency: string
  /** Where it operates — orbit / destination. */
  orbit: string
  launched: string
  size: string
  /** Class chip: station · telescope · orbiter · flyby · probe · lander · constellation. */
  kind: string
  /** One-paragraph real history. */
  fact: string
  /** Camera framing hint for the mini-viewer (some craft are wide, some tall). */
  frame?: number
}

export const SPACECRAFT: SpacecraftEntry[] = [
  // ── Space stations ──────────────────────────────────────────────────────
  {
    id: "iss", name: "International Space Station", model: "/models/sat-iss.glb",
    agency: "NASA · Roscosmos · ESA · JAXA · CSA", orbit: "Low Earth orbit · ~420 km · 51.6°",
    launched: "1998 (first module)", size: "109 × 73 m", kind: "Station",
    fact: "The largest human structure in space — a continuously crewed laboratory since 2000, assembled from modules over more than a decade of spacewalks and dockings. It orbits Earth roughly every 92 minutes.",
    frame: 3.4,
  },
  {
    id: "tiangong", name: "Tiangong", model: "/models/tiangong.glb",
    agency: "CMSA (China)", orbit: "Low Earth orbit · ~390 km · 41.5°",
    launched: "2021 (Tianhe core)", size: "~55 m · 3 modules", kind: "Station",
    fact: "China's modular space station, completed in 2022 — the second continuously inhabited station in orbit. Built independently after China was excluded from the ISS partnership.",
    frame: 3.2,
  },
  // ── Telescopes ──────────────────────────────────────────────────────────
  {
    id: "hubble", name: "Hubble Space Telescope", model: "/models/sat-hubble.glb",
    agency: "NASA · ESA", orbit: "Low Earth orbit · ~535 km",
    launched: "1990 (STS-31)", size: "13.2 m long · 4.2 m dia", kind: "Telescope",
    fact: "The space telescope that rewrote astronomy — deep fields, the expansion rate, exoplanet atmospheres. Serviced five times by Shuttle crews, it is still observing after 35 years.",
    frame: 3.0,
  },
  {
    id: "jwst", name: "James Webb Space Telescope", model: "/models/craft-jwst.glb",
    agency: "NASA · ESA · CSA", orbit: "Sun–Earth L2 · ~1.5M km",
    launched: "2021 (Ariane 5)", size: "21 × 14 m sunshield", kind: "Telescope",
    fact: "The largest space telescope ever flown — a 6.5 m gold-coated segmented mirror that sees the first galaxies in infrared, shaded from the Sun by a five-layer, tennis-court-sized sunshield.",
    frame: 3.2,
  },
  // ── The first satellites ────────────────────────────────────────────────
  {
    id: "sputnik", name: "Sputnik 1", model: "/models/craft-sputnik.glb",
    agency: "USSR", orbit: "Low Earth orbit · 215–939 km · 65.1°",
    launched: "4 Oct 1957", size: "0.58 m sphere", kind: "Satellite",
    fact: "The first artificial satellite — a polished aluminium sphere with four whip antennas that beeped for 21 days and began the Space Age, triggering the space race overnight.",
    frame: 2.6,
  },
  {
    id: "explorer1", name: "Explorer 1", model: "/models/sat-sputnik.glb",
    agency: "USA (JPL · Army)", orbit: "Low Earth orbit · 358–2,550 km",
    launched: "1 Feb 1958", size: "2.0 × 0.15 m", kind: "Satellite",
    fact: "The first US satellite. Its cosmic-ray detector discovered the Van Allen radiation belts — the first major scientific discovery of the space age.",
    frame: 2.8,
  },
  {
    id: "voyager", name: "Voyager 1 & 2", model: "/models/craft-voyager.glb",
    agency: "NASA", orbit: "The Grand Tour → interstellar space",
    launched: "1977", size: "3.7 m dish", kind: "Probe",
    fact: "The Grand Tour probes — Jupiter, Saturn, and for Voyager 2, Uranus and Neptune. Now the most distant human objects, both in interstellar space, still faintly transmitting after nearly 50 years, each carrying a Golden Record.",
    frame: 3.6,
  },
  // ── Planetary orbiters & flybys ─────────────────────────────────────────
  {
    id: "cassini", name: "Cassini", model: "/models/craft-cassini.glb",
    agency: "NASA · ESA · ASI", orbit: "Saturn orbit · 2004–2017",
    launched: "1997 · arrived 2004", size: "~6.8 m", kind: "Orbiter",
    fact: "Orbited Saturn for 13 years, delivered ESA's Huygens probe to Titan's surface, and discovered plumes erupting from Enceladus. It ended in a deliberate plunge into Saturn — the 'Grand Finale', 2017.",
    frame: 3.4,
  },
  {
    id: "juno", name: "Juno", model: "/models/craft-juno.glb",
    agency: "NASA", orbit: "Jupiter polar orbit · 53-day",
    launched: "2011 · arrived 2016", size: "~20 m solar span", kind: "Orbiter",
    fact: "A polar orbiter with three enormous solar wings (Jupiter gets ~4% of Earth's sunlight), probing the giant's deep structure, gravity field, and spectacular polar aurorae.",
    frame: 3.8,
  },
  {
    id: "mro", name: "Mars Reconnaissance Orbiter", model: "/models/craft-mro.glb",
    agency: "NASA", orbit: "Mars orbit · ~250–320 km",
    launched: "2005", size: "~6.5 m span", kind: "Orbiter",
    fact: "Its HiRISE camera returns the sharpest images ever taken of the Martian surface — resolving objects under a metre across — and it relays data for the rovers on the ground.",
    frame: 3.2,
  },
  {
    id: "maven", name: "MAVEN", model: "/models/craft-maven.glb",
    agency: "NASA", orbit: "Mars · 150–6,200 km elliptical",
    launched: "2013", size: "~11 m span", kind: "Orbiter",
    fact: "Mars Atmosphere and Volatile EvolutioN — measures how Mars lost its atmosphere to space over billions of years, dip-diving into the upper atmosphere to sample it directly.",
    frame: 3.4,
  },
  {
    id: "messenger", name: "MESSENGER", model: "/models/craft-messenger.glb",
    agency: "NASA", orbit: "Mercury orbit · 2011–2015",
    launched: "2004 · arrived 2011", size: "~1.4 m bus", kind: "Orbiter",
    fact: "The first spacecraft to orbit Mercury, shielded from the Sun by a big ceramic sunshade. It mapped the whole planet and found water ice hiding in permanently-shadowed polar craters before impacting in 2015.",
    frame: 3.0,
  },
  {
    id: "bepi", name: "BepiColombo", model: "/models/craft-bepi.glb",
    agency: "ESA · JAXA", orbit: "Mercury transfer · arriving 2026",
    launched: "2018", size: "two stacked orbiters", kind: "Orbiter",
    fact: "A joint ESA/JAXA mission of two orbiters, using repeated planetary flybys and ion engines to brake into orbit around Mercury — arrival is planned for late 2026.",
    frame: 3.2,
  },
  {
    id: "akatsuki", name: "Akatsuki", model: "/models/craft-akatsuki.glb",
    agency: "JAXA", orbit: "Venus elliptical orbit",
    launched: "2010 · arrived 2015", size: "~1.4 m bus", kind: "Orbiter",
    fact: "Japan's Venus Climate Orbiter, studying the planet's super-rotating atmosphere — after its first orbit-insertion failed in 2010, engineers coaxed it into orbit on a second attempt five years later.",
    frame: 3.0,
  },
  {
    id: "venus-express", name: "Venus Express", model: "/models/craft-venusexpress.glb",
    agency: "ESA", orbit: "Venus polar orbit · 2006–2014",
    launched: "2005 · arrived 2006", size: "~1.5 m bus", kind: "Orbiter",
    fact: "ESA's first Venus mission, mapping the atmosphere and surface temperatures for eight years before running out of fuel and descending into the crushing atmosphere in 2014.",
    frame: 3.0,
  },
  {
    id: "lro", name: "Lunar Reconnaissance Orbiter", model: "/models/craft-lro.glb",
    agency: "NASA", orbit: "Lunar polar orbit · ~50 km",
    launched: "2009", size: "~4.3 m span", kind: "Orbiter",
    fact: "Mapping the Moon in fine detail since 2009 — including the Apollo landing sites (its images show the descent stages and rover tracks) and the permanently-shadowed polar craters that may hold ice.",
    frame: 3.2,
  },
  // ── Deep-space & sample-return ──────────────────────────────────────────
  {
    id: "new-horizons", name: "New Horizons", model: "/models/craft-newhorizons.glb",
    agency: "NASA", orbit: "Pluto flyby → Kuiper Belt",
    launched: "2006 · Pluto 2015", size: "~2.1 m dish", kind: "Flyby",
    fact: "The fastest spacecraft ever launched, it crossed the solar system in nine years to give humanity its first close look at Pluto in 2015, then flew past the Kuiper Belt object Arrokoth in 2019.",
    frame: 3.0,
  },
  {
    id: "parker", name: "Parker Solar Probe", model: "/models/craft-parker.glb",
    agency: "NASA", orbit: "Solar corona · <7M km from the Sun",
    launched: "2018", size: "2.3 m heat shield", kind: "Probe",
    fact: "The first spacecraft to 'touch the Sun', diving through the corona behind a white carbon-composite heat shield that faces 1,400 °C while the instruments behind it stay near room temperature. The fastest human-made object ever.",
    frame: 2.8,
  },
  {
    id: "pioneer", name: "Pioneer 10 & 11", model: "/models/craft-pioneer.glb",
    agency: "NASA", orbit: "First to the outer planets → interstellar",
    launched: "1972 · 1973", size: "2.7 m dish", kind: "Probe",
    fact: "The trailblazers — first to cross the asteroid belt and first to fly past Jupiter (and, for Pioneer 11, Saturn). Each carries the famous engraved plaque showing where and when they came from.",
    frame: 3.2,
  },
  {
    id: "lucy", name: "Lucy", model: "/models/craft-lucy.glb",
    agency: "NASA", orbit: "Jupiter's Trojan asteroids",
    launched: "2021", size: "~14.3 m array span", kind: "Flyby",
    fact: "The first mission to Jupiter's Trojan asteroids — fossils of planet formation trapped in Jupiter's orbit. Its two enormous circular solar arrays power a 12-year tour past a record number of asteroids.",
    frame: 3.8,
  },
  {
    id: "hayabusa2", name: "Hayabusa2", model: "/models/craft-hayabusa.glb",
    agency: "JAXA", orbit: "Asteroid Ryugu → Earth return",
    launched: "2014 · returned 2020", size: "~6 m span", kind: "Sample return",
    fact: "Touched down on the asteroid Ryugu, fired a projectile to make a fresh crater, collected subsurface samples, and returned them to Earth in a capsule in 2020 — then flew on to a new target.",
    frame: 3.2,
  },
  {
    id: "osiris", name: "OSIRIS-APEX", model: "/models/craft-osiris.glb",
    agency: "NASA", orbit: "Asteroid Bennu → Apophis",
    launched: "2016", size: "~6 m span", kind: "Sample return",
    fact: "As OSIRIS-REx it grabbed a sample from asteroid Bennu and dropped it to Earth in 2023 — then, renamed OSIRIS-APEX, set course for the asteroid Apophis to study it during its close Earth pass in 2029.",
    frame: 3.2,
  },
  // ── Constellations ──────────────────────────────────────────────────────
  {
    id: "gps", name: "GPS", model: "/models/sat-gps.glb",
    agency: "US Space Force", orbit: "Medium Earth orbit · ~20,200 km",
    launched: "1978 (first) · Block III now", size: "~2.5 m bus · ~18 m span", kind: "Constellation",
    fact: "A constellation of ~31 satellites; any point on Earth can see at least four at once, which is how your phone triangulates where it is. Its atomic clocks must account for relativity to stay accurate.",
    frame: 3.4,
  },
  {
    id: "starlink", name: "Starlink", model: "/models/satellite-starlink.glb",
    agency: "SpaceX", orbit: "Low Earth orbit · ~550 km · 53°",
    launched: "2019 (first batch)", size: "2.8 × 1.4 m flat", kind: "Constellation",
    fact: "The largest satellite constellation ever built — thousands of flat-pack satellites delivering broadband, now the majority of all active satellites in orbit.",
    frame: 3.0,
  },
]
