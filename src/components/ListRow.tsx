import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Spacing, useThemeColors } from '@/constants/theme';
import type { ListWithCount } from '@/model/lists';
import { formatDate, plural } from '@/utils/format';

interface ListRowProps {
  list: ListWithCount;
  /** In selection mode the row shows a checkbox and a tap toggles it instead of opening the list. */
  selection?: { selected: boolean; onToggle: () => void };
  onLongPress?: () => void;
}

/** A word list in a list of lists; opens the list screen. */
export function ListRow({ list, selection, onLongPress }: ListRowProps) {
  const colors = useThemeColors();
  return (
    <Pressable
      accessibilityRole={selection ? 'checkbox' : 'button'}
      accessibilityState={selection ? { checked: selection.selected } : undefined}
      onPress={selection ? selection.onToggle : () => router.push({ pathname: '/lists/[id]', params: { id: list.id } })}
      onLongPress={onLongPress}
      style={({ pressed }) => [styles.row, { backgroundColor: colors.card, opacity: pressed ? 0.7 : 1 }]}>
      {selection && (
        <Ionicons
          name={selection.selected ? 'checkbox' : 'square-outline'}
          size={24}
          color={selection.selected ? colors.primary : colors.textSecondary}
        />
      )}
      <View style={styles.text}>
        <Text style={[styles.name, { color: colors.text }]} numberOfLines={1}>
          {list.name}
        </Text>
        <Text style={{ color: colors.textSecondary }}>
          {formatDate(list.createdAt)} · {plural(list.wordCount, 'word')}
        </Text>
      </View>
      {!selection && <Ionicons name="chevron-forward" size={20} color={colors.textSecondary} />}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, padding: Spacing.md, borderRadius: 12 },
  text: { flex: 1, gap: 2 },
  name: { fontSize: 17, fontWeight: '600' },
});
