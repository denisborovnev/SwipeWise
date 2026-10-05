import Ionicons from '@expo/vector-icons/Ionicons';
import { router, Stack } from 'expo-router';
import { useMemo } from 'react';
import { ActivityIndicator, FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';

import { Button } from '@/components/Button';
import { Footer } from '@/components/Footer';
import { ListRow } from '@/components/ListRow';
import { NewListButton } from '@/components/NewListButton';
import { SessionCard } from '@/components/SessionCard';
import { Spacing, useThemeColors } from '@/constants/theme';
import { sortLists, withWordCounts } from '@/model/lists';
import { isFinished } from '@/model/session';
import type { Course } from '@/model/types';
import {
  googleAccountStore,
  loadAll,
  syncActiveCourse,
  useCourses,
  useGoogleAccount,
  useSession,
  useSync,
  useVocabulary,
} from '@/store';
import { plural } from '@/utils/format';

/** How many of the newest lists the home screen shows; the rest are under "All lists". */
const HOME_LIST_COUNT = 5;

export default function HomeScreen() {
  const colors = useThemeColors();
  const coursesStatus = useCourses((s) => s.status);
  const coursesError = useCourses((s) => s.error);
  const course = useCourses((s) => s.courses.find((c) => c.id === s.activeCourseId));
  const status = useVocabulary((s) => s.status);
  const error = useVocabulary((s) => s.error);
  const data = useVocabulary((s) => s.data);
  const session = useSession((s) => s.session);
  const recentCount = useSession((s) => s.recent.length);
  const signedIn = useGoogleAccount((s) => s.email !== null);
  const syncing = useSync((s) => s.status === 'syncing' && s.courseId === course?.id);

  const newestLists = useMemo(
    () => sortLists(withWordCounts(data.lists, data.words), 'newest').slice(0, HOME_LIST_COUNT),
    [data],
  );

  if (coursesStatus === 'error' || status === 'error') {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <Text style={{ color: colors.danger, textAlign: 'center' }}>
          Could not load your words: {coursesError ?? error}
        </Text>
        <Button title="Try again" icon="refresh" onPress={() => loadAll()} />
      </View>
    );
  }

  if (coursesStatus === 'ready' && !course) {
    return <Welcome />;
  }

  if (status !== 'ready' || !course) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <ActivityIndicator color={colors.primary} size="large" />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <Stack.Screen
        options={{
          headerTitle: () => <CourseTitle course={course} />,
          headerRight: () => <SyncIcon course={course} />,
        }}
      />
      <FlatList
        // Pull down to read changes made in the spreadsheet (connected courses only).
        refreshControl={
          course.spreadsheetId && signedIn ? (
            <RefreshControl refreshing={syncing} onRefresh={() => syncActiveCourse({ force: true })} colors={[colors.primary]} />
          ) : undefined
        }
        contentContainerStyle={styles.content}
        data={newestLists}
        keyExtractor={(l) => l.id}
        ListHeaderComponent={
          <View style={styles.header}>
            {!course.language && <LanguageMissing course={course} />}
            {session && <SessionCard session={session} />}
            <View style={styles.sessionButtons}>
              {recentCount > 1 && (
                <Button
                  title="Recent"
                  icon="time-outline"
                  variant="secondary"
                  onPress={() => router.push('/session/recent')}
                  style={styles.flex}
                />
              )}
              <Button
                title="New session"
                icon="options-outline"
                variant={session && !isFinished(session) ? 'secondary' : 'primary'}
                onPress={() => router.push('/session/new')}
                disabled={data.words.length === 0}
                style={styles.flex}
              />
            </View>
            <Text style={[styles.sectionTitle, styles.listsTitle, { color: colors.text }]}>
              {data.lists.length > HOME_LIST_COUNT ? 'Newest word lists' : 'Word lists'}
            </Text>
            <Text style={{ color: colors.textSecondary }}>
              {plural(data.lists.length, 'list')} · {plural(data.words.length, 'word')}
            </Text>
          </View>
        }
        ListEmptyComponent={
          <Text style={{ color: colors.textSecondary }}>No word lists yet. Create your first one below.</Text>
        }
        renderItem={({ item }) => <ListRow list={item} />}
        ListFooterComponent={
          data.lists.length > HOME_LIST_COUNT ? (
            <Button
              title={`All lists (${data.lists.length})`}
              icon="list"
              variant="secondary"
              onPress={() => router.push('/all-lists')}
              style={styles.allLists}
            />
          ) : null
        }
      />
      <Footer>
        <NewListButton />
      </Footer>
    </View>
  );
}

