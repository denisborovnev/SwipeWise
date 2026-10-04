export interface Language {
  /** BCP-47 code, as used by text-to-speech engines. */
  code: string;
  /** English name. */
  name: string;
  /** Name in the language itself, so it is easy to find in the list. */
  nativeName: string;
}

/** Languages offered when creating a course. Regional variants matter for pronunciation. */
export const LANGUAGES: readonly Language[] = [
  { code: 'ar', name: 'Arabic', nativeName: 'العربية' },
  { code: 'bg-BG', name: 'Bulgarian', nativeName: 'Български' },
  { code: 'zh-CN', name: 'Chinese (Mandarin)', nativeName: '中文' },
  { code: 'hr-HR', name: 'Croatian', nativeName: 'Hrvatski' },
  { code: 'cs-CZ', name: 'Czech', nativeName: 'Čeština' },
  { code: 'da-DK', name: 'Danish', nativeName: 'Dansk' },
  { code: 'nl-NL', name: 'Dutch', nativeName: 'Nederlands' },
  { code: 'en-GB', name: 'English (UK)', nativeName: 'English' },
  { code: 'en-US', name: 'English (US)', nativeName: 'English' },
  { code: 'et-EE', name: 'Estonian', nativeName: 'Eesti' },
  { code: 'fi-FI', name: 'Finnish', nativeName: 'Suomi' },
  { code: 'fr-FR', name: 'French (France)', nativeName: 'Français' },
  { code: 'fr-CA', name: 'French (Canada)', nativeName: 'Français' },
  { code: 'ka-GE', name: 'Georgian', nativeName: 'ქართული' },
  { code: 'de-DE', name: 'German', nativeName: 'Deutsch' },
  { code: 'el-GR', name: 'Greek', nativeName: 'Ελληνικά' },
  { code: 'he-IL', name: 'Hebrew', nativeName: 'עברית' },
  { code: 'hi-IN', name: 'Hindi', nativeName: 'हिन्दी' },
  { code: 'hu-HU', name: 'Hungarian', nativeName: 'Magyar' },
  { code: 'id-ID', name: 'Indonesian', nativeName: 'Bahasa Indonesia' },
  { code: 'it-IT', name: 'Italian', nativeName: 'Italiano' },
  { code: 'ja-JP', name: 'Japanese', nativeName: '日本語' },
  { code: 'kk-KZ', name: 'Kazakh', nativeName: 'Қазақ тілі' },
  { code: 'ko-KR', name: 'Korean', nativeName: '한국어' },
  { code: 'lv-LV', name: 'Latvian', nativeName: 'Latviešu' },
  { code: 'lt-LT', name: 'Lithuanian', nativeName: 'Lietuvių' },
  { code: 'nb-NO', name: 'Norwegian', nativeName: 'Norsk' },
  { code: 'pl-PL', name: 'Polish', nativeName: 'Polski' },
  { code: 'pt-BR', name: 'Portuguese (Brazil)', nativeName: 'Português' },
  { code: 'pt-PT', name: 'Portuguese (Portugal)', nativeName: 'Português' },
  { code: 'ro-RO', name: 'Romanian', nativeName: 'Română' },
  { code: 'ru-RU', name: 'Russian', nativeName: 'Русский' },
  { code: 'sr-RS', name: 'Serbian', nativeName: 'Српски' },
  { code: 'sk-SK', name: 'Slovak', nativeName: 'Slovenčina' },
  { code: 'sl-SI', name: 'Slovenian', nativeName: 'Slovenščina' },
  { code: 'es-ES', name: 'Spanish (Spain)', nativeName: 'Español' },
  { code: 'es-MX', name: 'Spanish (Latin America)', nativeName: 'Español' },
  { code: 'sv-SE', name: 'Swedish', nativeName: 'Svenska' },
  { code: 'th-TH', name: 'Thai', nativeName: 'ไทย' },
  { code: 'tr-TR', name: 'Turkish', nativeName: 'Türkçe' },
  { code: 'uk-UA', name: 'Ukrainian', nativeName: 'Українська' },
  { code: 'vi-VN', name: 'Vietnamese', nativeName: 'Tiếng Việt' },
];

export function findLanguage(code: string | null): Language | undefined {
  return code ? LANGUAGES.find((l) => l.code === code) : undefined;
}

/** English name of a language code; the code itself for codes not in the list. */
export function languageName(code: string | null): string {
  return code ? (findLanguage(code)?.name ?? code) : 'Language not set';
}

/** Suggested course name: the language without the region, e.g. "English" for English (UK). */
export function defaultCourseName(code: string): string {
  return languageName(code).replace(/\s*\(.*\)$/, '');
}

/** Case-insensitive search by English name, native name or code. */
export function searchLanguages(query: string, languages: readonly Language[] = LANGUAGES): Language[] {
  const q = query.trim().toLowerCase();
  if (!q) {
    return [...languages];
  }
  return languages.filter(
    (l) => l.name.toLowerCase().includes(q) || l.nativeName.toLowerCase().includes(q) || l.code.toLowerCase().startsWith(q),
  );
}
