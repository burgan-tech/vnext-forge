import * as vscode from 'vscode';
import * as path from 'node:path';
import * as fs from 'node:fs/promises';
import type {
  ProjectService,
  WorkspaceService,
  VnextWorkspaceConfig,
} from '@vnext-forge/services-core';
import {
  buildComponentFolderRelPaths,
  classifyComponentTreePath,
} from '@vnext-forge/designer-ui/component-paths';
import {
  ensureComponentJsonFileName,
  getWorkspaceNameError,
} from '@vnext-forge/designer-ui/project-workspace-schema';
import {
  buildVnextComponentJson,
  type VnextComponentJsonKind,
} from '@vnext-forge/designer-ui/vnext-defaults';
import { baseLogger } from './shared/logger.js';
import { isDesignerEditorRoute, resolveProjectForRoot } from './designer-helpers.js';
import { resolveFileRoute } from './file-router.js';
import type { VnextWorkspaceDetector, VnextWorkspaceRoot } from './workspace-detector.js';
import type { DesignerEditorKind, DesignerPanel } from './panels/DesignerPanel.js';

interface CommandDeps {
  projectService: ProjectService;
  workspaceService: WorkspaceService;
  detector: VnextWorkspaceDetector;
  designerPanel: DesignerPanel;
}

/** Register all VS Code commands for vnext-forge. */
export function registerCommands(context: vscode.ExtensionContext, deps: CommandDeps): void {
  context.subscriptions.push(
    vscode.commands.registerCommand('vnextForge.open', () => openCommand(deps)),
    vscode.commands.registerCommand('vnextForge.openDesigner', (uri?: vscode.Uri) =>
      openDesignerCommand(uri, deps),
    ),
    vscode.commands.registerCommand('vnextForge.openInTextEditor', (uri?: vscode.Uri) =>
      openInTextEditorCommand(uri),
    ),
    vscode.commands.registerCommand('vnextForge.createProject', () => createProjectCommand(deps)),
    vscode.commands.registerCommand('vnextForge.createComponent', () =>
      createComponentCommand(deps),
    ),
    vscode.commands.registerCommand('vnextForge.forgeCreateWorkflow', (uri?: vscode.Uri) =>
      forgeComponentCreateByKind(uri, deps, 'workflow'),
    ),
    vscode.commands.registerCommand('vnextForge.forgeCreateTask', (uri?: vscode.Uri) =>
      forgeComponentCreateByKind(uri, deps, 'task'),
    ),
    vscode.commands.registerCommand('vnextForge.forgeCreateSchema', (uri?: vscode.Uri) =>
      forgeComponentCreateByKind(uri, deps, 'schema'),
    ),
    vscode.commands.registerCommand('vnextForge.forgeCreateView', (uri?: vscode.Uri) =>
      forgeComponentCreateByKind(uri, deps, 'view'),
    ),
    vscode.commands.registerCommand('vnextForge.forgeCreateFunction', (uri?: vscode.Uri) =>
      forgeComponentCreateByKind(uri, deps, 'function'),
    ),
    vscode.commands.registerCommand('vnextForge.forgeCreateExtension', (uri?: vscode.Uri) =>
      forgeComponentCreateByKind(uri, deps, 'extension'),
    ),
  );
}

// ── vnextForge.open ───────────────────────────────────────────────────────────

function openCommand({ designerPanel }: CommandDeps): void {
  designerPanel.openOrRevealEmpty();
}

// ── vnextForge.openDesigner ──────────────────────────────────────────────────

