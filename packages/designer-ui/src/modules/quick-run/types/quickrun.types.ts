import type { ViewDisplayModes } from '@vnext-forge-studio/vnext-types';

/**
 * Display labels read from the local workflow file — the fallback for
 * runtimes that send no labels (≤ 0.0.98) and for keys the runtime leaves
 * unlabelled.
 */
export interface FlowLabelsMap {
  workflowLabel: string | null;
  states: Record<string, string>;
  /** By transition key alone; the last declaration wins on a clash. */
  transitions: Record<string, string>;
  /** By `<state>/<transition>` — disambiguates a key reused across states. */
  stateTransitions?: Record<string, string>;
}

/** A Active, B Busy, C Completed, F Faulted, P Passive. */
export type InstanceStatus = 'A' | 'B' | 'C' | 'F' | 'P';

/** How an instance was started — immutable. `P` here is SubProcess, not Passive. */
export type InstanceType = 'R' | 'S' | 'P';

/** Incident block (runtime >= 2026-09-07): links, never content. */
export interface IncidentLinks {
  hasActiveIncident: boolean;
  active?: { href: string };
  history?: { href: string };
}

/** `[{ language, label }]` as authored in the definition; every language is sent. */
export interface RuntimeLabel {
  language: string;
  label: string;
}

/**
 * Where a transition (or the armed timeout) leads, described with the same
 * vocabulary as the current state (runtime 0.0.99). When the target state
 * does not resolve only `key` (the raw authored key) is present.
 */
export interface TransitionTarget {
  key: string;
  stateType?: string;
  stateSubType?: string;
  labels?: RuntimeLabel[];
  /** Present only when the target is a subFlow state: the flow it starts. */
  subFlow?: string;
}

/** State-function `timeout` block: the armed workflow timeout of the polled instance. */
export interface StateTimeout {
  key: string;
  /** A plain state key up to runtime 0.0.98, a {@link TransitionTarget} from 0.0.99. */
  target: string | TransitionTarget;
  executeAtUtc: string;
  annotations?: Record<string, string> | null;
}

/**
 * State-function `interaction` block.
 *
 * - `terminateLongPoll: true` — present only while the runtime is paused
 *   waiting for an acknowledge; carries `ack.href`.
 * - `terminateLongPoll: false` — present whenever the instance is in the
 *   declaring state (runtime 0.0.98+): no ack, the client keeps polling for
 *   `fallbackTimeoutSeconds` instead of its own default.
 */
export interface InteractionSignal {
  terminateLongPoll?: boolean;
  fallbackTimeoutSeconds?: number;
  ack?: { href: string };
}

export interface QuickRunInstance {
  id: string;
  key: string;
  status: InstanceStatus;
  /**
   * Display status from the instance list (`metadata.effectiveStatus`). `status`
   * stays the behavioural one (retry, cancel, polling). Cleared by poll results:
   * the state function's own `status` already is the effective status.
   */
  effectiveStatus?: InstanceStatus;
  domain: string;
  workflowKey: string;
  environmentName?: string;
  currentState?: string;
  startedAt: string;
  transitions?: TransitionInfo[];
  sharedTransitions?: TransitionInfo[];
}

export interface TransitionInfo {
  name: string;
  view?: {
    hasView: boolean;
    loadData: boolean;
    href: string;
  };
  schema?: {
    hasSchema: boolean;
    href: string;
  };
  href: string;
  annotations?: Record<string, string> | null;
  /**
   * R21: engine-declared semantic of this transition. Drives grouping
   * + colour of the button in the Available Transitions section.
   * Older engine responses may omit this; consumers default to
   * `'stateTransition'` (when the transition is in `transitions[]`)
   * or `'sharedTransition'` (when in `sharedTransitions[]`).
   */
  kind?: TransitionKind;
  /** Scheduled entries only: when the engine will fire it. Not callable by clients. */
  executeAtUtc?: string;
  /** Transition display labels (runtime 0.0.99). Absent → fall back to the local definition. */
  labels?: RuntimeLabel[];
  /** Target state description (runtime 0.0.99). */
  target?: TransitionTarget;
}

/** R21: known transition kinds — see Workflow engine state model. */
export const TRANSITION_KINDS = [
  'stateTransition',
  'sharedTransition',
  'cancel',
  'exit',
  'update-parent-data',
  '$timeout',
  'scheduled',
] as const;
export type TransitionKind = (typeof TRANSITION_KINDS)[number];

