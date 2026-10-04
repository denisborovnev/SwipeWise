import { useMemo } from 'react';
import { FlatList, StyleSheet, Text, View } from 'react-native';

import { Spacing, useThemeColors } from '@/constants/theme';
import { useVocabulary } from '@/store';

export default function HomeScreen() {
  const colors = useThemeColors();
  const status = useVocabulary((s) => s.status);
  const error = useVocabulary((s) => s.error);
  const data = useVocabulary((s) => s.data);

  const lists = useMemo(
    () =>
      data.lists.map((list) => ({
        ...list,
        wordCount: data.words.filter((w) => w.listId === list.id).length,
      })),
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
    <FlatList
      style={{ backgroundColor: colors.background }}
      contentContainerStyle={styles.content}
      data={lists}
      keyExtractor={(l) => l.id}
      ListHeaderComponent={
        <Text style={[styles.summary, { color: colors.textSecondary }]}>
          {data.lists.length} lists · {data.words.length} words
        </Text>
      }
      ListEmptyComponent={<Text style={{ color: colors.textSecondary }}>No word lists yet.</Text>}
      renderItem={({ item }) => (
        <View style={[styles.row, { backgroundColor: colors.card }]}>
          <Text style={[styles.listName, { color: colors.text }]}>{item.name}</Text>
          <Text style={{ color: colors.textSecondary }}>{item.wordCount} words</Text>
        </View>
      )}
    />
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: Spacing.lg },
  content: { padding: Spacing.md, gap: Spacing.sm },
  summary: { marginBottom: Spacing.sm },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: Spacing.md,
    borderRadius: 12,
  },
  listName: { fontSize: 17, fontWeight: '600' },
});
