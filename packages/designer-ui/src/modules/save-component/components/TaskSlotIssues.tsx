import { findInvalidVariableKeys, findTaskKeyCollisions } from '../taskSlots';

/**
 * Inline publish-time errors for a task-entry list: two entries writing the
 * same response slot (all entries for a function, same `order` for a
 * workflow collection) and malformed `variableKey`s.
 */
export function TaskSlotIssues({ tasks, mode }: { tasks: unknown[]; mode: 'function' | 'workflow' }) {
  const collisions = findTaskKeyCollisions(tasks, mode);
  const invalid = findInvalidVariableKeys(tasks);
  if (collisions.length === 0 && invalid.length === 0) return null;
  return (
    <div
      role="alert"
      className="rounded-md border border-destructive-border bg-destructive-surface px-3 py-2 text-[11px] text-destructive-text space-y-1">
      {collisions.length > 0 && <div className="font-semibold">Task keys collide</div>}
      <ul className="list-disc space-y-0.5 pl-4">
        {collisions.map((collision) => (
          <li key={`c${collision.index}`}>
            Task {collision.index + 1} key <code>{collision.key}</code> collides with{' '}
            <code>{collision.collidesWith}</code>
            {mode === 'workflow' && collision.order !== undefined ? ` at order ${collision.order}` : ''}: both resolve to the
            response variable <code>{collision.variableName}</code>, so the{' '}
            {mode === 'workflow' ? 'parallel outputs conflict' : 'later task output overwrites the earlier one'} and the
            runtime rejects it at publish. Rename one of them or give one a distinct variableKey.
          </li>
        ))}
        {invalid.map((issue) => (
          <li key={`v${issue.index}`}>
            Task {issue.index + 1} variableKey <code>{issue.variableKey}</code> is invalid: {issue.reason}.
          </li>
        ))}
      </ul>
    </div>
  );
}
