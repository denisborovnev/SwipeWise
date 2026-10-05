import { readJson } from '../repository';
import { BAK, createSafeBackend, TMP, type FileOps } from '../safeBackend';

/** In-memory files; `killAfter` makes the n-th file change throw, like Android killing the app there. */
function memoryOps(initial: Record<string, string> = {}) {
  const files: Record<string, string> = { ...initial };
  let changes = 0;
  let killAfter = Infinity;
  const change = () => {
    if (changes++ >= killAfter) {
      throw new Error('killed');
    }
  };
  const ops: FileOps = {
    exists: (path) => path in files,
    read: async (path) => files[path],
    write(path, content) {
      change();
      files[path] = content;
    },
    move(from, to) {
      change();
      if (to in files) {
        throw new Error('destination exists');
      }
      files[to] = files[from];
      delete files[from];
    },
    delete(path) {
      change();
      delete files[path];
    },
    deleteFolder() {},
    listFolders: () => [],
  };
  return {
    files,
    ops,
    kill(after: number) {
      changes = 0;
      killAfter = after;
    },
  };
}

describe('safeBackend', () => {
  it('writes, overwrites and reads files', async () => {
    const { ops, files } = memoryOps();
    const backend = createSafeBackend(ops);
    expect(await backend.readText('a.json')).toBeNull();
    await backend.writeTextAtomic('a.json', 'v1');
    await backend.writeTextAtomic('a.json', 'v2');
    expect(await backend.readText('a.json')).toBe('v2');
    expect(await backend.readBackup('a.json')).toBe('v1');
    expect(files[`a.json${TMP}`]).toBeUndefined();
  });

  it('never loses the file when the app is killed during a save', async () => {
    for (let step = 0; step < 4; step++) {
      const mem = memoryOps({ 'a.json': 'old', [`a.json${BAK}`]: 'older' });
      const backend = createSafeBackend(mem.ops);
      mem.kill(step);
      await backend.writeTextAtomic('a.json', 'new').catch(() => {});
      mem.kill(Infinity);
      // Either the old or the new version – never nothing.
      expect(['old', 'new']).toContain(await backend.readText('a.json'));
      // And the next save works.
      await backend.writeTextAtomic('a.json', 'next');
      expect(await backend.readText('a.json')).toBe('next');
    }
  });

  it('deletes the file with its backup and temp copies', async () => {
    const { ops, files } = memoryOps({ 'a.json': 'v2', [`a.json${BAK}`]: 'v1', [`a.json${TMP}`]: 'v3' });
    const backend = createSafeBackend(ops);
    await backend.delete('a.json');
    expect(files).toEqual({});
    expect(await backend.readText('a.json')).toBeNull();
  });

  it('reads the previous version when the file is corrupt', async () => {
    const { ops, files } = memoryOps({ 'a.json': '{"v":', [`a.json${BAK}`]: '{"v":1}' });
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    expect(await readJson(createSafeBackend(ops), 'a.json')).toEqual({ v: 1 });
    expect(files['a.json.corrupt']).toBe('{"v":');
    warn.mockRestore();
  });
});
