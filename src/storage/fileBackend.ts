import { Directory, File, Paths } from 'expo-file-system';

import type { StorageBackend } from './backend';

const DATA_DIR = 'myvocabulary';

/** Stores files in <documents>/myvocabulary. Writes go to a temp file that is then renamed over the target. */
export function createFileBackend(): StorageBackend {
  const dir = new Directory(Paths.document, DATA_DIR);

  const ensureDir = () => {
    if (!dir.exists) {
      dir.create({ intermediates: true, idempotent: true });
    }
  };

  return {
    async readText(name) {
      const file = new File(dir, name);
      return file.exists ? file.text() : null;
    },

    async writeTextAtomic(name, content) {
      ensureDir();
      const tmp = new File(dir, `${name}.tmp`);
      tmp.create({ overwrite: true });
      tmp.write(content);
      tmp.move(new File(dir, name), { overwrite: true });
    },

    async delete(name) {
      const file = new File(dir, name);
      if (file.exists) {
        file.delete();
      }
    },
  };
}