async function openDesignerCommand(uri: vscode.Uri | undefined, deps: CommandDeps): Promise<void> {
  const targetUri = uri ?? vscode.window.activeTextEditor?.document.uri;
  if (!targetUri) {
    void vscode.window.showWarningMessage('vnext-forge: No file selected to open in the designer.');
    return;
  }

  const target = targetUri.fsPath;
  const root = deps.detector.findOwningRoot(target);
  if (!root) {
    void vscode.window.showWarningMessage(
      'vnext-forge: The selected file is not inside a vnext workspace (no vnext.config.json found).',
    );
    return;
  }

  const projectInfo = await resolveProjectForRoot(root, deps.workspaceService, deps.projectService);
  if (!projectInfo) return;

  const route = resolveFileRoute(target, projectInfo.config, root.folderPath);

  // Files that don't map to a designer editor (vnext.config.json, generic
  // source files) are opened in VS Code's native editor — the webview only
  // hosts the structured component editors. This keeps the extension feeling
  // like a VS Code integration rather than a web app embedded inside VS Code.
  if (!isDesignerEditorRoute(route)) {
    try {
      const document = await vscode.workspace.openTextDocument(targetUri);
      await vscode.window.showTextDocument(document, { preview: false });
    } catch (error) {
      baseLogger.warn(
        { target, error: (error as Error).message },
        'Failed to open file in native editor',
      );
    }
    return;
  }

  deps.designerPanel.openEditor({
    type: 'open-editor',
    kind: route.kind,
    projectId: projectInfo.projectId,
    projectPath: root.folderPath,
    projectDomain: projectInfo.config.domain,
    group: route.group,
    name: route.name,
    filePath: route.filePath,
    vnextConfig: projectInfo.config,
  });
}

// ── vnextForge.openInTextEditor ─────────────────────────────────────────────

/** Bileşen yollarındaki .json (veya herhangi bir dosya) VS Code metin editöründe, tasarımcıyı atlayarak. */
async function openInTextEditorCommand(uri: vscode.Uri | undefined): Promise<void> {
  const targetUri = uri ?? vscode.window.activeTextEditor?.document.uri;
  if (!targetUri) {
    void vscode.window.showWarningMessage(
      'vnext-forge: No file selected to open in the text editor.',
    );
    return;
  }

  // `vscode.openWith` + `default` viewType, custom editor'ı (vnext-forge
  // designer) atlayıp dosyayı doğrudan VS Code'un yerleşik metin
  // editöründe açar. `openTextDocument` + `showTextDocument` çoğu
  // sürümde çalışsa da, custom editor priority `default` iken bazı
  // sürümlerde tasarımcıya geri yönlendirebiliyor.
  try {
    await vscode.commands.executeCommand('vscode.openWith', targetUri, 'default');
  } catch (error) {
    baseLogger.warn(
      { path: targetUri.fsPath, error: (error as Error).message },
      'Failed to open file in native text editor',
    );
  }
}

// ── vnextForge.createProject ─────────────────────────────────────────────────

async function createProjectCommand({ projectService, detector }: CommandDeps): Promise<void> {
  const domain = await vscode.window.showInputBox({
    title: 'Create vnext Project',
    prompt: 'Domain name (used as project id)',
    placeHolder: 'my-domain',
    validateInput: (value) => {
      const trimmed = value.trim();
      if (!trimmed) return 'Domain name is required';
      if (!/^[a-zA-Z0-9][a-zA-Z0-9._-]*$/.test(trimmed)) {
        return 'Use letters, digits, ".", "_" or "-" (must start with a letter or digit)';
      }
      return null;
    },
    ignoreFocusOut: true,
  });
  if (!domain) return;

  const description = await vscode.window.showInputBox({
    title: 'Create vnext Project',
    prompt: 'Description (optional)',
    ignoreFocusOut: true,
  });

  const defaultUri = vscode.workspace.workspaceFolders?.[0]?.uri;
  const targetUris = await vscode.window.showOpenDialog({
    title: 'Select target folder for the new project',
    canSelectFolders: true,
    canSelectFiles: false,
    canSelectMany: false,
    defaultUri,
    openLabel: 'Create Here',
  });
  if (!targetUris || targetUris.length === 0) return;
  const targetPath = targetUris[0].fsPath;

  try {
    const project = await vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Notification,
        title: `Creating vnext project "${domain.trim()}"…`,
      },
      () =>
        projectService.createProject(domain.trim(), description?.trim() ?? undefined, targetPath),
    );

    await detector.refresh();

    const action = await vscode.window.showInformationMessage(
      `vnext-forge: Project "${project.domain}" created at ${project.path}.`,
      'Open in New Window',
      'Add to Workspace',
    );

    if (action === 'Open in New Window') {
      await vscode.commands.executeCommand(
        'vscode.openFolder',
        vscode.Uri.file(project.path),
        true,
      );
    } else if (action === 'Add to Workspace') {
      const start = vscode.workspace.workspaceFolders?.length ?? 0;
      vscode.workspace.updateWorkspaceFolders(start, 0, { uri: vscode.Uri.file(project.path) });
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    baseLogger.error({ domain, message }, 'Failed to create vnext project');
    void vscode.window.showErrorMessage(`vnext-forge: Failed to create project. ${message}`);
  }
}

