import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import { AppState, useColorScheme } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { useVocabulary, vocabularyStore } from '@/store';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const status = useVocabulary((s) => s.status);

  useEffect(() => {
    vocabularyStore.getState().load();

    // Don't lose pending changes when the app is backgrounded (and possibly killed).
    const sub = AppState.addEventListener('change', (state) => {
      if (state !== 'active') {
        vocabularyStore.getState().flush();
      }
    });
    return () => sub.remove();
  }, []);

  useEffect(() => {
    if (status === 'ready' || status === 'error') {
      SplashScreen.hideAsync();
    }
  }, [status]);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
        <Stack>
          <Stack.Screen name="index" options={{ title: 'MyVocabulary' }} />
        </Stack>
      </ThemeProvider>
    </GestureHandlerRootView>
  );
}
