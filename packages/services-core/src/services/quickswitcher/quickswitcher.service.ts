import { ERROR_CODES, VnextForgeError } from '@vnext-forge-studio/app-contracts'

import type { FileSystemAdapter, LoggerAdapter } from '../../adapters/index.js'
import type { ProjectService } from '../project/index.js'
import { scanVnextComponents } from '../project/vnext-component-scanner.js'

import type {
  QuickSwitchEntry,
  QuickswitcherBuildIndexParams,
  QuickswitcherBuildIndexResult,
} from './quickswitcher-schemas.js'

export interface QuickswitcherServiceDeps {
  fs: FileSystemAdapter
  logger: LoggerAdapter
  projectService: ProjectService
}

interface WorkflowJsonShape {
  key?: string
  domain?: string
  version?: string
  flow?: string
  attributes?: WorkflowAttributesShape
}

interface WorkflowAttributesShape {
  type?: string
  startTransition?: TransitionShape
  cancel?: TransitionShape
  updateData?: TransitionShape
  sharedTransitions?: TransitionShape[]
  states?: StateShape[]
}

interface StateShape {
  key?: string
  stateType?: number
  transitions?: TransitionShape[]
}

interface TransitionShape {
  key?: string
}

interface ComponentJsonShape {
  key?: string
  domain?: string
  version?: string
  flow?: string
  attributes?: { type?: string }
}

const NESTED_TRANSITION_BUCKET_KEYS: (keyof Pick<
  WorkflowAttributesShape,
  'startTransition' | 'cancel' | 'updateData'
>)[] = ['startTransition', 'cancel', 'updateData']

