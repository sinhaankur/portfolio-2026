/**
 * craft-anatomy — curated "what parts it has + how it was built" data for each
 * satellite archetype the engine renders.
 *
 * Keyed by the same ArchetypeId the field classifies a selected satellite into
 * (iss / hubble / starlink2 / gps / iridium …). Each entry is real, published
 * spacecraft knowledge — the major PARTS (bus, arrays, antennas, instruments)
 * and a BUILD spec (builder, mass, power, purpose, a key fact). This is honest
 * reference data, not invented geometry: where a design isn't public (e.g.
 * Kuiper), the copy says so.
 *
 * Sources: manufacturer/agency published specs + spaceflight references
 * (NASA/ESA fact sheets, Gunter's Space Page, operator press kits). Figures are
 * representative of the class, rounded — a teaching read, not a datasheet.
 */

export type CraftPart = {
  /** the component's name. */
  name: string
  /** what it does, one line. */
  role: string
}

export type CraftAnatomy = {
  /** the class this describes (matches the archetype label). */
  title: string
  /** one-line "what this craft is for". */
  purpose: string
  /** who builds / operates the class. */
  builder: string
  /** representative launch mass. */
  mass: string
  /** representative electrical power (solar-array output). */
  power: string
  /** the major real components. */
  parts: CraftPart[]
  /** a memorable, true build fact. */
  built: string
  /** true where the real design isn't public and the model is an envelope. */
  approx?: boolean
}

