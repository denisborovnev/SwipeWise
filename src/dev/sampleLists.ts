import type { Word, WordList } from '@/model/types';
import { normalizeExamples } from '@/model/vocabulary';

/** [front, back, examples] */
type SampleWord = [string, string, string[]?];

/** Sample word lists for manual testing, created on different days over the last months. */
const SAMPLES: { name: string; daysAgo: number; words: SampleWord[] }[] = [
  {
    name: 'Travel',
    daysAgo: 160,
    words: [
      ['поезд', 'train', ['The train leaves at noon.']],
      ['билет', 'ticket', ['I lost my ticket.']],
      ['багаж', 'luggage', ['My luggage is too heavy.']],
      ['паспорт', 'passport'],
      ['гостиница', 'hotel', ['We stayed at a small hotel.']],
      ['аэропорт', 'airport'],
    ],
  },
  {
    name: 'Food',
    daysAgo: 140,
    words: [
      ['хлеб', 'bread', ['Fresh bread smells great.']],
      ['сыр', 'cheese'],
      ['молоко', 'milk', ['Do you take milk in your tea?']],
      ['мясо', 'meat'],
      ['рыба', 'fish', ['We had fish for dinner.']],
      ['соль', 'salt'],
      ['сахар', 'sugar'],
    ],
  },
  {
    name: 'Kitchen',
    daysAgo: 120,
    words: [
      ['нож', 'knife', ['Be careful, the knife is sharp.']],
      ['вилка', 'fork'],
      ['ложка', 'spoon'],
      ['тарелка', 'plate'],
      ['сковорода', 'frying pan', ['Heat the oil in a frying pan.']],
    ],
  },
  {
    name: 'Animals',
    daysAgo: 95,
    words: [
      ['собака', 'dog', ['The dog is barking.']],
      ['кошка', 'cat'],
      ['лошадь', 'horse', ['She rides a horse every weekend.']],
      ['птица', 'bird'],
      ['медведь', 'bear'],
      ['волк', 'wolf'],
    ],
  },
  {
    name: 'Weather',
    daysAgo: 70,
    words: [
      ['дождь', 'rain', ["Take an umbrella, it's going to rain."]],
      ['снег', 'snow'],
      ['ветер', 'wind', ['The wind is very strong today.']],
      ['солнце', 'sun'],
      ['облако', 'cloud'],
    ],
  },
  {
    name: 'Family',
    daysAgo: 50,
    words: [
      ['мать', 'mother'],
      ['отец', 'father'],
      ['брат', 'brother', ['My brother lives in London.']],
      ['сестра', 'sister'],
      ['бабушка', 'grandmother', ['My grandmother bakes the best pies.']],
      ['дедушка', 'grandfather'],
    ],
  },
  {
    name: 'Work',
    daysAgo: 35,
    words: [
      ['встреча', 'meeting', ['The meeting starts at ten.']],
      ['зарплата', 'salary'],
      ['начальник', 'boss'],
      ['коллега', 'colleague', ['My colleague helped me with the report.']],
      ['отпуск', 'vacation'],
    ],
  },
  {
    name: 'Verbs of motion',
    daysAgo: 20,
    words: [
      ['идти', 'to go (on foot)', ['I am going to the shop.']],
      ['ехать', 'to go (by vehicle)'],
      ['бежать', 'to run', ['He runs every morning.']],
      ['плыть', 'to swim'],
      ['лететь', 'to fly', ['We fly to Rome tomorrow.']],
    ],
  },
  {
    name: 'Colours',
    daysAgo: 8,
    words: [
      ['красный', 'red'],
      ['синий', 'blue', ['The sky is blue.']],
      ['зелёный', 'green'],
      ['жёлтый', 'yellow'],
      ['чёрный', 'black'],
      ['белый', 'white'],
    ],
  },
  {
    name: 'Clothes',
    daysAgo: 2,
    words: [
      ['рубашка', 'shirt', ['He is wearing a white shirt.']],
      ['брюки', 'trousers'],
      ['обувь', 'shoes'],
      ['куртка', 'jacket', ["It's cold, take a jacket."]],
      ['шапка', 'hat'],
    ],
  },
];

/**
 * Builds the sample lists. Lists whose name already exists in `existingNames` are skipped,
 * so adding the samples twice doesn't create duplicates.
 */
export function createSampleLists(
  newId: () => string,
  now: Date,
  existingNames: string[],
): { lists: WordList[]; words: Word[] } {
  const taken = new Set(existingNames.map((n) => n.toLowerCase()));
  const lists: WordList[] = [];
  const words: Word[] = [];
  for (const sample of SAMPLES.filter((s) => !taken.has(s.name.toLowerCase()))) {
    const created = new Date(now);
    created.setDate(created.getDate() - sample.daysAgo);
    const createdAt = created.toISOString();
    const listId = newId();
    lists.push({ id: listId, name: sample.name, createdAt });
    for (const [front, back, examples] of sample.words) {
      words.push({
        id: newId(),
        listId,
        front,
        back,
        examples: normalizeExamples(examples),
        addedAt: createdAt,
        lastRevisedAt: null,
        remembered: null,
        dirty: true,
        updatedAt: createdAt,
      });
    }
  }
  return { lists, words };
}
