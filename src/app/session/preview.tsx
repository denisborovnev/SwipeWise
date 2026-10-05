import Ionicons from '@expo/vector-icons/Ionicons';
import { router, useLocalSearchParams } from 'expo-router';
import { FlatList, StyleSheet, Text, View } from 'react-native';

import { Button } from '@/components/Button';
import { Footer } from '@/components/Footer';
import { Spacing, useThemeColors } from '@/constants/theme';
import { answerOf, isFinished } from '@/model/session';
import { sessionStore, useSession, useVocabulary } from '@/store';
import { describeProgress, describeSession } from '@/utils/describeFilter';

/** The words of a recent session, to check it's the one to continue: Continue / Start again, or Back. */
export default function SessionPreviewScreen() {
  const colors = useThemeColors();
  const { id } = useLocalSearchParams<{ id: string }>();
  const session = useSession((s) => s.recent.find((r) => r.id === id));
  const words = useVocabulary((s) => s.data.words);
  const lists = useVocabulary((s) => s.data.lists);

  if (!session) {
    return <View style={{ flex: 1, backgroundColor: colors.background }} />;
  }

  const finished = isFinished(session);
  // In the session's order; words deleted since then are left out.
  const items = session.wordIds.flatMap((wordId, index) => {
    const word = words.find((w) => w.id === wordId);
    return word ? [{ word, index }] : [];
  });

  const open = () => {
    sessionStore.getState().selectSession(session.id);
    // Back from the session goes home, as when continuing from the home screen.
    router.dismissTo('/');
    router.push('/session/play');
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <FlatList
        contentContainerStyle={styles.content}
        data={items}
        keyExtractor={(item) => item.word.id}
        ListHeaderComponent={
          <View style={styles.header}>
            <Text style={[styles.title, { color: colors.text }]}>{describeSession(session, lists)}</Text>
            <Text style={{ color: colors.textSecondary }}>{describeProgress(session)}</Text>
          </View>
        }
        renderItem={({ item: { word, index } }) => {
          const answer = answerOf(session, word.id);
          const current = !finished && index === session.currentIndex;
          return (
            <View
              style={[
                styles.row,
                { backgroundColor: colors.card, borderColor: current ? colors.primary : 'transparent' },
              ]}>
              <Text style={[styles.number, { color: colors.textSecondary }]}>{index + 1}</Text>
              <View style={styles.flex}>
                <Text style={[styles.front, { color: colors.text }]}>{word.front}</Text>
                <Text style={{ color: colors.textSecondary }}>{word.back}</Text>
              </View>
              {current ? (
                <Text style={[styles.current, { color: colors.primary }]}>NEXT</Text>
              ) : answer ? (
                <Ionicons
                  name={answer === 'yes' ? 'checkmark-circle' : 'close-circle'}
                  size={22}
                  color={answer === 'yes' ? colors.success : colors.danger}
                  accessibilityLabel={answer === 'yes' ? 'Knew it' : "Didn't know"}
                />
              ) : null}
            </View>
          );
        }}
      />
      <Footer>
        <Button title="Back" icon="arrow-back" variant="secondary" onPress={() => router.back()} style={styles.flex} />
        <Button
          title={finished ? 'Start again' : 'Continue'}
          icon={finished ? 'repeat' : 'play'}
          onPress={open}
          style={styles.flex}
        />
      </Footer>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { padding: Spacing.md, gap: Spacing.sm },
  header: { gap: 2, marginBottom: Spacing.xs },
  title: { fontSize: 20, fontWeight: '700' },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    padding: Spacing.md,
    borderRadius: 12,
    borderWidth: 1.5,
  },
  number: { minWidth: 22, textAlign: 'right', fontVariant: ['tabular-nums'] },
  front: { fontSize: 17, fontWeight: '600' },
  current: { fontSize: 12, fontWeight: '700', letterSpacing: 0.5 },
});
