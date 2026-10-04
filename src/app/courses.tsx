import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { useMemo } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';

import { Button, IconButton } from '@/components/Button';
import { Footer } from '@/components/Footer';
import { Spacing, useThemeColors } from '@/constants/theme';
import { languageName } from '@/model/languages';
import { switchCourse, useCourses, useGoogleAccount, googleAccountStore } from '@/store';

/** All courses: tap one to switch to it. */
export default function CoursesScreen() {
  const colors = useThemeColors();
  const courses = useCourses((s) => s.courses);
  const activeCourseId = useCourses((s) => s.activeCourseId);
  const email = useGoogleAccount((s) => s.email);
  const sorted = useMemo(() => [...courses].sort((a, b) => a.name.localeCompare(b.name)), [courses]);

  const select = (courseId: string) => {
    router.back();
    switchCourse(courseId).catch((e) => console.error('Could not switch the course', e));
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <FlatList
        contentContainerStyle={styles.content}
        data={sorted}
        keyExtractor={(c) => c.id}
        renderItem={({ item }) => {
          const active = item.id === activeCourseId;
          return (
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
              onPress={() => select(item.id)}
              style={({ pressed }) => [styles.row, { backgroundColor: colors.card, opacity: pressed ? 0.7 : 1 }]}>
              <Ionicons
                name={active ? 'checkmark-circle' : 'ellipse-outline'}
                size={24}
                color={active ? colors.primary : colors.border}
              />
              <View style={styles.flex}>
                <Text style={[styles.name, { color: colors.text }]} numberOfLines={1}>
                  {item.name}
                </Text>
                <Text style={{ color: item.language ? colors.textSecondary : colors.danger }}>
                  {languageName(item.language)}
                </Text>
              </View>
              {item.spreadsheetId && (
                <Ionicons name="cloud-done-outline" size={20} color={colors.textSecondary} accessibilityLabel="Connected to Google Sheets" />
              )}
              <IconButton
                icon="create-outline"
                accessibilityLabel={`Edit ${item.name}`}
                onPress={() => router.push({ pathname: '/course', params: { id: item.id } })}
              />
            </Pressable>
          );
        }}
      />
      {email && (
        <View style={[styles.account, { borderTopColor: colors.border }]}>
          <Text style={[styles.flex, { color: colors.textSecondary }]} numberOfLines={1}>
            Google: {email}
          </Text>
          <Pressable hitSlop={8} onPress={() => googleAccountStore.getState().signOut()}>
            <Text style={{ color: colors.primary }}>Sign out</Text>
          </Pressable>
        </View>
      )}
      <Footer>
        <Button title="New course" icon="add" onPress={() => router.push('/course')} style={styles.flex} />
      </Footer>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { padding: Spacing.md, gap: Spacing.sm },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, padding: Spacing.md, borderRadius: 12 },
  name: { fontSize: 17, fontWeight: '600' },
  account: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
});
