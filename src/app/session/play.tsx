import { router, Stack } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';

import { Button, IconButton } from '@/components/Button';
import { type BrowseDirection, FlashCard, type FlashCardHandle } from '@/components/FlashCard';
import { Spacing, useThemeColors } from '@/constants/theme';
import { answerOf, currentWordId, isFinished } from '@/model/session';
import { SPEECH_RATES, speak, stopSpeaking, useSpeechPhase } from '@/speech/pronounce';
import { sessionStore, useCourses, useSession, useVocabulary } from '@/store';

export default function PlayScreen() {
  const colors = useThemeColors();
  const session = useSession((s) => s.session);
  const wordId = session ? currentWordId(session) : undefined;
  const word = useVocabulary((s) => (wordId ? s.data.words.find((w) => w.id === wordId) : undefined));
  // Which card is flipped; keyed by card so it resets when the card changes (restart). Cleared when moving
  // to another card, since browsing can come back to the same card (same key) showing its front again.
  const [flipped, setFlipped] = useState<{ cardKey: string; back: boolean } | null>(null);
  // After browsing, the new card slides in from the other side.
  const [enterFrom, setEnterFrom] = useState<BrowseDirection | undefined>(undefined);
  const cardRef = useRef<FlashCardHandle>(null);
  const course = useCourses((s) => s.courses.find((c) => c.id === s.activeCourseId));
  const language = course?.language ?? null;
  const rate = course?.speech?.rate ?? SPEECH_RATES.normal;
  const speechKey = `card:${wordId}`;
  const speechPhase = useSpeechPhase(speechKey);

  const finished = !session || isFinished(session);
  const wordMissing = !!wordId && !word;

  useEffect(() => {
    if (wordMissing) {
      // The word was deleted after the session was created (or in the editor).
      sessionStore.getState().skipMissing();
    }
  }, [wordMissing]);

  // Don't keep reading a card that is gone.
  useEffect(() => stopSpeaking, [wordId]);

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
  const say = () => language && speak(word.back, language, rate, speechKey);

  const confirmRestart = () =>
    Alert.alert('Restart session?', 'You will go over the same words again, in a new order.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Restart', onPress: () => sessionStore.getState().restart() },
    ]);

  const answer = (value: 'yes' | 'no') => {
    setFlipped(null);
    setEnterFrom(undefined);
    sessionStore.getState().answer(value);
  };

  const browse = (direction: BrowseDirection) => {
    // Swiped left (next): the card left to the left, so the next one comes from the right – and vice versa.
    setFlipped(null);
    setEnterFrom(direction);
    sessionStore.getState().browse(direction);
  };

  const undo = () => {
    if (canUndo) {
      setFlipped(null);
      setEnterFrom(undefined);
      sessionStore.getState().undo();
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background, paddingBottom: Spacing.md }]}>
      <Stack.Screen
        options={{
          title: `${session.currentIndex + 1} / ${total}`,
          headerRight: () => (
            <View style={styles.headerButtons}>
              <IconButton
                icon="arrow-undo"
                accessibilityLabel="Undo last answer"
                color={canUndo ? colors.text : colors.border}
                onPress={undo}
              />
              <IconButton icon="refresh" accessibilityLabel="Restart session" onPress={confirmRestart} />
            </View>
          ),
        }}
      />

      {/* Progress = answered cards (skipped ones don't count). */}
      <View style={[styles.progressTrack, { backgroundColor: colors.card }]}>
        <View
          style={[
            styles.progressBar,
            { backgroundColor: colors.primary, width: `${(session.history.length / total) * 100}%` },
          ]}
        />
      </View>

      <View style={styles.cardArea}>
        <FlashCard
          key={cardKey}
          ref={cardRef}
          word={word}
          enterFrom={enterFrom}
          earlierAnswer={answerOf(session, word.id)}
          canBrowse={{ previous: session.currentIndex > 0, next: session.currentIndex < total - 1 }}
          onBrowse={browse}
          onEdit={() => router.push({ pathname: '/word', params: { listId: word.listId, wordId: word.id } })}
          onFlip={(back) => {
            setFlipped({ cardKey, back });
            if (back && course?.speech?.autoPlay) {
              say();
            }
          }}
          onSpeak={language ? say : undefined}
          speechPhase={speechPhase}
          onAnswer={answer}
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
            Recall the word, then tap the card.{'\n'}Swipe ‹ › to go to the previous / next word.
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
