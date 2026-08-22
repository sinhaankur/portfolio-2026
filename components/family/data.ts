import type { FamilyMedia } from "./types"

/**
 * The media shown on /family — a private corner for the people I love.
 *
 * HOW TO ADD YOUR OWN:
 *  1. Drop each photo or video into `public/img/family/`.
 *       • Images:  .webp / .jpg / .png  (portrait 3:4 looks best in the panels)
 *       • Videos:  .mp4 (H.264) so every browser can play it inline
 *  2. Add / edit an entry below.
 *       • `src`      — path under /public (e.g. "/img/family/diwali.webp")
 *       • `type`     — "image" or "video"
 *       • `people`   — everyone in the shot, e.g. ["Shweta", "Ritam"]. This is
 *                      what powers the name picker: selecting a name shows every
 *                      moment that person is in. New names appear automatically.
 *       • `caption`  — short line shown under the panel when it's open.
 *
 * The accordion shows however many entries match the picked name (or all of
 * them when "Everyone" is selected). Order top-to-bottom = left-to-right.
 */
export const familyMedia: FamilyMedia[] = [
  { id: "anita",  type: "image", src: "/img/family/anita-sinha-01.webp", people: ["Anita Sinha"],   caption: "Anita Sinha" },
  { id: "anita2", type: "image", src: "/img/family/anita-sinha-02.webp", people: ["Anita Sinha"],   caption: "Anita Sinha" },
  { id: "anita3", type: "image", src: "/img/family/anita-sinha-03.webp", people: ["Anita Sinha"],   caption: "Anita Sinha" },
  { id: "anita4", type: "image", src: "/img/family/anita-sinha-04.webp", people: ["Anita Sinha"],   caption: "Anita Sinha" },
  { id: "0",  type: "image", src: "/img/family/shweta-01.webp",       people: ["Shweta"],           caption: "Shweta" },
  { id: "0b", type: "image", src: "/img/family/shweta-02.webp",       people: ["Shweta"],           caption: "Shweta" },
  { id: "as", type: "image", src: "/img/family/ankur-shweta-01.webp", people: ["Shweta"],           caption: "Ankur & Shweta" },
  { id: "as2",type: "image", src: "/img/family/ankur-shweta-02.webp", people: ["Shweta"],           caption: "Ankur & Shweta" },
  { id: "1",  type: "image", src: "/img/family/shweta-ritam-01.webp", people: ["Shweta", "Ritam"],  caption: "Shweta & Ritam" },
  { id: "2",  type: "image", src: "/img/family/shweta-ritam-02.webp", people: ["Shweta", "Ritam"],  caption: "Shweta & Ritam" },
  { id: "3",  type: "image", src: "/img/family/shweta-ritam-03.webp", people: ["Shweta", "Ritam"],  caption: "Shweta & Ritam" },
  { id: "4",  type: "image", src: "/img/family/shweta-ritam-04.webp", people: ["Shweta", "Ritam"],  caption: "Shweta & Ritam" },
]

/**
 * Every distinct person across the media, in first-appearance order. Drives the
 * name picker — add a person to a photo's `people` and they show up here for free.
 */
export const familyPeople: string[] = Array.from(
  new Set(familyMedia.flatMap((m) => m.people ?? [])),
)
