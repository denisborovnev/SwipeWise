import type { NewWordInput, WordList } from './types';

/** Google Sheets tab names can't contain these characters. */
const FORBIDDEN_TAB_CHARS = /[:\\/?*[\]]/;
const MAX_LIST_NAME = 100;

/**
 * List names become spreadsheet tab names, so they follow the Sheets rules.
 * Returns an error message, or null when the name is valid.
 */
export function validateListName(name: string, lists: WordList[], ignoreListId?: string): string | null {
  const trimmed = name.trim();
  if (!trimmed) {
    return 'Please enter a name.';
  }
  if (trimmed.length > MAX_LIST_NAME) {
    return `The name can be at most ${MAX_LIST_NAME} characters long.`;
  }
  if (trimmed.startsWith('_')) {
    return 'The name can\'t start with "_" (such tabs are ignored in the spreadsheet).';
  }
  if (FORBIDDEN_TAB_CHARS.test(trimmed)) {
    return 'The name can\'t contain any of these characters: : \\ / ? * [ ]';
  }
  const lower = trimmed.toLowerCase();
  if (lists.some((l) => l.id !== ignoreListId && l.name.toLowerCase() === lower)) {
    return 'A list with this name already exists.';
  }
  return null;
}

export function validateWord(input: Pick<NewWordInput, 'front' | 'back'>): string | null {
  if (!input.front.trim() || !input.back.trim()) {
    return 'Both sides of the card are required.';
  }
  return null;
}

/** Splits the examples text field into examples, one per line. */
export function parseExamples(text: string): string[] {
  return text
    .split('\n')
    .map((e) => e.trim())
    .filter((e) => e.length > 0);
}