// ── vnextForge.createComponent ───────────────────────────────────────────────

type ComponentKind = DesignerEditorKind;

const COMPONENT_KINDS: { kind: ComponentKind; label: string; description: string }[] = [
  { kind: 'workflow', label: 'Workflow', description: 'Flow / SubFlow / Core definition' },
  { kind: 'task', label: 'Task', description: 'Reusable task (Http / Script / Dapr / ...)' },
  { kind: 'schema', label: 'Schema', description: 'JSON schema definition' },
  { kind: 'view', label: 'View', description: 'UI view binding' },
  { kind: 'function', label: 'Function', description: 'Scripted function' },
  { kind: 'extension', label: 'Extension', description: 'Extension definition' },
];

function pathSegmentForKind(config: VnextWorkspaceConfig, kind: ComponentKind): string {
  switch (kind) {
    case 'workflow':
      return config.paths.workflows;
    case 'task':
      return config.paths.tasks;
    case 'schema':
      return config.paths.schemas;
    case 'view':
      return config.paths.views;
    case 'function':
      return config.paths.functions;
    case 'extension':
      return config.paths.extensions;
    case 'config':
      throw new Error('vnext config is not a component kind');
    default: {
      const k: string = String(kind);
      throw new Error(`Unhandled component kind: ${k}`);
    }
  }
}

async function createComponentCommand(deps: CommandDeps): Promise<void> {
  const { detector, workspaceService, designerPanel } = deps;
  const roots = detector.getRoots();
  if (roots.length === 0) {
    void vscode.window.showWarningMessage(
      'vnext-forge: Open a folder containing vnext.config.json first.',
    );
    return;
  }

  const root = roots.length === 1 ? roots[0] : await pickWorkspaceRoot(roots);
  if (!root) return;

  const status = await workspaceService.readConfigStatus(root.folderPath);
  if (status.status !== 'ok') {
    void vscode.window.showWarningMessage(
      `vnext-forge: vnext.config.json in ${path.basename(root.folderPath)} is not valid.`,
    );
    return;
  }
  const config = status.config;

  const pickedKind = await vscode.window.showQuickPick(
    COMPONENT_KINDS.map((k) => ({
      label: k.label,
      description: k.description,
      componentKind: k.kind,
    })),
    { title: 'Create vnext Component', placeHolder: 'Select component type' },
  );
  if (!pickedKind) return;

  const kind: ComponentKind = pickedKind.componentKind;
  const kindLabel = pickedKind.label;
  const kindFolderAbs = path.resolve(
    root.folderPath,
    config.paths.componentsRoot,
    pathSegmentForKind(config, kind),
  );

  const group = await pickGroup(kindFolderAbs);
  if (group === undefined) return;

  const key = await vscode.window.showInputBox({
    title: `Create ${kindLabel}`,
    prompt: 'Component key (file name without extension)',
    placeHolder: 'my-component',
    validateInput: (value) => {
      const trimmed = value.trim();
      if (!trimmed) return 'Key is required';
      if (!/^[a-zA-Z0-9][a-zA-Z0-9._-]*$/.test(trimmed)) {
        return 'Use letters, digits, ".", "_" or "-" (must start with a letter or digit)';
      }
      return null;
    },
    ignoreFocusOut: true,
  });
  if (!key) return;
  const keyTrimmed = key.trim();
  const fileBase = keyTrimmed.replace(/\.json$/i, '');

  const targetDir = group === '' ? kindFolderAbs : path.join(kindFolderAbs, group);
  const targetFile = path.join(targetDir, `${fileBase}.json`);

  try {
    await fs.access(targetFile);
    void vscode.window.showErrorMessage(
      `vnext-forge: ${path.basename(targetFile)} already exists.`,
    );
    return;
  } catch {
    // expected ENOENT
  }

  const stub = buildVnextComponentJson(
    kind as VnextComponentJsonKind,
    { key: fileBase, domain: config.domain },
  );

  try {
    await fs.mkdir(targetDir, { recursive: true });
    await fs.writeFile(targetFile, JSON.stringify(stub, null, 2), 'utf-8');
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    void vscode.window.showErrorMessage(`vnext-forge: Failed to write component file. ${message}`);
    return;
  }

  baseLogger.info({ targetFile, kind }, 'vnext component created');

  try {
    await deps.projectService.importProject(root.folderPath);
  } catch (error) {
    baseLogger.warn(
      { folder: root.folderPath, error: (error as Error).message },
      'Failed to link project registry entry after component creation',
    );
  }

  designerPanel.openEditor({
    type: 'open-editor',
    kind,
    projectId: config.domain,
    projectPath: root.folderPath,
    projectDomain: config.domain,
    group,
    name: fileBase,
    filePath: targetFile,
    vnextConfig: config,
  });
}

