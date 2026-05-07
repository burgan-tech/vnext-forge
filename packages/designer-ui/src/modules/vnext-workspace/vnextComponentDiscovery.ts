import type {
  DiscoveredVnextComponent,
  VnextComponentsByCategory,
  VnextComponentsDiscoveryResult,
  VnextExportCategory,
} from '@vnext-forge-studio/app-contracts';
import { VNEXT_FLOW_TO_EXPORT_CATEGORY as VNEXT_FLOW_TO_EXPORT_CATEGORY_MAP } from '@vnext-forge-studio/app-contracts';

import { unwrapApi } from '../../api/client.js';

export type {
  DiscoveredVnextComponent,
  VnextComponentsByCategory,
  VnextComponentsDiscoveryResult,
  VnextExportCategory,
};

/** vNext JSON `flow` → vnext.config `exports` kategorisi (app-contracts ile aynı tablo). */
export const VNEXT_FLOW_TO_EXPORT_CATEGORY = VNEXT_FLOW_TO_EXPORT_CATEGORY_MAP;

/**
 * Tüm kategorilerdeki vNext bileşen JSON’larını listeler (tek RPC, sunucu taraması).
 * @param previewPaths — CreateVnextConfig önizlemesi: `JSON.stringify(paths)` (opsiyonel).
 */
function normalizePathsForPreview(input: VnextWorkspacePathsLike): Record<string, string> {
  return {
    componentsRoot: input.componentsRoot,
    tasks: input.tasks ?? '',
    views: input.views ?? '',
    functions: input.functions ?? '',
    extensions: input.extensions ?? '',
    workflows: input.workflows ?? '',
    schemas: input.schemas ?? '',
  };
}

export async function discoverAllVnextComponents(
  projectId: string,
  opts?: { previewPaths?: VnextWorkspacePathsLike },
): Promise<VnextComponentsDiscoveryResult> {
  const params: Record<string, string> = { id: projectId };
  if (opts?.previewPaths != null) {
    params.previewPaths = JSON.stringify(normalizePathsForPreview(opts.previewPaths));
  }
  return unwrapApi<VnextComponentsDiscoveryResult>(
    { method: 'vnext/components/list', params },
    'Failed to list vNext components',
  );
}

/** Form / istemci tarafı `paths` önizlemesi (BFF `vnextWorkspacePathsInputSchema` ile uyumlu). */
export type VnextWorkspacePathsLike = {
  componentsRoot: string;
  tasks?: string;
  views?: string;
  functions?: string;
  extensions?: string;
  workflows?: string;
  schemas?: string;
};

/**
 * Tek export kategorisi (ör. `tasks`) — tek RPC `vnext/<cat>/list`.
 */
export async function discoverVnextComponentsByCategory(
  projectId: string,
  category: VnextExportCategory,
): Promise<DiscoveredVnextComponent[]> {
  return unwrapApi<DiscoveredVnextComponent[]>(
    { method: `vnext/${category}/list`, params: { id: projectId } },
    'Failed to list vNext components by category',
  );
}

export function flowToExportCategory(flow: string): VnextExportCategory | null {
  return VNEXT_FLOW_TO_EXPORT_CATEGORY_MAP[flow] ?? null;
}
