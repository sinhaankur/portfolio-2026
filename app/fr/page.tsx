import type { Metadata } from "next"
import { CustomCursor } from "@/components/custom-cursor"
import { LocalizedHome } from "@/components/localized-home"
import { hreflangLanguages, SITE } from "@/lib/i18n-seo"

export const metadata: Metadata = {
  title: "Ankur Sinha — Design × Ingénierie × IA",
  description:
    "Designer UX de métier, j'explore l'IA en la construisant. Aperçu localisé du travail d'Ankur Sinha — le site complet est en anglais.",
  alternates: { canonical: `${SITE}/fr`, languages: hreflangLanguages },
}

export default function FrenchHome() {
  return (
    <>
      <CustomCursor />
      <main id="main">
        <LocalizedHome locale="fr" />
      </main>
    </>
  )
}
