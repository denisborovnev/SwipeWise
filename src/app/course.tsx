import Ionicons from '@expo/vector-icons/Ionicons';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Alert, KeyboardAvoidingView, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { Button } from '@/components/Button';
import { GoogleSheetsSection } from '@/components/GoogleSheetsSection';
import { LanguagePickerModal } from '@/components/LanguagePickerModal';
import { Spacing, useThemeColors } from '@/constants/theme';
import { defaultCourseName, findLanguage, languageName } from '@/model/languages';
import { validateCourseName } from '@/model/validation';
import { courseStore, createCourse, deleteCourse, updateCourseSpreadsheet, useCourses } from '@/store';
import { MIGRATED_COURSE_NAME } from '@/store/courseStore';

/** Create a course (no `id`) or edit one: the language being learned and the course name. */
export default function CourseScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const colors = useThemeColors();
  const courses = useCourses((s) => s.courses);
  const course = id ? courses.find((c) => c.id === id) : undefined;
  const isEdit = !!id;

  const [language, setLanguage] = useState(course?.language ?? null);
  const [name, setName] = useState(course?.name ?? '');
  // The name follows the language until the user types their own.
  const [nameFollowsLanguage, setNameFollowsLanguage] = useState(
    !course ||
      course.name === MIGRATED_COURSE_NAME ||
      (!!course.language && course.name === defaultCourseName(course.language)),
  );
  // A new course (or one without a language) starts with the language list.
  const [picking, setPicking] = useState(!course?.language);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  if (isEdit && !course) {
    // Deleted from this screen – nothing to show while it closes.
    return <Stack.Screen options={{ title: '' }} />;
  }

  const pickLanguage = (code: string) => {
    setLanguage(code);
    if (nameFollowsLanguage) {
      setName(defaultCourseName(code));
    }
    setPicking(false);
    setError(null);
  };

  const save = async () => {
    if (!language) {
      setError('Please choose the language you are learning.');
      return;
    }
    const err = validateCourseName(name, courses, id);
    setError(err);
    if (err) {
      return;
    }
    setSaving(true);
    try {
      if (isEdit) {
        await courseStore.getState().updateCourse(id, { name, language });
        updateCourseSpreadsheet(id);
        router.back();
      } else {
        await createCourse({ name, language });
        // Straight to the new (empty) course.
        router.dismissTo('/');
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setSaving(false);
    }
  };

  const confirmDelete = () =>
    Alert.alert(
      `Delete "${course?.name}"?`,
      'All word lists, words and sessions of this course will be deleted from this phone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            router.back();
            deleteCourse(id!).catch((e) => console.error('Could not delete the course', e));
          },
        },
      ],
    );

  const selected = findLanguage(language);

  return (
    <KeyboardAvoidingView behavior="padding" style={{ flex: 1, backgroundColor: colors.background }}>
      <Stack.Screen options={{ title: isEdit ? 'Edit course' : 'New course' }} />
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={[styles.label, { color: colors.textSecondary }]}>Language you are learning</Text>
        <Pressable
          accessibilityRole="button"
          onPress={() => setPicking(true)}
          style={({ pressed }) => [styles.languageRow, { backgroundColor: colors.card, opacity: pressed ? 0.7 : 1 }]}>
          <View style={styles.flex}>
            <Text style={[styles.languageName, { color: language ? colors.text : colors.primary }]}>
              {language ? languageName(language) : 'Choose language…'}
            </Text>
            {selected && <Text style={{ color: colors.textSecondary }}>{selected.nativeName}</Text>}
          </View>
          <Ionicons name="chevron-forward" size={20} color={colors.textSecondary} />
        </Pressable>

        <Text style={[styles.label, { color: colors.textSecondary }]}>Course name</Text>
        <TextInput
          value={name}
          onChangeText={(text) => {
            setName(text);
            setNameFollowsLanguage(false);
          }}
          placeholder={language ? defaultCourseName(language) : 'e.g. English'}
          placeholderTextColor={colors.textSecondary}
          style={[styles.input, { color: colors.text, borderColor: colors.border, backgroundColor: colors.card }]}
        />
        <Text style={{ color: colors.textSecondary }}>Each course has its own word lists, sessions and spreadsheet.</Text>

        {error && <Text style={{ color: colors.danger }}>{error}</Text>}

        <View style={styles.actions}>
          {isEdit && courses.length > 1 && (
            <Button title="Delete" variant="danger" icon="trash-outline" onPress={confirmDelete} />
          )}
          <Button title={isEdit ? 'Save' : 'Create course'} onPress={save} disabled={saving} style={styles.flex} />
        </View>

        {course && <GoogleSheetsSection course={course} />}
      </ScrollView>

      <LanguagePickerModal
        visible={picking}
        selected={language}
        onSelect={pickLanguage}
        onCancel={() => setPicking(false)}
      />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { padding: Spacing.md, gap: Spacing.sm },
  label: { marginTop: Spacing.sm },
  languageRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, padding: Spacing.md, borderRadius: 12 },
  languageName: { fontSize: 17, fontWeight: '600' },
  input: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 17 },
  actions: { flexDirection: 'row', gap: Spacing.sm, marginTop: Spacing.md },
});
