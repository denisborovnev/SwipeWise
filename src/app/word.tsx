import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useRef, useState } from 'react';
import { Alert, KeyboardAvoidingView, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { Button } from '@/components/Button';
import { Spacing, useThemeColors } from '@/constants/theme';
import { parseExamples, validateWord } from '@/model/validation';
import { findDuplicate } from '@/model/vocabulary';
import { useVocabulary, vocabularyStore } from '@/store';

/**
 * Add / edit a word. Without `wordId` it is in "quick add" mode: after adding,
 * the form is cleared and stays open for the next word.
 */
export default function WordScreen() {
  const { listId, wordId } = useLocalSearchParams<{ listId: string; wordId?: string }>();
  const colors = useThemeColors();
  const word = useVocabulary((s) => (wordId ? s.data.words.find((w) => w.id === wordId) : undefined));
  const isEdit = !!wordId;

  const [front, setFront] = useState(word?.front ?? '');
  const [back, setBack] = useState(word?.back ?? '');
  const [examples, setExamples] = useState(word?.examples.join('\n') ?? '');
  const [error, setError] = useState<string | null>(null);
  const [lastAdded, setLastAdded] = useState<string | null>(null);
  const frontRef = useRef<TextInput>(null);
  const backRef = useRef<TextInput>(null);
  const examplesRef = useRef<TextInput>(null);

  const input = { front, back, examples: parseExamples(examples) };

  const commit = () => {
    const store = vocabularyStore.getState();
    if (isEdit) {
      store.updateWord(wordId, input);
      router.back();
    } else {
      store.addWord(listId, input);
      setLastAdded(`${input.front} – ${input.back}`);
      setFront('');
      setBack('');
      setExamples('');
      frontRef.current?.focus();
    }
  };

  const save = () => {
    const err = validateWord(input);
    setError(err);
    if (err) {
      return;
    }
    const duplicate = findDuplicate(vocabularyStore.getState().data, listId, input, wordId);
    if (duplicate) {
      Alert.alert(
        'Possible duplicate',
        `This list already has "${duplicate.front} – ${duplicate.back}".`,
        [
          { text: 'Cancel', style: 'cancel' },
          { text: isEdit ? 'Save anyway' : 'Add anyway', onPress: commit },
        ],
      );
    } else {
      commit();
    }
  };

  const confirmDelete = () =>
    Alert.alert(`Delete "${word?.front}"?`, undefined, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          router.back();
          vocabularyStore.getState().deleteWord(wordId!);
        },
      },
    ]);

  const inputStyle = [styles.input, { color: colors.text, borderColor: colors.border, backgroundColor: colors.card }];

  return (
    <KeyboardAvoidingView behavior="padding" style={{ flex: 1, backgroundColor: colors.background }}>
      <Stack.Screen options={{ title: isEdit ? 'Edit word' : 'Add words' }} />
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        {lastAdded && (
          <Text style={{ color: colors.success }} accessibilityLiveRegion="polite">
            ✓ Added “{lastAdded}”
          </Text>
        )}

        <Text style={[styles.label, { color: colors.textSecondary }]}>Front – what you see first</Text>
        <TextInput
          ref={frontRef}
          autoFocus={!isEdit}
          value={front}
          onChangeText={setFront}
          autoCapitalize="none"
          placeholder="Definition in your native language"
          placeholderTextColor={colors.textSecondary}
          returnKeyType="next"
          submitBehavior="submit"
          onSubmitEditing={() => backRef.current?.focus()}
          style={inputStyle}
        />

        <Text style={[styles.label, { color: colors.textSecondary }]}>Back – the word to remember</Text>
        <TextInput
          ref={backRef}
          value={back}
          onChangeText={setBack}
          autoCapitalize="none"
          placeholder="Word"
          placeholderTextColor={colors.textSecondary}
          returnKeyType="next"
          submitBehavior="submit"
          onSubmitEditing={() => examplesRef.current?.focus()}
          style={inputStyle}
        />

        <Text style={[styles.label, { color: colors.textSecondary }]}>Examples – one per line (optional)</Text>
        <TextInput
          ref={examplesRef}
          value={examples}
          onChangeText={setExamples}
          placeholder="Example usage"
          placeholderTextColor={colors.textSecondary}
          multiline
          style={[inputStyle, styles.multiline]}
        />

        {error && <Text style={{ color: colors.danger }}>{error}</Text>}

        <View style={styles.actions}>
          {isEdit ? (
            <>
              <Button title="Delete" variant="danger" icon="trash-outline" onPress={confirmDelete} />
              <Button title="Save" onPress={save} style={styles.flex} />
            </>
          ) : (
            <>
              <Button title="Done" variant="secondary" onPress={() => router.back()} style={styles.flex} />
              <Button title="Add" icon="add" onPress={save} style={styles.flex} />
            </>
          )}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { padding: Spacing.md, gap: Spacing.sm },
  label: { marginTop: Spacing.sm },
  input: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 17 },
  multiline: { minHeight: 100, textAlignVertical: 'top' },
  actions: { flexDirection: 'row', gap: Spacing.sm, marginTop: Spacing.md },
});
