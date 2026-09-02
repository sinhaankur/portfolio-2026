/**
 * Lightweight i18n for the localized shell (/, /ar, /ja).
 *
 * Scope is the SHELL only — nav, hero, the manifesto, footer CTAs. Long-form
 * case studies, the Lab, and the astronomy-engine data stay English for now.
 * No i18n library: one typed dictionary, looked up per locale.
 *
 * ⚠️ TRANSLATIONS ARE AI-DRAFTED. English is the canonical source (verbatim from
 *    the live components). A first review pass (2026-06-18) fixed the clear issues:
 *      • JA name was "アンクル" (= "uncle"!) → corrected to "アンクール・シンハ".
 *      • JA: em-dash mid-sentence → 「。」; aboutEyebrow フィロソフィー → 哲学.
 *      • AR heroValue "بالحرفة" → "في الأساس" (more natural).
 *    STILL WANTS A NATIVE-SPEAKER CHECK (nuance/tone, not correctness blockers):
 *      • The manifesto bodies (principle1–4) in BOTH languages — they carry the
 *        most idiom ("the seam", "reversibility is the policy axis", "a lie with a
 *        UI on top"); my renderings are faithful but may not be the most natural.
 *      • AR name transliteration "أنكور سينها" — confirm preferred spelling.
 *      • "Design × Engineering × AI" headline phrasing in both.
 */

export type Locale = "en" | "ar" | "ja" | "ko" | "es" | "hi" | "fr" | "de" | "zh"
export const LOCALES: Locale[] = ["en", "ja", "ko", "zh", "es", "fr", "de", "hi", "ar"]

/** Human label for the language switcher (shown in its own script). */
export const LOCALE_LABEL: Record<Locale, string> = {
  en: "English",
  ja: "日本語",
  ko: "한국어",
  zh: "中文",
  es: "Español",
  fr: "Français",
  de: "Deutsch",
  hi: "हिन्दी",
  ar: "عربية",
}

/** Path each locale's home lives at. */
export const LOCALE_PATH: Record<Locale, string> = {
  en: "/",
  ja: "/ja",
  ko: "/ko",
  zh: "/zh",
  es: "/es",
  fr: "/fr",
  de: "/de",
  hi: "/hi",
  ar: "/ar",
}

/** Text direction — Arabic is right-to-left. */
export function dir(locale: Locale): "rtl" | "ltr" {
  return locale === "ar" ? "rtl" : "ltr"
}

