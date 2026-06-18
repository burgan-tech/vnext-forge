import { StateType, StateSubType } from '../constants/state-types';
import { TriggerType, TriggerKind } from '../constants/trigger-types';
import { ErrorBoundary } from './error-boundary';
import { Label } from './label';
import { MappingCode } from './mapping';
import type { RoleGrant } from './role';
import type { ViewBinding } from './view-binding';

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
}

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
  annotations?: Record<string, string>;
}

export interface SharedTransition extends Transition {
  availableIn: string[];
}

export interface SubFlowTimerConfig {
  reset?: string;
  duration?: string;
}

export interface SubFlowTimeoutOverride {
  key: string;
  target: string;
  versionStrategy?: string;
  timer?: SubFlowTimerConfig;
}

export interface SubFlowOverrides {
  timeout?: SubFlowTimeoutOverride;
  transitions?: Record<string, { roles?: RoleGrant[] }>;
  states?: Record<string, { queryRoles?: RoleGrant[] }>;
}

export interface SubFlowConfig {
  type?: string;
  process: ResourceReference;
  mapping?: MappingCode;
  overrides?: SubFlowOverrides;
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

/**
 * Long polling configuration for a state. Tells the client workflow
 * manager when to terminate an open long-poll request. See `longPoll`
 * in the workflow-definition schema.
 */
export interface LongPollConfig {
  /** Whether the long poll terminates the open request when the state is left. */
  terminate: boolean;
  /** Maximum seconds to hold the request open before falling back. */
  fallbackTimeoutSeconds?: number;
  /** Roles allowed to use the long poll interaction. DENY overrides ALLOW. */
  roles: RoleGrant[];
}

/** State interaction configuration (e.g. long polling). */
export interface StateInteraction {
  longPoll?: LongPollConfig;
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
}
