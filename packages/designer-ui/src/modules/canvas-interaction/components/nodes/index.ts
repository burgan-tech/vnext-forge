import { GroupNode } from './GroupNode';
import { NoteNode } from './NoteNode';
import { StartNode } from './StartNode';
import { StateNodeBase } from './StateNodeBase';
import { WorkflowTransitionNode } from './WorkflowTransitionNode';

// Note: the `selfRefNode` type used to back the virtual `$self`
// pseudo-node attached next to a source state. That node is no
// longer synthesized — `$self` transitions render as a self-loop
// edge whose source equals its target. See Conversion.ts.
//
// `noteNode`  — sticky-note annotation (free-form text).
// `groupNode` — translucent dashed container that visually
//               groups state nodes. Both store metadata in
//               diagram JSON (not workflow JSON).
export const nodeTypes = {
  startNode: StartNode,
  initialState: StateNodeBase,
  intermediateState: StateNodeBase,
  finalState: StateNodeBase,
  subFlowState: StateNodeBase,
  wizardState: StateNodeBase,
  workflowTransitionNode: WorkflowTransitionNode,
  noteNode: NoteNode,
  groupNode: GroupNode,
};
