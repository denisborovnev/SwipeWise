import * as Speech from 'expo-speech';
import { Linking } from 'react-native';
import { useStore } from 'zustand';
import { createStore } from 'zustand/vanilla';

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

/**
 * What is being read aloud, so the 🔊 button that started it can show it: 'starting' from the tap until the
 * voice starts (the phone's text-to-speech can take a few seconds), then 'speaking'.
 */
export interface SpeechState {
  key: string | null;
  phase: 'idle' | 'starting' | 'speaking';
}

export const speechStore = createStore<SpeechState>()(() => ({ key: null, phase: 'idle' }));

/** The phase of the speech started with this key ('idle' while something else or nothing is read). */
export function useSpeechPhase(key: string): SpeechState['phase'] {
  return useStore(speechStore, (s) => (s.key === key ? s.phase : 'idle'));
}

/** If the engine never reports the start / end (it happens), the button stops waiting after this long. */
const GIVE_UP_MS = 15_000;

/** Counts speak / stop calls, so callbacks of speech that was replaced or stopped are ignored. */
let current = 0;
let giveUp: ReturnType<typeof setTimeout> | null = null;

function setPhase(id: number, state: SpeechState) {
  if (id !== current) {
    return;
  }
  if (giveUp) {
    clearTimeout(giveUp);
    giveUp = null;
  }
  if (state.phase !== 'idle') {
    giveUp = setTimeout(() => setPhase(id, { key: null, phase: 'idle' }), GIVE_UP_MS);
  }
  speechStore.setState(state);
}

/**
 * Reads text aloud with the phone's text-to-speech, stopping whatever is being read. `key` identifies the
 * button that started it (for `useSpeechPhase`); by default the text.
 */
export function speak(text: string, language: string, rate: number = SPEECH_RATES.normal, key: string = text) {
  const spoken = speakableText(text);
  if (!spoken) {
    return;
  }
  const id = ++current;
  setPhase(id, { key, phase: 'starting' });
  const end = () => setPhase(id, { key: null, phase: 'idle' });
  Speech.stop()
    .catch(() => {})
    .finally(() => {
      if (id !== current) {
        return; // Something else was started (or stopped) meanwhile.
      }
      Speech.speak(spoken, {
        language,
        rate,
        onStart: () => setPhase(id, { key, phase: 'speaking' }),
        onDone: end,
        onStopped: end,
        onError: end,
      });
    });
}

export function stopSpeaking() {
  setPhase(++current, { key: null, phase: 'idle' });
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
