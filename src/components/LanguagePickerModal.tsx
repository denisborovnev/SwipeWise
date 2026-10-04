import Ionicons from '@expo/vector-icons/Ionicons';
import { useMemo, useState } from 'react';
import { FlatList, Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Spacing, useThemeColors } from '@/constants/theme';
import { searchLanguages } from '@/model/languages';

import { Button } from './Button';

interface LanguagePickerModalProps {
  visible: boolean;
  selected: string | null;
  onSelect: (code: string) => void;
  onCancel: () => void;
}

/** Full-screen, searchable single choice of the language being learned. */
export function LanguagePickerModal(props: LanguagePickerModalProps) {
  return (
    <Modal visible={props.visible} animationType="slide" statusBarTranslucent onRequestClose={props.onCancel}>
      {props.visible && <Picker {...props} />}
    </Modal>
  );
}

function Picker({ selected, onSelect, onCancel }: LanguagePickerModalProps) {
  const colors = useThemeColors();
  const [query, setQuery] = useState('');
  const shown = useMemo(() => searchLanguages(query), [query]);

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <Text style={[styles.title, { color: colors.text }]}>What language are you learning?</Text>

      <TextInput
        value={query}
        onChangeText={setQuery}
        placeholder="Search languages"
        placeholderTextColor={colors.textSecondary}
        autoCorrect={false}
        style={[styles.search, { color: colors.text, borderColor: colors.border, backgroundColor: colors.card }]}
      />

      <FlatList
        data={shown}
        keyExtractor={(l) => l.code}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={<Text style={{ color: colors.textSecondary }}>No languages match “{query}”.</Text>}
        renderItem={({ item }) => {
          const checked = item.code === selected;
          return (
            <Pressable
              accessibilityRole="radio"
              accessibilityState={{ checked }}
              onPress={() => onSelect(item.code)}
              style={({ pressed }) => [styles.row, { opacity: pressed ? 0.6 : 1 }]}>
              <Ionicons
                name={checked ? 'radio-button-on' : 'radio-button-off'}
                size={24}
                color={checked ? colors.primary : colors.textSecondary}
              />
              <View style={styles.flex}>
                <Text style={[styles.name, { color: colors.text }]}>{item.name}</Text>
                <Text style={{ color: colors.textSecondary, fontSize: 13 }}>{item.nativeName}</Text>
              </View>
            </Pressable>
          );
        }}
      />

      <View style={[styles.footer, { borderTopColor: colors.border }]}>
        <Button title="Cancel" variant="secondary" onPress={onCancel} style={styles.flex} />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  container: { flex: 1 },
  title: { fontSize: 20, fontWeight: '700', padding: Spacing.md },
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
  footer: { flexDirection: 'row', padding: Spacing.md, borderTopWidth: StyleSheet.hairlineWidth },
});
