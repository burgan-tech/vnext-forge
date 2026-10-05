import { TaskSlotIssues } from '../../save-component/components/TaskSlotIssues';

/** Publish-time runtime error surfaced while editing (C7). */
export function FunctionTaskKeyCollisions({ tasks }: { tasks: unknown[] }) {
  return <TaskSlotIssues tasks={tasks} mode="function" />;
}
