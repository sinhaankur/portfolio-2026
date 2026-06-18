import type { Metadata } from "next"
import { CustomCursor } from "@/components/custom-cursor"
import { LocalizedHome } from "@/components/localized-home"

const SITE = "https://www.sinhaankur.com"

export const metadata: Metadata = {
  title: "アンクル・シンハ — デザイン × エンジニアリング × AI",
  description:
    "本職はUXデザイナー、つくることでAIを探求しています。アンクル・シンハの作品のローカライズ概要 — フルサイトは英語でご覧いただけます。",
  alternates: {
    canonical: `${SITE}/ja`,
    languages: { en: SITE, ar: `${SITE}/ar`, ja: `${SITE}/ja`, "x-default": SITE },
  },
}

export default function JapaneseHome() {
  return (
    <>
      <CustomCursor />
      <main id="main">
        <LocalizedHome locale="ja" />
      </main>
    </>
  )
}