/**
 * One parent → sub-flow correlation.
 *
 * The fields below `isCompleted` only arrive from newer engine versions, on
 * the full `StateResponse.correlations` array; the long-standing
 * `activeCorrelations` array carries the base shape only. Everything optional
 * is therefore rendered conditionally.
 */
export interface CorrelationInfo {
  correlationId: string;
  parentState: string;
  subFlowInstanceId: string;
  subFlowType: string;
  subFlowDomain: string;
  subFlowName: string;
  subFlowVersion: string;
  isCompleted: boolean;
  href?: string;
  /** Sub-flow instance's current state. */
  currentState?: string;
  /** How a completed sub-flow ended, e.g. `completed` / `faulted`. */
  terminalOutcome?: string;
  createdAt?: string;
  completedAt?: string;
  stateChangedAt?: string;
}

/**
 * R21: engine lifecycle classification for the current state. Shown
 * as a small chip next to the state name so the user can tell at
 * a glance whether the workflow is starting (`initial`), running
 * (`intermediate`), terminating (`finish`), delegating to a child
 * flow (`subflow` / `subFlow`), or guided by a multi-page wizard.
 */
export const STATE_TYPES = [
  'initial',
  'intermediate',
  'finish',
  'subflow',
  'subFlow',
  'wizard',
] as const;
export type StateType = (typeof STATE_TYPES)[number];

export interface StateResponse {
  state: string;
  status: InstanceStatus;
  /** R21: optional engine-declared classification of the current state. */
  stateType?: string;
  /**
   * Sub type of the displayed state, camelCase (`none`, `human`, `busy`, …).
   * Describes the active subflow's state while one runs. Runtime 0.0.99.
   */
  stateSubType?: string;
  /** Display labels of the displayed state (runtime 0.0.99). */
  stateLabels?: RuntimeLabel[];
  transitions?: TransitionInfo[];
  sharedTransitions?: TransitionInfo[];
  activeCorrelations?: CorrelationInfo[];
  /**
   * Every correlation of this instance — open *and* closed — with the
   * lifecycle fields `activeCorrelations` omits. Newer engine versions only;
   * the UI hides the "All" view entirely when it is absent.
   */
  correlations?: CorrelationInfo[];
  view?: {
    hasView: boolean;
    loadData: boolean;
    href: string;
  };
  data?: {
    href: string;
  };
  /**
   * Functions reachable on this instance. `href` points at the instance's
   * function catalog; Forge does not follow it — `quickrun/getFunctionCatalog`
   * rebuilds the path host-side, the same stance `acknowledgeLongPoll` takes
   * towards `interaction.ack.href`. Only `hasFunctions` drives the UI.
   */
  functions?: {
    hasFunctions: boolean;
    href: string;
  };
  /** See {@link InteractionSignal}. */
  interaction?: InteractionSignal;
  /** Armed workflow timeout; absent when none is armed or the instance is terminal. */
  timeout?: StateTimeout;
  /** Incident flag + links (part of the ETag). */
  incident?: IncidentLinks;
  eTag?: string;
  entityEtag?: string;
  responseHeaders?: Record<string, string>;
  /**
   * `true` when the upstream returned HTTP 304 Not Modified in response to
   * `ifNoneMatch` — no JSON body was parsed; all fields above other than
   * `responseHeaders` are absent. Callers must keep their cached
   * state/view instead of overwriting it.
   */
  notModified?: boolean;
}

export interface ViewResponse {
  key: string;
  /** The view component's labels (runtime 0.0.99); the old `label` string stays. */
  labels?: RuntimeLabel[];
  content: string | Record<string, unknown>;
  type: string;
  /**
   * The SDI display value — a plain string even for a view authored with the
   * per-mode object form, and empty when only `mdi` is declared. This is the
   * pre-MDI field every existing consumer reads, and the runtime deliberately
   * keeps it a string, so it must NOT be widened to the object shape.
   */
  display?: string;
  /**
   * Both display modes, or absent when the view declares no display. Added
   * alongside `display` rather than replacing it; clients that render both
   * interfaces read this and pick the value for the one they are in.
   */
  modes?: ViewDisplayModes | null;
  label?: string;
  renderer?: string;
}

export interface DataResponse {
  data: Record<string, unknown>;
  eTag?: string;
  entityEtag?: string;
  extensions?: Record<string, unknown>;
  responseHeaders?: Record<string, string>;
  /**
   * `true` when the upstream returned HTTP 304 Not Modified in response to
   * `ifNoneMatch` — no JSON body was parsed; `data` is absent. Callers
   * must keep their cached data instead of overwriting it.
   */
  notModified?: boolean;
}

