import * as path from 'path';
import * as vscode from 'vscode';

import { registerCommands } from './commands.js';
import { VnextComponentCustomTextEditorProvider } from './vnext-component-custom-text-editor.js';
import { createExtensionHostLspStack } from './composition/lsp.js';
import { composeExtensionServices } from './composition/services.js';
import { bootstrapLsp } from './lsp-bootstrap.js';
import { createNativeCsxLanguageClient } from './lsp/native-csx-language-client.js';
import { createCsxSyncController } from './csx-sync/CsxSyncController.js';
import { CsxJsonHoverProvider } from './csx-sync/CsxJsonHoverProvider.js';
import { MessageRouter } from './MessageRouter.js';
import { createVsCodeOutputChannelLogger } from './adapters/vscode-output-channel-logger.js';
import { baseLogger } from './shared/logger.js';
import { DesignerPanel } from './panels/DesignerPanel.js';
import { publishWorkflowFile } from './lib/publishWorkflowFile.js';
import { QuickRunPanel } from './panels/QuickRunPanel.js';
import { FunctionQuickRunPanel } from './panels/FunctionQuickRunPanel.js';
import { toFunctionMetadataFormValues } from '@vnext-forge-studio/designer-ui/function-editor-schema';
import { VnextWorkspaceDetector, type VnextWorkspaceRoot } from './workspace-detector.js';
import {
  applyMaterialIconAssociationsIfApplicable,
  removeMaterialIconAssociations,
  resolveConfigsForMaterial,
} from './material-icon-associations.js';
import { clearRemovedFileIconThemeIfSet } from './stale-file-icon-theme.js';
import { ForgeToolsSettingsService } from './tools/forge-tools-settings.js';
import { ForgeTerminalManager } from './tools/forge-terminal.js';
import { EnvironmentHealthMonitor } from './tools/environment-health-monitor.js';
import { EnvironmentStatusBar, switchEnvironmentQuickPick } from './tools/environment-status-bar.js';
import { GlobalSettingsProvider } from './tools/providers/global-settings-provider.js';
import { ProjectActionsProvider } from './tools/providers/project-actions-provider.js';
import { CreateProjectProvider } from './tools/providers/create-project-provider.js';
import { EnvironmentsProvider } from './tools/providers/environments-provider.js';
import { PackageDeployProvider } from './tools/providers/package-deploy-provider.js';
import { QuickRunProvider } from './tools/providers/quickrun-provider.js';
import { LocalRuntimeService } from './tools/local-runtime/local-runtime.service.js';

/**
 * vnext-forge-studio extension entry point. Composes the shared `services-core` +
 * `lsp-core` packages with VS Code-specific adapters (workspace root
 * resolver, OutputChannel logger, webview `postMessage` transport) and wires
 * the resulting services to commands and the webview `MessageRouter`.
 *
 * LSP / OmniSharp lifecycle owner: `createExtensionHostLspStack` in
 * `@vnext-forge-studio/lsp-core` constructs the single shared `OmniSharpInstaller` and
 * `LspBridge`. The extension only re-exports that factory from
 * `composition/lsp.ts` and passes the same installer into `bootstrapLsp` for
 * background pre-download — there is no second installer factory in the
 * extension host (R-b8).
 */
/**
 * Narrow a command argument to a `vscode.Uri`.
 *
 * Commands wrapped in `safeAsync` receive `unknown[]`, because that is what a
 * command invocation can actually carry: the Explorer context menu passes the
 * resource, but the same command id reached from the palette or from
 * `executeCommand` passes nothing. Annotating the parameter as `vscode.Uri`
 * instead of narrowing is unsound — and would let `uri.fsPath` throw on
 * whatever else a caller supplied.
 */
function asUri(value: unknown): vscode.Uri | undefined {
  return value instanceof vscode.Uri ? value : undefined;
}

async function readWorkflowJson(uri: vscode.Uri): Promise<
  | {
      domain: string;
      workflowKey: string;
      startSchemaRef?: {
        key: string;
        version: string;
        flow?: string;
        domain?: string;
      };
    }
  | undefined
