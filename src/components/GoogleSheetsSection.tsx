import Ionicons from '@expo/vector-icons/Ionicons';
import { useState } from 'react';
import { ActivityIndicator, Alert, Linking, StyleSheet, Text, View } from 'react-native';

import { Spacing, useThemeColors } from '@/constants/theme';
import type { Course } from '@/model/types';
import {
  connectGoogleSheets,
  disconnectGoogleSheets,
  syncActiveCourse,
  useCourses,
  useGoogleAccount,
  useSync,
} from '@/store';
import { spreadsheetUrl } from '@/sync/sheetFormat';
import { formatDateTime } from '@/utils/format';

import { Button } from './Button';

/** Course screen section: connect the course to its own Google spreadsheet, open it, disconnect. */
export function GoogleSheetsSection({ course }: { course: Course }) {
  const colors = useThemeColors();
  const email = useGoogleAccount((s) => s.email);
  const active = useCourses((s) => s.activeCourseId === course.id);
  const sync = useSync((s) => (s.courseId === course.id ? s : null));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const connect = async () => {
    setBusy(true);
    setError(null);
    try {
      const result = await connectGoogleSheets(course.id);
      if (result && !result.created) {
        Alert.alert(
          'Spreadsheet found',
          `"${course.name}" is connected to the spreadsheet it used before. Your words will be synced with it.`,
        );
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const confirmDisconnect = () =>
    Alert.alert(
      'Disconnect Google Sheets?',
      'Your words stay on this phone and the spreadsheet stays in your Google Drive, but they are no longer synced.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Disconnect', style: 'destructive', onPress: () => disconnectGoogleSheets(course.id) },
      ],
    );

  return (
    <View style={[styles.section, { borderColor: colors.border }]}>
      <View style={styles.titleRow}>
        <Ionicons name="cloud-outline" size={20} color={colors.text} />
        <Text style={[styles.title, { color: colors.text }]}>Google Sheets</Text>
      </View>

      {course.spreadsheetId ? (
        <>
          <Text style={{ color: colors.textSecondary }}>
            Connected{email ? ` as ${email}` : ''}. You can edit the words in the spreadsheet too.
          </Text>
          {!email ? (
            <Text style={{ color: colors.danger }}>Not signed in to Google – sign in to sync.</Text>
          ) : sync?.status === 'syncing' ? (
            <View style={styles.busy}>
              <ActivityIndicator color={colors.primary} />
              <Text style={{ color: colors.textSecondary }}>Syncing…</Text>
            </View>
          ) : sync?.status === 'error' ? (
            <Text style={{ color: colors.danger }}>Last sync failed: {sync.error}</Text>
          ) : course.lastSyncAt ? (
            <Text style={{ color: colors.textSecondary }}>Last synced {formatDateTime(course.lastSyncAt)}</Text>
          ) : null}
          {active && email && (
            <Button
              title="Sync now"
              icon="sync"
              onPress={() => syncActiveCourse()}
              disabled={sync?.status === 'syncing'}
            />
          )}
          {!email && <Button title="Sign in to Google" icon="logo-google" onPress={connect} />}
          <Button
            title="Open in Google Sheets"
            icon="open-outline"
            variant="secondary"
            onPress={() => Linking.openURL(spreadsheetUrl(course.spreadsheetId!))}
          />
          <Button title="Disconnect" variant="secondary" onPress={confirmDisconnect} />
        </>
      ) : (
        <>
          <Text style={{ color: colors.textSecondary }}>
            Keep this course’s words in a spreadsheet in your Google Drive, so you can also add and edit them on
            your computer. The app can only access the spreadsheets it creates.
          </Text>
          {busy ? (
            <View style={styles.busy}>
              <ActivityIndicator color={colors.primary} />
              <Text style={{ color: colors.textSecondary }}>Creating the spreadsheet…</Text>
            </View>
          ) : (
            <Button title="Connect Google Sheets" icon="logo-google" onPress={connect} />
          )}
        </>
      )}

      {error && <Text style={{ color: colors.danger }}>Could not connect: {error}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  section: { gap: Spacing.sm, marginTop: Spacing.lg, paddingTop: Spacing.md, borderTopWidth: StyleSheet.hairlineWidth },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  title: { fontSize: 17, fontWeight: '600' },
  busy: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, paddingVertical: Spacing.sm },
});
