import { SelfRefNode } from './SelfRefNode';
import { StartNode } from './StartNode';
import { StateNodeBase } from './StateNodeBase';

export const nodeTypes = {
  startNode: StartNode,
  selfRefNode: SelfRefNode,
  initialState: StateNodeBase,
  intermediateState: StateNodeBase,
  finalState: StateNodeBase,
  subFlowState: StateNodeBase,
  wizardState: StateNodeBase,
};
