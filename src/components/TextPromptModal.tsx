import { useState } from 'react';
import { KeyboardAvoidingView, Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { Spacing, useThemeColors } from '@/constants/theme';

import { Button } from './Button';

interface TextPromptModalProps {
  visible: boolean;
  title: string;
  initialValue?: string;
  placeholder?: string;
  submitLabel?: string;
  /** Select the initial value, so typing replaces it (for suggested values). */
  selectInitialValue?: boolean;
  /** Returns an error message to keep the dialog open, or null to close it. */
  onSubmit: (value: string) => string | null;
  onCancel: () => void;
}

/** Cross-platform replacement for Alert.prompt (which is iOS-only). */
export function TextPromptModal(props: TextPromptModalProps) {
  return (
    <Modal visible={props.visible} transparent animationType="fade" onRequestClose={props.onCancel}>
      {/* Mounted only while visible, so the input starts from initialValue every time. */}
      {props.visible && <PromptDialog {...props} />}
    </Modal>
  );
}

function PromptDialog({
  title,
  initialValue = '',
  placeholder,
  submitLabel = 'Save',
  selectInitialValue = false,
  onSubmit,
  onCancel,
}: TextPromptModalProps) {
  const colors = useThemeColors();
  const [value, setValue] = useState(initialValue);
  const [error, setError] = useState<string | null>(null);

  const submit = () => setError(onSubmit(value));

  return (
    <KeyboardAvoidingView behavior="padding" style={styles.flex}>
      <Pressable style={styles.backdrop} onPress={onCancel}>
        <Pressable style={[styles.dialog, { backgroundColor: colors.background }]}>
          <Text style={[styles.title, { color: colors.text }]}>{title}</Text>
          <TextInput
            autoFocus
            selectTextOnFocus={selectInitialValue}
            value={value}
            onChangeText={(t) => {
              setValue(t);
              setError(null);
            }}
            placeholder={placeholder}
            placeholderTextColor={colors.textSecondary}
            onSubmitEditing={submit}
            returnKeyType="done"
            style={[styles.input, { color: colors.text, borderColor: error ? colors.danger : colors.border }]}
          />
          {error && <Text style={{ color: colors.danger }}>{error}</Text>}
          <View style={styles.buttons}>
            <Button title="Cancel" variant="secondary" onPress={onCancel} style={styles.flex} />
            <Button title={submitLabel} onPress={submit} style={styles.flex} />
          </View>
        </Pressable>
      </Pressable>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  backdrop: {
    flex: 1,
    justifyContent: 'center',
    padding: Spacing.lg,
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  dialog: { borderRadius: 16, padding: Spacing.lg, gap: Spacing.md },
  title: { fontSize: 18, fontWeight: '600' },
  input: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 16 },
  buttons: { flexDirection: 'row', gap: Spacing.sm },
});
