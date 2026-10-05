import { hasVoiceFor, speakableText } from '../pronounce';

describe('pronounce', () => {
  it('reads the text without notes in parentheses', () => {
    expect(speakableText('to go (on foot)')).toBe('to go');
    expect(speakableText(' (informal)  hi  there ')).toBe('hi there');
    expect(speakableText('listen')).toBe('listen');
    expect(speakableText('(note only)')).toBe('');
  });

  it('finds a voice for the language, accepting other regions of it', () => {
    const voices = [{ language: 'en-US' }, { language: 'de_DE' }];
    expect(hasVoiceFor(voices, 'en-US')).toBe(true);
    expect(hasVoiceFor(voices, 'en-GB')).toBe(true);
    expect(hasVoiceFor(voices, 'de-DE')).toBe(true);
    expect(hasVoiceFor(voices, 'es-ES')).toBe(false);
  });
});
