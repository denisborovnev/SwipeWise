import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Spacing, useThemeColors } from '@/constants/theme';

export interface ChipOption<K extends string> {
  key: K;
  label: string;
}

interface ChipsProps<K extends string> {
  options: ChipOption<K>[];
  selected: K;
  onSelect: (key: K) => void;
}

/** Single-choice row of pill buttons that wraps onto several lines. */
export function Chips<K extends string>({ options, selected, onSelect }: ChipsProps<K>) {
  const colors = useThemeColors();
  return (
    <View style={styles.row}>
      {options.map((option) => {
        const active = option.key === selected;
        return (
          <Pressable
            key={option.key}
            accessibilityRole="radio"
            accessibilityState={{ selected: active }}
            onPress={() => onSelect(option.key)}
            style={({ pressed }) => [
              styles.chip,
              {
                backgroundColor: active ? colors.primary : colors.card,
                borderColor: active ? colors.primary : colors.border,
                opacity: pressed ? 0.7 : 1,
              },
            ]}>
            <Text style={[styles.label, { color: active ? '#FFFFFF' : colors.text }]} numberOfLines={1}>
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, borderWidth: 1, maxWidth: '100%' },
  label: { fontSize: 15, fontWeight: '500' },
});
