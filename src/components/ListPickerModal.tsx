import Ionicons from '@expo/vector-icons/Ionicons';
import { useMemo, useState } from 'react';
import { FlatList, Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Spacing, useThemeColors } from '@/constants/theme';
import { searchLists, sortLists, type ListWithCount } from '@/model/lists';
import { formatDate, plural } from '@/utils/format';

import { Button } from './Button';

interface ListPickerModalProps {
  visible: boolean;
  lists: ListWithCount[];
  selected: string[];
  onDone: (listIds: string[]) => void;
  onCancel: () => void;
}

/** Full-screen, searchable multiple choice of word lists (newest first). */
export function ListPickerModal(props: ListPickerModalProps) {
  return (
    <Modal visible={props.visible} animationType="slide" statusBarTranslucent onRequestClose={props.onCancel}>
      {/* Mounted only while visible, so the selection starts from `selected` every time. */}
      {props.visible && <Picker {...props} />}
    </Modal>
  );
}

function Picker({ lists, selected, onDone, onCancel }: ListPickerModalProps) {
  const colors = useThemeColors();
  const [query, setQuery] = useState('');
  const [picked, setPicked] = useState<string[]>(selected);

  const shown = useMemo(() => searchLists(sortLists(lists, 'newest'), query), [lists, query]);
  const toggle = (id: string) => setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: colors.text }]}>Choose lists</Text>
        <Pressable onPress={() => setPicked([])} hitSlop={8} disabled={picked.length === 0}>
          <Text style={{ color: picked.length ? colors.primary : colors.textSecondary, fontSize: 16 }}>Clear</Text>
        </Pressable>
      </View>

      <TextInput
        value={query}
        onChangeText={setQuery}
        placeholder="Search lists"
        placeholderTextColor={colors.textSecondary}
        autoCorrect={false}
        style={[styles.search, { color: colors.text, borderColor: colors.border, backgroundColor: colors.card }]}
      />

      <FlatList
        data={shown}
        keyExtractor={(l) => l.id}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={<Text style={{ color: colors.textSecondary }}>No lists match “{query}”.</Text>}
        renderItem={({ item }) => {
          const checked = picked.includes(item.id);
          return (
            <Pressable
              accessibilityRole="checkbox"
              accessibilityState={{ checked }}
              onPress={() => toggle(item.id)}
              style={({ pressed }) => [styles.row, { opacity: pressed ? 0.6 : 1 }]}>
              <Ionicons
                name={checked ? 'checkbox' : 'square-outline'}
                size={24}
                color={checked ? colors.primary : colors.textSecondary}
              />
              <View style={styles.flex}>
                <Text style={[styles.name, { color: colors.text }]} numberOfLines={1}>
                  {item.name}
                </Text>
                <Text style={{ color: colors.textSecondary, fontSize: 13 }}>
                  {formatDate(item.createdAt)} · {plural(item.wordCount, 'word')}
                </Text>
              </View>
            </Pressable>
          );
        }}
      />

      <View style={[styles.footer, { borderTopColor: colors.border }]}>
        <Button title="Cancel" variant="secondary" onPress={onCancel} style={styles.flex} />
        <Button
          title={picked.length ? `Use ${plural(picked.length, 'list')}` : 'Use all words'}
          onPress={() => onDone(picked)}
          style={styles.flex}
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
  },
  title: { fontSize: 20, fontWeight: '700' },
  search: {
    marginHorizontal: Spacing.md,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
  },
  listContent: { padding: Spacing.md, gap: Spacing.xs },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, paddingVertical: Spacing.sm },
  name: { fontSize: 17, fontWeight: '500' },
  footer: {
    flexDirection: 'row',
    gap: Spacing.sm,
    padding: Spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
});
