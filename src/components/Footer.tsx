import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { Spacing, useThemeColors } from '@/constants/theme';

/** Bottom action bar (the navigator keeps every screen clear of the system navigation bar). */
export function Footer({ children }: { children: ReactNode }) {
  const colors = useThemeColors();
  return (
    <View
      style={[
        styles.footer,
        { borderTopColor: colors.border, paddingBottom: Spacing.md },
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
