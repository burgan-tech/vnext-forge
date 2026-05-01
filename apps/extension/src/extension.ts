import * as vscode from 'vscode';

import { registerCommands } from './commands.js';
import { VnextComponentCustomTextEditorProvider } from './vnext-component-custom-text-editor.js';
import { createExtensionHostLspStack } from './composition/lsp.js';
import { composeExtensionServices } from './composition/services.js';
import { bootstrapLsp } from './lsp-bootstrap.js';
import { createNativeCsxLanguageClient } from './lsp/native-csx-language-client.js';
import { MessageRouter } from './MessageRouter.js';
import { createVsCodeOutputChannelLogger } from './adapters/vscode-output-channel-logger.js';
import { baseLogger } from './shared/logger.js';
import { DesignerPanel } from './panels/DesignerPanel.js';
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

/**
 * vnext-forge extension entry point. Composes the shared `services-core` +
 * `lsp-core` packages with VS Code-specific adapters (workspace root
 * resolver, OutputChannel logger, webview `postMessage` transport) and wires
 * the resulting services to commands and the webview `MessageRouter`.
 *
 * LSP / OmniSharp lifecycle owner: `createExtensionHostLspStack` in
 * `@vnext-forge/lsp-core` constructs the single shared `OmniSharpInstaller` and
 * `LspBridge`. The extension only re-exports that factory from
 * `composition/lsp.ts` and passes the same installer into `bootstrapLsp` for
 * background pre-download — there is no second installer factory in the
 * extension host (R-b8).
 */
export async function activate(context: vscode.ExtensionContext): Promise<void> {
  baseLogger.info({}, 'vnext-forge activating');

  const clearedStaleIconTheme = await clearRemovedFileIconThemeIfSet();
  if (clearedStaleIconTheme) {
    void vscode.window.showInformationMessage(
      'vnext-forge: Removed stale file icon theme (vnext-forge-icons) from settings. For folder icons, use Command Palette → "Preferences: File Icon Theme" → Material Icon Theme.',
      'OK',
    );
  }

  const outputChannel = vscode.window.createOutputChannel('vnext-forge-core');
  context.subscriptions.push(outputChannel);
  const loggerAdapter = createVsCodeOutputChannelLogger(outputChannel);

  // Dedicated channel for webview-side designer-ui logs forwarded via the
  // `host:log` postMessage tunnel. Keeping it separate from the core channel
  // makes it trivial to filter "what happened in the editor UI" vs "what
  // happened in the extension host".
  const webviewLogChannel = vscode.window.createOutputChannel('vnext-forge:webview');
  context.subscriptions.push(webviewLogChannel);

  const { services, registry } = composeExtensionServices(loggerAdapter);
  const { bridge: lspBridge, installer: lspInstaller } = createExtensionHostLspStack(loggerAdapter);

  const diagnosticCollection = vscode.languages.createDiagnosticCollection('vnext-forge');
  context.subscriptions.push(diagnosticCollection);

  const statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 50);
  statusBarItem.text = '$(loading~spin) vnext-forge';
  statusBarItem.tooltip = 'vnext-forge: Initializing...';
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
  const csxNativeLspChannel = vscode.window.createOutputChannel('vnext-forge:csx-native-lsp');
  context.subscriptions.push(csxNativeLspChannel);
  context.subscriptions.push(
    createNativeCsxLanguageClient({
      lspBridge,
      workspaceDetector: detector,
      logger: loggerAdapter,
      outputChannel: csxNativeLspChannel,
    }),
  );

  // ── Forge Tools Sidebar ──────────────────────────────────────────────────

  const forgeToolsSettings = new ForgeToolsSettingsService(context.globalStorageUri);
  context.subscriptions.push(forgeToolsSettings);

  // Pre-load settings so DesignerPanel can inject them synchronously
  await forgeToolsSettings.loadSettings();
  await forgeToolsSettings.loadEnvironments();

  designerPanel.setForgeToolsSettings(forgeToolsSettings);

  const healthMonitor = new EnvironmentHealthMonitor(forgeToolsSettings);
  context.subscriptions.push(healthMonitor);

  const envStatusBar = new EnvironmentStatusBar(forgeToolsSettings, healthMonitor);
  context.subscriptions.push(envStatusBar);

  const globalSettingsProvider = new GlobalSettingsProvider(forgeToolsSettings);
  const projectActionsProvider = new ProjectActionsProvider(detector, forgeTerminal);
  const createProjectProvider = new CreateProjectProvider(detector, forgeTerminal);
  const environmentsProvider = new EnvironmentsProvider(forgeToolsSettings, healthMonitor);
  const packageDeployProvider = new PackageDeployProvider(detector, forgeTerminal);

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
  );

  // Sidebar commands — wrapped to prevent unhandled rejections
  const safeAsync = (fn: (...args: unknown[]) => Promise<unknown>) =>
    (...args: unknown[]) => {
      void fn(...args).catch((err) => {
        const msg = err instanceof Error ? err.message : String(err);
        baseLogger.error({ error: msg }, 'Forge Tools command failed');
        void vscode.window.showErrorMessage(`vnext-forge: ${msg}`);
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
    vscode.commands.registerCommand('vnextForge.tools.switchEnvironment', safeAsync(() =>
      switchEnvironmentQuickPick(forgeToolsSettings),
    )),
    vscode.commands.registerCommand('vnextForge.tools.checkHealth', safeAsync(async () => {
      const status = await healthMonitor.checkNow();
      void vscode.window.showInformationMessage(`vnext-forge: Environment health: ${status}`);
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
  );

  // Start health polling and status bar for the active environment
  await healthMonitor.syncActiveEnvironment();
  await envStatusBar.initialize();

  // ── End Forge Tools Sidebar ────────────────────────────────────────────

  registerCommands(context, {
    projectService: services.projectService,
    workspaceService: services.workspaceService,
    detector,
    designerPanel,
  });

  // Custom editor: bileşen JSON dosyaları doğrudan tasarımcı webview'inde
  // açılır (text editor flash'ı yok). Bileşen olmayan JSON'lar (örn.
  // vnext.config.json, package.json) provider içinde algılanıp anında
  // VS Code'un yerleşik metin editörüne devredilir.
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

  statusBarItem.text = '$(check) vnext-forge';
  statusBarItem.tooltip = 'vnext-forge: Ready';
  void vscode.window.showInformationMessage(
    'vnext-forge is ready — workflow designer available for this workspace.',
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
