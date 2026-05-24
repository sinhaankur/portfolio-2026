import type { Metadata } from "next"
import { StarCleaverPage } from "./star-cleaver-page"

export const metadata: Metadata = {
  title: "Star Cleaver — calibration sequence · Ankur Sinha",
  description:
    "A 3D shoot-the-planet game set in the Universe Engine register. The Cleaver is an autonomous weapon mind running a seven-world calibration sequence before its real mission. Working title, in development.",
}

export default function Page() {
  return <StarCleaverPage />
}
