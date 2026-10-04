/** Minimal text-file storage the repository depends on. */
export interface StorageBackend {
  /** Returns null if the file does not exist. */
  readText(name: string): Promise<string | null>;
  /** Must never leave a half-written file behind. */
  writeTextAtomic(name: string, content: string): Promise<void>;
  delete(name: string): Promise<void>;
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
  };
}
