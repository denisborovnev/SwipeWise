import { DarkTheme, DefaultTheme, type ErrorBoundaryProps, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import { AppState, StyleSheet, Text, useColorScheme, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { Button } from '@/components/Button';
import { Spacing, useThemeColors } from '@/constants/theme';
import { flushAll, loadAll, onAppStateChange, useCourses, useSession, useVocabulary } from '@/store';

SplashScreen.preventAutoHideAsync();

/** Shown instead of a screen that crashed, so the app never ends on a blank / red screen. */
export function ErrorBoundary({ error, retry }: ErrorBoundaryProps) {
  const colors = useThemeColors();
  useEffect(() => {
    SplashScreen.hideAsync();
  }, []);
  return (
    <View style={[styles.error, { backgroundColor: colors.background }]}>
      <Text style={[styles.errorTitle, { color: colors.text }]}>Something went wrong</Text>
      <Text style={{ color: colors.textSecondary, textAlign: 'center' }}>
        Your words are safe on this phone. Try again, and if it keeps happening, restart the app.
      </Text>
      <Text style={{ color: colors.textSecondary, fontSize: 12, textAlign: 'center' }}>{error.message}</Text>
      <Button title="Try again" icon="refresh" onPress={retry} />
    </View>
  );
}

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const coursesStatus = useCourses((s) => s.status);
  const hasCourse = useCourses((s) => s.activeCourseId !== null);
  const vocabularyStatus = useVocabulary((s) => s.status);
  const sessionStatus = useSession((s) => s.status);
  const courseLoaded =
    !hasCourse || vocabularyStatus === 'error' || (vocabularyStatus === 'ready' && sessionStatus === 'ready');
  const loaded = coursesStatus === 'error' || (coursesStatus === 'ready' && courseLoaded);

  useEffect(() => {
    loadAll();

    // Don't lose pending changes when the app is backgrounded (and possibly killed).
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'inactive') {
        flushAll();
      }
      // Background: save and push to the spreadsheet; active again: pull if it's been a while.
      onAppStateChange(state);
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
          <Stack.Screen name="index" options={{ title: 'SwipeWise' }} />
          <Stack.Screen name="courses" options={{ title: 'Courses' }} />
          <Stack.Screen name="course" options={{ presentation: 'modal' }} />
          <Stack.Screen name="all-lists"options={{ title: 'All lists' }} />
          <Stack.Screen name="lists/[id]" options={{ title: '' }} />
          <Stack.Screen name="dev-seed" options={{ title: '' }} />
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

const styles = StyleSheet.create({
  error: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: Spacing.md, padding: Spacing.lg },
  errorTitle: { fontSize: 20, fontWeight: '700' },
});