> {
  try {
    const bytes = await vscode.workspace.fs.readFile(uri);
    const json = JSON.parse(Buffer.from(bytes).toString('utf-8')) as Record<string, unknown>;
    const domain = typeof json.domain === 'string' ? json.domain : '';
    const workflowKey = typeof json.key === 'string' ? json.key : '';
    if (!domain || !workflowKey) {
      void vscode.window.showWarningMessage('Workflow file is missing "domain" or "key" fields.');
      return undefined;
    }

    // Extract `attributes.startTransition.schema` reference so the
    // QuickRun NewRunDialog can fire `test-data/generateForSchemaReference`
    // for faker-driven auto-fill. Mirrors `apps/web/QuickRunPage.tsx`.
    let startSchemaRef: { key: string; version: string; flow?: string; domain?: string } | undefined;
    const attrs = json.attributes;
    if (attrs && typeof attrs === 'object') {
      const start = (attrs as { startTransition?: unknown }).startTransition;
      if (start && typeof start === 'object') {
        const schema = (start as { schema?: unknown }).schema;
        if (schema && typeof schema === 'object') {
          const ref = schema as Record<string, unknown>;
          if (typeof ref.key === 'string' && typeof ref.version === 'string') {
            startSchemaRef = {
              key: ref.key,
              version: ref.version,
              ...(typeof ref.flow === 'string' ? { flow: ref.flow } : {}),
              ...(typeof ref.domain === 'string' ? { domain: ref.domain } : {}),
            };
          }
        }
      }
    }

    return {
      domain,
      workflowKey,
      ...(startSchemaRef ? { startSchemaRef } : {}),
    };
  } catch {
    void vscode.window.showWarningMessage('Failed to read workflow JSON file.');
    return undefined;
  }
}

async function readFunctionJson(uri: vscode.Uri): Promise<
  | {
      domain: string;
      functionKey: string;
      scope: 'D' | 'F' | 'I';
    }
  | undefined
> {
  try {
    const bytes = await vscode.workspace.fs.readFile(uri);
    const json = JSON.parse(Buffer.from(bytes).toString('utf-8')) as Record<string, unknown>;
    // Same normalization `FunctionEditorView`'s in-editor runner uses:
    // `attributes.scope` falls back to `scope`, defaulting to `'I'`. Imported
    // from designer-ui's pure (no-React) `function-editor-schema` subpath so
    // the extension host doesn't need to duplicate this logic or pull the
    // full React barrel into the esbuild-bundled host.
    const values = toFunctionMetadataFormValues(json);
    if (!values.domain || !values.key) {
      void vscode.window.showWarningMessage('Function file is missing "domain" or "key" fields.');
      return undefined;
    }
    return { domain: values.domain, functionKey: values.key, scope: values.scope };
  } catch {
    void vscode.window.showWarningMessage('Failed to read function JSON file.');
    return undefined;
  }
}

