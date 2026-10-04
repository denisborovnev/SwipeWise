import { router } from 'expo-router';
import { useMemo } from 'react';
import { FlatList, StyleSheet, Text, View } from 'react-native';

import { Button } from '@/components/Button';
import { Footer } from '@/components/Footer';
import { ListRow } from '@/components/ListRow';
import { NewListButton } from '@/components/NewListButton';
import { SessionCard } from '@/components/SessionCard';
import { Spacing, useThemeColors } from '@/constants/theme';
import { sortLists, withWordCounts } from '@/model/lists';
import { isFinished } from '@/model/session';
import { useSession, useVocabulary } from '@/store';
import { plural } from '@/utils/format';

/** How many of the newest lists the home screen shows; the rest are under "All lists". */
const HOME_LIST_COUNT = 5;

export default function HomeScreen() {
  const colors = useThemeColors();
  const status = useVocabulary((s) => s.status);
  const error = useVocabulary((s) => s.error);
  const data = useVocabulary((s) => s.data);
  const session = useSession((s) => s.session);
  const recentCount = useSession((s) => s.recent.length);

  const newestLists = useMemo(
    () => sortLists(withWordCounts(data.lists, data.words), 'newest').slice(0, HOME_LIST_COUNT),
    [data],
  );

  if (status === 'error') {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <Text style={{ color: colors.danger }}>Could not load your words: {error}</Text>
      </View>
    );
  }

  if (status !== 'ready') {
    return <View style={{ flex: 1, backgroundColor: colors.background }} />;
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <FlatList
        contentContainerStyle={styles.content}
        data={newestLists}
        keyExtractor={(l) => l.id}
        ListHeaderComponent={
          <View style={styles.header}>
            {session && <SessionCard session={session} />}
            <View style={styles.sessionButtons}>
              {recentCount > 1 && (
                <Button
                  title="Recent"
                  icon="time-outline"
                  variant="secondary"
                  onPress={() => router.push('/session/recent')}
                  style={styles.flex}
                />
              )}
              <Button
                title="New session"
                icon="options-outline"
                variant={session && !isFinished(session) ? 'secondary' : 'primary'}
                onPress={() => router.push('/session/new')}
                disabled={data.words.length === 0}
                style={styles.flex}
              />
            </View>
            <Text style={[styles.sectionTitle, styles.listsTitle, { color: colors.text }]}>
              {data.lists.length > HOME_LIST_COUNT ? 'Newest word lists' : 'Word lists'}
            </Text>
            <Text style={{ color: colors.textSecondary }}>
              {plural(data.lists.length, 'list')} · {plural(data.words.length, 'word')}
            </Text>
          </View>
        }
        ListEmptyComponent={
          <Text style={{ color: colors.textSecondary }}>No word lists yet. Create your first one below.</Text>
        }
        renderItem={({ item }) => <ListRow list={item} />}
        ListFooterComponent={
          data.lists.length > HOME_LIST_COUNT ? (
            <Button
              title={`All lists (${data.lists.length})`}
              icon="list"
              variant="secondary"
              onPress={() => router.push('/all-lists')}
              style={styles.allLists}
            />
          ) : null
        }
      />
      <Footer>
        <NewListButton />
      </Footer>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: Spacing.lg },
  content: { padding: Spacing.md, gap: Spacing.sm },
  header: { marginBottom: Spacing.sm, gap: Spacing.sm },
  sectionTitle: { fontSize: 20, fontWeight: '700' },
  listsTitle: { marginTop: Spacing.sm },
  sessionButtons: { flexDirection: 'row', gap: Spacing.sm },
  flex: { flex: 1 },
  allLists: { marginTop: Spacing.xs },
});
