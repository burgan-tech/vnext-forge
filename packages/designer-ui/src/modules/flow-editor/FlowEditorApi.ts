import { failureFromError, isFailure, success, type ApiResponse } from '@vnext-forge/app-contracts';
import { decodeScriptCode } from '../../modules/code-editor/editor/ScriptCodec';
import {
  createDirectory,
  readFile,
  readOptionalFile,
  writeFile,
} from '../../modules/project-workspace/WorkspaceApi';
import { createLogger } from '../../lib/logger/createLogger';
import { toVnextError } from '../../lib/error/vNextErrorHelpers';
import {
  flowEditorDocumentSchema,
  flowEditorScriptSchema,
  type FlowEditorScriptEntry,
} from './FlowEditorSchema';

const logger = createLogger('flow-editor/FlowEditorApi');

export interface LoadFlowEditorParams {
  workflowFilePath: string;
  diagramFilePath: string;
}

export interface LoadFlowEditorResult {
  workflow: Record<string, unknown>;
  diagram: Record<string, unknown>;
}

export interface SaveWorkflowDocumentParams {
  workflowDir: string;
  workflowFilePath: string;
  workflowJson: Record<string, unknown>;
}

/** @deprecated Use {@link SaveWorkflowDocumentParams} + {@link persistDiagramSnapshot} instead. */
export interface SaveFlowEditorParams {
  workflowDir: string;
  workflowFilePath: string;
  diagramFilePath: string;
  workflowJson: Record<string, unknown>;
  diagramJson: Record<string, unknown>;
}

export async function loadFlowEditorDocument({
  workflowFilePath,
  diagramFilePath,
}: LoadFlowEditorParams): Promise<ApiResponse<LoadFlowEditorResult>> {
  try {
    const workflowData = await readFile(workflowFilePath);
    const workflow = parseFlowEditorDocument(
      typeof workflowData.content === 'string'
        ? parseJsonDocument(workflowData.content, 'Workflow could not be parsed.')
        : workflowData.content,
      'Workflow document is invalid.',
    );

    let diagram = parseFlowEditorDocument({ nodePos: {} }, 'Workflow diagram is invalid.');

    // Diagram file is optional; when absent we fall back to an empty layout.
    // This avoids a `fileTree` dependency and works identically in every host.
    const diagramData = await readOptionalFile(diagramFilePath);

    if (diagramData) {
      diagram = parseFlowEditorDocument(
        typeof diagramData.content === 'string'
          ? parseJsonDocument(diagramData.content, 'Diagram could not be parsed.')
          : diagramData.content,
        'Workflow diagram is invalid.',
      );
    }

    return success({
      workflow,
      diagram,
    });
  } catch (value) {
    return failureFromError(toVnextError(value, 'Workflow could not be loaded.'));
  }
}

/**
 * Ensures the `.meta` directory and an empty diagram file exist on disk.
 * Intended to be called fire-and-forget after a workflow is opened so that
 * externally-created workflows (not scaffolded by the designer) also get
 * the diagram infrastructure.
 */
export async function ensureDiagramInfrastructure(diagramFilePath: string): Promise<void> {
  const metaDirPath = diagramFilePath.replace(/\/[^/]+$/, '');
  await createDirectory(metaDirPath);

  const existing = await readOptionalFile(diagramFilePath);
  if (!existing) {
    await writeFile(diagramFilePath, JSON.stringify({ nodePos: {} }, null, 2));
  }
}

/**
 * Saves the workflow JSON and any embedded `.csx` scripts.
 * This is the **awaited** save path — `markClean()` should fire on success.
 * Diagram persistence is handled separately via {@link persistDiagramSnapshot}.
 */
export async function saveWorkflowDocument({
  workflowDir,
  workflowFilePath,
  workflowJson,
}: SaveWorkflowDocumentParams): Promise<ApiResponse<void>> {
  try {
    const nextWorkflowJson = parseFlowEditorDocument(workflowJson, 'Workflow document is invalid.');

    await ensureWriteSucceeded(
      writeFile(workflowFilePath, JSON.stringify(nextWorkflowJson, null, 2)),
      'Workflow could not be saved.',
    );

    const scripts = extractScripts(nextWorkflowJson);

    for (const script of scripts) {
      if (script.encoding === 'NAT' || !script.location) {
        continue;
      }

      const decoded = decodeScriptCode(script.code, script.encoding);

      if (!decoded) {
        continue;
      }

      await ensureWriteSucceeded(
        writeFile(resolveScriptPath(workflowDir, script.location), decoded),
        `Script ${script.location} could not be saved.`,
      );
    }

    return success(undefined);
  } catch (value) {
    return failureFromError(toVnextError(value, 'Workflow could not be saved.'));
  }
}

