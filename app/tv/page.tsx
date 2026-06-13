import type { Metadata } from "next"
import { TvShell } from "./tv-shell"

export const metadata: Metadata = {
  title: "Universe Engine TV",
  description:
    "A TV-first Universe Engine shell built for LG webOS and other smart TVs, with remote-friendly navigation and a large preview surface.",
}

export default function TvPage() {
  return <TvShell />
}