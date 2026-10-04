import { router } from 'expo-router';
import { useState } from 'react';

import { validateListName } from '@/model/validation';
import { vocabularyStore } from '@/store';

import { Button } from './Button';
import { TextPromptModal } from './TextPromptModal';

/** "New list" button with its name dialog; opens the new list after creating it. */
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
        placeholder="e.g. Travel"
        submitLabel="Create"
        onSubmit={createList}
        onCancel={() => setCreating(false)}
      />
    </>
  );
}