export interface SchemaResponse {
  key: string;
  type: string;
  schema: Record<string, unknown>;
  eTag?: string;
  responseHeaders?: Record<string, string>;
  /**
   * `true` when the upstream returned HTTP 304 Not Modified in response to
   * `ifNoneMatch` — no JSON body was parsed; the fields above other than
   * `responseHeaders` are absent. Callers must keep their cached schema
   * instead of overwriting it.
   */
  notModified?: boolean;
}

/** One entry of an instance's function catalog. */
export interface FunctionCatalogEntry {
  /** The `sys-functions` component key — what the runner needs as `functionKey`. */
  name: string;
  version: string;
  /** `'D' | 'F' | 'I'` as declared by the engine; passed through to the runner. */
  scope: string;
  /** The engine's link to this function's `/info`. Displayed only. */
  href: string;
  /** The function component's `attributes.labels` (runtime 0.0.99). */
  labels?: RuntimeLabel[];
}

export interface FunctionCatalogResponse {
  functions: FunctionCatalogEntry[];
}

/**
 * Everything the Function Quick Runner needs to open bound to a live
 * instance. `designer-ui` owns no router, so the host turns this into a
 * route (web) or a webview panel (extension).
 */
export interface OpenFunctionRunTarget {
  domain: string;
  functionKey: string;
  /** From the catalog entry — `'D' | 'F' | 'I'`. */
  scope: string;
  workflowKey: string;
  instanceId: string;
}

/**
 * A correlation row asking for one of its sub-flow's editors. `designer-ui`
 * owns no router, so it resolves the workflow file and the host turns this
 * into a route (web) or a webview panel / editor (extension) — the same split
 * `OpenFunctionRunTarget` uses.
 */
export interface OpenSubFlowTarget {
  /** `designer` → the workflow definition; `quickrun` → the sub-flow's Quick Runner. */
  intent: 'designer' | 'quickrun';
  domain: string;
  workflowKey: string;
  /** Absolute path of the resolved workflow JSON. */
  workflowFilePath: string;
  /**
   * Route coordinates under the workflows root. Present only when the
   * workspace config is loaded (web shell); extension hosts use the path.
   */
  route?: { group: string; name: string };
}

export interface HistoryTransition {
  id: string;
  transitionId: string;
  fromState: string;
  toState: string;
  startedAt: string;
  finishedAt?: string;
  durationSeconds?: number;
  triggerType: string;
  body?: Record<string, unknown>;
  header?: Record<string, unknown>;
  createdAt: string;
  createdBy?: string;
  createdByBehalfOf?: string;
}

export interface HistoryResponse {
  transitions: HistoryTransition[];
}

export interface InstanceListItem {
  id: string;
  key: string;
  flow: string;
  domain: string;
  flowVersion?: string;
  tags?: string[];
  metadata: {
    currentState: string;
    effectiveState: string;
    status: InstanceStatus;
    /** Deepest active subflow's status (or the instance's own). Prefer for display. */
    effectiveStatus?: InstanceStatus;
    type?: InstanceType | null;
    incident?: IncidentLinks;
    effectiveStateType?: string;
    effectiveStateSubType?: string;
    currentStateType?: string;
    currentStateSubType?: string;
    stage?: string;
    completedAt?: string;
    duration?: number;
    createdAt: string;
    modifiedAt?: string;
    createdBy?: string;
    modifiedBy?: string;
  };
}

export interface InstanceListResponse {
  links: {
    self: string;
    first?: string;
    next?: string;
    prev?: string;
  };
  items: InstanceListItem[];
}

export type QuickRunTab = {
  instanceId: string;
  domain: string;
  workflowKey: string;
  environmentName?: string;
  label: string;
};

export type ContextPanelTab = 'data' | 'history' | 'tasks' | 'correlations' | 'raw';

export function safeViewContent(content: string | Record<string, unknown> | unknown): string {
  if (typeof content === 'string') return content;
  if (content != null && typeof content === 'object') {
    try { return JSON.stringify(content, null, 2); } catch { return String(content); }
  }
  return '';
}

