import { findTaskKeyCollisions } from '../functionTaskKeys';

/** Publish-time runtime error surfaced while editing (C7). */
export function FunctionTaskKeyCollisions({ tasks }: { tasks: unknown[] }) {
  const collisions = findTaskKeyCollisions(tasks);
  if (collisions.length === 0) return null;
  return (
    <div
      role="alert"
      className="rounded-md border border-destructive-border bg-destructive-surface px-3 py-2 text-[11px] text-destructive-text space-y-1">
      <div className="font-semibold">Task keys collide</div>
      <ul className="list-disc space-y-0.5 pl-4">
        {collisions.map((collision) => (
          <li key={collision.index}>
            Task {collision.index + 1} key <code>{collision.key}</code> collides with{' '}
            <code>{collision.collidesWith}</code>: both resolve to the response variable{' '}
            <code>{collision.variableName}</code>, so the later task output overwrites the earlier
            one and the runtime rejects the function at publish. Rename one of them.
          </li>
        ))}
      </ul>
    </div>
  );
}
