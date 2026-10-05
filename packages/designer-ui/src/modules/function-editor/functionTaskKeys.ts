/**
 * Function task-entry slots. The logic is shared with the workflow editors
 * and lives in `save-component/taskSlots.ts`; functions compare slots across
 * all `onExecutionTasks` (`FunctionComponentValidator`).
 */
export {
  toVariableName,
  findTaskKeyCollisions,
  findInvalidVariableKeys,
  effectiveTaskSlot,
  type TaskKeyCollision,
} from '../save-component/taskSlots';
