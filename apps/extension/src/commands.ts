import * as vscode from 'vscode'
import * as path from 'node:path'
import * as fs from 'node:fs/promises'
import type { ProjectService, WorkspaceService, VnextWorkspaceConfig } from '@vnext-forge/services-core'
import { baseLogger } from './shared/logger.js'
import { markUriSkipComponentDesignerAutoOpen } from './component-json-auto-open.js'
import { isDesignerEditorRoute, resolveProjectForRoot } from './designer-helpers.js'
import { resolveFileRoute } from './file-router.js'
import type { VnextWorkspaceDetector, VnextWorkspaceRoot } from './workspace-detector.js'
import type { DesignerEditorKind, DesignerPanel } from './panels/DesignerPanel.js'

interface CommandDeps {
  projectService: ProjectService
  workspaceService: WorkspaceService
  detector: VnextWorkspaceDetector
  designerPanel: DesignerPanel
}

/** Register all VS Code commands for vnext-forge. */
export function registerCommands(
  context: vscode.ExtensionContext,
  deps: CommandDeps,
): void {
  context.subscriptions.push(
    vscode.commands.registerCommand('vnextForge.open', () => openCommand(deps)),
    vscode.commands.registerCommand('vnextForge.openDesigner', (uri?: vscode.Uri) =>
      openDesignerCommand(uri, deps),
    ),
    vscode.commands.registerCommand('vnextForge.openInTextEditor', (uri?: vscode.Uri) =>
      openInTextEditorCommand(uri, deps),
    ),
    vscode.commands.registerCommand('vnextForge.createProject', () => createProjectCommand(deps)),
    vscode.commands.registerCommand('vnextForge.createComponent', () => createComponentCommand(deps)),
  )
}

// ── vnextForge.open ───────────────────────────────────────────────────────────

function openCommand({ designerPanel }: CommandDeps): void {
  designerPanel.openOrRevealEmpty()
}

// ── vnextForge.openDesigner ──────────────────────────────────────────────────

async function openDesignerCommand(uri: vscode.Uri | undefined, deps: CommandDeps): Promise<void> {
  const targetUri = uri ?? vscode.window.activeTextEditor?.document.uri
  if (!targetUri) {
    void vscode.window.showWarningMessage('vnext-forge: No file selected to open in the designer.')
    return
  }

  const target = targetUri.fsPath
  const root = deps.detector.findOwningRoot(target)
  if (!root) {
    void vscode.window.showWarningMessage(
      'vnext-forge: The selected file is not inside a vnext workspace (no vnext.config.json found).',
    )
    return
  }

  const projectInfo = await resolveProjectForRoot(root, deps.workspaceService, deps.projectService)
  if (!projectInfo) return

  const route = resolveFileRoute(target, projectInfo.config, root.folderPath)

  // Files that don't map to a designer editor (vnext.config.json, generic
  // source files) are opened in VS Code's native editor — the webview only
  // hosts the structured component editors. This keeps the extension feeling
  // like a VS Code integration rather than a web app embedded inside VS Code.
  if (!isDesignerEditorRoute(route)) {
    try {
      const document = await vscode.workspace.openTextDocument(targetUri)
      await vscode.window.showTextDocument(document, { preview: false })
    } catch (error) {
      baseLogger.warn(
        { target, error: (error as Error).message },
        'Failed to open file in native editor',
      )
    }
    return
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
  })
}

// ── vnextForge.openInTextEditor ─────────────────────────────────────────────

/** Bileşen yollarındaki .json (veya herhangi bir dosya) VS Code metin editöründe, tasarımcıyı atlayarak. */
async function openInTextEditorCommand(uri: vscode.Uri | undefined, deps: CommandDeps): Promise<void> {
  const targetUri = uri ?? vscode.window.activeTextEditor?.document.uri
  if (!targetUri) {
    void vscode.window.showWarningMessage('vnext-forge: No file selected to open in the text editor.')
    return
  }

  markUriSkipComponentDesignerAutoOpen(targetUri)

  try {
    const document = await vscode.workspace.openTextDocument(targetUri)
    await vscode.window.showTextDocument(document, { preview: false })
  } catch (error) {
    baseLogger.warn(
      { path: targetUri.fsPath, error: (error as Error).message },
      'Failed to open file in native text editor',
    )
  }
}

// ── vnextForge.createProject ─────────────────────────────────────────────────

