import { defaultCourseName, LANGUAGES, languageName, searchLanguages } from '../languages';

describe('languages', () => {
  it('has unique codes', () => {
    expect(new Set(LANGUAGES.map((l) => l.code)).size).toBe(LANGUAGES.length);
  });

  it('names languages, falling back to the code', () => {
    expect(languageName('en-GB')).toBe('English (UK)');
    expect(languageName('xx-YY')).toBe('xx-YY');
    expect(languageName(null)).toBe('Language not set');
  });

  it('suggests the language without the region as the course name', () => {
    expect(defaultCourseName('en-GB')).toBe('English');
    expect(defaultCourseName('zh-CN')).toBe('Chinese');
    expect(defaultCourseName('de-DE')).toBe('German');
  });

  it('searches by English name, native name or code', () => {
    expect(searchLanguages('span').map((l) => l.code)).toEqual(['es-ES', 'es-MX']);
    expect(searchLanguages('Deutsch').map((l) => l.code)).toEqual(['de-DE']);
    expect(searchLanguages('pt').map((l) => l.code)).toEqual(['pt-BR', 'pt-PT']);
    expect(searchLanguages('  ')).toHaveLength(LANGUAGES.length);
  });
});
