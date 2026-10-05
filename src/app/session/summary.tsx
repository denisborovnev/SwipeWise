import { router } from 'expo-router';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { Button } from '@/components/Button';
import { Footer } from '@/components/Footer';
import { Spacing, useThemeColors } from '@/constants/theme';
import { missedWordIds, sessionStats } from '@/model/session';
import { sessionStore, useSession, useVocabulary } from '@/store';
import { plural } from '@/utils/format';

export default function SummaryScreen() {
  const colors = useThemeColors();
  const session = useSession((s) => s.session);
  const words = useVocabulary((s) => s.data.words);

  if (!session) {
    return <View style={{ flex: 1, backgroundColor: colors.background }} />;
  }

  const stats = sessionStats(session);
  const missedIds = missedWordIds(session);
  const missed = missedIds.flatMap((id) => words.filter((w) => w.id === id));

  const repeatMissed = () => {
    sessionStore.getState().repeatMissed();
    router.replace('/session/play');
  };

  const restart = () => {
    sessionStore.getState().restart();
    router.replace('/session/play');
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={[styles.title, { color: colors.text }]}>
          {stats.notRemembered === 0 && stats.answered === stats.total ? 'Perfect! 🎉' : 'Session complete'}
        </Text>

        <View style={styles.stats}>
          <Stat label="Knew" value={stats.remembered} color={colors.success} />
          <Stat label="Didn't know" value={stats.notRemembered} color={colors.danger} />
          {stats.answered < stats.total && (
            <Stat label="Skipped" value={stats.total - stats.answered} color={colors.textSecondary} />
          )}
        </View>

        {missed.length > 0 && (
          <View style={styles.missed}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Words to practise</Text>
            {missed.map((w) => (
              <View key={w.id} style={[styles.row, { backgroundColor: colors.card }]}>
                <Text style={[styles.front, { color: colors.text }]}>{w.front}</Text>
                <Text style={{ color: colors.textSecondary }}>{w.back}</Text>
              </View>
            ))}
          </View>
        )}
      </ScrollView>

      <View style={styles.buttons}>
        {missedIds.length > 0 && (
          <Button title={`Repeat the ${plural(missedIds.length, 'word')} I missed`} icon="refresh" onPress={repeatMissed} />
        )}
        <Button
          title="Restart session"
          variant={missedIds.length > 0 ? 'secondary' : 'primary'}
          icon="repeat"
          onPress={restart}
        />
      </View>
      <Footer>
        <Button title="Done" variant="secondary" onPress={() => router.dismissTo('/')} style={styles.flex} />
      </Footer>
    </View>
  );
}

function Stat({ label, value, color }: { label: string; value: number; color: string }) {
  const colors = useThemeColors();
  return (
    <View style={[styles.stat, { backgroundColor: colors.card }]}>
      <Text style={[styles.statValue, { color }]}>{value}</Text>
      <Text style={{ color: colors.textSecondary }}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { padding: Spacing.md, gap: Spacing.lg },
  title: { fontSize: 26, fontWeight: '700', textAlign: 'center', marginTop: Spacing.md },
  stats: { flexDirection: 'row', gap: Spacing.md },
  stat: { flex: 1, alignItems: 'center', padding: Spacing.lg, borderRadius: 16, gap: Spacing.xs },
  statValue: { fontSize: 40, fontWeight: '800' },
  missed: { gap: Spacing.sm },
  sectionTitle: { fontSize: 18, fontWeight: '600' },
  row: { padding: Spacing.md, borderRadius: 12, gap: 2 },
  front: { fontSize: 17, fontWeight: '600' },
  buttons: { paddingHorizontal: Spacing.md, paddingBottom: Spacing.md, gap: Spacing.sm },
});
