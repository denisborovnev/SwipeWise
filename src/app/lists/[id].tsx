import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { Alert, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';

import { Button, IconButton } from '@/components/Button';
import { Footer } from '@/components/Footer';
import { TextPromptModal } from '@/components/TextPromptModal';
import { Spacing, useThemeColors } from '@/constants/theme';
import type { Word } from '@/model/types';
import { validateListName } from '@/model/validation';
import { sessionStore, useVocabulary, vocabularyStore } from '@/store';
import { plural } from '@/utils/format';

export default function ListScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const colors = useThemeColors();
  const data = useVocabulary((s) => s.data);
  const list = data.lists.find((l) => l.id === id);
  const [renaming, setRenaming] = useState(false);

  const words = useMemo(
    () => data.words.filter((w) => w.listId === id).sort((a, b) => b.addedAt.localeCompare(a.addedAt)),
    [data.words, id],
  );

  if (!list) {
    // The list was deleted (e.g. from the menu below) – nothing to show.
    return <Stack.Screen options={{ title: '' }} />;
  }

  const rename = (name: string) => {
    const err = validateListName(name, data.lists, list.id);
    if (err) {
      return err;
    }
    vocabularyStore.getState().renameList(list.id, name);
    setRenaming(false);
    return null;
  };

  const confirmDelete = () =>
    Alert.alert(
      `Delete "${list.name}"?`,
      words.length ? `The list and its ${plural(words.length, 'word')} will be deleted.` : undefined,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            router.back();
            vocabularyStore.getState().deleteList(list.id);
          },
        },
      ],
    );

  const openMenu = () =>
    Alert.alert(list.name, undefined, [
      { text: 'Rename', onPress: () => setRenaming(true) },
      { text: 'Delete', style: 'destructive', onPress: confirmDelete },
      { text: 'Cancel', style: 'cancel' },
    ]);

  const practice = () => {
    sessionStore.getState().startSession({ listIds: [list.id] });
    router.push('/session/play');
  };

  const openWord = (wordId?: string) =>
    router.push({ pathname: '/word', params: wordId ? { listId: list.id, wordId } : { listId: list.id } });

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <Stack.Screen
        options={{
          title: list.name,
          headerRight: () => <IconButton icon="ellipsis-vertical" accessibilityLabel="List menu" onPress={openMenu} />,
        }}
      />
      <FlatList
        contentContainerStyle={styles.content}
        data={words}
        keyExtractor={(w) => w.id}
        ListHeaderComponent={
          <Text style={{ color: colors.textSecondary, marginBottom: Spacing.sm }}>{plural(words.length, 'word')}</Text>
        }
        ListEmptyComponent={
          <Text style={{ color: colors.textSecondary }}>This list is empty. Add your first word below.</Text>
        }
        renderItem={({ item }) => <WordRow word={item} onPress={() => openWord(item.id)} />}
      />
      <Footer>
        <Button title="Add words" icon="add" variant="secondary" onPress={() => openWord()} style={styles.flex} />
        <Button title="Practice" icon="play" onPress={practice} disabled={words.length === 0} style={styles.flex} />
      </Footer>
      <TextPromptModal
        visible={renaming}
        title="Rename list"
        initialValue={list.name}
        onSubmit={rename}
        onCancel={() => setRenaming(false)}
      />
    </View>
  );
}

function WordRow({ word, onPress }: { word: Word; onPress: () => void }) {
  const colors = useThemeColors();
  const statusColor =
    word.remembered === 'yes' ? colors.success : word.remembered === 'no' ? colors.danger : colors.border;
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.row, { backgroundColor: colors.card, opacity: pressed ? 0.7 : 1 }]}>
      <View
        style={[styles.dot, { backgroundColor: statusColor }]}
        accessibilityLabel={
          word.remembered === 'yes' ? 'Remembered' : word.remembered === 'no' ? 'Not remembered' : 'Not revised yet'
        }
      />
      <View style={styles.flex}>
        <Text style={[styles.front, { color: colors.text }]}>{word.front}</Text>
        <Text style={{ color: colors.textSecondary }}>{word.back}</Text>
      </View>
      {word.examples.length > 0 && (
        <Text style={{ color: colors.textSecondary, fontSize: 12 }}>{plural(word.examples.length, 'example')}</Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { padding: Spacing.md, gap: Spacing.sm },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, padding: Spacing.md, borderRadius: 12 },
  dot: { width: 10, height: 10, borderRadius: 5 },
  front: { fontSize: 17, fontWeight: '600' },
});
