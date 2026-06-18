import type { Metadata } from "next"
import { CustomCursor } from "@/components/custom-cursor"
import { LocalizedHome } from "@/components/localized-home"

const SITE = "https://www.sinhaankur.com"

export const metadata: Metadata = {
  title: "أنكور سينها — تصميم × هندسة × ذكاء اصطناعي",
  description:
    "مصمم تجربة مستخدم بالحرفة، يستكشف الذكاء الاصطناعي ببنائه. نظرة عامة مترجمة على أعمال أنكور سينها — الموقع الكامل متوفّر بالإنجليزية.",
  alternates: {
    canonical: `${SITE}/ar`,
    languages: { en: SITE, ar: `${SITE}/ar`, ja: `${SITE}/ja`, "x-default": SITE },
  },
}

export default function ArabicHome() {
  return (
    <>
      <CustomCursor />
      <main id="main">
        <LocalizedHome locale="ar" />
      </main>
    </>
  )
}
