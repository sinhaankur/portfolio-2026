/** A single photo in the /photos gallery slider. */
export type Artwork = {
  id: string
  /** path under /public, e.g. "/img/photos/dune.jpg" */
  image: string
  title: string
  /** year or place caption shown as the mono eyebrow */
  year: string
  /** attribution line ("by …") — for these, it's Ankur */
  artist: string
}
