import type { Artwork } from "./types"

/**
 * The photos shown on /photos. Drop your images into `public/img/photos/` and
 * edit this list — set `image` to the file path, and give each a `title`, a
 * `year` (used as the small caption), and keep `artist` as your name.
 *
 * These start as placeholders (SVG gradients under public/img/photos/) so the
 * page works immediately; replace them with your real photos when ready.
 */
export const artworks: Artwork[] = [
  { id: "1", image: "/img/photos/placeholder-1.svg", title: "Untitled 01", year: "2026", artist: "Ankur Sinha" },
  { id: "2", image: "/img/photos/placeholder-2.svg", title: "Untitled 02", year: "2026", artist: "Ankur Sinha" },
  { id: "3", image: "/img/photos/placeholder-3.svg", title: "Untitled 03", year: "2026", artist: "Ankur Sinha" },
  { id: "4", image: "/img/photos/placeholder-4.svg", title: "Untitled 04", year: "2026", artist: "Ankur Sinha" },
  { id: "5", image: "/img/photos/placeholder-5.svg", title: "Untitled 05", year: "2026", artist: "Ankur Sinha" },
]
