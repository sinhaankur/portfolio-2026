/**
 * Lightweight i18n for the localized shell (/, /ar, /ja).
 *
 * Scope is the SHELL only — nav, hero, the manifesto, footer CTAs. Long-form
 * case studies, the Lab, and the astronomy-engine data stay English for now.
 * No i18n library: one typed dictionary, looked up per locale.
 *
 * ⚠️ TRANSLATIONS BELOW ARE AI-DRAFTED AND NEED A FLUENT REVIEW.
 *    Arabic + Japanese were drafted by Claude; nuance (esp. the
 *    "Design × Engineering × AI" positioning and the manifesto voice) should be
 *    checked by a native/fluent speaker before being treated as final.
 *    English is the canonical source (verbatim from the live components).
 */

export type Locale = "en" | "ar" | "ja"
export const LOCALES: Locale[] = ["en", "ar", "ja"]

/** Human label for the language switcher (shown in its own script). */
export const LOCALE_LABEL: Record<Locale, string> = {
  en: "EN",
  ar: "عربية",
  ja: "日本語",
}

/** Path each locale's home lives at. */
export const LOCALE_PATH: Record<Locale, string> = {
  en: "/",
  ar: "/ar",
  ja: "/ja",
}

/** Text direction — Arabic is right-to-left. */
export function dir(locale: Locale): "rtl" | "ltr" {
  return locale === "ar" ? "rtl" : "ltr"
}

/** BCP-47 lang attribute value. */
export function htmlLang(locale: Locale): string {
  return locale
}

export type Dict = {
  // nav
  navWorks: string
  navLab: string
  navSkills: string
  navUsability: string
  navGames: string
  navContact: string
  // hero
  name: string
  heroLine1: string // "DESIGN × ENGINEERING"
  heroLine2: string // "× AI"
  heroValue: string // "UX designer by craft — exploring AI by building it."
  heroDomainEyebrow: string // "02 — DOMAIN"
  heroDomain1: string // "Human–AI"
  heroDomain2: string // "interaction"
  ctaEnterWork: string
  // about / manifesto
  aboutEyebrow: string
  aboutHeading: string
  principle1: string
  principle1Body: string
  principle2: string
  principle2Body: string
  principle3: string
  principle3Body: string
  principle4: string
  principle4Body: string
  // footer / CTA
  footerCTA: string
  footerEmail: string
  // shell chrome
  viewEnglishSite: string // link from localized page → full English site
  langNote: string        // "Showing the localized overview. The full site is in English."
}

const en: Dict = {
  navWorks: "Works",
  navLab: "Lab",
  navSkills: "Skills",
  navUsability: "Usability",
  navGames: "Games",
  navContact: "Contact",
  name: "Ankur Sinha",
  heroLine1: "DESIGN × ENGINEERING",
  heroLine2: "× AI",
  heroValue: "UX designer by craft — exploring AI by building it.",
  heroDomainEyebrow: "DOMAIN",
  heroDomain1: "Human–AI",
  heroDomain2: "interaction",
  ctaEnterWork: "Enter Work",
  aboutEyebrow: "PHILOSOPHY",
  aboutHeading: "How I think about the work.",
  principle1: "The seam is the design.",
  principle1Body:
    "The moment of decision, override, and trust — where a human meets an AI agent — that's the surface I work on. Not the model, not the wrapper. The seam.",
  principle2: "Uncertainty must be legible.",
  principle2Body:
    "An AI's claim is only trustworthy if you can read how sure it is — and the basis must be checkable. Confidence without calibration is a lie with a UI on top.",
  principle3: "Reversibility is the policy axis.",
  principle3Body:
    "The right question isn't \"is it safe\" — it's: can the human undo what the agent just did, within how many seconds? That's the real surface area.",
  principle4: "Prototypes are the argument.",
  principle4Body:
    "I write my own code because a prototype is the only design document that can't be ignored. Ship the argument, then defend it in production.",
  footerCTA: "Let's build something.",
  footerEmail: "Get in touch",
  viewEnglishSite: "View the full site in English",
  langNote:
    "A localized overview. The full portfolio — case studies, the Lab, the universe engine — is in English.",
}