async function pickWorkspaceRoot(
  roots: readonly VnextWorkspaceRoot[],
): Promise<VnextWorkspaceRoot | undefined> {
  const picked = await vscode.window.showQuickPick(
    roots.map((r) => ({ label: path.basename(r.folderPath), description: r.folderPath, root: r })),
    { title: 'Select vnext workspace', placeHolder: 'Workspace root' },
  );
  return picked?.root;
}

async function pickGroup(kindFolderAbs: string): Promise<string | undefined> {
  const existing = await listSubdirectories(kindFolderAbs);

  if (existing.length === 0) return '';

  const createNewLabel = '$(add) Create new group…';
  const rootLabel = '$(root-folder) (no group — place at root)';

  const items: (vscode.QuickPickItem & { group?: string; isCreate?: boolean })[] = [
    { label: rootLabel, group: '' },
    ...existing.map((name) => ({ label: name, group: name })),
    { label: createNewLabel, isCreate: true },
  ];

  const picked = await vscode.window.showQuickPick(items, {
    title: 'Select group folder',
    placeHolder: 'Choose an existing group or create a new one',
  });
  if (!picked) return undefined;

  if (picked.isCreate) {
    const name = await vscode.window.showInputBox({
      title: 'New group folder',
      prompt: 'Group folder name (relative to the component type directory)',
      validateInput: (value) => {
        const trimmed = value.trim();
        if (!trimmed) return 'Name is required';
        if (/[\\/]/.test(trimmed)) return 'Do not include path separators';
        if (!/^[a-zA-Z0-9][a-zA-Z0-9._-]*$/.test(trimmed)) {
          return 'Use letters, digits, ".", "_" or "-" (must start with a letter or digit)';
        }
        return null;
      },
      ignoreFocusOut: true,
    });
    if (!name) return undefined;
    return name.trim();
  }

  return picked.group ?? '';
}

async function listSubdirectories(dir: string): Promise<string[]> {
  try {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    return entries
      .filter((e) => e.isDirectory() && !e.name.startsWith('.') && e.name !== 'node_modules')
      .map((e) => e.name)
      .sort((a, b) => a.localeCompare(b));
  } catch {
    return [];
  }
}

// ── Explorer: Forge “{Type} Create” (subfolder only; extension host) ─────────

async function writeWorkflowScaffoldToDisk(
  groupPath: string,
  workflowName: string,
  domain: string,
): Promise<string> {
  const workflowTemplate = buildVnextComponentJson('workflow', { key: workflowName, domain });
  const jsonPath = path.join(groupPath, `${workflowName}.json`);
  const metaPath = path.join(groupPath, '.meta');
  const diagramPath = path.join(metaPath, `${workflowName}.diagram.json`);
  await fs.mkdir(groupPath, { recursive: true });
  await fs.mkdir(metaPath, { recursive: true });
  await fs.writeFile(jsonPath, JSON.stringify(workflowTemplate, null, 2), 'utf-8');
  await fs.writeFile(diagramPath, JSON.stringify({ nodePos: {} }, null, 2), 'utf-8');
  return jsonPath;
}

