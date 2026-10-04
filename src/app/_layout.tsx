import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import { AppState, useColorScheme } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { flushAll, loadAll, useSession, useVocabulary } from '@/store';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const vocabularyStatus = useVocabulary((s) => s.status);
  const sessionStatus = useSession((s) => s.status);
  const loaded = vocabularyStatus === 'error' || (vocabularyStatus === 'ready' && sessionStatus === 'ready');

  useEffect(() => {
    loadAll();

    // Don't lose pending changes when the app is backgrounded (and possibly killed).
    const sub = AppState.addEventListener('change', (state) => {
      if (state !== 'active') {
        flushAll();
      }
    });
    return () => sub.remove();
  }, []);

  useEffect(() => {
    if (loaded) {
      SplashScreen.hideAsync();
    }
  }, [loaded]);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
        <Stack>
          <Stack.Screen name="index" options={{ title: 'MyVocabulary' }} />
          <Stack.Screen name="lists/[id]" options={{ title: '' }} />
          <Stack.Screen name="word" options={{ presentation: 'modal' }} />
          <Stack.Screen name="session/new" options={{ title: 'New session' }} />
          <Stack.Screen name="session/recent" options={{ title: 'Recent sessions' }} />
          <Stack.Screen name="session/play" options={{ title: '' }} />
          <Stack.Screen name="session/summary" options={{ title: 'Results', headerBackVisible: false }} />
        </Stack>
      </ThemeProvider>
    </GestureHandlerRootView>
  );
}
