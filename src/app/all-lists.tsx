import { router, Stack } from 'expo-router';
import { useMemo, useState } from 'react';
import { Alert, Pressable, SectionList, StyleSheet, Text, TextInput, View } from 'react-native';

import { Button } from '@/components/Button';
import { Chips } from '@/components/Chips';
import { Footer } from '@/components/Footer';
import { ListRow } from '@/components/ListRow';
import { NewListButton } from '@/components/NewListButton';
import { TextPromptModal } from '@/components/TextPromptModal';
import { Spacing, useThemeColors } from '@/constants/theme';
import { groupByMonth, searchLists, sortLists, withWordCounts, type ListSort } from '@/model/lists';
import { validateListName } from '@/model/validation';
import { countDuplicates } from '@/model/vocabulary';
import { mergeLists, useVocabulary } from '@/store';
import { formatMonth, plural } from '@/utils/format';

const SORT_OPTIONS: { key: ListSort; label: string }[] = [
  { key: 'newest', label: 'Newest' },
  { key: 'oldest', label: 'Oldest' },
  { key: 'name', label: 'A–Z' },
];

/** All word lists with search and sorting; date sorts are grouped by month. "Select" merges lists. */
export default function AllListsScreen() {
  const colors = useThemeColors();
  const data = useVocabulary((s) => s.data);
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<ListSort>('newest');
  /** Selected list ids; null = not in selection mode. */
  const [selected, setSelected] = useState<string[] | null>(null);
  const [naming, setNaming] = useState(false);

  const sections = useMemo(() => {
    const lists = searchLists(sortLists(withWordCounts(data.lists, data.words), sort), query);
    if (sort === 'name') {
      return lists.length ? [{ title: '', data: lists }] : [];
    }
    return groupByMonth(lists).map((g) => ({ title: formatMonth(g.month), data: g.data }));
  }, [data, sort, query]);

  const shownCount = sections.reduce((n, s) => n + s.data.length, 0);

  const toggle = (id: string) =>
    setSelected((s) => (s === null ? [id] : s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));

  // The merged list is the oldest selected one; its name is suggested.
  const selectedLists = data.lists
    .filter((l) => selected?.includes(l.id))
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  const selectedWords = data.words.filter((w) => selected?.includes(w.listId));
  const duplicates = countDuplicates(selectedWords);

  const merge = (name: string) => {
    const others = data.lists.filter((l) => !selected?.includes(l.id));
    const err = validateListName(name, others);
    if (err) {
      return err;
    }
    setNaming(false);
    Alert.alert(
      `Merge ${plural(selectedLists.length, 'list')} into "${name.trim()}"?`,
      "The other lists are deleted. This can't be undone.",
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Merge',
          onPress: () => {
            const listId = mergeLists(selectedLists.map((l) => l.id), name);
            setSelected(null);
            router.push({ pathname: '/lists/[id]', params: { id: listId } });
          },
        },
      ],
    );
    return null;
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <Stack.Screen
        options={{
          title: selected ? `${selected.length} selected` : 'All lists',
          headerRight: () =>
            data.lists.length > 1 ? (
              <Pressable hitSlop={8} onPress={() => setSelected(selected ? null : [])}>
                <Text style={{ color: colors.primary, fontSize: 16 }}>{selected ? 'Cancel' : 'Select'}</Text>
              </Pressable>
            ) : null,
        }}
      />
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
        renderItem={({ item }) => (
          <ListRow
            list={item}
            selection={selected ? { selected: selected.includes(item.id), onToggle: () => toggle(item.id) } : undefined}
            // Always set: if it were removed when selection mode starts, lifting the finger after the
            // long-press would count as a tap and unselect the list again.
            onLongPress={() => toggle(item.id)}
          />
        )}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        ListEmptyComponent={
          <Text style={{ color: colors.textSecondary }}>
            {data.lists.length ? `No lists match “${query}”.` : 'No word lists yet.'}
          </Text>
        }
      />
      <Footer>
        {selected ? (
          <Button
            title={selected.length >= 2 ? `Merge ${plural(selected.length, 'list')}` : 'Select lists to merge'}
            icon="git-merge-outline"
            onPress={() => setNaming(true)}
            disabled={selected.length < 2}
            style={styles.flex}
          />
        ) : (
          <NewListButton />
        )}
      </Footer>
      <TextPromptModal
        visible={naming}
        title="Merge lists"
        message={
          `${plural(selectedLists.length, 'list')} · ${plural(selectedWords.length, 'word')} will be combined into one list.` +
          (duplicates ? ` ${plural(duplicates, 'word appears', 'words appear')} more than once.` : '')
        }
        initialValue={selectedLists[0]?.name ?? ''}
        selectInitialValue
        submitLabel="Merge"
        onSubmit={merge}
        onCancel={() => setNaming(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
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
