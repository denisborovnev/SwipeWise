import { useMemo, useState } from 'react';
import { SectionList, StyleSheet, Text, TextInput, View } from 'react-native';

import { Chips } from '@/components/Chips';
import { Footer } from '@/components/Footer';
import { ListRow } from '@/components/ListRow';
import { NewListButton } from '@/components/NewListButton';
import { Spacing, useThemeColors } from '@/constants/theme';
import { groupByMonth, searchLists, sortLists, withWordCounts, type ListSort } from '@/model/lists';
import { useVocabulary } from '@/store';
import { formatMonth, plural } from '@/utils/format';

const SORT_OPTIONS: { key: ListSort; label: string }[] = [
  { key: 'newest', label: 'Newest' },
  { key: 'oldest', label: 'Oldest' },
  { key: 'name', label: 'A–Z' },
];

/** All word lists with search and sorting; date sorts are grouped by month. */
export default function AllListsScreen() {
  const colors = useThemeColors();
  const data = useVocabulary((s) => s.data);
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<ListSort>('newest');

  const sections = useMemo(() => {
    const lists = searchLists(sortLists(withWordCounts(data.lists, data.words), sort), query);
    if (sort === 'name') {
      return lists.length ? [{ title: '', data: lists }] : [];
    }
    return groupByMonth(lists).map((g) => ({ title: formatMonth(g.month), data: g.data }));
  }, [data, sort, query]);

  const shownCount = sections.reduce((n, s) => n + s.data.length, 0);

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <SectionList
        sections={sections}
        keyExtractor={(l) => l.id}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={styles.content}
        stickySectionHeadersEnabled={false}
        ListHeaderComponent={
          <View style={styles.header}>
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder={`Search ${plural(data.lists.length, 'list')}`}
              placeholderTextColor={colors.textSecondary}
              autoCorrect={false}
              clearButtonMode="while-editing"
              style={[styles.search, { color: colors.text, borderColor: colors.border, backgroundColor: colors.card }]}
            />
            <Chips options={SORT_OPTIONS} selected={sort} onSelect={setSort} />
            {query.trim() !== '' && (
              <Text style={{ color: colors.textSecondary }}>{plural(shownCount, 'list')} found</Text>
            )}
          </View>
        }
        renderSectionHeader={({ section }) =>
          section.title ? (
            <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>{section.title}</Text>
          ) : null
        }
        renderItem={({ item }) => <ListRow list={item} />}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        ListEmptyComponent={
          <Text style={{ color: colors.textSecondary }}>
            {data.lists.length ? `No lists match “${query}”.` : 'No word lists yet.'}
          </Text>
        }
      />
      <Footer>
        <NewListButton />
      </Footer>
    </View>
  );
}

const styles = StyleSheet.create({
  content: { padding: Spacing.md },
  header: { gap: Spacing.md, marginBottom: Spacing.sm },
  search: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 16 },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: Spacing.md,
    marginBottom: Spacing.sm,
  },
  separator: { height: Spacing.sm },
});