/** Header title: the current course; opens the Courses screen. */
function CourseTitle({ course }: { course: Course }) {
  const colors = useThemeColors();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Course ${course.name}. Switch course`}
      onPress={() => router.push('/courses')}
      hitSlop={8}
      style={({ pressed }) => [styles.courseTitle, { opacity: pressed ? 0.6 : 1 }]}>
      <Text style={[styles.courseName, { color: colors.text }]} numberOfLines={1}>
        {course.name}
      </Text>
      <Ionicons name="chevron-down" size={18} color={colors.text} />
    </Pressable>
  );
}

/** Sync status of a connected course; opens the course screen (Google Sheets section). */
function SyncIcon({ course }: { course: Course }) {
  const colors = useThemeColors();
  const signedIn = useGoogleAccount((s) => s.email !== null);
  const sync = useSync((s) => (s.courseId === course.id ? s.status : 'idle'));
  if (!course.spreadsheetId) {
    return null;
  }
  const problem = sync === 'error' || !signedIn;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={sync === 'syncing' ? 'Syncing' : problem ? 'Sync problem' : 'Synced with Google Sheets'}
      hitSlop={8}
      onPress={() => router.push({ pathname: '/course', params: { id: course.id } })}>
      {sync === 'syncing' ? (
        <ActivityIndicator color={colors.textSecondary} />
      ) : (
        <Ionicons
          name={problem ? 'cloud-offline-outline' : 'cloud-done-outline'}
          size={24}
          color={problem ? colors.danger : colors.textSecondary}
        />
      )}
    </Pressable>
  );
}

/** Shown once after the update that introduced courses: the existing words need a language. */
function LanguageMissing({ course }: { course: Course }) {
  const colors = useThemeColors();
  return (
    <View style={[styles.notice, { backgroundColor: colors.card, borderColor: colors.primary }]}>
      <Text style={{ color: colors.text, fontSize: 16 }}>
        Your words are now in the course “{course.name}”. Which language are you learning in it?
      </Text>
      <Button
        title="Choose language"
        icon="language"
        onPress={() => router.push({ pathname: '/course', params: { id: course.id } })}
      />
    </View>
  );
}

/** First start: no courses yet. */
/** Fresh install: sign in, then the courses screen lists the courses found in Google Drive. */
async function restoreFromDrive() {
  if (googleAccountStore.getState().email || (await googleAccountStore.getState().signIn())) {
    router.push('/courses');
  }
}

function Welcome() {
  const colors = useThemeColors();
  return (
    <View style={[styles.center, styles.welcome, { backgroundColor: colors.background }]}>
      <Stack.Screen options={{ title: 'SwipeWise' }} />
      <Ionicons name="albums-outline" size={64} color={colors.primary} />
      <Text style={[styles.welcomeTitle, { color: colors.text }]}>Welcome to SwipeWise</Text>
      <Text style={[styles.welcomeText, { color: colors.textSecondary }]}>
        Learn words with flashcards: flip a card, then swipe right if you knew it, left if you didn’t.
      </Text>
      <Button title="Choose the language you’re learning" icon="language" onPress={() => router.push('/course')} />
      <Button
        title="Restore from Google Drive"
        icon="cloud-download-outline"
        variant="secondary"
        onPress={restoreFromDrive}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  courseTitle: { flexDirection: 'row', alignItems: 'center', gap: 4, maxWidth: 260 },
  courseName: { fontSize: 20, fontWeight: '600', flexShrink: 1 },
  notice: { gap: Spacing.sm, padding: Spacing.md, borderRadius: 12, borderWidth: 1 },
  welcome: { gap: Spacing.md },
  welcomeTitle: { fontSize: 24, fontWeight: '700' },
  welcomeText: { fontSize: 16, textAlign: 'center' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: Spacing.md, padding: Spacing.lg },
  content: { padding: Spacing.md, gap: Spacing.sm },
  header: { marginBottom: Spacing.sm, gap: Spacing.sm },
  sectionTitle: { fontSize: 20, fontWeight: '700' },
  listsTitle: { marginTop: Spacing.sm },
  sessionButtons: { flexDirection: 'row', gap: Spacing.sm },
  flex: { flex: 1 },
  allLists: { marginTop: Spacing.xs },
});
