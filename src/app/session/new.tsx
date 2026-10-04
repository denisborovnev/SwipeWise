import DateTimePicker, { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import { router } from 'expo-router';
import { useMemo, useState, type ReactNode } from 'react';
import { Platform, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';

import { Button } from '@/components/Button';
import { Chips, type ChipOption } from '@/components/Chips';
import { Footer } from '@/components/Footer';
import { Spacing, useThemeColors } from '@/constants/theme';
import { selectWords } from '@/model/filter';
import type { DateFilter, SessionFilter } from '@/model/types';
import { sessionStore, useSession, useVocabulary } from '@/store';
import { formatDate, plural } from '@/utils/format';

type DateChoice = 'any' | `d${number}` | 'date';

const ADDED_PRESETS: ChipOption<DateChoice>[] = [
  { key: 'any', label: 'Any time' },
  { key: 'd0', label: 'Today' },
  { key: 'd7', label: 'Last 7 days' },
  { key: 'd30', label: 'Last 30 days' },
];

const REVISED_PRESETS: ChipOption<DateChoice>[] = [
  { key: 'any', label: 'Any time' },
  { key: 'd0', label: 'Not today' },
  { key: 'd3', label: 'Not in 3 days' },
  { key: 'd7', label: 'Not in a week' },
  { key: 'd30', label: 'Not in a month' },
];

function toChoice(filter: DateFilter | undefined): DateChoice {
  if (!filter) {
    return 'any';
  }
  return 'date' in filter ? 'date' : `d${filter.days}`;
}

function fromChoice(choice: DateChoice): DateFilter | undefined {
  return choice === 'any' || choice === 'date' ? undefined : { days: Number(choice.slice(1)) };
}

export default function NewSessionScreen() {
  const colors = useThemeColors();
  const lists = useVocabulary((s) => s.data.lists);
  const words = useVocabulary((s) => s.data.words);
  const lastFilter = useSession((s) => s.lastFilter);

  const [filter, setFilter] = useState<SessionFilter>(() => {
    const initial = lastFilter ?? { listId: 'all' };
    // The remembered list may have been deleted since.
    return initial.listId === 'all' || lists.some((l) => l.id === initial.listId)
      ? initial
      : { ...initial, listId: 'all' };
  });
  const update = (patch: Partial<SessionFilter>) => setFilter((f) => ({ ...f, ...patch }));

  const count = useMemo(() => selectWords(words, filter, new Date()).length, [words, filter]);

  const listOptions: ChipOption<string>[] = [
    { key: 'all', label: 'All words' },
    ...[...lists].sort((a, b) => a.name.localeCompare(b.name)).map((l) => ({ key: l.id, label: l.name })),
  ];

  const start = () => {
    if (sessionStore.getState().startSession(filter) > 0) {
      router.replace('/session/play');
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView contentContainerStyle={styles.content}>
        <Section title="Word list">
          <Chips options={listOptions} selected={filter.listId} onSelect={(listId) => update({ listId })} />
        </Section>

        <Section title="Added">
          <DateFilterPicker
            presets={ADDED_PRESETS}
            value={filter.addedSince}
            dateLabel={(d) => `Since ${d}`}
            onChange={(addedSince) => update({ addedSince })}
          />
        </Section>

        <Section title="Last revised" hint="Words you have never revised are always included.">
          <DateFilterPicker
            presets={REVISED_PRESETS}
            value={filter.notRevisedSince}
            dateLabel={(d) => `Not since ${d}`}
            onChange={(notRevisedSince) => update({ notRevisedSince })}
          />
        </Section>

        <View style={[styles.switchRow, { borderColor: colors.border }]}>
          <View style={styles.flex}>
            <Text style={[styles.switchTitle, { color: colors.text }]}>Only words I didn&apos;t remember</Text>
            <Text style={{ color: colors.textSecondary }}>Based on the last answer for each word</Text>
          </View>
          <Switch
            value={!!filter.onlyNotRemembered}
            onValueChange={(onlyNotRemembered) => update({ onlyNotRemembered })}
            accessibilityLabel="Only words I didn't remember"
          />
        </View>

        <Text style={{ color: colors.textSecondary }}>Words are shown in a new random order every time.</Text>
      </ScrollView>

      <Footer>
        <Button
          title={count > 0 ? `Start · ${plural(count, 'word')}` : 'No words match'}
          icon="play"
          onPress={start}
          disabled={count === 0}
          style={styles.flex}
        />
      </Footer>
    </View>
  );
}

function Section({ title, hint, children }: { title: string; hint?: string; children: ReactNode }) {
  const colors = useThemeColors();
  return (
    <View style={styles.section}>
      <Text style={[styles.sectionTitle, { color: colors.text }]}>{title}</Text>
      {children}
      {hint && <Text style={{ color: colors.textSecondary, fontSize: 13 }}>{hint}</Text>}
    </View>
  );
}

interface DateFilterPickerProps {
  presets: ChipOption<DateChoice>[];
  value: DateFilter | undefined;
  dateLabel: (formattedDate: string) => string;
  onChange: (value: DateFilter | undefined) => void;
}

/** Preset chips plus a "Pick date…" chip that opens the system date picker. */
function DateFilterPicker({ presets, value, dateLabel, onChange }: DateFilterPickerProps) {
  const [iosPickerVisible, setIosPickerVisible] = useState(false);
  const pickedDate = value && 'date' in value ? value.date : undefined;

  const options: ChipOption<DateChoice>[] = [
    ...presets,
    { key: 'date', label: pickedDate ? dateLabel(formatDate(pickedDate)) : 'Pick date…' },
  ];

  const setDate = (date: Date) => onChange({ date: date.toISOString() });

  const openPicker = () => {
    const current = pickedDate ? new Date(pickedDate) : new Date();
    if (Platform.OS === 'android') {
      DateTimePickerAndroid.open({
        value: current,
        mode: 'date',
        maximumDate: new Date(),
        onValueChange: (_event, date) => setDate(date),
      });
    } else {
      setIosPickerVisible(true);
    }
  };

  return (
    <>
      <Chips
        options={options}
        selected={toChoice(value)}
        onSelect={(choice) => (choice === 'date' ? openPicker() : onChange(fromChoice(choice)))}
      />
      {iosPickerVisible && (
        <DateTimePicker
          value={pickedDate ? new Date(pickedDate) : new Date()}
          mode="date"
          maximumDate={new Date()}
          onValueChange={(_event, date) => {
            setIosPickerVisible(false);
            setDate(date);
          }}
          onDismiss={() => setIosPickerVisible(false)}
        />
      )}
    </>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { padding: Spacing.md, gap: Spacing.lg },
  section: { gap: Spacing.sm },
  sectionTitle: { fontSize: 17, fontWeight: '600' },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    paddingTop: Spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  switchTitle: { fontSize: 17, fontWeight: '600' },
});
