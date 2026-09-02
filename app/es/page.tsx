import type { Metadata } from "next"
import { CustomCursor } from "@/components/custom-cursor"
import { LocalizedHome } from "@/components/localized-home"
import { hreflangLanguages, SITE } from "@/lib/i18n-seo"

export const metadata: Metadata = {
  title: "Ankur Sinha — Diseño × Ingeniería × IA",
  description:
    "Diseñador UX de oficio, explorando la IA construyéndola. Resumen localizado del trabajo de Ankur Sinha — el sitio completo está en inglés.",
  alternates: { canonical: `${SITE}/es`, languages: hreflangLanguages },
}

export default function SpanishHome() {
  return (
    <>
      <CustomCursor />
      <main id="main">
        <LocalizedHome locale="es" />
      </main>
    </>
  )
}
