import { useEffect, useCallback } from 'react';
import { createLogger } from '@shared/lib/logger/createLogger';
import { useWorkflowStore } from '@modules/canvas-interaction/workflow-store';
import { decodeFromBase64 } from '@modules/code-editor/editor/Base64Handler';
import { useProjectStore } from '@modules/project-management/project-store-legacy';
import { writeFile } from '@modules/project-workspace/workspace-api';

const logger = createLogger('save-workflow/useSaveWorkflow');

interface UseSaveWorkflowOptions {
  group: string;
  name: string;
}

/* ────────────── Script Extraction & Save ────────────── */

interface ScriptEntry {
  location: string;
  code: string;
}

/**
 * Extracts all script references (mapping, rule, condition, timer) from a workflow JSON.
 * Only includes scripts that have both a `location` and non-empty `code`.
 */
function extractScripts(workflow: any): ScriptEntry[] {
  const scripts: ScriptEntry[] = [];
  const seen = new Set<string>(); // Deduplicate by location
  const attrs = workflow?.attributes;
  if (!attrs) return scripts;

  function collect(script: any) {
    if (!script?.location || !script?.code) return;
    // Skip generic/placeholder locations
    if (script.location === './NewMapping.csx' || script.location === './NewCondition.csx' || script.location === './NewTimer.csx') return;
    if (seen.has(script.location)) return;
    seen.add(script.location);
    scripts.push({ location: script.location, code: script.code });
  }

  // States
  for (const state of (attrs.states || [])) {
    // onEntries mappings
    for (const entry of (state.onEntries || [])) {
      collect(entry.mapping);
    }
    // onExits mappings
    for (const entry of (state.onExits || [])) {
      collect(entry.mapping);
    }
    // transitions: rule, condition, timer
    for (const t of (state.transitions || [])) {
      collect(t.rule);
      // Only collect condition if it's a separate object from rule
      if (t.condition && t.condition !== t.rule && t.condition.location !== t.rule?.location) {
        collect(t.condition);
      }
      collect(t.timer);
    }
  }

  // sharedTransitions
  for (const st of (attrs.sharedTransitions || [])) {
    collect(st.mapping);
  }

  return scripts;
}

/**
 * Resolves a relative location (e.g., "./src/MyMapping.csx") to an absolute path on disk.
 * @param workflowDir - The directory containing the workflow JSON file
 * @param location - The relative location from the JSON (e.g., "./src/MyMapping.csx")
 */
function resolveScriptPath(workflowDir: string, location: string): string {
  // Remove "./" prefix if present
  const relative = location.startsWith('./') ? location.slice(2) : location;
  return `${workflowDir}/${relative}`;
}

/**
 * Saves all extracted .csx scripts to disk alongside the workflow JSON.
 */
async function saveScriptFiles(workflow: any, workflowDir: string): Promise<void> {
  const scripts = extractScripts(workflow);
  if (scripts.length === 0) return;

  const savePromises = scripts.map(async (script) => {
    const decoded = decodeFromBase64(script.code);
    if (!decoded || decoded === '// Unable to decode') return;

    const absolutePath = resolveScriptPath(workflowDir, script.location);
    try {
      await writeFile(absolutePath, decoded);
    } catch (err) {
      logger.error(`Failed to save script ${script.location}`, err);
    }
  });

  await Promise.all(savePromises);
}

/* ────────────── Hook ────────────── */

export function useSaveWorkflow({ group, name }: UseSaveWorkflowOptions) {
  const { workflowJson, diagramJson, isDirty, markClean } = useWorkflowStore();
  const { activeProject, vnextConfig } = useProjectStore();

  const save = useCallback(async () => {
    if (!workflowJson || !diagramJson || !activeProject || !vnextConfig || !isDirty) return;

    const projectPath = activeProject.path;
    const componentsRoot = vnextConfig.paths.componentsRoot;
    const workflowsDir = vnextConfig.paths.workflows;

    const workflowDir = `${projectPath}/${componentsRoot}/${workflowsDir}/${group}`;
    const wfFilePath = `${workflowDir}/${name}.json`;
    const diagFilePath = `${workflowDir}/.meta/${name}.diagram.json`;

    try {
      await Promise.all([
        writeFile(wfFilePath, JSON.stringify(workflowJson, null, 2)),
        writeFile(diagFilePath, JSON.stringify(diagramJson, null, 2)),
        saveScriptFiles(workflowJson, workflowDir),
      ]);
      markClean();
    } catch (err) {
      logger.error('Failed to save workflow', err);
    }
  }, [workflowJson, diagramJson, activeProject, vnextConfig, isDirty, markClean, group, name]);

  // Listen for Cmd+S
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === 's') {
        e.preventDefault();
        save();
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [save]);

  return { save, isDirty };
}
