import { NotificationType } from '../constants/notification-types';
import type { Annotations } from './annotations';
import type { AvailableIn } from './available-in';
import { StateType, StateSubType } from '../constants/state-types';
import { TriggerType, TriggerKind } from '../constants/trigger-types';
import { ErrorBoundary } from './error-boundary';
import type { Event } from './event';
import { Label } from './label';
import { MappingCode } from './mapping';
import type { RoleGrant } from './role';
import type { ResourceLock } from './resource-lock';
import type { ViewBinding } from './view-binding';
import type { TimeoutTransition, WorkflowTimerConfig } from './workflow';

export interface ResourceReference {
  key: string;
  domain: string;
  version: string;
  flow: string;
}

export interface TaskExecution {
  order: number;
  task: ResourceReference;
  mapping?: MappingCode;
  errorBoundary?: ErrorBoundary;
  /**
   * Response slot the task's output is written to. Defaults to the task key
   * in camelCase (`send-notification` → `sendNotification`). Needed when one
   * task runs twice at the same `order`. Pattern `^[A-Za-z_][A-Za-z0-9_]*$`,
   * max 100 chars. Runtime 0.0.99 / vnext-schema 0.0.55.
   */
  variableKey?: string;
  _comment?: string;
}

/**
 * Per-transition / per-flow execution mode. `S` blocks and returns the full
 * instance, `A` is accepted and runs in the background. Overrides the
 * caller's `?sync=` query parameter; a transition's value wins over the
 * flow's. Ignored for automatic transitions. Runtime 0.0.99.
 */
export type ExecutionType = 'S' | 'A';

export interface Transition {
  key: string;
  target: string;
  triggerType: TriggerType;
  triggerKind?: TriggerKind;
  versionStrategy?: string;
  labels?: Label[];
  rule?: MappingCode;
  timer?: MappingCode;
  schema?: ResourceReference;
  mapping?: MappingCode;
  onExecutionTasks?: TaskExecution[];
  roles?: RoleGrant[];
  view?: ViewBinding;
  views?: ViewBinding[];
  annotations?: Annotations | null;
  /**
   * Declares how an inbound external event is mapped before it triggers this
   * transition. Required when `triggerType` is `Event`.
   */
  event?: Event;
  /**
   * Distributed-lock operation for this transition. Valid only for
   * start, state-level, and shared transitions — never for cancel,
   * exit, or updateData transitions.
   */
  resourceLock?: ResourceLock;
  executionType?: ExecutionType;
}

export interface SharedTransition extends Transition {
  /** Null, empty or absent means every state — for every trigger type. */
  availableIn?: AvailableIn | null;
}

/** @deprecated Use {@link WorkflowTimerConfig}. */
export type SubFlowTimerConfig = WorkflowTimerConfig;

/**
 * @deprecated A subflow timeout override is a full workflow timeout; use
 * {@link TimeoutTransition}.
 */
export type SubFlowTimeoutOverride = TimeoutTransition;

/**
 * Parent override of a child state's `interaction.longPoll`. Field-level:
 * omitted fields keep the child's value. `terminate` and `rule` are not
 * overridable; `roles` is ignored when the child uses a rule.
 */
export interface SubFlowLongPollOverride {
  fallbackTimeoutSeconds?: number;
  roles?: RoleGrant[];
}

export interface SubFlowStateOverride {
  queryRoles?: RoleGrant[];
  interaction?: { longPoll?: SubFlowLongPollOverride };
  /** View swap: key is the view key the child selected, value the replacement. */
  views?: Record<string, ResourceReference>;
}

export interface SubFlowTransitionOverride {
  roles?: RoleGrant[];
  views?: Record<string, ResourceReference>;
}

export interface SubFlowOverrides {
  timeout?: TimeoutTransition | null;
  transitions?: Record<string, SubFlowTransitionOverride>;
  states?: Record<string, SubFlowStateOverride>;
  /** @deprecated Use `states.<s>.views` / `transitions.<t>.views`. */
  views?: Record<string, ResourceReference>;
}

/** `S` = SubFlow, `P` = SubProcess. Overrides apply to `S` only. */
export type SubFlowType = 'S' | 'P';

export interface SubFlowConfig {
  type?: SubFlowType;
  process: ResourceReference;
  mapping?: MappingCode;
  overrides?: SubFlowOverrides;
  /** @deprecated Use `overrides.states.<s>.views` / `overrides.transitions.<t>.views`. */
  viewOverrides?: Record<string, ResourceReference>;
}

/**
 * Role-scoped alias for a state. Lets the engine return a friendlier /
 * safer name (and multi-lang labels) to actors matching `roles` while
 * the canonical `key` stays internal. A state can carry multiple
 * aliases — the runtime picks the first whose role grants resolve to
 * `allow` for the requesting actor (DENY overrides ALLOW per the
 * shared `RoleGrant` semantics).
 *
 * Example: state `kps-limit-check` (internal) is exposed to the
 * `backoffice.operator` role as "Operational Review" while the
 * client-facing default name stays untouched.
 */
export interface StateAlias {
  name: string;
  roles: RoleGrant[];
  labels: Label[];
}

interface LongPollBase {
  /** When true the runtime pauses after the triggering transition until the
   *  client acknowledges (or `fallbackTimeoutSeconds` elapses). */
  terminate: boolean;
  /** Acknowledge fallback window in seconds (runtime default 60). */
  fallbackTimeoutSeconds?: number;
}

/** Authorization by role grants. DENY overrides ALLOW. */
export interface LongPollRolesArm extends LongPollBase {
  roles: RoleGrant[];
  rule?: never;
}

/** Authorization by a condition script (IConditionMapping), fail-closed. */
export interface LongPollRuleArm extends LongPollBase {
  rule: MappingCode;
  roles?: never;
}

/**
 * Long polling configuration for a state. Exactly one authorization arm:
 * `roles` or `rule` — never both (schema `oneOf`).
 */
export type LongPollConfig = LongPollRolesArm | LongPollRuleArm;

/** State interaction configuration (e.g. long polling). */
export interface StateInteraction {
  longPoll?: LongPollConfig;
}

/**
 * A single notification rule attached to a state. The engine fires
 * the notification when the state is entered.
 */
export interface StateNotification {
  /** Notification channel type. Currently only {@link NotificationType.State} (0). */
  type: NotificationType;
  /** Required payload mapping script executed when the notification fires. */
  mapping: MappingCode;
  /** Optional condition — if omitted the notification always fires. */
  rule?: MappingCode;
}

export interface State {
  key: string;
  alias?: StateAlias[];
  stateType: StateType;
  subType?: StateSubType;
  versionStrategy?: string;
  queryRoles?: RoleGrant[];
  labels?: Label[];
  onEntries?: TaskExecution[];
  onExits?: TaskExecution[];
  transitions?: Transition[];
  errorBoundary?: ErrorBoundary;
  view?: ViewBinding;
  views?: ViewBinding[];
  subFlow?: SubFlowConfig;
  interaction?: StateInteraction | null;
  notifications?: StateNotification[];
}