function getExplorerFolderTarget(uri: vscode.Uri | undefined): string | null {
  if (uri && uri.scheme === 'file') {
    return uri.fsPath;
  }
  return null;
}

const FORGE_CREATE_TITLE: Record<VnextComponentJsonKind, string> = {
  workflow: 'Forge: Workflow Create',
  task: 'Forge: Task Create',
  schema: 'Forge: Schema Create',
  view: 'Forge: View Create',
  function: 'Forge: Function Create',
  extension: 'Forge: Extension Create',
};

/**
 * Web FileTree’deki satır-içi isim gibi: Quick Input, Explorer’da hedef klasöre fokus.
 * VS Code Explorer ağaçta yerleşik text edit açmayı dışa vermez; bu en yakın entegrasyon.
 */
async function promptForgeNewComponentName(
  resource: vscode.Uri | undefined,
  folderPath: string,
  expectedKind: VnextComponentJsonKind,
): Promise<string | undefined> {
  if (resource) {
    try {
      await vscode.commands.executeCommand('revealInExplorer', resource);
    } catch {
      try {
        await vscode.commands.executeCommand('workbench.view.explorer');
      } catch {
        // ignore
      }
    }
  }

  const workspaceFolder = vscode.workspace.getWorkspaceFolder(vscode.Uri.file(folderPath));
  const relHint =
    workspaceFolder != null
      ? path.relative(workspaceFolder.uri.fsPath, folderPath) || path.basename(folderPath)
      : folderPath;

  return new Promise((resolve) => {
    const ib = vscode.window.createInputBox();
    let resolved = false;
    const finish = (value: string | undefined) => {
      if (resolved) return;
      resolved = true;
      ib.hide();
      ib.dispose();
      resolve(value);
    };

    ib.title = FORGE_CREATE_TITLE[expectedKind];
    ib.description = relHint;
    ib.placeholder = expectedKind === 'workflow' ? 'workflow-name' : 'name or name.json (optional .json)';

    const validate = (raw: string): string | undefined => {
      const t = raw.trim();
      if (t.length === 0) return undefined;
      if (expectedKind === 'workflow') {
        if (t.toLowerCase().endsWith('.json')) {
          return 'Workflow name must not include .json';
        }
        return getWorkspaceNameError(raw, 'workflow') ?? undefined;
      }
      const fileName = ensureComponentJsonFileName(raw);
      if (!fileName) {
        return 'Name is required';
      }
      return getWorkspaceNameError(fileName, 'file') ?? undefined;
    };

    let accepted = false;
    ib.onDidChangeValue((v) => {
      const err = validate(v);
      ib.validationMessage = err;
    });
    ib.onDidAccept(() => {
      const t = ib.value.trim();
      if (t.length === 0) {
        ib.validationMessage = 'Name is required.';
        return;
      }
      const err = validate(ib.value);
      if (err) {
        ib.validationMessage = err;
        return;
      }
      accepted = true;
      finish(ib.value);
    });
    ib.onDidHide(() => {
      if (!accepted) {
        finish(undefined);
      }
    });
    ib.show();
  });
}

