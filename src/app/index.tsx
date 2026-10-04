import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';

import { Button } from '@/components/Button';
import { Footer } from '@/components/Footer';
import { SessionCard } from '@/components/SessionCard';
import { TextPromptModal } from '@/components/TextPromptModal';
import { Spacing, useThemeColors } from '@/constants/theme';
import { isFinished } from '@/model/session';
import { validateListName } from '@/model/validation';
import { useSession, useVocabulary, vocabularyStore } from '@/store';
import { plural } from '@/utils/format';

export default function HomeScreen() {
  const colors = useThemeColors();
  const status = useVocabulary((s) => s.status);
  const error = useVocabulary((s) => s.error);
  const data = useVocabulary((s) => s.data);
  const session = useSession((s) => s.session);
  const [creating, setCreating] = useState(false);

  const lists = useMemo(() => {
    const counts = new Map<string, number>();
    for (const w of data.words) {
      counts.set(w.listId, (counts.get(w.listId) ?? 0) + 1);
    }
    return data.lists
      .map((list) => ({ ...list, wordCount: counts.get(list.id) ?? 0 }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [data]);

  const createList = (name: string) => {
    const err = validateListName(name, data.lists);
    if (err) {
      return err;
    }
    const id = vocabularyStore.getState().addList(name);
    setCreating(false);
    router.push({ pathname: '/lists/[id]', params: { id } });
    return null;
  };

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
        data={lists}
        keyExtractor={(l) => l.id}
        ListHeaderComponent={
          <View style={styles.header}>
            {session && <SessionCard session={session} />}
            <Button
              title="New session"
              icon="options-outline"
              variant={session && !isFinished(session) ? 'secondary' : 'primary'}
              onPress={() => router.push('/session/new')}
              disabled={data.words.length === 0}
            />
            <Text style={[styles.sectionTitle, styles.listsTitle, { color: colors.text }]}>Word lists</Text>
            <Text style={{ color: colors.textSecondary }}>
              {plural(data.lists.length, 'list')} · {plural(data.words.length, 'word')}
            </Text>
          </View>
        }
        ListEmptyComponent={
          <Text style={{ color: colors.textSecondary }}>No word lists yet. Create your first one below.</Text>
        }
        renderItem={({ item }) => (
          <Pressable
            accessibilityRole="button"
            onPress={() => router.push({ pathname: '/lists/[id]', params: { id: item.id } })}
            style={({ pressed }) => [styles.row, { backgroundColor: colors.card, opacity: pressed ? 0.7 : 1 }]}>
            <Text style={[styles.listName, { color: colors.text }]} numberOfLines={1}>
              {item.name}
            </Text>
            <Text style={{ color: colors.textSecondary }}>{plural(item.wordCount, 'word')}</Text>
            <Ionicons name="chevron-forward" size={20} color={colors.textSecondary} />
          </Pressable>
        )}
      />
      <Footer>
        <Button title="New list" icon="add" variant="secondary" onPress={() => setCreating(true)} style={{ flex: 1 }} />
      </Footer>
      <TextPromptModal
        visible={creating}
        title="New word list"
        placeholder="e.g. Travel"
        submitLabel="Create"
        onSubmit={createList}
        onCancel={() => setCreating(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: Spacing.lg },
  content: { padding: Spacing.md, gap: Spacing.sm },
  header: { marginBottom: Spacing.sm, gap: Spacing.sm },
  sectionTitle: { fontSize: 20, fontWeight: '700' },
  listsTitle: { marginTop: Spacing.sm },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    padding: Spacing.md,
    borderRadius: 12,
  },
  listName: { flex: 1, fontSize: 17, fontWeight: '600' },
});
