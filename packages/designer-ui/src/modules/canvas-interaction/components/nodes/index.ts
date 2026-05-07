import { SelfRefNode } from './SelfRefNode';
import { StartNode } from './StartNode';
import { StateNodeBase } from './StateNodeBase';
import { WorkflowTransitionNode } from './WorkflowTransitionNode';

export const nodeTypes = {
  startNode: StartNode,
  selfRefNode: SelfRefNode,
  initialState: StateNodeBase,
  intermediateState: StateNodeBase,
  finalState: StateNodeBase,
  subFlowState: StateNodeBase,
  wizardState: StateNodeBase,
  workflowTransitionNode: WorkflowTransitionNode,
};
