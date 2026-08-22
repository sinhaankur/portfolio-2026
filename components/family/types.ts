export interface FamilyMedia {
  /** Stable id (any unique string). */
  id: string
  /** Whether `src` points at an image or a video file. */
  type: "image" | "video"
  /** Path under /public, e.g. "/img/family/diwali.webp". */
  src: string
  /** Everyone in the shot, e.g. ["Shweta", "Ritam"] — powers the name picker. */
  people?: string[]
  /** Short line shown under the panel when it's open. */
  caption?: string
}