/**
 * Writes the diagram JSON to disk. Fire-and-forget — errors are logged,
 * never propagated to the caller. Diagram data is layout metadata, not
 * authoritative business content; silent failure is acceptable.
 */
export async function persistDiagramSnapshot(
  diagramFilePath: string,
  diagramJson: Record<string, unknown>,
): Promise<void> {
  try {
    const nextDiagramJson = parseFlowEditorDocument(diagramJson, 'Workflow diagram is invalid.');
    await ensureWriteSucceeded(
      writeFile(diagramFilePath, JSON.stringify(nextDiagramJson, null, 2)),
      'Workflow diagram could not be saved.',
    );
  } catch (value) {
    logger.warn('Diagram persistence failed (non-fatal)', value);
  }
}

/** @deprecated Use {@link saveWorkflowDocument} + {@link persistDiagramSnapshot} instead. */
export async function saveFlowEditorDocument({
  workflowDir,
  workflowFilePath,
  diagramFilePath,
  workflowJson,
  diagramJson,
}: SaveFlowEditorParams): Promise<ApiResponse<void>> {
  const result = await saveWorkflowDocument({ workflowDir, workflowFilePath, workflowJson });
  void persistDiagramSnapshot(diagramFilePath, diagramJson);
  return result;
}

async function ensureWriteSucceeded(
  response: Promise<ApiResponse<void>>,
  fallbackMessage: string,
): Promise<void> {
  const result = await response;

  if (isFailure(result)) {
    throw toVnextError(result, fallbackMessage);
  }
}

function parseJsonDocument(content: string, fallbackMessage: string): unknown {
  try {
    return JSON.parse(content);
  } catch (value) {
    throw toVnextError(value, fallbackMessage);
  }
}

function parseFlowEditorDocument(value: unknown, fallbackMessage: string): Record<string, unknown> {
  try {
    return flowEditorDocumentSchema.parse(value);
  } catch (schemaError) {
    throw toVnextError(schemaError, fallbackMessage);
  }
}

function extractScripts(workflow: Record<string, unknown>): FlowEditorScriptEntry[] {
  const scripts: FlowEditorScriptEntry[] = [];
  const seen = new Set<string>();
  const attrs = workflow.attributes;

  if (!isRecord(attrs)) {
    return scripts;
  }

  function collect(script: unknown) {
    const parsedScript = parseScriptEntry(script);

    if (!parsedScript) {
      return;
    }

    if (
      parsedScript.location === './NewMapping.csx' ||
      parsedScript.location === './NewCondition.csx' ||
      parsedScript.location === './NewTimer.csx'
    ) {
      return;
    }

    if (seen.has(parsedScript.location)) {
      return;
    }

    seen.add(parsedScript.location);
    scripts.push(parsedScript);
  }

  for (const state of asArray(attrs.states)) {
    if (!isRecord(state)) {
      continue;
    }

    for (const entry of asArray(state.onEntries)) {
      if (isRecord(entry)) {
        collect(entry.mapping);
      }
    }

    for (const entry of asArray(state.onExits)) {
      if (isRecord(entry)) {
        collect(entry.mapping);
      }
    }

    for (const transition of asArray(state.transitions)) {
      if (!isRecord(transition)) {
        continue;
      }

      const conditionScript = parseScriptEntry(transition.condition);
      const ruleScript = parseScriptEntry(transition.rule);

      collect(transition.rule);

      if (conditionScript && (!ruleScript || conditionScript.location !== ruleScript.location)) {
        collect(conditionScript);
      }

      collect(transition.timer);
    }
  }

  for (const sharedTransition of asArray(attrs.sharedTransitions)) {
    if (isRecord(sharedTransition)) {
      collect(sharedTransition.mapping);
    }
  }

  return scripts;
}

function resolveScriptPath(workflowDir: string, location: string): string {
  const relativePath = location.startsWith('./') ? location.slice(2) : location;
  return `${workflowDir}/${relativePath}`;
}

function isRecord(value: unknown): value is Record<string, any> {
  return typeof value === 'object' && value !== null;
}

function parseScriptEntry(value: unknown): FlowEditorScriptEntry | null {
  const parsed = flowEditorScriptSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}
