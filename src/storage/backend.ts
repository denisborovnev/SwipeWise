/** Minimal text-file storage the repository depends on. Names may contain "/" for sub-folders. */
export interface StorageBackend {
  /** Returns null if the file does not exist. */
  readText(name: string): Promise<string | null>;
  /** Must never leave a half-written file behind. Creates missing folders. */
  writeTextAtomic(name: string, content: string): Promise<void>;
  delete(name: string): Promise<void>;
  /** Deletes a folder with everything in it (no-op if it doesn't exist). */
  deleteFolder(name: string): Promise<void>;
}

/** A view of `backend` limited to one folder, e.g. the files of one course. */
export function scopeBackend(backend: StorageBackend, folder: string): StorageBackend {
  const path = (name: string) => `${folder}/${name}`;
  return {
    readText: (name) => backend.readText(path(name)),
    writeTextAtomic: (name, content) => backend.writeTextAtomic(path(name), content),
    delete: (name) => backend.delete(path(name)),
    deleteFolder: (name) => backend.deleteFolder(path(name)),
  };
}

/** In-memory backend for tests. */
export function createMemoryBackend(initial: Record<string, string> = {}): StorageBackend & {
  files: Record<string, string>;
} {
  const files: Record<string, string> = { ...initial };
  return {
    files,
    async readText(name) {
      return name in files ? files[name] : null;
    },
    async writeTextAtomic(name, content) {
      files[name] = content;
    },
    async delete(name) {
      delete files[name];
    },
    async deleteFolder(name) {
      for (const key of Object.keys(files)) {
        if (key.startsWith(`${name}/`)) {
          delete files[key];
        }
      }
    },
  };
}