async function createProjectCommand({ projectService, detector }: CommandDeps): Promise<void> {
  const domain = await vscode.window.showInputBox({
    title: 'Create vnext Project',
    prompt: 'Domain name (used as project id)',
    placeHolder: 'my-domain',
    validateInput: (value) => {
      const trimmed = value.trim()
      if (!trimmed) return 'Domain name is required'
      if (!/^[a-zA-Z0-9][a-zA-Z0-9._-]*$/.test(trimmed)) {
        return 'Use letters, digits, ".", "_" or "-" (must start with a letter or digit)'
      }
      return null
    },
    ignoreFocusOut: true,
  })
  if (!domain) return

  const description = await vscode.window.showInputBox({
    title: 'Create vnext Project',
    prompt: 'Description (optional)',
    ignoreFocusOut: true,
  })

  const defaultUri = vscode.workspace.workspaceFolders?.[0]?.uri
  const targetUris = await vscode.window.showOpenDialog({
    title: 'Select target folder for the new project',
    canSelectFolders: true,
    canSelectFiles: false,
    canSelectMany: false,
    defaultUri,
    openLabel: 'Create Here',
  })
  if (!targetUris || targetUris.length === 0) return
  const targetPath = targetUris[0].fsPath

  try {
    const project = await vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Notification,
        title: `Creating vnext project "${domain.trim()}"…`,
      },
      () =>
        projectService.createProject(domain.trim(), description?.trim() ?? undefined, targetPath),
    )

    await detector.refresh()

    const action = await vscode.window.showInformationMessage(
      `vnext-forge: Project "${project.domain}" created at ${project.path}.`,
      'Open in New Window',
      'Add to Workspace',
    )

    if (action === 'Open in New Window') {
      await vscode.commands.executeCommand('vscode.openFolder', vscode.Uri.file(project.path), true)
    } else if (action === 'Add to Workspace') {
      const start = vscode.workspace.workspaceFolders?.length ?? 0
      vscode.workspace.updateWorkspaceFolders(start, 0, { uri: vscode.Uri.file(project.path) })
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    baseLogger.error({ domain, message }, 'Failed to create vnext project')
    void vscode.window.showErrorMessage(`vnext-forge: Failed to create project. ${message}`)
  }
}

// ── vnextForge.createComponent ───────────────────────────────────────────────

type ComponentKind = DesignerEditorKind

const COMPONENT_KINDS: { kind: ComponentKind; label: string; description: string }[] = [
  { kind: 'workflow', label: 'Workflow', description: 'Flow / SubFlow / Core definition' },
  { kind: 'task', label: 'Task', description: 'Reusable task (Http / Script / Dapr / ...)' },
  { kind: 'schema', label: 'Schema', description: 'JSON schema definition' },
  { kind: 'view', label: 'View', description: 'UI view binding' },
  { kind: 'function', label: 'Function', description: 'Scripted function' },
  { kind: 'extension', label: 'Extension', description: 'Extension definition' },
]

function pathSegmentForKind(config: VnextWorkspaceConfig, kind: ComponentKind): string {
  switch (kind) {
    case 'workflow':
      return config.paths.workflows
    case 'task':
      return config.paths.tasks
    case 'schema':
      return config.paths.schemas
    case 'view':
      return config.paths.views
    case 'function':
      return config.paths.functions
    case 'extension':
      return config.paths.extensions
  }
}

async function createComponentCommand(deps: CommandDeps): Promise<void> {
  const { detector, workspaceService, designerPanel } = deps
  const roots = detector.getRoots()
  if (roots.length === 0) {
    void vscode.window.showWarningMessage(
      'vnext-forge: Open a folder containing vnext.config.json first.',
    )
    return
  }

  const root = roots.length === 1 ? roots[0] : await pickWorkspaceRoot(roots)
  if (!root) return

  const status = await workspaceService.readConfigStatus(root.folderPath)
  if (status.status !== 'ok') {
    void vscode.window.showWarningMessage(
      `vnext-forge: vnext.config.json in ${path.basename(root.folderPath)} is not valid.`,
    )
    return
  }
  const config = status.config

  const pickedKind = await vscode.window.showQuickPick(
    COMPONENT_KINDS.map((k) => ({ label: k.label, description: k.description, componentKind: k.kind })),
    { title: 'Create vnext Component', placeHolder: 'Select component type' },
  )
  if (!pickedKind) return

  const kind: ComponentKind = pickedKind.componentKind
  const kindLabel = pickedKind.label
  const kindFolderAbs = path.resolve(
    root.folderPath,
    config.paths.componentsRoot,
    pathSegmentForKind(config, kind),
  )

  const group = await pickGroup(kindFolderAbs)
  if (group === undefined) return

  const key = await vscode.window.showInputBox({
    title: `Create ${kindLabel}`,
    prompt: 'Component key (file name without extension)',
    placeHolder: 'my-component',
    validateInput: (value) => {
      const trimmed = value.trim()
      if (!trimmed) return 'Key is required'
      if (!/^[a-zA-Z0-9][a-zA-Z0-9._-]*$/.test(trimmed)) {
        return 'Use letters, digits, ".", "_" or "-" (must start with a letter or digit)'
      }
      return null
    },
    ignoreFocusOut: true,
  })
  if (!key) return
  const keyTrimmed = key.trim()

  const targetDir = group === '' ? kindFolderAbs : path.join(kindFolderAbs, group)
  const targetFile = path.join(targetDir, `${keyTrimmed}.json`)

  try {
    await fs.access(targetFile)
    void vscode.window.showErrorMessage(`vnext-forge: ${path.basename(targetFile)} already exists.`)
    return
  } catch {
    // expected ENOENT
  }

  const stub = buildComponentStub(kind, keyTrimmed, config.domain)

  try {
    await fs.mkdir(targetDir, { recursive: true })
    await fs.writeFile(targetFile, JSON.stringify(stub, null, 2), 'utf-8')
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    void vscode.window.showErrorMessage(`vnext-forge: Failed to write component file. ${message}`)
    return
  }

  baseLogger.info({ targetFile, kind }, 'vnext component created')

  try {
    await deps.projectService.importProject(root.folderPath)
  } catch (error) {
    baseLogger.warn(
      { folder: root.folderPath, error: (error as Error).message },
      'Failed to link project registry entry after component creation',
    )
  }

  designerPanel.openEditor({
    type: 'open-editor',
    kind,
    projectId: config.domain,
    projectPath: root.folderPath,
    projectDomain: config.domain,
    group,
    name: keyTrimmed,
    filePath: targetFile,
    vnextConfig: config,
  })
}

