import { StartNode } from './StartNode';
import { StateNodeBase } from './StateNodeBase';

export const nodeTypes = {
  startNode: StartNode,
  initialState: StateNodeBase,
  intermediateState: StateNodeBase,
  finalState: StateNodeBase,
  subFlowState: StateNodeBase,
  wizardState: StateNodeBase,
};