export const CRAFT_ANATOMY: Record<string, CraftAnatomy> = {
  iss: {
    title: "International Space Station",
    purpose: "A permanently crewed micro-gravity research laboratory in low Earth orbit.",
    builder: "NASA · Roscosmos · ESA · JAXA · CSA (a 15-nation partnership)",
    mass: "~420,000 kg",
    power: "~75–90 kW (eight solar arrays)",
    parts: [
      { name: "Integrated Truss Structure", role: "The ~109 m backbone that carries the arrays, radiators and external payloads." },
      { name: "Solar array wings (×8)", role: "Four pairs of photovoltaic wings that generate all station power." },
      { name: "Pressurized modules", role: "The crew's living + lab volume — Zarya, Unity, Destiny, Columbus, Kibō, and more." },
      { name: "Thermal radiators", role: "Reject waste heat so the station doesn't cook in sunlight." },
      { name: "Robotic arm (Canadarm2)", role: "Berths visiting vehicles and moves payloads outside." },
      { name: "Docking ports", role: "Where crew + cargo ships (Dragon, Soyuz, Cygnus) attach." },
    ],
    built: "Assembled in orbit across ~40 flights from 1998 — the single most expensive object ever built (~$150 B).",
  },
  hubble: {
    title: "Hubble Space Telescope",
    purpose: "A 2.4 m optical/UV space telescope — above the atmosphere's blur, imaging the deep universe since 1990.",
    builder: "NASA / ESA (Lockheed + Perkin-Elmer optics)",
    mass: "~11,100 kg",
    power: "~2.8 kW (two solar wings)",
    parts: [
      { name: "2.4 m primary mirror", role: "Collects and focuses light — the heart of the telescope." },
      { name: "Aperture door", role: "Opens to admit starlight; shields the optics from the sun." },
      { name: "Solar array wings (×2)", role: "Power the instruments and recharge the batteries." },
      { name: "Science instruments", role: "Cameras + spectrographs (WFC3, COS, ACS…) at the focal plane." },
      { name: "High-gain antennas", role: "Relay data to the ground via the TDRS network." },
      { name: "Reaction wheels + gyros", role: "Point the telescope with arc-second precision, no thrusters." },
    ],
    built: "The famous 1990 mirror flaw (spherical aberration) was fixed by astronauts in 1993 — the first of five servicing missions.",
  },
  telescope: {
    title: "Space telescope / observatory",
    purpose: "An orbiting observatory imaging the sky in visible, UV, IR or X-ray, free of the atmosphere.",
    builder: "Space agencies + prime contractors (varies by mission)",
    mass: "~1,000–6,000 kg (class-dependent)",
    power: "~1–5 kW",
    parts: [
      { name: "Primary mirror / optics", role: "Collects light onto the instruments." },
      { name: "Sunshield / baffle", role: "Keeps stray light + heat off the optics." },
      { name: "Focal-plane instruments", role: "Cameras and spectrographs that record the science." },
      { name: "Solar arrays", role: "Power the spacecraft + instruments." },
      { name: "Fine-guidance sensors", role: "Lock onto guide stars for steady pointing." },
    ],
    built: "Observatories trade aperture for stability — most point via reaction wheels to arc-second accuracy.",
  },
  starlink: {
    title: "Starlink v1 (flat-pack)",
    purpose: "A broadband internet relay in a low-Earth constellation — one of thousands beaming service worldwide.",
    builder: "SpaceX",
    mass: "~260 kg",
    power: "~2–3 kW (single roll-out array)",
    parts: [
      { name: "Flat-panel bus", role: "The slab body — dozens stack flat in one rocket, no dispenser." },
      { name: "Single solar array", role: "Unfolds after deploy to power the phased-array radios." },
      { name: "Phased-array antennas", role: "Steer beams electronically to user terminals below." },
      { name: "Krypton Hall thrusters", role: "Ion propulsion to raise orbit + deorbit at end of life." },
      { name: "Star trackers", role: "Know which way it's pointing to aim the beams." },
    ],
    built: "Designed to be mass-produced + stacked flat — a single Falcon 9 lofts ~60 at once.",
  },
  starlink2: {
    title: "Starlink v2 Mini",
    purpose: "The current-generation Starlink — bigger, higher-capacity broadband relays.",
    builder: "SpaceX",
    mass: "~800 kg",
    power: "~8 kW (twin arrays)",
    parts: [
      { name: "Enlarged flat bus", role: "More capacity + backhaul than v1, still stacks flat." },
      { name: "Twin solar wings", role: "~3× the power of v1 for higher throughput." },
      { name: "Phased-array + optical inter-satellite links", role: "Laser cross-links relay data sat-to-sat, no ground hop." },
      { name: "Argon Hall thrusters", role: "More-efficient ion propulsion than v1's krypton." },
    ],
    built: "First flew Feb 2023; the laser cross-links let the network route data in space, over oceans + poles.",
  },
  gps: {
    title: "GPS III-class navigation satellite",
    purpose: "Broadcasts precise time + position signals from medium Earth orbit for global navigation.",
    builder: "Lockheed Martin (GPS III) for the U.S. Space Force",
    mass: "~2,200 kg",
    power: "~4 kW",
    parts: [
      { name: "Atomic clocks", role: "Rubidium clocks so stable they define the signal's timing — the core of GPS." },
      { name: "Navigation antenna", role: "Beams the ranging signal to the whole visible Earth disc." },
      { name: "Solar arrays (×2)", role: "Power the clocks + transmitters through eclipse seasons." },
      { name: "Cross-link antennas", role: "Talk to other GPS craft + control." },
    ],
    built: "The whole system works because the clocks are corrected for relativity — they'd drift ~38 µs/day otherwise.",
  },
  iridium: {
    title: "Iridium NEXT",
    purpose: "A voice + data relay in a 66-satellite polar constellation covering the entire planet.",
    builder: "Thales Alenia Space (bus) for Iridium",
    mass: "~860 kg",
    power: "~2 kW",
    parts: [
      { name: "Main mission antenna", role: "The phased array serving handsets + terminals below." },
      { name: "Inter-satellite link antennas", role: "Cross-links to neighbours — the network works without ground stations underneath." },
      { name: "Solar array wings", role: "Power the payload." },
      { name: "Hosted payloads (Aireon)", role: "Also carries ADS-B receivers that track aircraft globally." },
    ],
    built: "The constellation cross-links sat-to-sat, so a call can route through space from pole to pole.",
  },
  oneweb: {
    title: "OneWeb bus",
    purpose: "A broadband internet relay in a low-Earth constellation, complementary to Starlink.",
    builder: "Airbus OneWeb Satellites",
    mass: "~150 kg",
    power: "~1.5 kW",
    parts: [
      { name: "Compact bus", role: "A small, mass-produced body — one of the first true assembly-line satellites." },
      { name: "Solar array", role: "Powers the Ku-band payload." },
      { name: "Ku-band antennas", role: "Beam broadband to user terminals." },
      { name: "Electric propulsion", role: "Raises orbit + maintains the slot." },
    ],
    built: "Built on a Florida production line at ~2 satellites/day — a first for the industry.",
  },
  kuiper: {
    title: "Amazon Kuiper (approximate)",
    purpose: "Amazon's planned low-Earth broadband constellation — a Starlink competitor.",
    builder: "Amazon",
    mass: "~600 kg (reported)",
    power: "—",
    parts: [
      { name: "Flat bus", role: "Stacks for bulk launch (like Starlink)." },
      { name: "Solar array", role: "Powers the phased-array payload." },
      { name: "Phased-array antennas", role: "Steer beams to customer terminals." },
    ],
    built: "The exact design isn't public — this model is the known envelope, labelled as an approximation, not the real craft.",
    approx: true,
  },
  comsat: {
    title: "Communications satellite (GEO dish)",
    purpose: "Relays TV, data + telephony from geostationary orbit — parked over one spot on Earth.",
    builder: "Boeing / Airbus / Lockheed / Thales (varies)",
    mass: "~3,000–6,000 kg",
    power: "~10–20 kW",
    parts: [
      { name: "Large dish reflectors", role: "Focus the up/downlink beams onto service regions." },
      { name: "Transponders", role: "Receive, amplify + retransmit the carrier signals." },
      { name: "Big solar wings", role: "GEO comsats are power-hungry — large arrays feed the transponders." },
      { name: "Station-keeping thrusters", role: "Hold the exact orbital slot against drift." },
    ],
    built: "At GEO it orbits once per day, so it appears fixed in the sky — that's why your dish never moves.",
  },
  weather: {
    title: "Weather / Earth-observation satellite",
    purpose: "Images Earth's weather + surface from GEO or sun-synchronous orbit.",
    builder: "NOAA / EUMETSAT / agencies + primes",
    mass: "~2,000–3,000 kg",
    power: "~2–5 kW",
    parts: [
      { name: "Imager / radiometer", role: "The main camera — visible + infrared bands for cloud, land + sea." },
      { name: "Sounder", role: "Measures the atmosphere's temperature + moisture in profile." },
      { name: "Solar array", role: "Powers the instruments." },
      { name: "High-gain antenna", role: "Downlinks the imagery in near-real-time." },
    ],
    built: "GEO weather sats (GOES, Meteosat) give the whole-disc Earth loops you see on the forecast.",
  },
  eobus: {
    title: "Earth-observation bus (Sentinel-class)",
    purpose: "Sun-synchronous imaging + radar of the land, ocean + atmosphere.",
    builder: "Airbus / Thales / agencies",
    mass: "~1,000–2,300 kg",
    power: "~1.5–3 kW",
    parts: [
      { name: "Optical or SAR payload", role: "A high-res camera, or a synthetic-aperture radar that sees through cloud + dark." },
      { name: "Deployable solar array", role: "Powers the imaging payload." },
      { name: "X-band downlink antenna", role: "Dumps large image volumes to ground stations each pass." },
      { name: "Reaction wheels", role: "Slew the craft to point + track ground targets." },
    ],
    built: "Sun-synchronous orbits cross each spot at the same local time — consistent lighting for comparing images.",
  },
  station: {
    title: "Space station (crewed)",
    purpose: "A crewed orbital outpost — living + working volume with power, life support + docking.",
    builder: "National space agencies",
    mass: "~tens of thousands of kg",
    power: "~tens of kW (solar arrays)",
    parts: [
      { name: "Pressurized modules", role: "The habitable + lab volume." },
      { name: "Solar array wings", role: "Generate station power." },
      { name: "Docking ports", role: "Where crew + cargo craft attach." },
      { name: "Radiators", role: "Reject waste heat." },
    ],
    built: "A crewed station is really a power + life-support plant that happens to have people in it.",
  },
  smallsat: {
    title: "Smallsat / microsat",
    purpose: "A compact commercial or research satellite — imaging, IoT, tech-demo, science.",
    builder: "Planet / Spire / many new-space firms",
    mass: "~5–100 kg",
    power: "~50–500 W",
    parts: [
      { name: "Compact bus", role: "A small standardized body — cheap + quick to build in numbers." },
      { name: "Body-mounted or deployable panels", role: "Modest power for a modest payload." },
      { name: "Payload", role: "A camera, radio receiver, or experiment — the reason it's up there." },
      { name: "Reaction wheels / magnetorquers", role: "Small actuators to point the craft." },
    ],
    built: "Flocks of these (Planet's Doves) re-image the whole Earth daily — quantity over individual size.",
  },
  cubesat: {
    title: "CubeSat",
    purpose: "A tiny standardized satellite built from 10 cm cubes ('U' units) — the entry point to space.",
    builder: "Universities · startups · agencies",
    mass: "~1–10 kg",
    power: "~2–20 W",
    parts: [
      { name: "1U–12U frame", role: "Standard 10 cm modular cube structure — cheap + rideshare-friendly." },
      { name: "Body-mounted solar cells", role: "Cover the faces; sometimes tiny deployable panels." },
      { name: "Payload board", role: "A camera, sensor or radio — often the whole point is one experiment." },
      { name: "UHF/VHF antenna", role: "A thin whip or tape antenna for the ground link." },
    ],
    built: "The 10 cm 'U' standard (1999, Cal Poly + Stanford) made space reachable for a student team's budget.",
  },
  rocketbody: {
    title: "Spent rocket upper stage",
    purpose: "The discarded final stage that placed a payload in orbit — now inert debris.",
    builder: "The launch provider (SpaceX, ULA, Roscosmos…)",
    mass: "~1,000–4,000 kg (dry)",
    power: "none (inert)",
    parts: [
      { name: "Engine + nozzle", role: "The upper-stage engine that did the orbital insertion burn." },
      { name: "Empty propellant tanks", role: "The bulk of the body — now dry." },
      { name: "Interstage / adapter", role: "Where the payload was mounted before separation." },
    ],
    built: "Left on orbit after the payload separates — a major debris category; leftover propellant can later explode into fragments.",
  },
  debris: {
    title: "Orbital debris fragment",
    purpose: "An uncontrolled piece of a broken-up satellite or rocket — tracked but dead.",
    builder: "— (fragment)",
    mass: "grams to ~kg",
    power: "none",
    parts: [
      { name: "Fragment", role: "A shard of structure, insulation, or a shattered component." },
    ],
    built: "Fragments come from collisions + explosions (Fengyun-1C, Cosmos-2251). At ~7 km/s even a bolt is a hazard.",
  },
}

export function anatomyFor(archetypeId?: string | null): CraftAnatomy | null {
  if (!archetypeId) return null
  return CRAFT_ANATOMY[archetypeId] ?? null
}
