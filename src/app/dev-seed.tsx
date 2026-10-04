import * as Crypto from 'expo-crypto';
import { router } from 'expo-router';
import { useEffect } from 'react';
import { View } from 'react-native';

import { createSampleLists } from '@/dev/sampleLists';
import { useVocabulary, vocabularyStore } from '@/store';

/**
 * Development helper: opening the deep link `…/--/dev-seed` adds the sample word lists and goes
 * back to the home screen. Does nothing in release builds.
 */
export default function DevSeedScreen() {
  const status = useVocabulary((s) => s.status);

  useEffect(() => {
    if (status !== 'ready') {
      return;
    }
    if (__DEV__) {
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
  }, [status]);

  return <View />;
}
