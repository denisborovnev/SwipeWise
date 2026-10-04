import { router } from 'expo-router';
import { Alert, StyleSheet, Text, View } from 'react-native';

import { Spacing, useThemeColors } from '@/constants/theme';
import { isFinished, sessionStats } from '@/model/session';
import type { Session } from '@/model/types';
import { sessionStore, useVocabulary } from '@/store';
import { describeProgress, describeSession } from '@/utils/describeFilter';

import { Button } from './Button';

/** The last session on the home screen: continue where you stopped, or restart it. */
export function SessionCard({ session }: { session: Session }) {
  const colors = useThemeColors();
  const lists = useVocabulary((s) => s.data.lists);
  const finished = isFinished(session);
  const stats = sessionStats(session);

  const restart = () => {
    sessionStore.getState().restart();
    router.push('/session/play');
  };

  const confirmRestart = () =>
    Alert.alert('Restart session?', 'You will go over the same words again, in a new order.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Restart', onPress: restart },
    ]);

  return (
    <View style={[styles.card, { backgroundColor: colors.card }]}>
      <Text style={[styles.label, { color: colors.textSecondary }]}>{finished ? 'Last session' : 'Current session'}</Text>
      <Text style={[styles.title, { color: colors.text }]}>{describeSession(session, lists)}</Text>
      <Text style={{ color: colors.textSecondary }}>{describeProgress(session)}</Text>
      {!finished && (
        <View style={[styles.progressTrack, { backgroundColor: colors.border }]}>
          <View
            style={[styles.progressBar, { backgroundColor: colors.primary, width: `${(session.currentIndex / stats.total) * 100}%` }]}
          />
        </View>
      )}
      <View style={styles.buttons}>
        {finished ? (
          <Button title="Restart session" icon="repeat" onPress={restart} style={styles.flex} />
        ) : (
          <>
            <Button
              title="Restart"
              icon="repeat"
              variant="secondary"
              onPress={confirmRestart}
              style={{ backgroundColor: colors.background }}
            />
            <Button title="Continue" icon="play" onPress={() => router.push('/session/play')} style={styles.flex} />
          </>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  card: { padding: Spacing.md, borderRadius: 16, gap: Spacing.sm },
  label: { fontSize: 13, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 },
  title: { fontSize: 18, fontWeight: '600' },
  progressTrack: { height: 6, borderRadius: 3, overflow: 'hidden' },
  progressBar: { height: '100%' },
  buttons: { flexDirection: 'row', gap: Spacing.sm, marginTop: Spacing.xs },
});
