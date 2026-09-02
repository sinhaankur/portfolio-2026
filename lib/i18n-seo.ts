import { LOCALES, LOCALE_PATH, htmlLang, type Locale } from "./i18n"

export const SITE = "https://www.sinhaankur.com"

/**
 * The hreflang map for <link rel="alternate">, shared by every locale home so
 * Google + AI search know all language versions of the page and rank the right
 * one per user. Uses BCP-47 lang codes (zh → zh-Hans) and an x-default → English.
 */
export const hreflangLanguages: Record<string, string> = {
  ...Object.fromEntries(
    LOCALES.map((l: Locale) => [htmlLang(l), SITE + (LOCALE_PATH[l] === "/" ? "" : LOCALE_PATH[l])])
  ),
  "x-default": SITE,
}
