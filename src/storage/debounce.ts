export interface DebouncedTask {
  /** Schedules the task; repeated calls within `delayMs` are merged into one run. */
  schedule(): void;
  /** Runs a pending task right away (e.g. when the app goes to background). */
  flush(): Promise<void>;
}

export function createDebouncedTask(task: () => Promise<void>, delayMs: number): DebouncedTask {
  let timer: ReturnType<typeof setTimeout> | null = null;
  let running: Promise<void> = Promise.resolve();

  const run = () => {
    timer = null;
    // Chain runs so two saves never write the same file at the same time.
    running = running.then(task).catch((e) => console.error('Background save failed', e));
    return running;
  };

  return {
    schedule() {
      if (timer) {
        clearTimeout(timer);
      }
      timer = setTimeout(run, delayMs);
    },
    async flush() {
      if (timer) {
        clearTimeout(timer);
        await run();
      } else {
        await running;
      }
    },
  };
}