/** One row of `…/functions/tasks` (metadata only, StartedAt ascending). */
export interface TaskHistoryItem {
  id: string;
  taskKey: string;
  transitionKey: string;
  fromState: string;
  /** `null` while the owning transition is in progress. */
  toState?: string | null;
  triggerType: string;
  /** waiting | busy | completed | faulted */
  status: string;
  /** unknown | success | failed */
  businessStatus: string;
  startedAt: string;
  finishedAt?: string | null;
  durationMs?: number | null;
  /** Fault reason on a faulted row; never a stack trace. */
  error?: string | null;
  /** Runtime 0.0.99: onExecute | onEntry | onExit; null on pre-migration rows. */
  hook?: string | null;
  /** Runtime 0.0.99: equal order ⇒ parallel group. */
  order?: number | null;
}

export interface TaskHistoryResponse {
  items: TaskHistoryItem[];
}

/** One row of `GET {domain}/functions/human-task`: the ROOT instance, the LEAF's text. */
export interface HumanTaskItem {
  /** Business key of the root (its own id for a SubProcess). */
  instanceId?: string | null;
  /** The root instance's own id — always unique; what Forge opens. */
  id: string;
  workflow?: string | null;
  title?: string | null;
  description?: string | null;
  createdAt: string;
}

export interface HumanTaskListResponse {
  items: HumanTaskItem[];
  /** `X-VNext-HumanTask-Truncated: true` — the runtime capped the list. */
  truncated: boolean;
}

/** The single question an `authorize` call asks. */
export type AuthorizeTarget =
  | { kind: 'transition'; transitionKey: string }
  | { kind: 'function'; functionKey: string }
  | { kind: 'queryRoles' }
  | { kind: 'ack' };

/** `authorize` verdict — the runtime answers 200 (allowed) or 403 (denied), both with a body. */
export interface AuthorizeResult {
  allowed: boolean;
  status: number;
}

/**
 * One node of an instance's correlation tree (`quickrun/getCorrelationTree`).
 * Runtime 0.0.99 `functions/instance-correlation`; on older runtimes the
 * service reads `functions/hierarchy` and fills `resolved` / `ownState`.
 */
export interface CorrelationTreeNode {
  id: string;
  key?: string | null;
  flow: string;
  domain: string;
  flowVersion?: string | null;
  /** Deepest active state below this node (descends through running subflows). */
  currentState?: string | null;
  /** This instance's own state. */
  ownState?: string | null;
  status?: string | null;
  /** `S` SubFlow, `P` SubProcess. Absent on the root. */
  subFlowType?: string | null;
  isCompleted?: boolean;
  completedAt?: string | null;
  /** completed | faulted | canceled */
  terminalOutcome?: string | null;
  parentState?: string | null;
  correlationId?: string | null;
  createdAt?: string | null;
  stateChangedAt?: string | null;
  href?: string | null;
  /** False when the runtime could not descend into this node. */
  resolved: boolean;
  /** depth-exceeded | hop-failed | instance-missing */
  unresolvedReason?: string | null;
  children: CorrelationTreeNode[];
}

export interface CorrelationTreeResponse {
  root: CorrelationTreeNode;
  source: 'instance-correlation' | 'hierarchy';
}

/** One task under a metrics attempt (runtime 0.0.99). */
export interface MetricsTask {
  id: string;
  taskKey: string;
  /** onExecute | onEntry | onExit */
  hook?: string | null;
  order?: number | null;
  status: string;
  businessStatus?: string | null;
  startedAt?: string | null;
  durationMs?: number | null;
  error?: string | null;
}

/** One firing (transition) or visit (state). */
export interface MetricsAttempt {
  seq: number;
  startedAt?: string | null;
  finishedAt?: string | null;
  /** Transition: execution time. State: dwell (null while still in it). */
  durationMs?: number | null;
  triggerType?: string | null;
  triggeredBy?: string | null;
  tasks: MetricsTask[];
}

export interface ElementMetricsResponse {
  element: { kind: 'transition' | 'state'; key: string };
  count: number;
  attempts: MetricsAttempt[];
}

export interface FunctionMetricsItem {
  executionId: string;
  functionVersion?: string | null;
  invokedAt: string;
  durationMs?: number | null;
  scope?: string | null;
  workflow?: string | null;
  instanceId?: string | null;
  succeeded: boolean;
  status?: string | null;
  statusCode?: number | null;
  error?: string | null;
  fromCache?: boolean;
  traceId?: string | null;
  invokedBy?: string | null;
  invokedByBehalfOf?: string | null;
}

export interface FunctionMetricsResponse {
  items: FunctionMetricsItem[];
  summary?: { count: number; p50Ms?: number | null; p95Ms?: number | null; failureRate?: number | null } | null;
  hasNext: boolean;
}
