import { router } from 'expo-router';
import { useState } from 'react';

import { uniqueListName } from '@/model/lists';
import { validateListName } from '@/model/validation';
import { vocabularyStore } from '@/store';
import { formatDate } from '@/utils/format';

import { Button } from './Button';
import { TextPromptModal } from './TextPromptModal';

/**
 * "New list" button with its name dialog; opens the new list after creating it.
 * The suggested name is today's date (e.g. a list per lesson), selected so typing replaces it.
 */
export function NewListButton() {
  const [creating, setCreating] = useState(false);

  const createList = (name: string) => {
    const err = validateListName(name, vocabularyStore.getState().data.lists);
    if (err) {
      return err;
    }
    const id = vocabularyStore.getState().addList(name);
    setCreating(false);
    router.push({ pathname: '/lists/[id]', params: { id } });
    return null;
  };

  return (
    <>
      <Button title="New list" icon="add" variant="secondary" onPress={() => setCreating(true)} style={{ flex: 1 }} />
      <TextPromptModal
        visible={creating}
        title="New word list"
        initialValue={creating ? uniqueListName(formatDate(new Date().toISOString()), vocabularyStore.getState().data.lists) : ''}
        selectInitialValue
        placeholder="e.g. Travel"
        submitLabel="Create"
        onSubmit={createList}
        onCancel={() => setCreating(false)}
      />
    </>
  );
}
