import * as Crypto from 'expo-crypto';
import { router } from 'expo-router';
import { useEffect } from 'react';
import { View } from 'react-native';

import { createSampleLists } from '@/dev/sampleLists';
import { useCourses, useVocabulary, vocabularyStore } from '@/store';

/**
 * Development helper: opening the deep link `…/--/dev-seed` adds the sample word lists to the current
 * course and goes back to the home screen. Does nothing in release builds or when there is no course yet.
 */
export default function DevSeedScreen() {
  const status = useVocabulary((s) => s.status);
  const noCourse = useCourses((s) => s.status === 'ready' && s.activeCourseId === null);

  useEffect(() => {
    if (status !== 'ready' && !noCourse) {
      return;
    }
    if (__DEV__ && status === 'ready') {
      const store = vocabularyStore.getState();
      const { lists, words } = createSampleLists(
        () => Crypto.randomUUID(),
        new Date(),
        store.data.lists.map((l) => l.name),
      );
      store.importVocabulary(lists, words);
    }
    // Return to the screen the app was on (or home on a cold start) without stacking a second home.
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/');
    }
  }, [status, noCourse]);

  return <View />;
}