/** BCP-47 lang attribute value (zh → simplified). */
export function htmlLang(locale: Locale): string {
  return locale === "zh" ? "zh-Hans" : locale
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
  heroValue: "مصمّم تجربة مستخدم في الأساس — أستكشف الذكاء الاصطناعي ببنائه.",
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
  name: "アンクール・シンハ",
  heroLine1: "デザイン × エンジニアリング",
  heroLine2: "× AI",
  heroValue: "本職はUXデザイナー。つくることでAIを探求しています。",
  heroDomainEyebrow: "領域",
  heroDomain1: "人間とAIの",
  heroDomain2: "インタラクション",
  ctaEnterWork: "実績を見る",
  aboutEyebrow: "哲学",
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

// ⚠️ AI-DRAFTED — needs fluent review. Tone: confident, understated, philosophy-
// forward (not salesy) — matching the English voice.
const ko: Dict = {
  navWorks: "작업",
  navLab: "랩",
  navSkills: "역량",
  navUsability: "사용성",
  navGames: "게임",
  navContact: "연락처",
  name: "안쿠르 신하",
  heroLine1: "디자인 × 엔지니어링",
  heroLine2: "× AI",
  heroValue: "본업은 UX 디자이너 — 직접 만들며 AI를 탐구합니다.",
  heroDomainEyebrow: "영역",
  heroDomain1: "인간과 AI의",
  heroDomain2: "상호작용",
  ctaEnterWork: "작업 보기",
  aboutEyebrow: "철학",
  aboutHeading: "일을 대하는 방식.",
  principle1: "이음새가 곧 디자인이다.",
  principle1Body:
    "사람이 AI 에이전트와 만나는 순간 — 결정하고, 되돌리고, 신뢰하는 그 지점이 제가 다루는 표면입니다. 모델도, 껍데기도 아닌 이음새를.",
  principle2: "불확실성은 읽을 수 있어야 한다.",
  principle2Body:
    "AI의 주장은 그것이 얼마나 확신하는지 읽을 수 있을 때에만 신뢰할 수 있으며, 그 근거는 검증 가능해야 합니다. 보정 없는 확신은 UI를 씌운 거짓말입니다.",
  principle3: "되돌릴 수 있음이 정책의 축이다.",
  principle3Body:
    "옳은 질문은 \"안전한가\"가 아니라, 에이전트가 방금 한 일을 사람이 몇 초 안에 되돌릴 수 있는가입니다. 그것이 진짜 작업 범위입니다.",
  principle4: "프로토타입이 곧 주장이다.",
  principle4Body:
    "제가 직접 코드를 쓰는 이유는, 프로토타입만이 무시할 수 없는 유일한 설계 문서이기 때문입니다. 주장을 내보내고, 프로덕션에서 지켜냅니다.",
  footerCTA: "함께 무언가 만들어요.",
  footerEmail: "연락하기",
  viewEnglishSite: "영어로 전체 사이트 보기",
  langNote:
    "현지화된 요약입니다. 케이스 스터디, 랩, 유니버스 엔진을 포함한 전체 포트폴리오는 영어로 제공됩니다.",
}

// ⚠️ AI-DRAFTED — needs fluent review.
const es: Dict = {
  navWorks: "Trabajos",
  navLab: "Laboratorio",
  navSkills: "Habilidades",
  navUsability: "Usabilidad",
  navGames: "Juegos",
  navContact: "Contacto",
  name: "Ankur Sinha",
  heroLine1: "DISEÑO × INGENIERÍA",
  heroLine2: "× IA",
  heroValue: "Diseñador UX de oficio — exploro la IA construyéndola.",
  heroDomainEyebrow: "ÁMBITO",
  heroDomain1: "Interacción",
  heroDomain2: "humano–IA",
  ctaEnterWork: "Ver trabajos",
  aboutEyebrow: "FILOSOFÍA",
  aboutHeading: "Cómo pienso el trabajo.",
  principle1: "La costura es el diseño.",
  principle1Body:
    "El momento de decisión, corrección y confianza —donde un humano se encuentra con un agente de IA— es la superficie sobre la que trabajo. Ni el modelo ni la envoltura. La costura.",
  principle2: "La incertidumbre debe ser legible.",
  principle2Body:
    "La afirmación de una IA solo es fiable si puedes leer cuán segura está —y la base debe poder comprobarse. Confianza sin calibración es una mentira con una interfaz encima.",
  principle3: "La reversibilidad es el eje de la política.",
  principle3Body:
    "La pregunta correcta no es \"¿es seguro?\" sino: ¿puede el humano deshacer lo que el agente acaba de hacer, y en cuántos segundos? Esa es la verdadera superficie.",
  principle4: "Los prototipos son el argumento.",
  principle4Body:
    "Escribo mi propio código porque un prototipo es el único documento de diseño que no se puede ignorar. Publica el argumento y defiéndelo en producción.",
  footerCTA: "Construyamos algo.",
  footerEmail: "Ponte en contacto",
  viewEnglishSite: "Ver el sitio completo en inglés",
  langNote:
    "Un resumen localizado. El portafolio completo —casos de estudio, el Laboratorio, el motor del universo— está en inglés.",
}

// ⚠️ AI-DRAFTED — needs fluent review.
const hi: Dict = {
  navWorks: "काम",
  navLab: "लैब",
  navSkills: "कौशल",
  navUsability: "उपयोगिता",
  navGames: "गेम्स",
  navContact: "संपर्क",
  name: "अंकुर सिन्हा",
  heroLine1: "डिज़ाइन × इंजीनियरिंग",
  heroLine2: "× एआई",
  heroValue: "पेशे से यूएक्स डिज़ाइनर — एआई को बनाकर समझता हूँ।",
  heroDomainEyebrow: "क्षेत्र",
  heroDomain1: "मानव–एआई",
  heroDomain2: "अंतःक्रिया",
  ctaEnterWork: "काम देखें",
  aboutEyebrow: "दर्शन",
  aboutHeading: "मैं काम को कैसे देखता हूँ।",
  principle1: "जोड़ ही डिज़ाइन है।",
  principle1Body:
    "निर्णय, बदलाव और भरोसे का वह क्षण — जहाँ इंसान किसी एआई एजेंट से मिलता है — वही वह सतह है जिस पर मैं काम करता हूँ। न मॉडल, न आवरण। बस वह जोड़।",
  principle2: "अनिश्चितता पढ़ी जा सकनी चाहिए।",
  principle2Body:
    "एआई का दावा तभी भरोसेमंद है जब आप पढ़ सकें कि वह कितना आश्वस्त है — और उसका आधार जाँचने योग्य होना चाहिए। बिना अंशांकन के आत्मविश्वास, यूआई ओढ़े हुए झूठ है।",
  principle3: "पलटने की क्षमता ही नीति का आधार है।",
  principle3Body:
    "सही सवाल \"क्या यह सुरक्षित है\" नहीं है — बल्कि: एजेंट ने अभी जो किया, उसे इंसान कितने सेकंड में पलट सकता है? असली कार्यक्षेत्र वही है।",
  principle4: "प्रोटोटाइप ही तर्क है।",
  principle4Body:
    "मैं अपना कोड खुद लिखता हूँ क्योंकि प्रोटोटाइप ही एकमात्र डिज़ाइन दस्तावेज़ है जिसे नज़रअंदाज़ नहीं किया जा सकता। तर्क को उतारो, फिर प्रोडक्शन में उसे निभाओ।",
  footerCTA: "आइए कुछ बनाते हैं।",
  footerEmail: "संपर्क करें",
  viewEnglishSite: "पूरी साइट अंग्रेज़ी में देखें",
  langNote:
    "एक स्थानीयकृत सारांश। पूरा पोर्टफोलियो — केस स्टडीज़, लैब, यूनिवर्स इंजन — अंग्रेज़ी में उपलब्ध है।",
}

// ⚠️ AI-DRAFTED — needs fluent review.
const fr: Dict = {
  navWorks: "Travaux",
  navLab: "Laboratoire",
  navSkills: "Compétences",
  navUsability: "Utilisabilité",
  navGames: "Jeux",
  navContact: "Contact",
  name: "Ankur Sinha",
  heroLine1: "DESIGN × INGÉNIERIE",
  heroLine2: "× IA",
  heroValue: "Designer UX de métier — j'explore l'IA en la construisant.",
  heroDomainEyebrow: "DOMAINE",
  heroDomain1: "Interaction",
  heroDomain2: "humain–IA",
  ctaEnterWork: "Voir les travaux",
  aboutEyebrow: "PHILOSOPHIE",
  aboutHeading: "Ma façon d'aborder le travail.",
  principle1: "La jointure, c'est le design.",
  principle1Body:
    "Le moment de la décision, de la correction et de la confiance — là où un humain rencontre un agent d'IA — voilà la surface sur laquelle je travaille. Ni le modèle, ni l'habillage. La jointure.",
  principle2: "L'incertitude doit être lisible.",
  principle2Body:
    "L'affirmation d'une IA n'est fiable que si l'on peut lire à quel point elle est sûre — et la base doit être vérifiable. La confiance sans calibrage est un mensonge coiffé d'une interface.",
  principle3: "La réversibilité est l'axe des règles.",
  principle3Body:
    "La bonne question n'est pas « est-ce sûr », mais : l'humain peut-il défaire ce que l'agent vient de faire, et en combien de secondes ? Voilà la vraie surface.",
  principle4: "Les prototypes sont l'argument.",
  principle4Body:
    "J'écris mon propre code car un prototype est le seul document de conception qu'on ne peut ignorer. Livrez l'argument, puis défendez-le en production.",
  footerCTA: "Construisons quelque chose.",
  footerEmail: "Me contacter",
  viewEnglishSite: "Voir le site complet en anglais",
  langNote:
    "Un aperçu localisé. Le portfolio complet — études de cas, le Laboratoire, le moteur d'univers — est en anglais.",
}

// ⚠️ AI-DRAFTED — needs fluent review.
const de: Dict = {
  navWorks: "Arbeiten",
  navLab: "Labor",
  navSkills: "Fähigkeiten",
  navUsability: "Usability",
  navGames: "Spiele",
  navContact: "Kontakt",
  name: "Ankur Sinha",
  heroLine1: "DESIGN × ENGINEERING",
  heroLine2: "× KI",
  heroValue: "UX-Designer von Beruf — ich erforsche KI, indem ich sie baue.",
  heroDomainEyebrow: "FELD",
  heroDomain1: "Mensch–KI-",
  heroDomain2: "Interaktion",
  ctaEnterWork: "Arbeiten ansehen",
  aboutEyebrow: "PHILOSOPHIE",
  aboutHeading: "Wie ich über die Arbeit denke.",
  principle1: "Die Naht ist das Design.",
  principle1Body:
    "Der Moment der Entscheidung, der Korrektur und des Vertrauens — dort, wo ein Mensch auf einen KI-Agenten trifft — das ist die Fläche, an der ich arbeite. Nicht das Modell, nicht die Hülle. Die Naht.",
  principle2: "Unsicherheit muss lesbar sein.",
  principle2Body:
    "Die Aussage einer KI ist nur vertrauenswürdig, wenn man ablesen kann, wie sicher sie ist — und die Grundlage muss überprüfbar sein. Zuversicht ohne Kalibrierung ist eine Lüge mit einer Oberfläche darüber.",
  principle3: "Umkehrbarkeit ist die Achse der Regeln.",
  principle3Body:
    "Die richtige Frage lautet nicht „ist es sicher?“, sondern: Kann der Mensch rückgängig machen, was der Agent gerade getan hat — und in wie vielen Sekunden? Das ist die eigentliche Fläche.",
  principle4: "Prototypen sind das Argument.",
  principle4Body:
    "Ich schreibe meinen eigenen Code, weil ein Prototyp das einzige Designdokument ist, das man nicht ignorieren kann. Liefere das Argument und verteidige es in der Produktion.",
  footerCTA: "Lass uns etwas bauen.",
  footerEmail: "Kontakt aufnehmen",
  viewEnglishSite: "Die vollständige Seite auf Englisch ansehen",
  langNote:
    "Eine lokalisierte Übersicht. Das vollständige Portfolio — Fallstudien, das Labor, die Universum-Engine — ist auf Englisch.",
}

// ⚠️ AI-DRAFTED — needs fluent review. (Simplified Chinese.)
const zh: Dict = {
  navWorks: "作品",
  navLab: "实验室",
  navSkills: "技能",
  navUsability: "可用性",
  navGames: "游戏",
  navContact: "联系",
  name: "安库尔·辛哈",
  heroLine1: "设计 × 工程",
  heroLine2: "× 人工智能",
  heroValue: "本职是 UX 设计师 —— 通过亲手构建来探索人工智能。",
  heroDomainEyebrow: "领域",
  heroDomain1: "人与 AI",
  heroDomain2: "的交互",
  ctaEnterWork: "查看作品",
  aboutEyebrow: "理念",
  aboutHeading: "我如何看待这份工作。",
  principle1: "接缝即设计。",
  principle1Body:
    "人与 AI 代理相遇的那一刻 —— 决策、纠正与信任发生之处 —— 才是我所处理的界面。不是模型，也不是外壳，而是那道接缝。",
  principle2: "不确定性必须可读。",
  principle2Body:
    "只有当你能读出 AI 有多确定，它的判断才值得信任 —— 而依据必须可核查。没有校准的自信，只是一句披着界面的谎言。",
  principle3: "可逆性是策略的核心。",
  principle3Body:
    "真正的问题不是“它安全吗”，而是：人能否撤销代理刚刚所做的事，又需要多少秒？那才是真正的作用面。",
  principle4: "原型即论证。",
  principle4Body:
    "我亲自写代码，因为原型是唯一无法被忽视的设计文档。把论证发布出去，再在生产环境中守住它。",
  footerCTA: "一起做点东西吧。",
  footerEmail: "联系我",
  viewEnglishSite: "查看英文完整网站",
  langNote:
    "这是本地化的概览。完整作品集 —— 案例研究、实验室、宇宙引擎 —— 以英文呈现。",
}

const DICTS: Record<Locale, Dict> = { en, ja, ko, zh, es, fr, de, hi, ar }

export function getDict(locale: Locale): Dict {
  return DICTS[locale] ?? en
}