export async function activate(context: vscode.ExtensionContext): Promise<void> {
  baseLogger.info({}, 'vnext-forge-studio activating');

  const clearedStaleIconTheme = await clearRemovedFileIconThemeIfSet();
  if (clearedStaleIconTheme) {
    void vscode.window.showInformationMessage(
      'vNext Forge: Removed stale file icon theme (vnext-forge-icons) from settings. For folder icons, use Command Palette → "Preferences: File Icon Theme" → Material Icon Theme.',
      'OK',
    );
  }

  const outputChannel = vscode.window.createOutputChannel('vnext-forge-studio-core');
  context.subscriptions.push(outputChannel);
  const loggerAdapter = createVsCodeOutputChannelLogger(outputChannel);

  // Dedicated channel for webview-side designer-ui logs forwarded via the
  // `host:log` postMessage tunnel. Keeping it separate from the core channel
  // makes it trivial to filter "what happened in the editor UI" vs "what
  // happened in the extension host".
  const webviewLogChannel = vscode.window.createOutputChannel('vnext-forge-studio:webview');
  context.subscriptions.push(webviewLogChannel);

  const forgeToolsSettings = new ForgeToolsSettingsService(context.globalStorageUri);
  context.subscriptions.push(forgeToolsSettings);

  const { services, registry } = composeExtensionServices(loggerAdapter, forgeToolsSettings);
  const { bridge: lspBridge, installer: lspInstaller } = createExtensionHostLspStack(loggerAdapter);

  const diagnosticCollection = vscode.languages.createDiagnosticCollection('vnext-forge-studio');
  context.subscriptions.push(diagnosticCollection);

  const statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 50);
  statusBarItem.text = '$(loading~spin) vNext Forge';
  statusBarItem.tooltip = 'vNext Forge: Initializing...';
  statusBarItem.show();
  context.subscriptions.push(statusBarItem);

  const forgeTerminal = new ForgeTerminalManager();
  context.subscriptions.push(forgeTerminal);

  const router = new MessageRouter({
    registry,
    services,
    lspBridge,
    logger: loggerAdapter,
    webviewLogChannel,
    diagnosticCollection,
    statusBarItem,
    terminal: forgeTerminal,
  });
  const designerPanel = new DesignerPanel(context, router);

  const detector = new VnextWorkspaceDetector(services.workspaceService);
  context.subscriptions.push(detector);

  // Native VS Code editor LSP client for .csx files. Reuses the same
  // `lspBridge` (and thus the same OmniSharp/csharp-ls + temp workspace +
  // BBT.Workflow.Domain setup) as the designer Monaco webview, but talks to
  // the workbench TextEditor through the native `vscode-languageclient`. The
  // client only attaches when the workspace contains `vnext.config.json` and
  // can be opted out via `vnextForge.lsp.enableNativeEditor`.
  const csxNativeLspChannel = vscode.window.createOutputChannel('vnext-forge-studio:csx-native-lsp');
  context.subscriptions.push(csxNativeLspChannel);
  context.subscriptions.push(
    createNativeCsxLanguageClient({
      lspBridge,
      workspaceDetector: detector,
      logger: loggerAdapter,
      outputChannel: csxNativeLspChannel,
    }),
  );

  // ── CSX → component JSON auto-sync ───────────────────────────────────────
  // Replaces the standalone `burgan-tech/csx-json-sync` extension by
  // listening for `.csx` saves inside a vNext workspace and writing the
  // encoded body back into every component JSON whose `attributes.location`
  // resolves to that file. Also registers a JSON hover provider that
  // decodes the `code` field per its sibling `encoding`.
  const csxSyncController = createCsxSyncController({
    detector,
    workspaceService: services.workspaceService,
  });
  csxSyncController.activate(context);
  context.subscriptions.push(
    vscode.languages.registerHoverProvider(
      { language: 'json', scheme: 'file' },
      new CsxJsonHoverProvider(outputChannel),
    ),
  );

  // ── Forge Tools Sidebar ──────────────────────────────────────────────────

  // Pre-load settings so DesignerPanel can inject them synchronously
  await forgeToolsSettings.loadSettings();
  await forgeToolsSettings.loadEnvironments();
  // Also pre-load Quick Run settings (`globalHeaders`) so DesignerPanel can
  // inject them into the in-editor Function Run panel synchronously too —
  // see `getCachedQuickRunSettings()`.
  await forgeToolsSettings.loadQuickRunSettings();

  designerPanel.setForgeToolsSettings(forgeToolsSettings);

  const healthMonitor = new EnvironmentHealthMonitor(forgeToolsSettings);
  context.subscriptions.push(healthMonitor);

  const quickRunPanel = new QuickRunPanel(context, router, forgeToolsSettings, healthMonitor);
  context.subscriptions.push({ dispose: () => quickRunPanel.dispose() });

  const functionQuickRunPanel = new FunctionQuickRunPanel(context, router, forgeToolsSettings);
  context.subscriptions.push({ dispose: () => functionQuickRunPanel.dispose() });

  const envStatusBar = new EnvironmentStatusBar(forgeToolsSettings, healthMonitor);
  context.subscriptions.push(envStatusBar);

  const globalSettingsProvider = new GlobalSettingsProvider(forgeToolsSettings);
  const projectActionsProvider = new ProjectActionsProvider(detector, forgeTerminal);
  const createProjectProvider = new CreateProjectProvider(detector, forgeTerminal);
  const localRuntimeService = new LocalRuntimeService(outputChannel);
  const environmentsProvider = new EnvironmentsProvider(
    forgeToolsSettings,
    healthMonitor,
    services.cliService
      ? (params) => services.cliService!.domainAdd(params)
      : undefined,
    detector,
    // Read the workspace domain from `vnext.config.json` through the
    // shared services-core accessor so this stays in sync with every
    // other consumer (LSP, template scaffolding, runtime proxy, etc).
    async (root) => {
      const config = await services.workspaceService.getConfig(root.folderPath);
      return config.domain ?? '';
    },
    localRuntimeService,
    () => outputChannel.show(true),
    (command, cwd) => forgeTerminal.run(command, { cwd }),
    // The remaining `wf domain` verbs. Wired as a group with `domainAdd`
    // above: together they let the provider replace a stale registration and
    // verify the result, instead of a single `add` that cannot be checked.
    services.cliService ? () => services.cliService!.domainList() : undefined,
    services.cliService ? (name) => services.cliService!.domainRemove(name) : undefined,
    services.cliService ? (name) => services.cliService!.domainUse(name) : undefined,
  );
  const packageDeployProvider = new PackageDeployProvider(detector, forgeTerminal);
  const quickRunProvider = new QuickRunProvider();

  context.subscriptions.push(
    vscode.window.createTreeView('vnextForge.tools.globalSettings', {
      treeDataProvider: globalSettingsProvider,
      showCollapseAll: false,
    }),
    vscode.window.createTreeView('vnextForge.tools.project', {
      treeDataProvider: projectActionsProvider,
    }),
    vscode.window.createTreeView('vnextForge.tools.createProject', {
      treeDataProvider: createProjectProvider,
    }),
    vscode.window.createTreeView('vnextForge.tools.environments', {
      treeDataProvider: environmentsProvider,
    }),
    vscode.window.createTreeView('vnextForge.tools.packageDeploy', {
      treeDataProvider: packageDeployProvider,
    }),
    vscode.window.createTreeView('vnextForge.tools.quickRun', {
      treeDataProvider: quickRunProvider,
    }),
  );

  // Sidebar commands — wrapped to prevent unhandled rejections.
  //
  // Accepts sync handlers as well as async ones. Invoking `fn` inside a `.then`
  // is what makes that safe: it turns a *synchronous* throw into a rejection
  // too, so a handler that fails before its first `await` is reported the same
  // way as one that fails after — with `fn(...args).catch(...)` the sync throw
  // escaped the wrapper entirely. A returned promise is flattened by `.then`,
  // and a handler with nothing to await need not be declared `async` just to
  // satisfy this signature.
  const safeAsync = (fn: (...args: unknown[]) => unknown) =>
    (...args: unknown[]) => {
      void Promise.resolve().then(() => fn(...args)).catch((err: unknown) => {
        const msg = err instanceof Error ? err.message : String(err);
        baseLogger.error({ error: msg }, 'Forge Tools command failed');
        void vscode.window.showErrorMessage(`vnext-forge-studio: ${msg}`);
      });
    };

  context.subscriptions.push(
    vscode.commands.registerCommand('vnextForge.tools.changeSetting', safeAsync((settingId) =>
      globalSettingsProvider.handleChangeSetting(settingId as Parameters<typeof globalSettingsProvider.handleChangeSetting>[0]),
    )),
    vscode.commands.registerCommand('vnextForge.tools.validateProject', () =>
      projectActionsProvider.runAction('validate'),
    ),
    vscode.commands.registerCommand('vnextForge.tools.buildRuntime', () =>
      projectActionsProvider.runAction('buildRuntime'),
    ),
    vscode.commands.registerCommand('vnextForge.tools.buildReference', () =>
      projectActionsProvider.runAction('buildReference'),
    ),
    vscode.commands.registerCommand('vnextForge.tools.generateDocs', safeAsync(() =>
      projectActionsProvider.runAction('generateDocs'),
    )),
    vscode.commands.registerCommand('vnextForge.tools.createProjectFromSidebar', safeAsync(() =>
      createProjectProvider.createProject(),
    )),
    vscode.commands.registerCommand('vnextForge.tools.addEnvironment', safeAsync(() =>
      environmentsProvider.addEnvironment(),
    )),
    vscode.commands.registerCommand('vnextForge.tools.editEnvironment', safeAsync((envId) =>
      environmentsProvider.editEnvironment(envId as string),
    )),
    vscode.commands.registerCommand('vnextForge.tools.deleteEnvironment', safeAsync((envId) =>
      environmentsProvider.deleteEnvironment(envId as string),
    )),
    vscode.commands.registerCommand('vnextForge.tools.setActiveEnvironment', safeAsync((envId) =>
      environmentsProvider.setActiveEnvironment(envId as string),
    )),
    vscode.commands.registerCommand('vnextForge.tools.startEnvironment', safeAsync((envId) =>
      environmentsProvider.startEnvironment(envId as string),
    )),
    vscode.commands.registerCommand('vnextForge.tools.stopEnvironment', safeAsync((envId) =>
      environmentsProvider.stopEnvironment(envId as string),
    )),
    vscode.commands.registerCommand('vnextForge.tools.restartEnvironment', safeAsync((envId) =>
      environmentsProvider.restartEnvironment(envId as string),
    )),
    vscode.commands.registerCommand('vnextForge.tools.updateRuntime', safeAsync((envId) =>
      environmentsProvider.updateRuntime(envId as string),
    )),
    vscode.commands.registerCommand('vnextForge.tools.registerCliDomain', safeAsync((envId) =>
      environmentsProvider.registerCliDomain(envId as string),
    )),
    vscode.commands.registerCommand('vnextForge.tools.resetComponents', safeAsync((envId) =>
      environmentsProvider.resetComponents(envId as string),
    )),
    vscode.commands.registerCommand('vnextForge.tools.showEnvironmentLogs', safeAsync((envId) =>
      environmentsProvider.showLogsForEnvironment(envId as string),
    )),
    vscode.commands.registerCommand('vnextForge.tools.openRuntimeFolder', safeAsync((envId) =>
      environmentsProvider.openRuntimeFolder(envId as string),
    )),
    vscode.commands.registerCommand('vnextForge.tools.revealEnvironmentPorts', safeAsync((envId) =>
      environmentsProvider.revealPorts(envId as string),
    )),
    // Shared-infrastructure commands take no argument — the infra profile is a
    // singleton, unlike the environment commands above, which are all keyed on
    // an envId supplied by the tree item. That is what lets them be exposed in
    // the command palette (see `commandPalette` in package.json).
    vscode.commands.registerCommand('vnextForge.tools.startInfrastructure', safeAsync(() =>
      environmentsProvider.startInfrastructure(),
    )),
    vscode.commands.registerCommand('vnextForge.tools.stopInfrastructure', safeAsync(() =>
      environmentsProvider.stopInfrastructure(),
    )),
    vscode.commands.registerCommand('vnextForge.tools.restartInfrastructure', safeAsync(() =>
      environmentsProvider.restartInfrastructure(),
    )),
    vscode.commands.registerCommand('vnextForge.tools.showInfrastructureLogs', safeAsync(() =>
      environmentsProvider.showInfrastructureLogs(),
    )),
    vscode.commands.registerCommand('vnextForge.tools.showInfrastructureStatus', safeAsync(() =>
      environmentsProvider.showInfrastructureStatus(),
    )),
    vscode.commands.registerCommand('vnextForge.tools.stopAllDomains', safeAsync(() =>
      environmentsProvider.stopAllDomains(),
    )),
    vscode.commands.registerCommand('vnextForge.tools.stopEverything', safeAsync(() =>
      environmentsProvider.stopEverything(),
    )),
    vscode.commands.registerCommand('vnextForge.tools.switchEnvironment', safeAsync(() =>
      switchEnvironmentQuickPick(forgeToolsSettings),
    )),
    vscode.commands.registerCommand('vnextForge.tools.checkHealth', safeAsync(async () => {
      const status = await healthMonitor.checkNow();
      void vscode.window.showInformationMessage(`vNext Forge: Environment health: ${status}`);
    })),
    vscode.commands.registerCommand('vnextForge.tools.wfUpdateAll', safeAsync(() =>
      packageDeployProvider.runDeployAction('wfUpdateAll'),
    )),
    vscode.commands.registerCommand('vnextForge.tools.wfUpdate', safeAsync(() =>
      packageDeployProvider.runDeployAction('wfUpdate'),
    )),
    vscode.commands.registerCommand('vnextForge.tools.wfCsxAll', safeAsync(() =>
      packageDeployProvider.runDeployAction('wfCsxAll'),
    )),
    vscode.commands.registerCommand('vnextForge.tools.installWfCli', safeAsync(() =>
      packageDeployProvider.runDeployAction('installWfCli'),
    )),
    vscode.commands.registerCommand('vnextForge.openQuickRun', safeAsync(async () => {
      const workflowFiles = await vscode.workspace.findFiles('**/Workflows/**/*.json', '**/node_modules/**', 50);
      if (workflowFiles.length === 0) {
        void vscode.window.showWarningMessage('No workflow files found in the workspace.');
        return;
      }
      const items = workflowFiles.map((f) => ({
        label: path.basename(f.fsPath, '.json'),
        description: vscode.workspace.asRelativePath(f),
        uri: f,
      }));
      const picked = await vscode.window.showQuickPick(items, {
        placeHolder: 'Select a workflow to run',
      });
      if (!picked) return;
      const wfJson = await readWorkflowJson(picked.uri);
      if (!wfJson) return;
      const activeEnv = await forgeToolsSettings.getActiveEnvironment();
      // The extension shell doesn't have a project picker (workspace == project),
      // so we derive a stable per-workspace projectId from the workspace
      // folder path. The backend's test-data service uses this to resolve
      // Schemas/ files relative to the workspace root.
      const projectId =
        vscode.workspace.workspaceFolders?.[0]?.uri.fsPath ?? picked.uri.fsPath;
      quickRunPanel.open({
        domain: wfJson.domain,
        workflowKey: wfJson.workflowKey,
        projectId,
        projectPath: picked.uri.fsPath,
        environmentName: activeEnv?.name,
        environmentUrl: activeEnv?.baseUrl,
        ...(wfJson.startSchemaRef ? { startSchemaRef: wfJson.startSchemaRef } : {}),
      });
    })),
    vscode.commands.registerCommand('vnextForge.openQuickRunFromFile', safeAsync(async (arg) => {
      const uri = asUri(arg);
      if (!uri) return;
      const wfJson = await readWorkflowJson(uri);
      if (!wfJson) return;
      const activeEnv = await forgeToolsSettings.getActiveEnvironment();
      const projectId =
        vscode.workspace.workspaceFolders?.[0]?.uri.fsPath ?? uri.fsPath;
      quickRunPanel.open({
        domain: wfJson.domain,
        workflowKey: wfJson.workflowKey,
        projectId,
        projectPath: uri.fsPath,
        environmentName: activeEnv?.name,
        environmentUrl: activeEnv?.baseUrl,
        ...(wfJson.startSchemaRef ? { startSchemaRef: wfJson.startSchemaRef } : {}),
      });
    })),
    vscode.commands.registerCommand('vnextForge.openFunctionQuickRun', safeAsync(async () => {
      const functionFiles = await vscode.workspace.findFiles('**/Functions/**/*.json', '**/node_modules/**', 50);
      if (functionFiles.length === 0) {
        void vscode.window.showWarningMessage('No function files found in the workspace.');
        return;
      }
      const items = functionFiles.map((f) => ({
        label: path.basename(f.fsPath, '.json'),
        description: vscode.workspace.asRelativePath(f),
        uri: f,
      }));
      const picked = await vscode.window.showQuickPick(items, {
        placeHolder: 'Select a function to run',
      });
      if (!picked) return;
      const fnJson = await readFunctionJson(picked.uri);
      if (!fnJson) return;
      const activeEnv = await forgeToolsSettings.getActiveEnvironment();
      functionQuickRunPanel.open({
        domain: fnJson.domain,
        functionKey: fnJson.functionKey,
        scope: fnJson.scope,
        runtimeUrl: activeEnv?.baseUrl,
      });
    })),
    vscode.commands.registerCommand('vnextForge.openFunctionQuickRunFromFile', safeAsync(async (arg) => {
      const uri = asUri(arg);
      if (!uri) return;
      const fnJson = await readFunctionJson(uri);
      if (!fnJson) return;
      const activeEnv = await forgeToolsSettings.getActiveEnvironment();
      functionQuickRunPanel.open({
        domain: fnJson.domain,
        functionKey: fnJson.functionKey,
        scope: fnJson.scope,
        runtimeUrl: activeEnv?.baseUrl,
      });
    })),
    // Explorer right-click "Forge: Publish" — deploys the single
    // workflow JSON to the runtime via `wf update -f <path>`. Same
    // helper the Designer's Publish toolbar button uses, so the two
    // entry points stay behaviorally identical.
    // Not `async`: `publishWorkflowFile` sends the command to a terminal and
    // returns synchronously. `safeAsync` accepts sync handlers.
    vscode.commands.registerCommand('vnextForge.publishFromFile', safeAsync((arg) => {
      const uri = asUri(arg);
      if (!uri) {
        void vscode.window.showWarningMessage('Forge Publish: right-click a workflow JSON file in the Explorer.');
        return;
      }
      const result = publishWorkflowFile({
        filePath: uri.fsPath,
        terminal: forgeTerminal,
        logger: loggerAdapter,
      });
      if (!result.ok) {
        void vscode.window.showErrorMessage(
          `Forge Publish failed: ${result.reason ?? 'Unknown error'}`,
        );
      }
    })),
  );

  // Start health polling and status bar for the active environment (non-blocking)
  void healthMonitor.syncActiveEnvironment();
  void envStatusBar.initialize();

  // ── End Forge Tools Sidebar ────────────────────────────────────────────

  registerCommands(context, {
    projectService: services.projectService,
    workspaceService: services.workspaceService,
    detector,
    designerPanel,
  });

  // Custom editor: bileşen JSON dosyaları ve vnext.config.json doğrudan
  // tasarımcı webview'inde açılır (text editor flash'ı yok). Bileşen olmayan
  // JSON'lar (örn. package.json, tsconfig.json) provider içinde algılanıp
  // anında VS Code'un yerleşik metin editörüne devredilir.
  VnextComponentCustomTextEditorProvider.register(context, {
    detector,
    designerPanel,
    projectService: services.projectService,
  });

  // Material Icon Theme aktif kullanicilar icin: bizim spesifik klasor/dosya
  // isimlerini Material'in kendi ikon kutuphanesinden esleyerek (User Settings'e
  // yazarak) ozel ikon gosterimi saglar. Material aktif degilse no-op.
  const refreshMaterial = async (roots: readonly VnextWorkspaceRoot[]) => {
    try {
      const configs = await resolveConfigsForMaterial(roots);
      await applyMaterialIconAssociationsIfApplicable(configs);
    } catch (error) {
      baseLogger.warn(
        { error: (error as Error).message },
        'Failed to apply Material Icon Theme associations',
      );
    }
  };

  // Komutlar: kullanici manuel calistirmak / geri almak isterse.
  context.subscriptions.push(
    vscode.commands.registerCommand('vnextForge.applyMaterialIconAssociations', () =>
      refreshMaterial(detector.getRoots()),
    ),
    vscode.commands.registerCommand('vnextForge.removeMaterialIconAssociations', async () => {
      await removeMaterialIconAssociations();
    }),
  );

  context.subscriptions.push(
    detector.onDidChange((roots) => {
      void importDetectedRoots(roots, services.projectService);
      void refreshMaterial(roots);
    }),
  );

  // Kullanici workbench.iconTheme'i Material'a degistirirse de associations'lari uygula.
  context.subscriptions.push(
    vscode.workspace.onDidChangeConfiguration((e) => {
      if (e.affectsConfiguration('workbench.iconTheme')) {
        void refreshMaterial(detector.getRoots());
      }
    }),
  );

  await detector.refresh();
  await refreshMaterial(detector.getRoots());

  if (detector.getRoots().length > 0) {
    bootstrapLsp(loggerAdapter, lspInstaller);
  }

  statusBarItem.text = '$(check) vNext Forge';
  statusBarItem.tooltip = 'vNext Forge: Ready';
  void vscode.window.showInformationMessage(
    'vNext Forge is ready — workflow designer available for this workspace.',
  );
}

async function importDetectedRoots(
  roots: readonly { folderPath: string }[],
  projectService: { importProject(path: string): Promise<unknown> },
): Promise<void> {
  for (const root of roots) {
    try {
      await projectService.importProject(root.folderPath);
    } catch (error) {
      baseLogger.warn(
        { folder: root.folderPath, error: (error as Error).message },
        'Failed to link vnext workspace into project registry',
      );
    }
  }
}

export function deactivate(): void {
  // No-op: all disposables are registered on context.subscriptions.
}
