import { useColorScheme } from 'react-native';

export const Colors = {
  light: {
    text: '#11181C',
    textSecondary: '#60646C',
    background: '#FFFFFF',
    card: '#F0F0F3',
    border: '#E0E1E6',
    primary: '#208AEF',
    success: '#2E9E5B',
    danger: '#D93F3F',
  },
  dark: {
    text: '#ECEDEE',
    textSecondary: '#B0B4BA',
    background: '#000000',
    card: '#1C1D20',
    border: '#2E3135',
    primary: '#3A9BF4',
    success: '#3FBF73',
    danger: '#F05A5A',
  },
} as const;

export type ThemeColors = { [K in keyof typeof Colors.light]: string };

export const Spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
} as const;

export function useThemeColors(): ThemeColors {
  return Colors[useColorScheme() === 'dark' ? 'dark' : 'light'];
}
