import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Spacing, useThemeColors } from '@/constants/theme';

/** Bottom action bar that stays clear of the system navigation / gesture bar. */
export function Footer({ children }: { children: ReactNode }) {
  const colors = useThemeColors();
  const insets = useSafeAreaInsets();
  return (
    <View
      style={[
        styles.footer,
        { borderTopColor: colors.border, paddingBottom: Spacing.md + insets.bottom },
      ]}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  footer: {
    flexDirection: 'row',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
});
