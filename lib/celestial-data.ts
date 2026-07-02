/**
 * Celestial body data for /lab/celestial.
 *
 * Shared between the page (server) and the orrery (client). Ordered outward
 * from the Sun. `img` = webp poster, `glb` = interactive model (Git LFS),
 * `relSize` = a gentle visual size factor for the orbital rail (not to scale —
 * real ratios would make Mercury invisible next to the Sun).
 */

export type CelestialBody = {
  name: string
  tagline: string
  img: string
  glb: string
  blurb: string
  facts: { label: string; value: string }[]
  features: { name: string; note: string }[]
  accent: string
  relSize?: number
  kind?: "star" | "planet" | "moon" | "dwarf"
}

export const BODIES: CelestialBody[] = [
  {
    name: "Mars",
    tagline: "The Red Planet · 4th from the Sun",
    img: "/img/space/mars-globe.webp",
    glb: "/models/mars-globe.glb",
    accent: "#c1502e",
    kind: "planet",
    relSize: 0.7,
    blurb:
      "A cold desert world half Earth's size, wrapped in a thin CO₂ atmosphere. Its rust comes from iron oxide in the regolith. Mars holds the tallest volcano and the deepest canyon in the solar system — and, beneath the surface and poles, water ice.",
    facts: [
      { label: "Radius", value: "3,390 km" },
      { label: "Gravity", value: "3.72 m/s² (0.38 g)" },
      { label: "Day length", value: "24h 37m (1 sol)" },
      { label: "Year", value: "687 Earth days" },
      { label: "Moons", value: "Phobos · Deimos" },
      { label: "Mean temp", value: "−63 °C" },
    ],
    features: [
      { name: "Olympus Mons", note: "Largest volcano in the solar system — ~22 km tall, ~3× Everest." },
      { name: "Valles Marineris", note: "A canyon system over 4,000 km long — would span the continental US." },
      { name: "Jezero Crater", note: "An ancient river delta — where Perseverance has been roving since 2021." },
      { name: "Polar ice caps", note: "Water and frozen CO₂ that grow and shrink with the Martian seasons." },
    ],
  },
  {
    name: "Moon",
    tagline: "Earth's only natural satellite",
    img: "/img/space/moon-globe.webp",
    glb: "/models/moon-globe.glb",
    accent: "#9ca3af",
    kind: "moon",
    relSize: 0.5,
    blurb:
      "Born ~4.5 billion years ago, likely from a giant impact on the early Earth. It's tidally locked, so we always see the same face. Its dark plains are ancient lava flows (maria); the bright highlands are older, cratered crust. No atmosphere means every impact is preserved.",
    facts: [
      { label: "Radius", value: "1,737 km" },
      { label: "Gravity", value: "1.62 m/s² (0.17 g)" },
      { label: "Distance", value: "384,400 km" },
      { label: "Orbit", value: "27.3 days" },
      { label: "Day temp", value: "+127 °C" },
      { label: "Night temp", value: "−173 °C" },
    ],
    features: [
      { name: "Mare Tranquillitatis", note: "Sea of Tranquility — Apollo 11's 1969 landing site." },
      { name: "Tycho", note: "A young, bright crater with rays of ejecta splashed across the surface." },
      { name: "Highlands", note: "The pale, heavily-cratered ancient crust — the Moon's oldest terrain." },
      { name: "South Pole", note: "Permanently-shadowed craters holding water ice — the target for Artemis." },
    ],
  },
  {
    name: "Sun",
    tagline: "The star at the heart of it all",
    img: "/img/space/sun-globe.webp",
    glb: "/models/sun-globe.glb",
    accent: "#f5a623",
    kind: "star",
    relSize: 2.0,
    blurb:
      "A 4.6-billion-year-old ball of plasma holding 99.86% of the solar system's mass. It fuses ~600 million tonnes of hydrogen into helium every second; that energy takes tens of thousands of years to crawl out from the core, then eight minutes to reach Earth.",
    facts: [
      { label: "Radius", value: "696,000 km" },
      { label: "Mass", value: "333,000 Earths" },
      { label: "Surface", value: "~5,500 °C" },
      { label: "Core", value: "~15 million °C" },
      { label: "Composition", value: "73% H · 25% He" },
      { label: "Age", value: "4.6 billion yrs" },
    ],
    features: [
      { name: "Photosphere", note: "The visible 'surface' — granules of rising plasma, each the size of a country." },
      { name: "Sunspots", note: "Cooler, darker magnetic knots that track the 11-year solar cycle." },
      { name: "Corona", note: "The million-degree outer atmosphere, visible during total eclipses." },
      { name: "Solar wind", note: "A constant stream of particles that shapes every planet's space weather." },
    ],
  },
  {
    name: "Mercury",
    tagline: "Smallest planet · closest to the Sun",
    img: "/img/space/mercury-globe.webp",
    glb: "/models/mercury-globe.glb",
    accent: "#9c8a7a",
    kind: "planet",
    relSize: 0.55,
    blurb:
      "A scorched, airless, cratered world barely larger than the Moon. With almost no atmosphere to trap heat, it swings from baking day to freezing night — the most extreme temperature range of any planet. A year here is just 88 Earth days.",
    facts: [
      { label: "Radius", value: "2,440 km" },
      { label: "Gravity", value: "3.7 m/s² (0.38 g)" },
      { label: "Day", value: "176 Earth days" },
      { label: "Year", value: "88 Earth days" },
      { label: "Day temp", value: "+430 °C" },
      { label: "Night temp", value: "−180 °C" },
    ],
    features: [
      { name: "Caloris Basin", note: "A 1,550 km impact crater — one of the largest in the solar system." },
      { name: "Scarps", note: "Wrinkle ridges where the whole planet shrank as its core cooled." },
      { name: "Polar ice", note: "Water ice survives in permanently-shadowed craters, even this close to the Sun." },
      { name: "No moons", note: "Too close to the Sun to hold onto one." },
    ],
  },
  {
    name: "Venus",
    tagline: "Earth's twin gone wrong",
    img: "/img/space/venus-globe.webp",
    glb: "/models/venus-globe.glb",
    accent: "#d9a441",
    kind: "planet",
    relSize: 0.85,
    blurb:
      "Almost Earth's size, but wrapped in a crushing CO₂ atmosphere 90× denser than ours and clouds of sulfuric acid. A runaway greenhouse makes it the hottest planet — hotter than Mercury — and it spins backwards, so the Sun rises in the west.",
    facts: [
      { label: "Radius", value: "6,052 km" },
      { label: "Gravity", value: "8.87 m/s² (0.9 g)" },
      { label: "Day", value: "243 Earth days" },
      { label: "Year", value: "225 Earth days" },
      { label: "Surface", value: "+465 °C" },
      { label: "Pressure", value: "92× Earth" },
    ],
    features: [
      { name: "Retrograde spin", note: "Rotates backwards — and its day is longer than its year." },
      { name: "Maxwell Montes", note: "Mountains taller than Everest, under sulfuric-acid skies." },
      { name: "Volcanic plains", note: "Vast lava fields; Venus may still be volcanically active today." },
      { name: "Runaway greenhouse", note: "A cautionary tale of what a thick CO₂ blanket can do." },
    ],
  },
  {
    name: "Earth",
    tagline: "The pale blue dot · home",
    img: "/img/space/earth-globe.webp",
    glb: "/models/earth-globe.glb",
    accent: "#3b82f6",
    kind: "planet",
    relSize: 0.9,
    blurb:
      "The only world we know that hosts life — liquid water, a protective magnetic field, and an oxygen atmosphere. 71% ocean, one large Moon that stabilises its tilt, and the only planet not named after a god.",
    facts: [
      { label: "Radius", value: "6,371 km" },
      { label: "Gravity", value: "9.81 m/s² (1 g)" },
      { label: "Day", value: "23h 56m" },
      { label: "Year", value: "365.25 days" },
      { label: "Moons", value: "1 (the Moon)" },
      { label: "Surface", value: "71% water" },
    ],
    features: [
      { name: "Magnetic field", note: "A molten-iron dynamo that shields life from the solar wind." },
      { name: "Plate tectonics", note: "The only planet with active plate tectonics — it recycles its crust." },
      { name: "The biosphere", note: "~8 million species, the only life confirmed anywhere." },
      { name: "One big Moon", note: "Unusually large for the planet — it steadies Earth's axial tilt." },
    ],
  },
  {
    name: "Jupiter",
    tagline: "King of the planets · gas giant",
    img: "/img/space/jupiter-globe.webp",
    glb: "/models/jupiter-globe.glb",
    accent: "#c9a06a",
    kind: "planet",
    relSize: 1.6,
    blurb:
      "A gas giant so massive it's 2.5× all the other planets combined. No solid surface — just deepening layers of hydrogen and helium, banded by 600 km/h jet streams. Its gravity shields the inner planets from many comets and asteroids.",
    facts: [
      { label: "Radius", value: "69,911 km" },
      { label: "Mass", value: "318 Earths" },
      { label: "Day", value: "9h 56m (fastest)" },
      { label: "Year", value: "11.9 Earth yrs" },
      { label: "Moons", value: "95+ known" },
      { label: "Composition", value: "H + He" },
    ],
    features: [
      { name: "Great Red Spot", note: "A storm wider than Earth, raging for at least 350 years." },
      { name: "Galilean moons", note: "Io, Europa, Ganymede, Callisto — Europa hides a subsurface ocean." },
      { name: "Banded clouds", note: "Light zones and dark belts driven by ferocious jet streams." },
      { name: "Faint rings", note: "A thin dusty ring system, discovered by Voyager in 1979." },
    ],
  },
  {
    name: "Saturn",
    tagline: "The ringed jewel · gas giant",
    img: "/img/space/saturn-globe.webp",
    glb: "/models/saturn-globe.glb",
    accent: "#d8c18a",
    kind: "planet",
    relSize: 1.45,
    blurb:
      "The crown of the solar system, circled by the most spectacular ring system — billions of ice and rock chunks, yet on average only ~10 metres thick. So low in density that Saturn would float in water, if you could find a big enough ocean.",
    facts: [
      { label: "Radius", value: "58,232 km" },
      { label: "Mass", value: "95 Earths" },
      { label: "Day", value: "10h 42m" },
      { label: "Year", value: "29.5 Earth yrs" },
      { label: "Moons", value: "140+ known" },
      { label: "Density", value: "< water" },
    ],
    features: [
      { name: "The rings", note: "~280,000 km across but only metres thick — mostly water ice." },
      { name: "Titan", note: "Larger than Mercury, with a thick atmosphere and liquid-methane lakes." },
      { name: "Enceladus", note: "Jets water into space from an ocean beneath its icy shell." },
      { name: "Hexagon storm", note: "A bizarre six-sided jet stream around the north pole." },
    ],
  },
  {
    name: "Uranus",
    tagline: "The tilted ice giant",
    img: "/img/space/uranus-globe.webp",
    glb: "/models/uranus-globe.glb",
    accent: "#9fd8d8",
    kind: "planet",
    relSize: 1.1,
    blurb:
      "An ice giant tipped completely on its side — it orbits the Sun rolling like a ball, likely after an ancient collision. Methane in its atmosphere gives it a pale cyan colour. Each pole gets 42 years of sunlight, then 42 years of dark.",
    facts: [
      { label: "Radius", value: "25,362 km" },
      { label: "Mass", value: "14.5 Earths" },
      { label: "Day", value: "17h 14m" },
      { label: "Year", value: "84 Earth yrs" },
      { label: "Tilt", value: "98° (sideways)" },
      { label: "Moons", value: "28 known" },
    ],
    features: [
      { name: "Extreme tilt", note: "Rotates on its side — the most extreme axial tilt of any planet." },
      { name: "Coldest atmosphere", note: "Drops to −224 °C, the coldest measured in the solar system." },
      { name: "Faint rings", note: "13 dark, narrow rings, discovered in 1977." },
      { name: "One flyby", note: "Only Voyager 2 has ever visited — in 1986." },
    ],
  },
  {
    name: "Neptune",
    tagline: "The windswept far frontier",
    img: "/img/space/neptune-globe.webp",
    glb: "/models/neptune-globe.glb",
    accent: "#3f6fd1",
    kind: "planet",
    relSize: 1.05,
    blurb:
      "The most distant planet — a deep-blue ice giant with the fastest winds in the solar system, up to 2,000 km/h. It was found by maths before it was ever seen: its position was predicted from Uranus's wobble, then confirmed at the telescope.",
    facts: [
      { label: "Radius", value: "24,622 km" },
      { label: "Mass", value: "17 Earths" },
      { label: "Day", value: "16h 6m" },
      { label: "Year", value: "165 Earth yrs" },
      { label: "Winds", value: "up to 2,000 km/h" },
      { label: "Moons", value: "16 known" },
    ],
    features: [
      { name: "Supersonic winds", note: "The fastest winds anywhere in the solar system." },
      { name: "Triton", note: "A large moon orbiting backwards — likely a captured Kuiper Belt object." },
      { name: "Found by maths", note: "Predicted from gravity before it was observed in 1846." },
      { name: "Dark spots", note: "Great storms that appear and vanish over years." },
    ],
  },
  {
    name: "Pluto",
    tagline: "The beloved dwarf planet · Kuiper Belt",
    img: "/img/space/pluto-globe.webp",
    glb: "/models/pluto-globe.glb",
    accent: "#c9a98a",
    kind: "dwarf",
    relSize: 0.45,
    blurb:
      "Demoted from planet to dwarf planet in 2006, Pluto is a small, icy world in the Kuiper Belt with a surprisingly complex surface — nitrogen-ice plains, water-ice mountains, and a giant heart-shaped glacier. It's so far out that sunlight takes ~5 hours to reach it.",
    facts: [
      { label: "Radius", value: "1,188 km" },
      { label: "Gravity", value: "0.62 m/s² (0.06 g)" },
      { label: "Day", value: "6.4 Earth days" },
      { label: "Year", value: "248 Earth yrs" },
      { label: "Moons", value: "5 (incl. Charon)" },
      { label: "Surface", value: "−229 °C" },
    ],
    features: [
      { name: "Tombaugh Regio", note: "The famous heart — a vast nitrogen-ice glacier, brighter than its surroundings." },
      { name: "Sputnik Planitia", note: "A churning plain of frozen nitrogen with no impact craters — geologically young." },
      { name: "Charon", note: "A moon half Pluto's size — they orbit a shared point, almost a double planet." },
      { name: "New Horizons", note: "The only spacecraft to visit — it flew past in July 2015." },
    ],
  },
  {
    name: "Asteroid",
    tagline: "Rocky remnant of the early system",
    img: "/img/space/asteroid-globe.webp",
    glb: "/models/asteroid-globe.glb",
    accent: "#7d7468",
    kind: "dwarf",
    relSize: 0.35,
    blurb:
      "Asteroids are leftover rubble from the solar system's birth, mostly orbiting in the belt between Mars and Jupiter. Too small for gravity to pull them round, they keep irregular, cratered shapes — frozen snapshots of 4.6 billion years ago.",
    facts: [
      { label: "Where", value: "Main belt" },
      { label: "Shape", value: "Irregular" },
      { label: "Size", value: "m to ~940 km" },
      { label: "Count", value: "1M+ known" },
      { label: "Made of", value: "Rock / metal" },
      { label: "Gravity", value: "Negligible" },
    ],
    features: [
      { name: "Irregular shape", note: "Too small for gravity to round them out — they stay lumpy." },
      { name: "Impact history", note: "Surfaces are saturated with craters from billions of years of collisions." },
      { name: "Building blocks", note: "The same material that built the rocky planets." },
      { name: "Visited", note: "Missions like OSIRIS-REx and Hayabusa have sampled them directly." },
    ],
  },
  {
    name: "Comet",
    tagline: "An icy visitor from the deep cold",
    img: "/img/space/comet-globe.webp",
    glb: "/models/comet-globe.glb",
    accent: "#8fbcd6",
    kind: "dwarf",
    relSize: 0.4,
    blurb:
      "Comets are dirty snowballs of ice and dust from the outer solar system. When one swings near the Sun, its ices vaporise into a glowing coma and a tail that always points away from the Sun — sometimes stretching millions of kilometres.",
    facts: [
      { label: "From", value: "Kuiper / Oort" },
      { label: "Nucleus", value: "Ice + dust" },
      { label: "Coma", value: "Glowing gas" },
      { label: "Tail", value: "Anti-sunward" },
      { label: "Size", value: "~1\u201360 km" },
      { label: "Orbit", value: "Often eccentric" },
    ],
    features: [
      { name: "The coma", note: "A glowing halo of gas and dust released as the Sun heats the nucleus." },
      { name: "The tail", note: "Always points away from the Sun, pushed by solar wind and radiation." },
      { name: "Dirty snowball", note: "A nucleus of water ice, frozen gases, rock, and dust." },
      { name: "Rosetta", note: "Landed Philae on comet 67P in 2014 — the first soft landing on a comet." },
    ],
  },
]
