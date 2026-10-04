import { router, Stack } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button, IconButton } from '@/components/Button';
import { FlashCard, type FlashCardHandle } from '@/components/FlashCard';
import { Spacing, useThemeColors } from '@/constants/theme';
import { currentWordId, isFinished } from '@/model/session';
import { sessionStore, useSession, useVocabulary } from '@/store';

export default function PlayScreen() {
  const colors = useThemeColors();
  const insets = useSafeAreaInsets();
  const session = useSession((s) => s.session);
  const wordId = session ? currentWordId(session) : undefined;
  const word = useVocabulary((s) => (wordId ? s.data.words.find((w) => w.id === wordId) : undefined));
  // Which card is flipped; keyed by card so it resets when the card changes (next card, undo, restart).
  const [flipped, setFlipped] = useState<{ cardKey: string; back: boolean } | null>(null);
  const cardRef = useRef<FlashCardHandle>(null);

  const finished = !session || isFinished(session);
  const wordMissing = !!wordId && !word;

  useEffect(() => {
    if (wordMissing) {
      // The word was deleted after the session was created.
      sessionStore.getState().skipMissing();
    }
  }, [wordMissing]);

  useEffect(() => {
    if (finished) {
      router.replace(session ? '/session/summary' : '/');
    }
  }, [finished, session]);

  if (!session || !word) {
    return <View style={{ flex: 1, backgroundColor: colors.background }} />;
  }

  const cardKey = `${word.id}-${session.currentIndex}`;
  const showingBack = flipped?.cardKey === cardKey && flipped.back;
  const total = session.wordIds.length;
  const canUndo = session.history.length > 0;

  const confirmRestart = () =>
    Alert.alert('Restart session?', 'You will go over the same words again from the first card.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Restart', onPress: () => sessionStore.getState().restart() },
    ]);

  return (
    <View style={[styles.container, { backgroundColor: colors.background, paddingBottom: insets.bottom + Spacing.md }]}>
      <Stack.Screen
        options={{
          title: `${session.currentIndex + 1} / ${total}`,
          headerRight: () => (
            <View style={styles.headerButtons}>
              <IconButton
                icon="arrow-undo"
                accessibilityLabel="Undo last answer"
                color={canUndo ? colors.text : colors.border}
                onPress={() => canUndo && sessionStore.getState().undo()}
              />
              <IconButton icon="refresh" accessibilityLabel="Restart session" onPress={confirmRestart} />
            </View>
          ),
        }}
      />

      <View style={[styles.progressTrack, { backgroundColor: colors.card }]}>
        <View
          style={[
            styles.progressBar,
            { backgroundColor: colors.primary, width: `${(session.currentIndex / total) * 100}%` },
          ]}
        />
      </View>

      <View style={styles.cardArea}>
        <FlashCard
          key={cardKey}
          ref={cardRef}
          word={word}
          onFlip={(back) => setFlipped({ cardKey, back })}
          onAnswer={(answer) => sessionStore.getState().answer(answer)}
        />
      </View>

      <View style={styles.bottom}>
        {showingBack ? (
          <View style={styles.actions}>
            <Button
              title="Didn't know"
              icon="close"
              variant="danger"
              onPress={() => cardRef.current?.answer('no')}
              style={styles.flex}
            />
            <Button
              title="Knew it"
              icon="checkmark"
              variant="success"
              onPress={() => cardRef.current?.answer('yes')}
              style={styles.flex}
            />
          </View>
        ) : (
          <Text style={[styles.hint, { color: colors.textSecondary }]}>
            Try to recall the word, then tap the card
          </Text>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  container: { flex: 1, paddingHorizontal: Spacing.md, paddingTop: Spacing.md, gap: Spacing.md },
  headerButtons: { flexDirection: 'row', gap: Spacing.md },
  progressTrack: { height: 6, borderRadius: 3, overflow: 'hidden' },
  progressBar: { height: '100%' },
  cardArea: { flex: 1, marginVertical: Spacing.sm },
  actions: { flexDirection: 'row', gap: Spacing.sm },
  bottom: { height: 52, justifyContent: 'center' },
  hint: { textAlign: 'center', fontSize: 15 },
});
