import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';

import { Spacing, useThemeColors } from '@/constants/theme';
import { isFinished, MAX_RECENT_SESSIONS } from '@/model/session';
import type { Session } from '@/model/types';
import { sessionStore, useSession, useVocabulary } from '@/store';
import { describeProgress, describeSession } from '@/utils/describeFilter';
import { formatDateTime } from '@/utils/format';

/**
 * The last few sessions: tapping one shows its words first (to check it's the right one); the button on the
 * right continues it right away (or starts it again when it was finished).
 */
export default function RecentSessionsScreen() {
  const colors = useThemeColors();
  const recent = useSession((s) => s.recent);

  const open = (session: Session) => {
    sessionStore.getState().selectSession(session.id);
    router.replace('/session/play');
  };

  return (
    <FlatList
      style={{ backgroundColor: colors.background }}
      contentContainerStyle={styles.content}
      data={recent}
      keyExtractor={(s) => s.id}
      ListHeaderComponent={
        <Text style={{ color: colors.textSecondary }}>
          Your last {MAX_RECENT_SESSIONS} sessions. Tap one to see its words. Unfinished ones continue where you
          stopped, finished ones start again in a new order.
        </Text>
      }
      renderItem={({ item, index }) => (
        <RecentRow
          session={item}
          current={index === 0}
          onPress={() => router.push({ pathname: '/session/preview', params: { id: item.id } })}
          onOpen={() => open(item)}
        />
      )}
    />
  );
}

interface RecentRowProps {
  session: Session;
  current: boolean;
  /** Shows the session's words. */
  onPress: () => void;
  /** Continues / starts it again right away. */
  onOpen: () => void;
}

function RecentRow({ session, current, onPress, onOpen }: RecentRowProps) {
  const colors = useThemeColors();
  const lists = useVocabulary((s) => s.data.lists);
  const finished = isFinished(session);

  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.row, { backgroundColor: colors.card, opacity: pressed ? 0.7 : 1 }]}>
      <View style={styles.flex}>
        {current && <Text style={[styles.badge, { color: colors.primary }]}>CURRENT</Text>}
        <Text style={[styles.title, { color: colors.text }]}>{describeSession(session, lists)}</Text>
        <Text style={{ color: colors.textSecondary }}>{describeProgress(session)}</Text>
        <Text style={[styles.date, { color: colors.textSecondary }]}>Started {formatDateTime(session.startedAt)}</Text>
      </View>
      <Pressable
        accessibilityRole="button"
        hitSlop={8}
        onPress={onOpen}
        style={({ pressed }) => [styles.action, { opacity: pressed ? 0.5 : 1 }]}>
        <Ionicons name={finished ? 'repeat' : 'play'} size={22} color={colors.primary} />
        <Text style={[styles.actionLabel, { color: colors.primary }]}>{finished ? 'Again' : 'Continue'}</Text>
      </Pressable>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { padding: Spacing.md, gap: Spacing.sm },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, padding: Spacing.md, borderRadius: 12 },
  badge: { fontSize: 12, fontWeight: '700', letterSpacing: 0.5 },
  title: { fontSize: 17, fontWeight: '600' },
  date: { fontSize: 13, marginTop: 2 },
  action: { alignItems: 'center', gap: 2, minWidth: 64 },
  actionLabel: { fontSize: 13, fontWeight: '600' },
});
