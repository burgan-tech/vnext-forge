import { isHumanTaskGateMissing, type HumanTaskStateLike } from './humanTask';
import { isRec } from './isRec';

/** Runtime default acknowledge window (vnext long-poll-termination.md). */
export const DEFAULT_LONG_POLL_FALLBACK_SECONDS = 60;

export interface InteractionNodeData {
  hasLongPoll: boolean;
  longPollAuth?: 'roles' | 'rule';
  terminate?: boolean;
  fallbackTimeoutSeconds?: number;
}

export interface StateNodeExtraData extends InteractionNodeData {
  humanTaskGateMissing: boolean;
}

/** @deprecated Import from `./isRec` — kept so existing consumers still resolve. */
export { isRec };

/**
 * A long poll authorizes its continuation check with either a `rule` (a
 * script REF) or plain `roles` — `rule` wins when both/either is present.
 * Exported so later Phase C tasks reading `interaction.longPoll` can reuse
 * this instead of re-deriving the arm.
 */
export function longPollArm(longPoll: Record<string, unknown>): 'roles' | 'rule' {
  return longPoll.rule !== undefined && longPoll.rule !== null ? 'rule' : 'roles';
}

export function deriveInteractionNodeData(interaction: unknown): InteractionNodeData {
  if (!isRec(interaction)) return { hasLongPoll: false };
  const longPoll = interaction.longPoll;
  if (!isRec(longPoll)) return { hasLongPoll: false };
  const data: InteractionNodeData = {
    hasLongPoll: true,
    longPollAuth: longPollArm(longPoll),
    terminate: longPoll.terminate === true,
  };
  if (typeof longPoll.fallbackTimeoutSeconds === 'number') {
    data.fallbackTimeoutSeconds = longPoll.fallbackTimeoutSeconds;
  }
  return data;
}

export function longPollTooltip(data: InteractionNodeData): string {
  if (!data.hasLongPoll) return 'No long poll';
  const fallback =
    data.fallbackTimeoutSeconds === undefined
      ? `${DEFAULT_LONG_POLL_FALLBACK_SECONDS}s (default)`
      : `${data.fallbackTimeoutSeconds}s`;
  return ['Long poll', data.terminate ? 'terminate' : 'no terminate', fallback, data.longPollAuth ?? 'roles'].join(
    ' · ',
  );
}

export function deriveStateNodeData(
  state: HumanTaskStateLike & { interaction?: unknown },
  workflowQueryRoles: unknown,
): StateNodeExtraData {
  return {
    ...deriveInteractionNodeData(state.interaction),
    humanTaskGateMissing: isHumanTaskGateMissing(state, workflowQueryRoles),
  };
}
