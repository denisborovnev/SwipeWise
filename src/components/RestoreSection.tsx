import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { Spacing, useThemeColors } from '@/constants/theme';
import { languageName } from '@/model/languages';
import { findRestorableCourses, googleAccountStore, restoreCourses, useCourses, useGoogleAccount } from '@/store';
import type { RestorableCourse } from '@/sync/restore';
import { formatDate } from '@/utils/format';

import { Button } from './Button';

type Check = { status: 'done'; items: RestorableCourse[] } | { status: 'error'; error: string };

/**
 * Courses screen: courses whose spreadsheets are in Google Drive but not on this phone (e.g. after
 * reinstalling), with a button to restore them. Signed out: a link to sign in and look.
 */
export function RestoreSection() {
  const colors = useThemeColors();
  const email = useGoogleAccount((s) => s.email);
  const courseCount = useCourses((s) => s.courses.length);
  // Look again when the account changes or courses are added / removed here (or on Try again).
  const [attempt, setAttempt] = useState(0);
  const key = `${email}|${courseCount}|${attempt}`;
  const [result, setResult] = useState<{ key: string; check: Check } | null>(null);
  const check = result?.key === key ? result.check : null;
  const [restoring, setRestoring] = useState(false);

  useEffect(() => {
    if (!email) {
      return;
    }
    let active = true;
    findRestorableCourses().then(
      (items) => active && setResult({ key, check: { status: 'done', items } }),
      (e) => active && setResult({ key, check: { status: 'error', error: e instanceof Error ? e.message : String(e) } }),
    );
    return () => {
      active = false;
    };
  }, [email, key]);

  const load = () => setAttempt((n) => n + 1);

  const restore = async (items: RestorableCourse[]) => {
    setRestoring(true);
    try {
      await restoreCourses(items);
      router.back();
    } catch (e) {
      setResult({ key, check: { status: 'error', error: e instanceof Error ? e.message : String(e) } });
    } finally {
      setRestoring(false);
    }
  };

  if (!email) {
    return (
      <Pressable
        accessibilityRole="button"
        hitSlop={8}
        onPress={() => googleAccountStore.getState().signIn()}
        style={styles.link}>
        <Ionicons name="cloud-download-outline" size={18} color={colors.primary} />
        <Text style={{ color: colors.primary }}>Restore courses from Google Drive</Text>
      </Pressable>
    );
  }

  if (!check) {
    return (
      <View style={styles.link}>
        <ActivityIndicator color={colors.textSecondary} />
        <Text style={{ color: colors.textSecondary }}>Looking for your courses in Google Drive…</Text>
      </View>
    );
  }

  if (check.status === 'error') {
    return (
      <View style={styles.section}>
        <Text style={{ color: colors.danger }}>Couldn’t look in Google Drive: {check.error}</Text>
        <Button title="Try again" icon="refresh" variant="secondary" onPress={load} />
      </View>
    );
  }

  if (check.items.length === 0) {
    return null;
  }

  return (
    <View style={styles.section}>
      <Text style={[styles.title, { color: colors.text }]}>In your Google Drive</Text>
      <Text style={{ color: colors.textSecondary }}>
        Courses created with SwipeWise earlier (e.g. before reinstalling). Restoring reads their words from the
        spreadsheet.
      </Text>
      {check.items.map((item) => (
        <View key={item.spreadsheet.id} style={[styles.row, { backgroundColor: colors.card }]}>
          <Ionicons name="cloud-outline" size={24} color={colors.textSecondary} />
          <View style={styles.flex}>
            <Text style={[styles.name, { color: colors.text }]} numberOfLines={1}>
              {item.course.name}
            </Text>
            <Text style={{ color: colors.textSecondary }}>
              {languageName(item.course.language)} · created {formatDate(item.course.createdAt)}
            </Text>
          </View>
          <Button title="Restore" variant="secondary" disabled={restoring} onPress={() => restore([item])} />
        </View>
      ))}
      {check.items.length > 1 && (
        <Button
          title={`Restore all ${check.items.length}`}
          icon="cloud-download-outline"
          disabled={restoring}
          onPress={() => restore(check.items)}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  section: { gap: Spacing.sm, marginTop: Spacing.lg },
  title: { fontSize: 17, fontWeight: '600' },
  name: { fontSize: 17, fontWeight: '600' },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, padding: Spacing.md, borderRadius: 12 },
  link: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginTop: Spacing.lg, paddingVertical: Spacing.xs },
});
