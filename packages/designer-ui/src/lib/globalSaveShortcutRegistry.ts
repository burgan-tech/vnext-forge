/**
 * Single global Cmd/Ctrl+S listener. Editor hooks register their save handler
 * while mounted; the top of the stack wins (last registered = active surface).
 */

export type GlobalSaveHandler = () => void | Promise<void>;

interface StackEntry {
  id: number;
  fn: GlobalSaveHandler;
}

const stack: StackEntry[] = [];
let listenerCount = 0;
let nextHandlerId = 0;

function onKeyDown(e: KeyboardEvent): void {
  if (!(e.metaKey || e.ctrlKey) || e.key !== 's') return;
  const top = stack[stack.length - 1];
  if (!top) return;
  e.preventDefault();
  void Promise.resolve(top.fn()).catch(() => {
    /* Callers / useAsync own user-visible error handling */
  });
}

export function registerGlobalSaveHandler(handler: GlobalSaveHandler): () => void {
  const id = nextHandlerId++;
  stack.push({ id, fn: handler });
  if (listenerCount === 0) {
    window.addEventListener('keydown', onKeyDown);
  }
  listenerCount += 1;
  return () => {
    const idx = stack.findIndex((s) => s.id === id);
    if (idx >= 0) stack.splice(idx, 1);
    listenerCount -= 1;
    if (listenerCount === 0) {
      window.removeEventListener('keydown', onKeyDown);
    }
  };
}
