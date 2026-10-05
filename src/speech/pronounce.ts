import * as Speech from 'expo-speech';
import { Linking } from 'react-native';

/** Speech rates offered in the course settings (1 = normal). */
export const SPEECH_RATES = { slow: 0.7, normal: 1 } as const;

/**
 * The part of a card's text worth reading aloud: notes in parentheses are skipped
 * ("to go (on foot)" → "to go").
 */
export function speakableText(text: string): string {
  return text
    .replace(/\([^)]*\)/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Whether one of the voices speaks the language ("en-GB" also accepts any "en" voice). */
export function hasVoiceFor(voices: { language: string }[], language: string): boolean {
  const wanted = language.toLowerCase().replace('_', '-');
  const base = wanted.split('-')[0];
  return voices.some((v) => {
    const lang = v.language.toLowerCase().replace('_', '-');
    return lang === wanted || lang.split('-')[0] === base;
  });
}

/** Reads text aloud with the phone's text-to-speech, stopping whatever is being read. */
export function speak(text: string, language: string, rate: number = SPEECH_RATES.normal) {
  const spoken = speakableText(text);
  if (!spoken) {
    return;
  }
  Speech.stop()
    .catch(() => {})
    .finally(() => Speech.speak(spoken, { language, rate }));
}

export function stopSpeaking() {
  Speech.stop().catch(() => {});
}

let voicesCache: Promise<{ language: string }[]> | null = null;

/** Whether the phone has a voice for the language (voices are read once per app start). */
export async function canSpeak(language: string): Promise<boolean> {
  voicesCache ??= Speech.getAvailableVoicesAsync().catch(() => []);
  const voices = await voicesCache;
  // Some engines report no voices at all although speaking works – don't hide the feature then.
  return voices.length === 0 || hasVoiceFor(voices, language);
}

/** Android's text-to-speech settings, where voices can be downloaded. */
export function openSpeechSettings() {
  Linking.sendIntent('com.android.settings.TTS_SETTINGS').catch(() => Linking.openSettings());
}