async function pickWorkspaceRoot(
  roots: readonly VnextWorkspaceRoot[],
): Promise<VnextWorkspaceRoot | undefined> {
  const picked = await vscode.window.showQuickPick(
    roots.map((r) => ({ label: path.basename(r.folderPath), description: r.folderPath, root: r })),
    { title: 'Select vnext workspace', placeHolder: 'Workspace root' },
  )
  return picked?.root
}

async function pickGroup(kindFolderAbs: string): Promise<string | undefined> {
  const existing = await listSubdirectories(kindFolderAbs)
  const createNewLabel = '$(add) Create new group…'
  const rootLabel = '$(root-folder) (no group — place at root)'

  const items: (vscode.QuickPickItem & { group?: string; isCreate?: boolean })[] = [
    { label: rootLabel, group: '' },
    ...existing.map((name) => ({ label: name, group: name })),
    { label: createNewLabel, isCreate: true },
  ]

  const picked = await vscode.window.showQuickPick(items, {
    title: 'Select group folder',
    placeHolder: 'Choose an existing group or create a new one',
  })
  if (!picked) return undefined

  if (picked.isCreate) {
    const name = await vscode.window.showInputBox({
      title: 'New group folder',
      prompt: 'Group folder name (relative to the component type directory)',
      validateInput: (value) => {
        const trimmed = value.trim()
        if (!trimmed) return 'Name is required'
        if (/[\\/]/.test(trimmed)) return 'Do not include path separators'
        if (!/^[a-zA-Z0-9][a-zA-Z0-9._-]*$/.test(trimmed)) {
          return 'Use letters, digits, ".", "_" or "-" (must start with a letter or digit)'
        }
        return null
      },
      ignoreFocusOut: true,
    })
    if (!name) return undefined
    return name.trim()
  }

  return picked.group ?? ''
}

async function listSubdirectories(dir: string): Promise<string[]> {
  try {
    const entries = await fs.readdir(dir, { withFileTypes: true })
    return entries
      .filter((e) => e.isDirectory() && !e.name.startsWith('.') && e.name !== 'node_modules')
      .map((e) => e.name)
      .sort((a, b) => a.localeCompare(b))
  } catch {
    return []
  }
}

// ── Component stubs ───────────────────────────────────────────────────────────

function buildComponentStub(kind: ComponentKind, key: string, domain: string): Record<string, unknown> {
  const base = {
    key,
    flow: `sys-${kind}`,
    domain,
    version: '1.0.0',
    tags: [],
  }

  switch (kind) {
    case 'workflow':
      return {
        ...base,
        flow: 'sys-workflow',
        attributes: {
          type: 'F',
          subFlowType: 'S',
          timeout: { key: '', domain, flow: '', version: '' },
          states: [],
        },
      }
    case 'task':
      return {
        ...base,
        flow: 'sys-task',
        attributes: {
          type: 5,
          executionTimeout: 30,
          config: {},
        },
      }
    case 'schema':
      return {
        ...base,
        flow: 'sys-schema',
        attributes: {
          schema: {
            $schema: 'http://json-schema.org/draft-07/schema#',
            type: 'object',
            properties: {},
          },
        },
      }
    case 'view':
      return {
        ...base,
        flow: 'sys-view',
        attributes: {
          type: 'Json',
          display: 'full-page',
          content: {},
        },
      }
    case 'function':
      return {
        ...base,
        flow: 'sys-function',
        attributes: {
          scope: 'F',
          task: { key: '', domain, flow: '', version: '' },
        },
      }
    case 'extension':
      return {
        ...base,
        flow: 'sys-extension',
        attributes: {
          type: 1,
          task: { key: '', domain, flow: '', version: '' },
        },
      }
  }
}
