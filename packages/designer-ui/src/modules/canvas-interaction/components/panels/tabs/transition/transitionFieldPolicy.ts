import { TriggerType, TriggerKind } from '@vnext-forge/vnext-types';

export type TransitionEditorKind =
  | 'state'
  | 'shared'
  | 'cancel'
  | 'exit'
  | 'updateData'
  | 'start';

export type TransitionFieldKey =
  | 'key'
  | 'target'
  | 'triggerType'
  | 'triggerKind'
  | 'versionStrategy'
  | 'labels'
  | 'schema'
  | 'view'
  | 'rule'
  | 'timer'
  | 'mapping'
  | 'onExecutionTasks'
  | 'roles'
  | 'availableIn'
  | 'from'
  | '_comment';

export interface FieldPolicy {
  visible: boolean;
  required: boolean;
  locked?: boolean;
}

export type TransitionFieldPolicyMap = Record<TransitionFieldKey, FieldPolicy>;

const VISIBLE_REQUIRED: FieldPolicy = { visible: true, required: true };
const VISIBLE_OPTIONAL: FieldPolicy = { visible: true, required: false };
const HIDDEN: FieldPolicy = { visible: false, required: false };
const LOCKED_REQUIRED: FieldPolicy = { visible: true, required: true, locked: true };

const ALWAYS_FIELDS: Pick<
  TransitionFieldPolicyMap,
  'key' | 'versionStrategy' | 'labels'
> = {
  key: VISIBLE_REQUIRED,
  versionStrategy: VISIBLE_REQUIRED,
  labels: VISIBLE_REQUIRED,
};

function stateTransitionPolicy(
  triggerType: TriggerType,
  triggerKind?: TriggerKind,
): TransitionFieldPolicyMap {
  const isAutoDefault =
    triggerType === TriggerType.Automatic && triggerKind === TriggerKind.DefaultAuto;

  const base: TransitionFieldPolicyMap = {
    ...ALWAYS_FIELDS,
    target: VISIBLE_REQUIRED,
    triggerType: VISIBLE_REQUIRED,
    triggerKind: HIDDEN,
    schema: HIDDEN,
    view: HIDDEN,
    rule: HIDDEN,
    timer: HIDDEN,
    mapping: HIDDEN,
    onExecutionTasks: VISIBLE_OPTIONAL,
    roles: VISIBLE_OPTIONAL,
    availableIn: HIDDEN,
    from: VISIBLE_OPTIONAL,
    _comment: VISIBLE_OPTIONAL,
  };

  switch (triggerType) {
    case TriggerType.Manual:
      return {
        ...base,
        triggerKind: VISIBLE_OPTIONAL,
        schema: VISIBLE_OPTIONAL,
        view: VISIBLE_OPTIONAL,
        mapping: VISIBLE_OPTIONAL,
      };
    case TriggerType.Automatic:
      return {
        ...base,
        triggerKind: isAutoDefault ? LOCKED_REQUIRED : VISIBLE_OPTIONAL,
        rule: isAutoDefault ? VISIBLE_OPTIONAL : VISIBLE_REQUIRED,
      };
    case TriggerType.Scheduled:
      return {
        ...base,
        triggerKind: VISIBLE_OPTIONAL,
        timer: VISIBLE_REQUIRED,
      };
    case TriggerType.Event:
      return {
        ...base,
        triggerKind: VISIBLE_OPTIONAL,
        schema: VISIBLE_OPTIONAL,
        mapping: VISIBLE_OPTIONAL,
      };
  }
}

function sharedTransitionPolicy(
  triggerType: TriggerType,
  triggerKind?: TriggerKind,
): TransitionFieldPolicyMap {
  const statePolicy = stateTransitionPolicy(triggerType, triggerKind);
  return {
    ...statePolicy,
    availableIn:
      triggerType === TriggerType.Manual ? VISIBLE_REQUIRED : HIDDEN,
  };
}

function manualOnlyPolicy(
  kind: 'cancel' | 'exit' | 'updateData',
): TransitionFieldPolicyMap {
  return {
    ...ALWAYS_FIELDS,
    target: kind === 'updateData'
      ? { visible: true, required: true, locked: true }
      : VISIBLE_REQUIRED,
    triggerType: { visible: true, required: true, locked: true },
    triggerKind: HIDDEN,
    schema: VISIBLE_OPTIONAL,
    view: VISIBLE_OPTIONAL,
    rule: HIDDEN,
    timer: HIDDEN,
    mapping: VISIBLE_OPTIONAL,
    onExecutionTasks: VISIBLE_OPTIONAL,
    roles: VISIBLE_OPTIONAL,
    availableIn: VISIBLE_OPTIONAL,
    from: VISIBLE_OPTIONAL,
    _comment: VISIBLE_OPTIONAL,
  };
}

function startTransitionPolicy(): TransitionFieldPolicyMap {
  return {
    key: VISIBLE_REQUIRED,
    target: VISIBLE_REQUIRED,
    triggerType: { visible: true, required: true, locked: true },
    triggerKind: HIDDEN,
    versionStrategy: VISIBLE_REQUIRED,
    labels: VISIBLE_REQUIRED,
    schema: VISIBLE_OPTIONAL,
    view: HIDDEN,
    rule: HIDDEN,
    timer: HIDDEN,
    mapping: VISIBLE_OPTIONAL,
    onExecutionTasks: VISIBLE_OPTIONAL,
    roles: VISIBLE_OPTIONAL,
    availableIn: HIDDEN,
    from: HIDDEN,
    _comment: HIDDEN,
  };
}

export function resolveFieldPolicy(
  kind: TransitionEditorKind,
  triggerType: TriggerType,
  triggerKind?: TriggerKind,
): TransitionFieldPolicyMap {
  switch (kind) {
    case 'state':
      return stateTransitionPolicy(triggerType, triggerKind);
    case 'shared':
      return sharedTransitionPolicy(triggerType, triggerKind);
    case 'cancel':
    case 'exit':
    case 'updateData':
      return manualOnlyPolicy(kind);
    case 'start':
      return startTransitionPolicy();
  }
}

export function getAllowedTriggerTypes(
  kind: TransitionEditorKind,
): TriggerType[] {
  switch (kind) {
    case 'state':
    case 'shared':
      return [
        TriggerType.Manual,
        TriggerType.Automatic,
        TriggerType.Scheduled,
        TriggerType.Event,
      ];
    case 'cancel':
    case 'exit':
    case 'updateData':
    case 'start':
      return [TriggerType.Manual];
  }
}