async function forgeComponentCreateByKind(
  resource: vscode.Uri | undefined,
  deps: CommandDeps,
  expectedKind: VnextComponentJsonKind,
): Promise<void> {
  let folderPath = getExplorerFolderTarget(resource);
  let root: VnextWorkspaceRoot | undefined;
  let config: VnextWorkspaceConfig;

  if (folderPath) {
    root = deps.detector.findOwningRoot(folderPath);
    if (!root) {
      void vscode.window.showErrorMessage('vnext-forge: Not inside a vNext workspace.');
      return;
    }
    const status = await deps.workspaceService.readConfigStatus(root.folderPath);
    if (status.status !== 'ok') {
      void vscode.window.showErrorMessage('vnext-forge: vnext.config.json is not valid.');
      return;
    }
    config = status.config;
    const relPaths = buildComponentFolderRelPaths(config.paths);
    const c = classifyComponentTreePath(folderPath, root.folderPath, relPaths);
    if (!c) {
      void vscode.window.showErrorMessage(
        'vnext-forge: Use a component folder (e.g. Extensions, Tasks/your-group), not a nested subfolder (e.g. src).',
      );
      return;
    }
    if (c.componentKind !== expectedKind) {
      void vscode.window.showErrorMessage(
        'vnext-forge: This command does not match the selected folder type.',
      );
      return;
    }
  } else {
    const roots = deps.detector.getRoots();
    if (roots.length === 0) {
      void vscode.window.showErrorMessage('vnext-forge: Open a folder containing vnext.config.json first.');
      return;
    }
    root = roots.length === 1 ? roots[0] : await pickWorkspaceRoot(roots);
    if (!root) return;
    const status = await deps.workspaceService.readConfigStatus(root.folderPath);
    if (status.status !== 'ok') {
      void vscode.window.showErrorMessage('vnext-forge: vnext.config.json is not valid.');
      return;
    }
    config = status.config;
    const kindFolderAbs = path.resolve(
      root.folderPath,
      config.paths.componentsRoot,
      pathSegmentForKind(config, expectedKind as ComponentKind),
    );
    const group = await pickGroup(kindFolderAbs);
    if (group === undefined) return;
    folderPath = group === '' ? kindFolderAbs : path.join(kindFolderAbs, group);
    await fs.mkdir(folderPath, { recursive: true });
  }

  const domain = config.domain;
  const name = await promptForgeNewComponentName(resource, folderPath, expectedKind);
  if (name == null || !name.trim()) {
    return;
  }

  let createdFilePath: string;
  let fileBase: string;

  try {
    if (expectedKind === 'workflow') {
      if (/\.json$/i.test(name.trim())) {
        void vscode.window.showErrorMessage('vnext-forge: Workflow name should not include .json.');
        return;
      }
      fileBase = name.trim();
      createdFilePath = await writeWorkflowScaffoldToDisk(folderPath, fileBase, domain);
    } else {
      const fileName = ensureComponentJsonFileName(name);
      if (!fileName) {
        void vscode.window.showErrorMessage('vnext-forge: Name is required.');
        return;
      }
      const nameErr = getWorkspaceNameError(fileName, 'file');
      if (nameErr) {
        void vscode.window.showErrorMessage(`vnext-forge: ${nameErr}`);
        return;
      }
      fileBase = fileName.replace(/\.json$/i, '');
      const target = path.join(folderPath, fileName);
      try {
        await fs.access(target);
        void vscode.window.showErrorMessage('vnext-forge: File already exists.');
        return;
      } catch {
        // ok
      }
      const body = buildVnextComponentJson(expectedKind, { key: fileBase, domain });
      await fs.writeFile(target, JSON.stringify(body, null, 2), 'utf-8');
      createdFilePath = target;
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    void vscode.window.showErrorMessage(`vnext-forge: ${msg}`);
    return;
  }

  await openOrRefreshProjectForRoot(deps, root);

  const kindFolderAbs = path.resolve(
    root.folderPath,
    config.paths.componentsRoot,
    pathSegmentForKind(config, expectedKind as ComponentKind),
  );
  const relToKindFolder = path.relative(kindFolderAbs, folderPath).split(path.sep).join('/');
  const group = relToKindFolder === '.' || relToKindFolder === '' ? '' : relToKindFolder;

  deps.designerPanel.openEditor({
    type: 'open-editor',
    kind: expectedKind as ComponentKind,
    projectId: domain,
    projectPath: root.folderPath,
    projectDomain: domain,
    group,
    name: fileBase,
    filePath: createdFilePath,
    vnextConfig: config,
  });
}

async function openOrRefreshProjectForRoot(
  deps: CommandDeps,
  root: VnextWorkspaceRoot,
): Promise<void> {
  try {
    await deps.projectService.importProject(root.folderPath);
  } catch (err) {
    baseLogger.warn({ error: (err as Error).message, folder: root.folderPath }, 'importProject failed');
  }
}
