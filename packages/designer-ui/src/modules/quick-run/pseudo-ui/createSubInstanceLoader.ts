import type { PseudoViewDelegate, SubInstanceRef } from '@burgan-tech/pseudo-ui';

import { createLogger } from '../../../lib/logger/createLogger';
import * as QuickRunApi from '../QuickRunApi';
import type { CorrelationInfo } from '../types/quickrun.types';
import type { DataTarget } from '../utils/dataTarget';

const logger = createLogger('pseudo-ui-sub-instances');

type LoadSubInstances = NonNullable<PseudoViewDelegate['loadSubInstances']>;

/** Identity of the record whose children the view on screen reads through. */
export function subInstanceHostOf(
  target: Pick<DataTarget, 'domain' | 'workflowKey' | 'instanceId'>,
): { domain: string; workflow: string; instanceId: string } {
  return { domain: target.domain, workflow: target.workflowKey, instanceId: target.instanceId };
}

function createdAtMs(c: CorrelationInfo): number {
  const t = c.createdAt ? Date.parse(c.createdAt) : NaN;
  return Number.isNaN(t) ? -Infinity : t;
}

/**
 * Read-through for `$subFlow.<state>` / `$subProcess.<flow>` view bindings.
 * The parent's state lists its correlations; each referenced child's data is
 * read with the data function (the child's own current state comes from the
 * correlation). Best-effort: a child whose read fails is dropped, one
 * aggregated warning is logged.
 */
export function createSubInstanceLoader(deps: {
  getHeaders: () => Record<string, string>;
  runtimeUrl?: string;
}): LoadSubInstances {
  return async (input) => {
    const headers = deps.getHeaders();
    const runtimeUrl = deps.runtimeUrl || undefined;

    const stateRes = await QuickRunApi.getState({
      domain: input.domain,
      workflowKey: input.workflow,
      instanceId: input.instanceId,
      headers,
      runtimeUrl,
    }).catch(() => null);
    if (!stateRes?.success) {
      logger.warn('Sub-instance read skipped: the parent state could not be read.', {
        instanceId: input.instanceId,
      });
      return [];
    }

    const all = stateRes.data.correlations ?? stateRes.data.activeCorrelations ?? [];
    const wanted = all
      .filter((c) => {
        const type = String(c.subFlowType).toUpperCase();
        return (
          (type === 'P' && input.flows.includes(c.subFlowName)) ||
          (type === 'S' && input.states.includes(c.parentState))
        );
      })
      .sort((a, b) => createdAtMs(b) - createdAtMs(a));

    const settled = await Promise.all(
      wanted.map(async (c): Promise<SubInstanceRef | null> => {
        const res = await QuickRunApi.getData({
          domain: c.subFlowDomain || input.domain,
          workflowKey: c.subFlowName,
          instanceId: c.subFlowInstanceId,
          headers,
          runtimeUrl,
        }).catch(() => null);
        if (!res?.success) return null;
        return {
          instanceId: c.subFlowInstanceId,
          flow: c.subFlowName,
          domain: c.subFlowDomain || input.domain,
          version: c.subFlowVersion,
          type: String(c.subFlowType).toUpperCase() === 'P' ? 'P' : 'S',
          parentState: c.parentState,
          state: c.currentState,
          isCompleted: c.isCompleted,
          data: res.data.data ?? {},
        };
      }),
    );

    const refs = settled.filter((r): r is SubInstanceRef => r !== null);
    const dropped = settled.length - refs.length;
    if (dropped > 0) {
      logger.warn(`Dropped ${dropped} sub-instance(s) whose data could not be read.`, {
        instanceId: input.instanceId,
        dropped,
      });
    }
    return refs;
  };
}
