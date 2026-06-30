import type { Metadata } from "next"
import { canonicalPath } from "@/lib/seo"

export const metadata: Metadata = {
  ...canonicalPath("/lab/optical-flow"),
  title: "Optical Flow — feature tracking, live in the browser",
  description:
    "A from-scratch port of Shi-Tomasi corner detection and Lucas-Kanade optical flow to TypeScript, running live on your webcam — watch yourself resolve into tracked feature points. No OpenCV, no server: the classic computer-vision algorithms, by hand.",
}

export default function OpticalFlowLayout({ children }: { children: React.ReactNode }) {
  return children
}
