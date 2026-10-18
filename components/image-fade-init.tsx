"use client"

import { useEffect } from "react"

/**
 * ImageFadeInit — one small client helper that gives EVERY image on the page a
 * smooth fade-in instead of a hard pop-in, without touching each <img> tag.
 *
 * It finds images tagged `img-fade` (and lazy content images) and marks them
 * `loaded` the instant they're complete — or on their `load` event if not yet.
 * A MutationObserver covers images added after first paint (route changes,
 * client-rendered sections). Cached/already-complete images are handled, so an
 * image can never get stuck transparent. Reduced-motion is handled in CSS.
 *
 * Mounted once in the root layout.
 */
export function ImageFadeInit() {
  useEffect(() => {
    const mark = (img: HTMLImageElement) => {
      if (img.classList.contains("loaded")) return
      if (img.complete && img.naturalWidth > 0) {
        img.classList.add("loaded")
      } else {
        const done = () => img.classList.add("loaded")
        img.addEventListener("load", done, { once: true })
        img.addEventListener("error", done, { once: true }) // never strand a broken img
      }
    }
    const scan = (root: ParentNode = document) =>
      root.querySelectorAll<HTMLImageElement>("img.img-fade").forEach(mark)

    scan()
    // Catch images added later (route transitions, deferred sections).
    const obs = new MutationObserver((muts) => {
      for (const m of muts)
        for (const node of m.addedNodes) {
          if (node instanceof HTMLImageElement && node.classList.contains("img-fade")) mark(node)
          else if (node instanceof HTMLElement) scan(node)
        }
    })
    obs.observe(document.body, { childList: true, subtree: true })
    return () => obs.disconnect()
  }, [])

  return null
}
