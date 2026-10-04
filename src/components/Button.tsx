import Ionicons from '@expo/vector-icons/Ionicons';
import type { ComponentProps } from 'react';
import { Pressable, StyleSheet, Text, type StyleProp, type ViewStyle } from 'react-native';

import { Spacing, useThemeColors } from '@/constants/theme';

type Variant = 'primary' | 'secondary' | 'danger' | 'success';

interface ButtonProps {
  title: string;
  onPress: () => void;
  variant?: Variant;
  icon?: ComponentProps<typeof Ionicons>['name'];
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
}

export function Button({ title, onPress, variant = 'primary', icon, disabled, style }: ButtonProps) {
  const colors = useThemeColors();
  const filled = variant !== 'secondary';
  const background = {
    primary: colors.primary,
    secondary: colors.card,
    danger: colors.danger,
    success: colors.success,
  }[variant];
  const foreground = filled ? '#FFFFFF' : colors.text;

  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.button,
        { backgroundColor: background, opacity: disabled ? 0.4 : pressed ? 0.75 : 1 },
        style,
      ]}>
      {icon && <Ionicons name={icon} size={20} color={foreground} />}
      <Text style={[styles.title, { color: foreground }]}>{title}</Text>
    </Pressable>
  );
}

interface IconButtonProps {
  icon: ComponentProps<typeof Ionicons>['name'];
  onPress: () => void;
  accessibilityLabel: string;
  color?: string;
}

export function IconButton({ icon, onPress, accessibilityLabel, color }: IconButtonProps) {
  const colors = useThemeColors();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      onPress={onPress}
      hitSlop={8}
      style={({ pressed }) => [styles.iconButton, { opacity: pressed ? 0.5 : 1 }]}>
      <Ionicons name={icon} size={24} color={color ?? colors.text} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    paddingVertical: 12,
    paddingHorizontal: Spacing.md,
    borderRadius: 12,
  },
  title: { fontSize: 16, fontWeight: '600' },
  iconButton: { padding: Spacing.xs },
});
