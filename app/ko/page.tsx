import type { Metadata } from "next"
import { CustomCursor } from "@/components/custom-cursor"
import { LocalizedHome } from "@/components/localized-home"
import { hreflangLanguages, SITE } from "@/lib/i18n-seo"

export const metadata: Metadata = {
  title: "안쿠르 신하 — 디자인 × 엔지니어링 × AI",
  description:
    "본업은 UX 디자이너, 직접 만들며 AI를 탐구합니다. 안쿠르 신하 작업의 현지화 개요 — 전체 사이트는 영어로 제공됩니다.",
  alternates: {
    canonical: `${SITE}/ko`,
    languages: hreflangLanguages,
  },
}

export default function KoreanHome() {
  return (
    <>
      <CustomCursor />
      <main id="main">
        <LocalizedHome locale="ko" />
      </main>
    </>
  )
}
