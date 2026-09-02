import type { Metadata } from "next"
import { CustomCursor } from "@/components/custom-cursor"
import { LocalizedHome } from "@/components/localized-home"
import { hreflangLanguages, SITE } from "@/lib/i18n-seo"

export const metadata: Metadata = {
  title: "Ankur Sinha — Design × Engineering × KI",
  description:
    "UX-Designer von Beruf, ich erforsche KI, indem ich sie baue. Lokalisierte Übersicht der Arbeit von Ankur Sinha — die vollständige Seite ist auf Englisch.",
  alternates: { canonical: `${SITE}/de`, languages: hreflangLanguages },
}

export default function GermanHome() {
  return (
    <>
      <CustomCursor />
      <main id="main">
        <LocalizedHome locale="de" />
      </main>
    </>
  )
}
