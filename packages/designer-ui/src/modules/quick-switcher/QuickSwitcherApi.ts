import { unwrapApi } from '../../api/client.js';

import type { QuickswitcherIndexResult } from './QuickSwitcherTypes.js';

const METHOD_BUILD_INDEX = 'quickswitcher/buildIndex';

/**
 * Server call: build the Smart Search index for a project. Result includes
 * all entries (workflows / states / transitions / tasks / schemas / views /
 * functions / extensions) plus warnings for files the indexer couldn't parse.
 *
 * Throws `VnextForgeError` on failure (handled by `unwrapApi`).
 */
export async function buildQuickSwitcherIndex(
  projectId: string,
): Promise<QuickswitcherIndexResult> {
  return unwrapApi<QuickswitcherIndexResult>(
    {
      method: METHOD_BUILD_INDEX,
      params: { id: projectId },
    },
    'Quick Switcher index could not be built',
  );
}
