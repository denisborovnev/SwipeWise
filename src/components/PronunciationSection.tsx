import Ionicons from '@expo/vector-icons/Ionicons';
import { useEffect, useState } from 'react';
import { StyleSheet, Switch, Text, View } from 'react-native';

import { Spacing, useThemeColors } from '@/constants/theme';
import { findLanguage, languageName } from '@/model/languages';
import type { Course } from '@/model/types';
import { canSpeak, openSpeechSettings, SPEECH_RATES, speak } from '@/speech/pronounce';
import { courseStore } from '@/store';

import { Button } from './Button';
import { Chips } from './Chips';

type RateKey = keyof typeof SPEECH_RATES;
const RATE_OPTIONS: { key: RateKey; label: string }[] = [
  { key: 'slow', label: 'Slow' },
  { key: 'normal', label: 'Normal' },
];

/** Course screen section: read words aloud with the phone's text-to-speech in the course's language. */
export function PronunciationSection({ course }: { course: Course }) {
  const colors = useThemeColors();
  const language = course.language;
  const [voice, setVoice] = useState<'checking' | 'yes' | 'no'>('checking');

  useEffect(() => {
    if (!language) {
      return;
    }
    let active = true;
    canSpeak(language).then((ok) => active && setVoice(ok ? 'yes' : 'no'));
    return () => {
      active = false;
    };
  }, [language]);

  if (!language) {
    return null;
  }

  const speech = course.speech ?? {};
  const rate = speech.rate ?? SPEECH_RATES.normal;
  const rateKey: RateKey = rate < SPEECH_RATES.normal ? 'slow' : 'normal';
  const update = (patch: Course['speech']) =>
    courseStore.getState().updateCourse(course.id, { speech: { ...speech, ...patch } });
  // A short sample in the language itself, e.g. "English", "Español".
  const sample = findLanguage(language)?.nativeName ?? languageName(language);

  return (
    <View style={[styles.section, { borderColor: colors.border }]}>
      <View style={styles.titleRow}>
        <Ionicons name="volume-high-outline" size={20} color={colors.text} />
        <Text style={[styles.title, { color: colors.text }]}>Pronunciation</Text>
      </View>
      <Text style={{ color: colors.textSecondary }}>
        Tap 🔊 on a card or a word to hear it in {languageName(language)}, read by your phone.
      </Text>

      {voice === 'no' && (
        <View style={styles.gap}>
          <Text style={{ color: colors.danger }}>
            Your phone has no voice for {languageName(language)} yet. Download one in the text-to-speech settings
            (e.g. Speech services by Google → Install voice data).
          </Text>
          <Button title="Open text-to-speech settings" icon="settings-outline" variant="secondary" onPress={openSpeechSettings} />
        </View>
      )}

      <View style={styles.row}>
        <Text style={[styles.flex, { color: colors.text, fontSize: 16 }]}>Read the word when a card is flipped</Text>
        <Switch value={!!speech.autoPlay} onValueChange={(autoPlay) => update({ autoPlay })} />
      </View>

      <Text style={{ color: colors.textSecondary }}>Speed</Text>
      <Chips options={RATE_OPTIONS} selected={rateKey} onSelect={(key) => update({ rate: SPEECH_RATES[key] })} />

      <Button title="Test the voice" icon="play-outline" variant="secondary" onPress={() => speak(sample, language, rate)} />
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  gap: { gap: Spacing.sm },
  section: { gap: Spacing.sm, marginTop: Spacing.lg, paddingTop: Spacing.md, borderTopWidth: StyleSheet.hairlineWidth },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  title: { fontSize: 17, fontWeight: '600' },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, paddingVertical: Spacing.xs },
});
