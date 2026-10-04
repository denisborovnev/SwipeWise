import { Directory, File, Paths } from 'expo-file-system';

import type { StorageBackend } from './backend';

/** Folder name kept from the app's first name, so existing data stays where it is. */
const DATA_DIR = 'myvocabulary';

/** Stores files in <documents>/myvocabulary. Writes go to a temp file that is then renamed over the target. */
export function createFileBackend(): StorageBackend {
  const root = new Directory(Paths.document, DATA_DIR);
  const file = (name: string) => new File(root, ...name.split('/'));

  return {
    async readText(name) {
      const f = file(name);
      return f.exists ? f.text() : null;
    },

    async writeTextAtomic(name, content) {
      const target = file(name);
      const folder = target.parentDirectory;
      if (!folder.exists) {
        folder.create({ intermediates: true, idempotent: true });
      }
      const tmp = new File(folder, `${target.name}.tmp`);
      tmp.create({ overwrite: true });
      tmp.write(content);
      tmp.move(target, { overwrite: true });
    },

    async delete(name) {
      const f = file(name);
      if (f.exists) {
        f.delete();
      }
    },

    async deleteFolder(name) {
      const dir = new Directory(root, ...name.split('/'));
      if (dir.exists) {
        dir.delete();
      }
    },
  };
}
