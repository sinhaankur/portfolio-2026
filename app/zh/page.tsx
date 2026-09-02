import type { Metadata } from "next"
import { CustomCursor } from "@/components/custom-cursor"
import { LocalizedHome } from "@/components/localized-home"
import { hreflangLanguages, SITE } from "@/lib/i18n-seo"

export const metadata: Metadata = {
  title: "安库尔·辛哈 — 设计 × 工程 × 人工智能",
  description:
    "本职是 UX 设计师，通过亲手构建来探索人工智能。安库尔·辛哈作品的本地化概览 —— 完整网站以英文呈现。",
  alternates: { canonical: `${SITE}/zh`, languages: hreflangLanguages },
}

export default function ChineseHome() {
  return (
    <>
      <CustomCursor />
      <main id="main">
        <LocalizedHome locale="zh" />
      </main>
    </>
  )
}
