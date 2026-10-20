import { extractEtag } from '../etagFromResponse';
import { currentDataTarget } from '../hooks/currentDataTarget';
import { resolveStateViewSource } from '../hooks/resolveStateViewSource';
import * as QuickRunApi from '../QuickRunApi';
import { useQuickRunStore } from '../store/quickRunStore';
import { dataTargetKey, resolveDataTarget } from '../utils/dataTarget';

export interface RefreshParams {
  domain: string;
  workflowKey: string;
  instanceId: string;
  runtimeUrl: string;
  headers: Record<string, string>;
}

export async function scheduleQuickRunRefresh(params: RefreshParams): Promise<void> {
  const store = useQuickRunStore.getState();
  const {
    setActiveState,
    setActiveStateLoading,
    setStateView,
    setStateViewLoading,
    setStateViewError,
    updateInstanceState,
    setActiveView,
    setActiveViewLoading,
    setActiveData,
    setActiveDataLoading,
    setEtag,
    setDataTarget,
  } = store;

  const base = {
    domain: params.domain,
    workflowKey: params.workflowKey,
    instanceId: params.instanceId,
    headers: params.headers,
    runtimeUrl: params.runtimeUrl || undefined,
  };

  setActiveStateLoading(true);
  setStateViewLoading(true);
  setActiveDataLoading(true);
  setActiveViewLoading(true);
  setStateViewError(false);

  try {
    let stateRes;
    try {
      stateRes = await QuickRunApi.getState(base);
    } catch {
      return;
    }

    if (!stateRes.success) {
      return;
    }

    const stateData = stateRes.data;
    setActiveState(stateData, params.instanceId);
    setDataTarget(resolveDataTarget(params, stateData));
    updateInstanceState(params.instanceId, stateData);

    const viewSource = resolveStateViewSource(stateData);
    const fetchView = Boolean(viewSource) && (stateData.status === 'A' || stateData.status === 'C');

    const parallel: Promise<void>[] = [];

    // Data belongs to the leaf open SubFlow (the runtime keeps `data.href`
    // on the parent). Read the ETag after `setDataTarget`: a moved target
    // has just dropped the previous target's one.
    const target = currentDataTarget(params);
    const targetKey = dataTargetKey(target);
    parallel.push(
      QuickRunApi.getData({
        ...base,
        domain: target.domain,
        workflowKey: target.workflowKey,
        instanceId: target.instanceId,
        ifNoneMatch: useQuickRunStore.getState().etags.data,
      }).then((dataRes) => {
        // The target moved while this answer was in flight — drop it.
        if (dataTargetKey(currentDataTarget(params)) !== targetKey) return;
        if (!dataRes.success) {
          // Clear the cached ETag along with the data so the next fetch is
          // unconditional (a stale-but-valid ETag would otherwise get a
          // 304 and the "keep cache" branch would keep this `null` forever).
          setEtag('data', undefined);
          setActiveData(null);
          return;
        }
        if (dataRes.data.notModified) {
          // 304: keep the cached activeData as-is.
          return;
        }
        setEtag('data', extractEtag(dataRes.data));
        setActiveData(dataRes.data);
      }, () => {
        // A thrown request self-heals like a failed one, unless the
        // target moved meanwhile (then the new target owns the cache).
        if (dataTargetKey(currentDataTarget(params)) !== targetKey) return;
        setEtag('data', undefined);
        setActiveData(null);
      }),
    );

    if (fetchView) {
      parallel.push(
        QuickRunApi.getView({ ...base, transitionKey: viewSource?.transitionKey }).then((viewRes) => {
          if (viewRes.success) {
            setStateView(viewRes.data);
            setActiveView(viewRes.data);
            setStateViewError(false);
          } else {
            setStateViewError(true);
            setStateView(null);
            setActiveView(null);
          }
        }),
      );
    } else {
      setStateView(null);
      setActiveView(null);
      setStateViewError(false);
    }

    await Promise.all(parallel);
  } finally {
    setActiveStateLoading(false);
    setStateViewLoading(false);
    setActiveDataLoading(false);
    setActiveViewLoading(false);
  }
}
