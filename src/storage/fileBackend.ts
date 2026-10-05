import { Directory, File, Paths } from 'expo-file-system';

import type { StorageBackend } from './backend';
import { createSafeBackend } from './safeBackend';

/** Folder name kept from the app's first name, so existing data stays where it is. */
const DATA_DIR = 'myvocabulary';

/** Stores files in <documents>/myvocabulary, saving them so that a killed app never loses one. */
export function createFileBackend(): StorageBackend {
  const root = new Directory(Paths.document, DATA_DIR);
  const file = (path: string) => new File(root, ...path.split('/'));
  const folder = (path: string) => new Directory(root, ...path.split('/'));

  return createSafeBackend({
    exists: (path) => file(path).exists,
    read: (path) => file(path).text(),
    write(path, content) {
      const f = file(path);
      const parent = f.parentDirectory;
      if (!parent.exists) {
        parent.create({ intermediates: true, idempotent: true });
      }
      f.create({ overwrite: true });
      f.write(content);
    },
    // Asynchronous in expo-file-system (moveSync would block the JS thread); safeBackend awaits it.
    move: (from, to) => file(from).move(file(to)),
    delete: (path) => file(path).delete(),
    deleteFolder(path) {
      const dir = folder(path);
      if (dir.exists) {
        dir.delete();
      }
    },
    listFolders(path) {
      const dir = folder(path);
      return dir.exists ? dir.list().filter((e) => e instanceof Directory).map((d) => d.name) : [];
    },
  });
}
