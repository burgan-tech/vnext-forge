import type { ApiResponse } from '@vnext-forge-studio/app-contracts';

import { callApi } from '@shared/api';

import { v1 } from './v1';

/** Matches `files/browse` aggregation used by workspace folder picker flows. */
export interface WorkspaceBrowseResult {
  path: string;
  folders: { name: string; path: string }[];
}

export async function read(path: string): Promise<ApiResponse<{ content: string }>> {
  return callApi(v1.files.read.$get({ query: { path } }));
}

export async function write(path: string, content: string): Promise<ApiResponse<void>> {
  return callApi(v1.files.write.$put({ json: { path, content } }));
}

export async function del(path: string): Promise<ApiResponse<void>> {
  return callApi(v1.files.delete.$delete({ query: { path } }));
}

export async function mkdir(path: string): Promise<ApiResponse<void>> {
  return callApi(v1.files.mkdir.$post({ json: { path } }));
}

export async function rename(oldPath: string, newPath: string): Promise<ApiResponse<void>> {
  return callApi(v1.files.rename.$post({ json: { oldPath, newPath } }));
}

export async function browse(path?: string): Promise<ApiResponse<WorkspaceBrowseResult>> {
  return callApi(v1.files.browse.$get(path ? { query: { path } } : undefined));
}

export async function search(params: {
  q: string;
  project: string;
  matchCase?: boolean;
  matchWholeWord?: boolean;
  useRegex?: boolean;
  include?: string;
  exclude?: string;
}): Promise<
  ApiResponse<
    {
      path: string;
      line: number;
      text: string;
    }[]
  >
> {
  const query: Record<string, string> = {
    q: params.q,
    project: params.project,
  };
  if (params.matchCase !== undefined) query.matchCase = String(params.matchCase);
  if (params.matchWholeWord !== undefined) query.matchWholeWord = String(params.matchWholeWord);
  if (params.useRegex !== undefined) query.useRegex = String(params.useRegex);
  if (params.include !== undefined) query.include = params.include;
  if (params.exclude !== undefined) query.exclude = params.exclude;

  return callApi(v1.files.search.$get({ query }));
}
