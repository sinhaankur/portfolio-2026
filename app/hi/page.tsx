import type { Metadata } from "next"
import { CustomCursor } from "@/components/custom-cursor"
import { LocalizedHome } from "@/components/localized-home"
import { hreflangLanguages, SITE } from "@/lib/i18n-seo"

export const metadata: Metadata = {
  title: "अंकुर सिन्हा — डिज़ाइन × इंजीनियरिंग × एआई",
  description:
    "पेशे से यूएक्स डिज़ाइनर, एआई को बनाकर समझता हूँ। अंकुर सिन्हा के काम का स्थानीयकृत सारांश — पूरी साइट अंग्रेज़ी में उपलब्ध है।",
  alternates: { canonical: `${SITE}/hi`, languages: hreflangLanguages },
}

export default function HindiHome() {
  return (
    <>
      <CustomCursor />
      <main id="main">
        <LocalizedHome locale="hi" />
      </main>
    </>
  )
}
