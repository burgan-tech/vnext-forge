import * as QuickRunApi from '../QuickRunApi';
import { useQuickRunStore } from '../store/quickRunStore';

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
    setActiveState(stateData);
    updateInstanceState(params.instanceId, stateData);

    const fetchView = Boolean(stateData.view?.hasView && (stateData.status === 'A' || stateData.status === 'C'));

    const parallel: Promise<void>[] = [];

    parallel.push(
      QuickRunApi.getData(base).then((dataRes) => {
        if (dataRes.success) setActiveData(dataRes.data);
        else setActiveData(null);
      }),
    );

    if (fetchView) {
      parallel.push(
        QuickRunApi.getView(base).then((viewRes) => {
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
