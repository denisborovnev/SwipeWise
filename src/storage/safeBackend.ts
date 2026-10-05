import type { StorageBackend } from './backend';

/**
 * The few file operations the safe backend needs (paths are relative to the data folder, "/"-separated).
 * Any of them may be asynchronous (expo-file-system's `move` is), so every call is awaited.
 */
export interface FileOps {
  exists(path: string): boolean;
  read(path: string): Promise<string>;
  /** Creates missing folders. */
  write(path: string, content: string): void | Promise<void>;
  /** Moves a file; the destination must not exist. Resolves once the file is in its new place. */
  move(from: string, to: string): void | Promise<void>;
  delete(path: string): void | Promise<void>;
  deleteFolder(path: string): void | Promise<void>;
  /** Names of the sub-folders of a folder (empty if it doesn't exist). */
  listFolders(path: string): string[];
}

export const TMP = '.tmp';
export const BAK = '.bak';

/**
 * A StorageBackend that never loses a file, even if the app is killed in the middle of a save:
 *  1. the new content is written to `name.tmp`;
 *  2. the current file is moved to `name.bak` (the previous `.bak` is deleted first);
 *  3. `name.tmp` is moved to `name`.
 * At every moment a complete copy exists, so reading falls back to `.tmp` (newest) and then `.bak` when
 * `name` is missing. (Android has no atomic "replace": moving over a file deletes it first.)
 */
export function createSafeBackend(ops: FileOps): StorageBackend {
  return {
    async readText(name) {
      // A `.tmp` next to an existing file is an unfinished write (step 1) and is ignored.
      for (const path of [name, name + TMP, name + BAK]) {
        if (ops.exists(path)) {
          return ops.read(path);
        }
      }
      return null;
    },

    async readBackup(name) {
      return ops.exists(name + BAK) ? ops.read(name + BAK) : null;
    },

    async writeTextAtomic(name, content) {
      // Each step must be finished before the next starts, or the moves collide.
      await ops.write(name + TMP, content);
      if (ops.exists(name)) {
        if (ops.exists(name + BAK)) {
          await ops.delete(name + BAK);
        }
        await ops.move(name, name + BAK);
      }
      await ops.move(name + TMP, name);
    },

    async delete(name) {
      for (const path of [name, name + TMP, name + BAK]) {
        if (ops.exists(path)) {
          await ops.delete(path);
        }
      }
    },

    async deleteFolder(name) {
      await ops.deleteFolder(name);
    },

    async listFolders(name) {
      return ops.listFolders(name);
    },
  };
}