export function createQuickswitcherService(deps: QuickswitcherServiceDeps) {
  const { fs, logger, projectService } = deps

  /**
   * Builds the full Smart Search index for a project.
   *
   * Sources:
   *   - workspace config from `projectService.getConfig()` for component
   *     folder paths (componentsRoot, workflows, tasks, ...)
   *   - `scanVnextComponents()` for top-level files (one entry per file)
   *   - workflow JSONs are re-read to extract states + their transitions +
   *     shared/start/cancel/updateData transitions as additional entries
   *
   * Workflow files are read sequentially after the scan; for a typical
   * 50-workflow project this adds ~50 file reads on top of the scan and
   * stays under 200 ms on a warm cache. Heavier projects can be optimised
   * later with mtime-based caching.
   */
  async function buildIndex(
    params: QuickswitcherBuildIndexParams,
    traceId?: string,
  ): Promise<QuickswitcherBuildIndexResult> {
    const { id } = params

    const project = await projectService.getProject(id, traceId)
    const config = await projectService.getConfig(id, traceId)
    if (!config?.paths) {
      throw new VnextForgeError(
        ERROR_CODES.PROJECT_INVALID_CONFIG,
        'Project has no vnext.config.json paths; cannot build quickswitcher index.',
        {
          source: 'QuickswitcherService.buildIndex',
          layer: 'domain',
          details: { id },
        },
        traceId,
      )
    }

    const scan = await scanVnextComponents(fs, project.path, config.paths)
    const entries: QuickSwitchEntry[] = []
    const warnings: string[] = []

    // Top-level entries for non-workflow categories — one entry per file.
    // We re-parse each JSON to recover `domain` (the scanner only kept
    // key/path/flow/version).
    const flatCategories = ['tasks', 'schemas', 'views', 'functions', 'extensions'] as const
    type FlatType = 'task' | 'schema' | 'view' | 'function' | 'extension'
    const TYPE_FOR: Record<(typeof flatCategories)[number], FlatType> = {
      tasks: 'task',
      schemas: 'schema',
      views: 'view',
      functions: 'function',
      extensions: 'extension',
    }

    for (const cat of flatCategories) {
      for (const c of scan.components[cat]) {
        const meta = await readComponentMeta(c.path, warnings)
        entries.push({
          id: `${c.flow}:${c.key}`,
          type: TYPE_FOR[cat],
          label: c.key,
          ...(meta?.attributes?.type ? { description: `type ${meta.attributes.type}` } : {}),
          componentKey: c.key,
          ...(meta?.domain ? { domain: meta.domain } : {}),
          ...(c.version ? { version: c.version } : {}),
          flow: c.flow,
          filePath: c.path,
        })
      }
    }

    // Workflows + drill-down to states + transitions.
    for (const wf of scan.components.workflows) {
      const meta = await readWorkflowJson(wf.path, warnings)
      if (!meta) {
        // Still emit the top-level entry even if drill-down failed — at
        // worst the user navigates to the workflow file directly.
        entries.push({
          id: `${wf.flow}:${wf.key}`,
          type: 'workflow',
          label: wf.key,
          componentKey: wf.key,
          ...(wf.version ? { version: wf.version } : {}),
          flow: wf.flow,
          filePath: wf.path,
        })
        continue
      }

      const wfDomain = meta.domain
      const wfType = meta.attributes?.type
      entries.push({
        id: `${wf.flow}:${wf.key}`,
        type: 'workflow',
        label: wf.key,
        ...(wfType ? { description: `workflow ${wfType}` } : {}),
        componentKey: wf.key,
        ...(wfDomain ? { domain: wfDomain } : {}),
        ...(wf.version ? { version: wf.version } : {}),
        flow: wf.flow,
        filePath: wf.path,
      })

      const attrs = meta.attributes ?? {}

      // Top-level transitions (start / cancel / updateData) — emitted as
      // transitions parented to the workflow itself (no stateKey).
      for (const bucketKey of NESTED_TRANSITION_BUCKET_KEYS) {
        const tx = attrs[bucketKey]
        if (!tx?.key) continue
        entries.push({
          id: `${wf.flow}:${wf.key}::tx:${bucketKey}:${tx.key}`,
          type: 'transition',
          label: tx.key,
          description: `${bucketKey} · ${wf.key}`,
          componentKey: wf.key,
          ...(wfDomain ? { domain: wfDomain } : {}),
          ...(wf.version ? { version: wf.version } : {}),
          flow: wf.flow,
          filePath: wf.path,
          transitionKey: tx.key,
        })
      }

      // Shared transitions — also parented to the workflow, no stateKey.
      for (const tx of attrs.sharedTransitions ?? []) {
        if (!tx?.key) continue
        entries.push({
          id: `${wf.flow}:${wf.key}::shared:${tx.key}`,
          type: 'transition',
          label: tx.key,
          description: `shared · ${wf.key}`,
          componentKey: wf.key,
          ...(wfDomain ? { domain: wfDomain } : {}),
          ...(wf.version ? { version: wf.version } : {}),
          flow: wf.flow,
          filePath: wf.path,
          transitionKey: tx.key,
        })
      }

      // States and per-state transitions.
      for (const st of attrs.states ?? []) {
        if (!st?.key) continue
        entries.push({
          id: `${wf.flow}:${wf.key}::state:${st.key}`,
          type: 'state',
          label: st.key,
          description: `state · ${wf.key}`,
          componentKey: wf.key,
          ...(wfDomain ? { domain: wfDomain } : {}),
          ...(wf.version ? { version: wf.version } : {}),
          flow: wf.flow,
          filePath: wf.path,
          stateKey: st.key,
        })

        for (const tx of st.transitions ?? []) {
          if (!tx?.key) continue
          entries.push({
            id: `${wf.flow}:${wf.key}::state:${st.key}::tx:${tx.key}`,
            type: 'transition',
            label: tx.key,
            description: `${st.key} · ${wf.key}`,
            componentKey: wf.key,
            ...(wfDomain ? { domain: wfDomain } : {}),
            ...(wf.version ? { version: wf.version } : {}),
            flow: wf.flow,
            filePath: wf.path,
            stateKey: st.key,
            transitionKey: tx.key,
          })
        }
      }
    }

    if (warnings.length > 0) {
      logger.warn?.(
        { source: 'QuickswitcherService.buildIndex', traceId, count: warnings.length },
        'Some component files were skipped while building quickswitcher index',
      )
    }

    return { entries, warnings }
  }

  async function readComponentMeta(
    path: string,
    warnings: string[],
  ): Promise<ComponentJsonShape | null> {
    try {
      const content = await fs.readFile(path)
      const parsed = JSON.parse(content) as unknown
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null
      return parsed as ComponentJsonShape
    } catch {
      warnings.push(path)
      return null
    }
  }

  async function readWorkflowJson(
    path: string,
    warnings: string[],
  ): Promise<WorkflowJsonShape | null> {
    try {
      const content = await fs.readFile(path)
      const parsed = JSON.parse(content) as unknown
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null
      return parsed as WorkflowJsonShape
    } catch {
      warnings.push(path)
      return null
    }
  }

  return { buildIndex }
}

export type QuickswitcherService = ReturnType<typeof createQuickswitcherService>
