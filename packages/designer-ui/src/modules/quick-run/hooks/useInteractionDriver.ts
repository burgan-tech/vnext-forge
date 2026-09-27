import { useEffect, useRef } from 'react';

import { useQuickRunStore } from '../store/quickRunStore';
import { useNow } from './useNow';

/**
 * Drives the interaction machine's clock: ticks once a second while an ack is
 * pending (so the countdown expires into `resumed`) and calls `resume` when
 * the machine enters `resumed` — after a successful ack or the fallback. The
 * caller's `resume` starts a new poll round; `resumed` survives that round's
 * `POLL_STARTED` and is left once a response shows the state changed or the
 * status left `B`. Returns the clock for the countdown display.
 */
export function useInteractionDriver(resume: (instanceId: string) => void): number {
  const interaction = useQuickRunStore((s) => s.interaction);
  const dispatchInteraction = useQuickRunStore((s) => s.dispatchInteraction);
  const awaiting = interaction.kind === 'awaitingAck';
  const nowMs = useNow(awaiting ? 1000 : null);

  useEffect(() => {
    if (awaiting) dispatchInteraction({ type: 'TICK', nowMs });
  }, [awaiting, nowMs, dispatchInteraction]);

  const resumeRef = useRef(resume);
  resumeRef.current = resume;
  // The reducer returns the same `resumed` object while it stays put, so this
  // fires once per entry into `resumed`, not on every poll response.
  useEffect(() => {
    if (interaction.kind === 'resumed') resumeRef.current(interaction.instanceId);
  }, [interaction]);

  return nowMs;
}