// ⚠️ AI-DRAFTED — needs fluent review.
const ar: Dict = {
  navWorks: "الأعمال",
  navLab: "المختبر",
  navSkills: "المهارات",
  navUsability: "قابلية الاستخدام",
  navGames: "الألعاب",
  navContact: "تواصل",
  name: "أنكور سينها",
  heroLine1: "تصميم × هندسة",
  heroLine2: "× ذكاء اصطناعي",
  heroValue: "مصمم تجربة مستخدم بالحرفة — أستكشف الذكاء الاصطناعي ببنائه.",
  heroDomainEyebrow: "المجال",
  heroDomain1: "تفاعل الإنسان",
  heroDomain2: "والذكاء الاصطناعي",
  ctaEnterWork: "استعرض الأعمال",
  aboutEyebrow: "الفلسفة",
  aboutHeading: "كيف أفكّر في العمل.",
  principle1: "الوصلة هي التصميم.",
  principle1Body:
    "لحظة القرار والتجاوز والثقة — حيث يلتقي الإنسان بوكيل الذكاء الاصطناعي — هي السطح الذي أعمل عليه. ليس النموذج، ولا الغلاف. بل الوصلة.",
  principle2: "يجب أن يكون عدم اليقين مقروءًا.",
  principle2Body:
    "ادّعاء الذكاء الاصطناعي جدير بالثقة فقط إذا أمكنك قراءة مدى تأكّده — ويجب أن يكون الأساس قابلًا للتحقّق. الثقة بلا معايرة كذبةٌ تعلوها واجهة.",
  principle3: "القابلية للتراجع هي محور السياسة.",
  principle3Body:
    "السؤال الصحيح ليس \"هل هو آمن\" — بل: هل يستطيع الإنسان التراجع عمّا فعله الوكيل للتو، وخلال كم ثانية؟ تلك هي مساحة العمل الحقيقية.",
  principle4: "النماذج الأوّلية هي الحجّة.",
  principle4Body:
    "أكتب شيفرتي بنفسي لأن النموذج الأوّلي هو وثيقة التصميم الوحيدة التي لا يمكن تجاهلها. اشحن الحجّة، ثم دافع عنها في الإنتاج.",
  footerCTA: "لنبنِ شيئًا معًا.",
  footerEmail: "تواصل معي",
  viewEnglishSite: "استعرض الموقع كاملًا بالإنجليزية",
  langNote:
    "نظرة عامة مترجمة. الموقع الكامل — دراسات الحالة، والمختبر، ومحرّك الكون — متوفّر بالإنجليزية.",
}

// ⚠️ AI-DRAFTED — needs fluent review.
const ja: Dict = {
  navWorks: "実績",
  navLab: "ラボ",
  navSkills: "スキル",
  navUsability: "ユーザビリティ",
  navGames: "ゲーム",
  navContact: "連絡先",
  name: "アンクル・シンハ",
  heroLine1: "デザイン × エンジニアリング",
  heroLine2: "× AI",
  heroValue: "本職はUXデザイナー — つくることでAIを探求しています。",
  heroDomainEyebrow: "領域",
  heroDomain1: "人間とAIの",
  heroDomain2: "インタラクション",
  ctaEnterWork: "実績を見る",
  aboutEyebrow: "フィロソフィー",
  aboutHeading: "仕事への向き合い方。",
  principle1: "継ぎ目こそがデザイン。",
  principle1Body:
    "人間がAIエージェントと出会う、判断・上書き・信頼の瞬間 — そこが私の扱う面です。モデルでもラッパーでもなく、その継ぎ目を。",
  principle2: "不確実性は読み取れなければならない。",
  principle2Body:
    "AIの主張は、どれだけ確信しているかを読み取れて初めて信頼できる — しかもその根拠は検証可能であるべきです。較正なき自信は、UIをかぶせた嘘にすぎません。",
  principle3: "可逆性こそが方針の軸。",
  principle3Body:
    "正しい問いは「安全か」ではなく、エージェントが今行ったことを人間は何秒以内に取り消せるか、です。それが本当の作業領域です。",
  principle4: "プロトタイプが主張である。",
  principle4Body:
    "自分でコードを書くのは、プロトタイプこそ無視できない唯一の設計文書だからです。主張を世に出し、本番で守り抜く。",
  footerCTA: "一緒に何かをつくりましょう。",
  footerEmail: "お問い合わせ",
  viewEnglishSite: "英語版のフルサイトを見る",
  langNote:
    "ローカライズされた概要です。ケーススタディ、ラボ、ユニバースエンジンを含むフルポートフォリオは英語でご覧いただけます。",
}

const DICTS: Record<Locale, Dict> = { en, ar, ja }

export function getDict(locale: Locale): Dict {
  return DICTS[locale] ?? en
}
