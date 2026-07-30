import * as vscode from 'vscode';
import {
  parseWfDomainList,
  planDomainRegistration,
  type WfDomainEntry,
} from '@vnext-forge-studio/services-core';
import type {
  ForgeToolsSettingsService,
  RuntimeEnvironment,
  EnvironmentsConfig,
  LocalRuntimeBinding,
} from '../forge-tools-settings.js';
import type { EnvironmentHealthMonitor, HealthStatus } from '../environment-health-monitor.js';
import type { VnextWorkspaceDetector, VnextWorkspaceRoot } from '../../workspace-detector.js';
import { baseLogger } from '../../shared/logger.js';
import { sanitizeForDisplay } from '../../shared/redact.js';
import {
  isCancellation,
  LocalRuntimeService,
  type ContainerState,
  type ProvisionResult,
} from '../local-runtime/local-runtime.service.js';
import {
  registerWfDomain,
  type RegistrationOutcome,
  type WfCliResult,
  type WfDomainAddArgs,
  type WfDomainCalls,
} from '../local-runtime/wf-domain-registrar.js';

/**
 * Resolves the workspace domain from `vnext.config.json` (single source
 * of truth for everything that talks to the engine / CLI). The function
 * stays a pluggable async hook so tests don't need to spin up a real
 * `WorkspaceService`.
 */
export type ResolveWorkspaceDomainFn = (root: VnextWorkspaceRoot) => Promise<string>;

const WORKFLOW_CLI_DOCS_URL = 'https://burgan-tech.github.io/vnext-docs/docs/tools/workflow-cli';

export type DomainAddFn = (params: WfDomainAddArgs) => Promise<WfCliResult>;

/** `wf domain list` — the only reliable way to read the CLI's registry. */
export type DomainListFn = () => Promise<WfCliResult>;
/** `wf domain remove <name>` / `wf domain use <name>`. */
export type DomainNameFn = (name: string) => Promise<WfCliResult>;

/**
 * Container state as the tree renders it. `'unknown'` is not something
 * `LocalRuntimeService` can return — the tree adds it for the case where the
 * container CLI/daemon is unavailable, so "we cannot ask" is never displayed
 * as "this container does not exist".
 */
type TreeContainerState = ContainerState | 'unknown';

const CONTAINER_STATE_LABELS: Record<ContainerState, string> = {
  running: 'running',
  stopped: 'stopped',
  absent: 'not created',
};

/**
 * Preflight issues that do NOT mean the container runtime is unusable.
 * `evaluatePreflight` reports at most one container-related issue and always
 * labels the host tools exactly `git` / `make`, so anything else in the list
 * is about the container CLI, its compose plugin, or its daemon.
 */
const HOST_TOOL_PREFLIGHT_TOOLS: ReadonlySet<string> = new Set(['git', 'make']);

/**
 * Whether the Workflow CLI's registration for a managed environment agrees
 * with what Forge persisted for it.
 *
 * `'unknown'` is not a third kind of registration — it means Forge could not
 * find out: no `wf` CLI on the host, a `domain list` that threw, or no
 * database name on record to compare against. The Register action stays hidden
 * in that state, because without the CLI (or without a DB_NAME) there is
 * nothing Forge could correctly register.
 */
type CliRegistrationState = 'ok' | 'needs-registration' | 'unknown';

/**
 * `contextValue` per registration state.
 *
 * The suffix is what `package.json` keys the Register action off: a
 * `view/item/context` `when` clause is the only way VS Code can hide a
 * context-menu entry — menu items cannot be greyed out. Every other managed
 * environment menu entry matches on `viewItem =~ /^environment-local/`, so all
 * three variants keep the full lifecycle menu.
 */
const CLI_REGISTRATION_CONTEXT: Record<CliRegistrationState, string> = {
  ok: 'environment-local-cli-ok',
  'needs-registration': 'environment-local-cli-needs-registration',
  unknown: 'environment-local',
};

const CLI_REGISTRATION_TOOLTIPS: Record<CliRegistrationState, string> = {
  ok: 'Workflow CLI: registered and pointing at this runtime',
  'needs-registration':
    'Workflow CLI: not registered, or registered with different values — run "Register with Workflow CLI"',
  unknown: 'Workflow CLI: unknown — Forge could not check the registration',
};

/**
 * Domain names Forge is willing to put on a shell command line (`wf domain use
 * <domain> && wf reset`). Matches what the runtime layout already implies — the
 * domain is a single path segment and a database name suffix.
 */
const WF_DOMAIN_NAME_PATTERN = /^[A-Za-z0-9._-]+$/;

/**
 * True when `wf domain add` reported an error while still exiting 0.
 *
 * Only used by the degraded fallback path — the one taken when the `domain
 * list` / `remove` / `use` calls were not wired, so the outcome cannot be
 * confirmed by re-listing. Without it that path would report success on an
 * "already exists" error.
 *
 * The CLI's `addDomain` catches the "already exists" throw and prints
 * `✗ Error: Domain "x" already exists.` to stdout without ever setting an exit
 * code (verified in vnext-workflow-cli `src/commands/domain.js`). Trusting the
 * exit code alone would let Forge claim it registered the domain while `wf`
 * kept pointing at a completely different runtime — the exact divergence this
 * feature exists to prevent, and invisible on the happy path.
 *
 * Both halves are required: the error marker alone would also match unrelated
 * failures, and "already exists" alone would match a success message that
 * merely mentions the phrase.
 */
function isSilentDomainAddFailure(output: string): boolean {
  return /already exists/i.test(output) && (output.includes('✗') || /error:/i.test(output));
}

function describeError(err: unknown): string {
  // Sanitised defensively: these messages go straight to a VS Code
  // notification, and a failing child process both echoes its own argv (which
  // can carry --DB_PASSWORD) and colours its output with ANSI escapes.
  return sanitizeForDisplay(err instanceof Error ? err.message : String(err));
}

export class EnvironmentsProvider implements vscode.TreeDataProvider<string> {
  private readonly _onDidChangeTreeData = new vscode.EventEmitter<string | undefined>();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  private envConfig: EnvironmentsConfig | undefined;

  /** Container state per environment id; a miss triggers one `docker ps`. */
  private readonly containerStates = new Map<string, ContainerState>();

  /**
   * Shared preflight probe for the current refresh cycle.
   *
   * Held as the *promise* (not the value) so that the parallel `getTreeItem`
   * calls VS Code issues for every child collapse into a single `docker info`
   * rather than one per environment.
   */
  private containerRuntimeProbe: Promise<boolean> | undefined;

  /**
   * The Workflow CLI's domain registry for the current refresh cycle, or
   * `null` when it could not be read.
   *
   * Held as the *promise* for the same reason as `containerRuntimeProbe`: VS
   * Code calls `getTreeItem` for every child in parallel, so caching the value
   * would still spawn one `wf domain list` per environment.
   */
  private wfDomainsProbe: Promise<WfDomainEntry[] | null> | undefined;

  constructor(
    private readonly settingsService: ForgeToolsSettingsService,
    private readonly healthMonitor: EnvironmentHealthMonitor,
    private readonly domainAdd?: DomainAddFn,
    private readonly detector?: VnextWorkspaceDetector,
    private readonly resolveWorkspaceDomain?: ResolveWorkspaceDomainFn,
    private readonly localRuntime?: LocalRuntimeService,
    private readonly showOutput?: () => void,
    private readonly runTerminal?: (command: string, cwd: string) => void,
    /**
     * The remaining `wf domain` verbs. Optional as a group: only when all
     * three are wired can Forge read the CLI's registry, replace a stale
     * entry, and verify the result — otherwise it falls back to a single
     * unverifiable `domain add`.
     */
    private readonly domainList?: DomainListFn,
    private readonly domainRemove?: DomainNameFn,
    private readonly domainUse?: DomainNameFn,
  ) {
    settingsService.onDidChangeEnvironments(() => {
      this.envConfig = undefined;
      this.containerStates.clear();
      this.containerRuntimeProbe = undefined;
      this.wfDomainsProbe = undefined;
      this._onDidChangeTreeData.fire(undefined);
    });
    healthMonitor.onDidChangeHealth(() => {
      this._onDidChangeTreeData.fire(undefined);
    });
  }

  async getTreeItem(element: string): Promise<vscode.TreeItem> {
    const config = await this.getConfig();
    const env = config.environments.find((e) => e.id === element);
    if (!env) {
      return new vscode.TreeItem('Unknown');
    }

    const isActive = config.activeEnvironmentId === env.id;
    const health = isActive ? this.healthMonitor.getHealth() : undefined;

    const item = new vscode.TreeItem(env.name, vscode.TreeItemCollapsibleState.None);
    item.description = env.baseUrl;

    // A managed entry without a wired LocalRuntimeService renders exactly like
    // a remote one: no lifecycle command is reachable, so `environment-local`
    // would advertise menu items that cannot run.
    const binding = env.kind === 'local-docker' ? env.local : undefined;
    if (binding && this.localRuntime) {
      const [state, cliState] = await Promise.all([
        this.resolveContainerState(env.id, binding),
        this.resolveCliRegistrationState(env, binding),
      ]);
      item.contextValue = CLI_REGISTRATION_CONTEXT[cliState];
      item.tooltip = this.buildLocalTooltip(env, binding, state, isActive, health, cliState);
      item.iconPath = this.getLocalIcon(state, isActive, health);
    } else {
      item.contextValue = 'environment';
      item.tooltip = this.buildTooltip(env, isActive, health);
      item.iconPath = this.getHealthIcon(isActive, health);
    }

    if (!isActive) {
      item.command = {
        command: 'vnextForge.tools.setActiveEnvironment',
        title: 'Set Active',
        arguments: [element],
      };
    }

    return item;
  }

  async getChildren(element?: string): Promise<string[]> {
    if (element) return [];
    const config = await this.getConfig();
    return config.environments.map((e) => e.id);
  }

  async addEnvironment(): Promise<void> {
    // Managed local runtimes are only offered when the service is wired.
    if (!this.localRuntime) {
      await this.addRemoteEnvironment();
      return;
    }

    const kind = await vscode.window.showQuickPick(
      [
        {
          label: 'Local (managed Docker runtime)',
          description: 'Forge clones the runtime, allocates ports, and starts Docker for you.',
          value: 'local' as const,
        },
        {
          label: 'Remote / existing',
          description: 'Connect to a vNext platform that is already running.',
          value: 'remote' as const,
        },
      ],
      { title: 'Add Environment', placeHolder: 'What kind of environment?', ignoreFocusOut: true },
    );
    if (!kind) return;

    if (kind.value === 'remote') {
      await this.addRemoteEnvironment();
      return;
    }
    await this.addLocalEnvironment();
  }

  private async addRemoteEnvironment(): Promise<void> {
    const name = await vscode.window.showInputBox({
      title: 'Add Environment',
      prompt: 'Environment name (e.g. Local, Test, Staging)',
      placeHolder: 'Local',
      validateInput: (v) => (v.trim() ? null : 'Name is required'),
      ignoreFocusOut: true,
    });
    if (!name) return;

    const baseUrl = await vscode.window.showInputBox({
      title: 'Add Environment',
      prompt: 'Base URL of the vNext platform',
      placeHolder: 'http://localhost:4201',
      value: 'http://localhost:4201',
      validateInput: (v) => {
        try {
          new URL(v.trim());
          return null;
        } catch {
          return 'Enter a valid URL (e.g. http://localhost:4201)';
        }
      },
      ignoreFocusOut: true,
    });
    if (!baseUrl) return;

    // Resolve the workspace domain BEFORE the DB Name prompt so the
    // default value (`vNext_<DOMAIN>`) reflects vnext.config.json, not
    // the environment label. We still let the user override the DB
    // Name — leaving the field empty (or unchanged from the
    // placeholder) yields the auto-derived value.
    const workspaceDomain = await this.pickWorkspaceDomain();
    if (workspaceDomain === undefined) return; // user cancelled

    // Lowercase domain preserves the runtime/CLI convention (the
    // workspace's `vnext.config.json` `domain` is also lowercased).
    const defaultDbName = workspaceDomain
      ? `vNext_${workspaceDomain.toLowerCase()}`
      : `vNext_${name.trim().replace(/\s+/g, '_').toLowerCase()}`;
    const dbName = await vscode.window.showInputBox({
      title: 'Add Environment',
      prompt: workspaceDomain
        ? `Database name for Workflow CLI domain (defaults to vNext_<domain> from vnext.config.json: domain="${workspaceDomain}")`
        : 'Database name for Workflow CLI domain',
      placeHolder: defaultDbName,
      value: defaultDbName,
      validateInput: (v) => (v.trim() ? null : 'Database name is required'),
      ignoreFocusOut: true,
    });
    if (!dbName) return;

    await this.settingsService.addEnvironment(name.trim(), baseUrl.trim(), dbName.trim());
    // The wf CLI domain argument is the workspace domain (read from
    // vnext.config.json), NOT the environment label. Same domain can
    // be registered with multiple environment URLs (e.g. Local +
    // Staging both target domain "core" with different base URLs).
    const cliDomain = workspaceDomain || name.trim();
    await this.runDomainAdd(cliDomain, baseUrl.trim(), dbName.trim(), name.trim());
  }

  /**
   * Resolve the wf CLI domain argument from vnext.config.json.
   *
   * - 0 roots → return `''` (caller falls back to the environment label
   *   so the legacy path still works for users without a workspace).
   * - 1 root → read its config and return `config.domain`.
   * - 2+ roots → present a QuickPick so the user picks which workspace
   *   the environment registration targets. Returns `undefined` if the
   *   user dismisses the picker (so the caller can abort the flow).
   *
   * Returns `''` (not `undefined`) on read failure — the environment can
   * still be persisted; only the wf CLI fallback shifts to using the
   * environment name as the domain argument.
   */
  private async pickWorkspaceDomain(): Promise<string | undefined> {
    if (!this.detector || !this.resolveWorkspaceDomain) return '';
    const roots = this.detector.getRoots();
    if (roots.length === 0) return '';
    let chosen: VnextWorkspaceRoot;
    if (roots.length === 1) {
      chosen = roots[0];
    } else {
      const pick = await vscode.window.showQuickPick(
        roots.map((r) => ({
          label: r.folderPath.split(/[\\/]/).pop() ?? r.folderPath,
          description: r.folderPath,
          root: r,
        })),
        {
          title: 'Select vNext workspace for the new environment',
          placeHolder: 'Pick the workspace whose `vnext.config.json` `domain` will be used.',
          ignoreFocusOut: true,
        },
      );
      if (!pick) return undefined;
      chosen = pick.root;
    }
    try {
      const domain = await this.resolveWorkspaceDomain(chosen);
      return domain.trim();
    } catch (err) {
      baseLogger.warn(
        { folder: chosen.folderPath, error: (err as Error).message },
        'Failed to read vnext.config.json domain; falling back to environment label.',
      );
      return '';
    }
  }

  // ── Managed local runtime ──────────────────────────────────────────────────

  /**
   * Pick the workspace root that will host the runtime clone.
   *
   * Returns `null` when no vNext workspace is open and `undefined` when the
   * user dismissed the picker — the caller reports those differently, since
   * only the first one is something the user can act on.
   */
  private async pickWorkspaceRoot(
    title = 'Select vNext workspace for the local runtime',
    placeHolder = 'Pick the workspace that will host the runtime clone.',
  ): Promise<VnextWorkspaceRoot | null | undefined> {
    const roots = this.detector?.getRoots() ?? [];
    if (roots.length === 0) return null;
    if (roots.length === 1) return roots[0];
    const pick = await vscode.window.showQuickPick(
      roots.map((r) => ({
        label: r.folderPath.split(/[\\/]/).pop() ?? r.folderPath,
        description: r.folderPath,
        root: r,
      })),
      { title, placeHolder, ignoreFocusOut: true },
    );
    if (!pick) return undefined;
    return pick.root;
  }

  private async addLocalEnvironment(): Promise<void> {
    const service = this.localRuntime;
    if (!service) return;

    // 1 — workspace
    const root = await this.pickWorkspaceRoot();
    if (root === undefined) return; // user cancelled
    if (root === null) {
      void vscode.window.showWarningMessage(
        'Open a vNext workspace before adding a local runtime environment.',
      );
      return;
    }

    // 2 — domain. The whole local runtime identity (clone layout, container
    // names, database, ports) hangs off it, so we never guess one.
    let domain = '';
    if (this.resolveWorkspaceDomain) {
      try {
        domain = (await this.resolveWorkspaceDomain(root)).trim();
      } catch (err) {
        baseLogger.warn(
          { folder: root.folderPath, error: (err as Error).message },
          'Failed to read vnext.config.json domain for the local runtime.',
        );
      }
    }
    if (!domain) {
      void vscode.window.showErrorMessage(
        'Local runtime needs a domain. Add a `domain` field to vnext.config.json first.',
      );
      return;
    }

    // 3 — preflight
    if (!(await this.checkPreflight())) return;

    // 4 — port offset
    const suggested = await vscode.window.withProgress(
      { location: vscode.ProgressLocation.Notification, title: 'Looking for a free port offset…' },
      () => service.suggestPortOffset(root.folderPath),
    );
    const offsetInput = await vscode.window.showInputBox({
      title: 'Add Local Environment',
      prompt: 'Port offset for this domain — every local domain needs its own block of ports.',
      value: suggested === null ? '' : String(suggested),
      placeHolder:
        suggested === null
          ? 'No free offset was found below 200. Enter one manually.'
          : String(suggested),
      validateInput: (v) => {
        const trimmed = v.trim();
        if (!trimmed) return 'Offset must be zero or a positive multiple of 10';
        const parsed = Number(trimmed);
        return Number.isFinite(parsed) && LocalRuntimeService.isValidPortOffset(parsed)
          ? null
          : 'Offset must be zero or a positive multiple of 10';
      },
      ignoreFocusOut: true,
    });
    // An empty string cannot pass validateInput, so only a dismissal reaches
    // here as `undefined` — the two must not be collapsed into `!offsetInput`.
    if (offsetInput === undefined) return;
    const portOffset = Number(offsetInput.trim());

    // 5 — name
    const name = await vscode.window.showInputBox({
      title: 'Add Local Environment',
      prompt: 'Environment name',
      value: `Local (${domain})`,
      validateInput: (v) => (v.trim() ? null : 'Name is required'),
      ignoreFocusOut: true,
    });
    if (!name) return;

    // 6 — provision
    let result: ProvisionResult;
    try {
      result = await vscode.window.withProgress(
        {
          location: vscode.ProgressLocation.Notification,
          title: `Provisioning local runtime for "${domain}"`,
          cancellable: true,
        },
        (progress, token) =>
          service.provision({ workspacePath: root.folderPath, domain, portOffset }, progress, token),
      );
    } catch (err) {
      // Either way we return before persisting: a cancelled or failed
      // provision must never leave a registered environment behind.
      if (isCancellation(err)) {
        this.showCancelled('Local runtime setup');
      } else {
        await this.showFailure(`Local runtime setup failed: ${describeError(err)}`);
      }
      return;
    }

    // 7 — persist
    await this.settingsService.addEnvironment(
      name.trim(),
      result.baseUrl,
      result.dbName,
      result.binding,
    );

    // 8 — register with the Workflow CLI + report the outcome
    await this.finishProvisioning(domain, result, name.trim());
  }

  /**
   * Everything that follows a successful provision once the environment has
   * been persisted. Shared by Add and by the provision-now branch of Start so
   * the two cannot drift into registering with the CLI differently.
   */
  private async finishProvisioning(
    domain: string,
    result: ProvisionResult,
    envLabel: string,
  ): Promise<void> {
    await this.runDomainAdd(domain, result.baseUrl, result.dbName, envLabel, result.binding);

    const message = result.healthy
      ? `Local runtime for domain "${domain}" is running at ${result.baseUrl}.`
      : `Local runtime for domain "${domain}" started at ${result.baseUrl}, but /health did not respond yet.`;
    const action = await vscode.window.showInformationMessage(message, 'Show Logs', 'Show Output');
    if (action === 'Show Logs') this.showLogs(result.binding);
    if (action === 'Show Output') this.showOutput?.();
  }

  /**
   * True when the host has everything the local runtime needs.
   *
   * "Installed but not running" gets its own wording and a Retry: a stopped
   * Docker Desktop is the most common first-run state, and telling that user
   * something is "missing" sends them off to reinstall what they already have.
   */
  private async checkPreflight(): Promise<boolean> {
    const service = this.localRuntime;
    if (!service) return false;

    const preflight = await service.detectPreflight();
    if (preflight.ok) return true;

    const summary = preflight.issues
      .map((issue) =>
        issue.problem === 'not-running'
          ? `${issue.tool} is installed but not running`
          : `${issue.tool} is not installed`,
      )
      .join('; ');
    // Both actions when the issues are mixed: a stopped daemon is fixed by
    // Retry, a missing tool by the docs, and one user can have both. The link
    // targets the first *missing* issue — the first issue overall could be the
    // stopped daemon, whose help page says nothing about installing git.
    const canRetry = preflight.issues.some((issue) => issue.problem === 'not-running');
    const firstMissing = preflight.issues.find((issue) => issue.problem === 'missing');
    const actions = [
      ...(canRetry ? ['Retry'] : []),
      ...(firstMissing ? ['Open Install Docs'] : []),
    ];
    const action = await vscode.window.showErrorMessage(
      `Cannot set up a local runtime: ${summary}.`,
      ...actions,
    );

    if (action === 'Retry') {
      // `detectPreflight` drops its detection cache on every call, so this
      // genuinely re-checks rather than replaying the previous verdict.
      await this.addLocalEnvironment();
    } else if (action === 'Open Install Docs' && firstMissing) {
      void vscode.env.openExternal(vscode.Uri.parse(firstMissing.helpUrl));
    }
    return false;
  }

  // ── Lifecycle actions ──────────────────────────────────────────────────────

  /** The environment plus its binding, but only for a managed local entry. */
  private async withEnvironment(
    envId: string,
  ): Promise<{ env: RuntimeEnvironment; binding: LocalRuntimeBinding } | undefined> {
    const config = await this.getConfig();
    const env = config.environments.find((e) => e.id === envId);
    if (env?.kind !== 'local-docker' || !env.local) return undefined;
    return { env, binding: env.local };
  }

  /** Runs one lifecycle operation with progress + error reporting. */
  private async runLifecycle(
    envId: string,
    title: string,
    run: (
      service: LocalRuntimeService,
      binding: LocalRuntimeBinding,
      progress: vscode.Progress<{ message?: string }>,
      token: vscode.CancellationToken,
    ) => Promise<void>,
  ): Promise<boolean> {
    const service = this.localRuntime;
    const target = await this.withEnvironment(envId);
    if (!service || !target) return false;

    let succeeded = true;
    try {
      await vscode.window.withProgress(
        { location: vscode.ProgressLocation.Notification, title, cancellable: true },
        (progress, token) => run(service, target.binding, progress, token),
      );
    } catch (err) {
      // Still not a success — `updateRuntime` must not claim it updated —
      // but presented as the user's own decision rather than as an error.
      succeeded = false;
      if (isCancellation(err)) {
        this.showCancelled(title);
      } else {
        await this.showFailure(`${title} failed: ${describeError(err)}`);
      }
    } finally {
      this.invalidateContainerState(envId);
    }
    return succeeded;
  }

  async startEnvironment(envId: string): Promise<void> {
    const service = this.localRuntime;
    const target = await this.withEnvironment(envId);
    if (!service || !target) return;

    if (!(await service.isProvisioned(target.binding))) {
      const confirm = await vscode.window.showWarningMessage(
        'This runtime is not provisioned yet. Provision it now?',
        { modal: true },
        'Provision',
      );
      if (confirm !== 'Provision') return;
      // The result is captured rather than discarded: provisioning from here
      // has to reach the same end state as provisioning from Add — values
      // persisted, CLI registered, outcome reported — or the same operation
      // would mean two different things depending on where it was started.
      let result: ProvisionResult | undefined;
      const provisioned = await this.runLifecycle(
        envId,
        `Provisioning local runtime for "${target.binding.domain}"`,
        async (svc, binding, progress, token) => {
          result = await svc.provision(
            {
              workspacePath: binding.workspacePath,
              domain: binding.domain,
              portOffset: binding.portOffset,
            },
            progress,
            token,
          );
        },
      );
      if (!provisioned || !result) return;

      await this.settingsService.updateEnvironment(envId, {
        baseUrl: result.baseUrl,
        dbName: result.dbName,
        local: result.binding,
      });
      await this.finishProvisioning(target.binding.domain, result, target.env.name);
      return;
    }

    await this.runLifecycle(envId, `Starting "${target.env.name}"`, (svc, binding, progress, token) =>
      svc.start(binding, progress, token),
    );
  }

  async stopEnvironment(envId: string): Promise<void> {
    const target = await this.withEnvironment(envId);
    if (!target) return;
    await this.runLifecycle(envId, `Stopping "${target.env.name}"`, (svc, binding, progress, token) =>
      svc.stop(binding, progress, token),
    );
  }

  async restartEnvironment(envId: string): Promise<void> {
    const target = await this.withEnvironment(envId);
    if (!target) return;
    await this.runLifecycle(
      envId,
      `Restarting "${target.env.name}"`,
      (svc, binding, progress, token) => svc.restart(binding, progress, token),
    );
  }

  async updateRuntime(envId: string): Promise<void> {
    const updated = await this.runLifecycle(
      envId,
      'Updating the vNext runtime',
      (svc, binding, progress, token) => svc.updateRuntime(binding, progress, token),
    );
    if (updated) {
      void vscode.window.showInformationMessage(
        'Runtime updated. Restart the environment to apply changes.',
      );
    }
  }

  /**
   * Register (or re-register) this managed environment's domain with the
   * Workflow CLI. Surfaced only while `contextValue` says the registration is
   * missing or stale, and it disappears again once it is correct.
   */
  async registerCliDomain(envId: string): Promise<void> {
    const target = await this.withEnvironment(envId);
    if (!target) return;
    const { env, binding } = target;

    if (!this.domainAdd || !this.localRuntime) {
      await this.notifyWithDocs(
        'warning',
        'Workflow CLI integration is not available, so Forge cannot register this domain.',
      );
      return;
    }

    // Never derived: registering a guessed DB_NAME would point the CLI at a
    // database that does not exist, and every later `wf` call would fail
    // against it while looking correctly configured.
    if (!env.dbName) {
      void vscode.window.showErrorMessage(
        `Forge has no database name recorded for "${env.name}", so it cannot register the ` +
          `Workflow CLI domain "${binding.domain}". Re-provision the runtime, or register the ` +
          'domain with `wf domain add` by hand.',
      );
      return;
    }

    // Routed through the shared path on purpose: `runDomainAdd` owns building
    // the args (`buildDomainAddArgs`) and reporting every outcome (added /
    // replaced / up-to-date / blocked-default / failed). Duplicating either
    // here would let the two entry points drift.
    await this.runDomainAdd(binding.domain, env.baseUrl, env.dbName, env.name, binding);

    // The registry just changed, so the cached list is stale — dropping it is
    // what makes the action disappear from the menu when it succeeded.
    this.wfDomainsProbe = undefined;
    this._onDidChangeTreeData.fire(undefined);
  }

  /**
   * Run `wf reset` for this environment's domain — a force update that deletes
   * and re-publishes the domain's components in the database.
   *
   * Offered for remote environments too: they also have a CLI domain, and its
   * components are just as resettable.
   */
  async resetComponents(envId: string): Promise<void> {
    const runTerminal = this.runTerminal;
    if (!runTerminal) return;

    const config = await this.getConfig();
    const env = config.environments.find((e) => e.id === envId);
    if (!env) return;

    const binding = env.kind === 'local-docker' ? env.local : undefined;

    // A managed environment carries both values; a remote one has neither, so
    // they come from the workspace the same way the remote add flow gets them.
    let domain = binding?.domain ?? '';
    let workspacePath = binding?.workspacePath ?? '';
    if (!binding) {
      const root = await this.pickWorkspaceRoot(
        'Select vNext workspace to reset components for',
        'Pick the workspace whose `vnext.config.json` components will be reset.',
      );
      if (root === undefined) return; // user cancelled
      if (root === null) {
        void vscode.window.showErrorMessage(
          'Open a vNext workspace before resetting components — `wf reset` reads the ' +
            'components from `vnext.config.json`.',
        );
        return;
      }
      workspacePath = root.folderPath;
      if (this.resolveWorkspaceDomain) {
        try {
          domain = (await this.resolveWorkspaceDomain(root)).trim();
        } catch (err) {
          baseLogger.warn(
            { folder: root.folderPath, error: (err as Error).message },
            'Failed to read the vnext.config.json domain for a component reset.',
          );
        }
      }
    }

    if (!domain) {
      void vscode.window.showErrorMessage(
        'Cannot reset components: no domain could be resolved. Add a `domain` field to ' +
          'vnext.config.json first.',
      );
      return;
    }
    if (!workspacePath) {
      void vscode.window.showErrorMessage(
        'Cannot reset components: no workspace folder could be resolved. `wf reset` has to run ' +
          'from the workspace root that holds vnext.config.json.',
      );
      return;
    }
    // The domain is interpolated into a shell command line below, so anything
    // outside this set is refused rather than quoted: a domain name that needs
    // quoting is one the runtime, the database and the CLI would not agree on
    // anyway, and shell metacharacters here would run in the user's terminal.
    if (!WF_DOMAIN_NAME_PATTERN.test(domain)) {
      void vscode.window.showErrorMessage(
        `Cannot reset components: "${domain}" is not a usable domain name. Use letters, digits, ` +
          'dot, underscore or hyphen only.',
      );
      return;
    }

    // Modal, not a toast: this deletes the domain's component rows before
    // re-publishing them, and a toast is dismissible by accident.
    const confirm = await vscode.window.showWarningMessage(
      `Reset components for domain "${domain}"?`,
      {
        modal: true,
        detail:
          `This force-updates the components of domain "${domain}": every matching component is ` +
          'deleted from the database and published again from the files in ' +
          `${workspacePath}.\n\n` +
          'The command then asks which component types to include and for a final confirmation ' +
          'in the terminal.',
      },
      'Reset Components',
    );
    if (confirm !== 'Reset Components') return;

    // A terminal, and both commands, are both load-bearing — do not "simplify"
    // this into `runStreaming`:
    //   * `wf reset` is interactive. It prompts (inquirer) for which component
    //     types to reset and then for a final confirmation, and the CLI
    //     declares the command with no non-interactive flag. `runStreaming`
    //     captures output and gives the child no stdin, so it would hang
    //     forever on a prompt with nowhere to appear.
    //   * `wf reset` acts on the CLI's *active* domain, so it must be preceded
    //     by `wf domain use <domain>` or it would reset whichever domain the
    //     user last selected — possibly a different environment entirely.
    // The shell `&&` is fine here (unlike the argv arrays used for `spawn`):
    // `runTerminal` hands a command line to a real shell.
    runTerminal(`wf domain use ${domain} && wf reset`, workspacePath);
  }

  async showLogsForEnvironment(envId: string): Promise<void> {
    const target = await this.withEnvironment(envId);
    if (!target) return;
    this.showLogs(target.binding);
  }

  async openRuntimeFolder(envId: string): Promise<void> {
    const target = await this.withEnvironment(envId);
    if (!target) return;
    await vscode.commands.executeCommand(
      'revealFileInOS',
      vscode.Uri.file(target.binding.runtimePath),
    );
  }

  async revealPorts(envId: string): Promise<void> {
    const target = await this.withEnvironment(envId);
    if (!target) return;
    const { ports } = target.binding;
    const items = [
      { label: 'Orchestration API', port: ports.app },
      { label: 'Execution', port: ports.execution },
      { label: 'Worker Inbox', port: ports.inbox },
      { label: 'Worker Outbox', port: ports.outbox },
      { label: 'Init', port: ports.init },
    ].map((entry) => ({
      label: entry.label,
      description: `http://localhost:${entry.port}`,
      url: `http://localhost:${entry.port}`,
    }));

    const pick = await vscode.window.showQuickPick(items, {
      title: `Ports for "${target.env.name}"`,
      placeHolder: 'Select a port to copy its URL to the clipboard.',
      ignoreFocusOut: true,
    });
    if (!pick) return;
    await vscode.env.clipboard.writeText(pick.url);
    void vscode.window.showInformationMessage(`Copied ${pick.url} to the clipboard.`);
  }

  /** A follow-mode tail belongs in a terminal, not in the Output channel. */
  private showLogs(binding: LocalRuntimeBinding): void {
    this.runTerminal?.(`make logs-vnext DOMAIN=${binding.domain}`, binding.runtimePath);
  }

  /**
   * Cancellation is a decision the user just made, not a failure. It gets a
   * plain informational message with no action button — reporting it as an
   * error would both misdescribe it and blunt the error toast a real failure
   * needs. Not silence: these operations run for minutes and leave partial
   * state behind, so a one-line confirmation that Forge actually stopped (and,
   * where it differs from what was asked, what that means) is worth the toast.
   */
  private showCancelled(what: string, note?: string): void {
    void vscode.window.showInformationMessage(
      note ? `${what} was cancelled. ${note}` : `${what} was cancelled.`,
    );
  }

  private async showFailure(message: string, severity: 'error' | 'warning' = 'error'): Promise<void> {
    const action =
      severity === 'error'
        ? await vscode.window.showErrorMessage(message, 'Show Output')
        : await vscode.window.showWarningMessage(message, 'Show Output');
    if (action === 'Show Output') this.showOutput?.();
  }

  private invalidateContainerState(envId: string): void {
    this.containerStates.delete(envId);
    // A lifecycle run is also the moment the container runtime may have become
    // reachable (or gone away), so the shared probe is dropped with it. The
    // domain registry goes too: provisioning from Start registers the domain.
    this.containerRuntimeProbe = undefined;
    this.wfDomainsProbe = undefined;
    this._onDidChangeTreeData.fire(undefined);
  }

  async editEnvironment(envId: string): Promise<void> {
    const config = await this.getConfig();
    const env = config.environments.find((e) => e.id === envId);
    if (!env) return;

    const name = await vscode.window.showInputBox({
      title: 'Edit Environment',
      prompt: 'Environment name',
      value: env.name,
      validateInput: (v) => (v.trim() ? null : 'Name is required'),
      ignoreFocusOut: true,
    });
    if (!name) return;

    const baseUrl = await vscode.window.showInputBox({
      title: 'Edit Environment',
      prompt: 'Base URL',
      value: env.baseUrl,
      validateInput: (v) => {
        try {
          new URL(v.trim());
          return null;
        } catch {
          return 'Enter a valid URL';
        }
      },
      ignoreFocusOut: true,
    });
    if (!baseUrl) return;

    await this.settingsService.updateEnvironment(envId, {
      name: name.trim(),
      baseUrl: baseUrl.trim(),
    });

    const action = await vscode.window.showInformationMessage(
      'For advanced Workflow CLI configuration (DB host, credentials, Docker, etc.), see the CLI docs.',
      'View CLI Docs',
    );
    if (action === 'View CLI Docs') {
      void vscode.env.openExternal(vscode.Uri.parse(WORKFLOW_CLI_DOCS_URL));
    }
  }

  async deleteEnvironment(envId: string): Promise<void> {
    const config = await this.getConfig();
    const env = config.environments.find((e) => e.id === envId);
    if (!env) return;

    const service = this.localRuntime;
    const binding = env.kind === 'local-docker' ? env.local : undefined;

    if (service && binding) {
      const confirm = await vscode.window.showWarningMessage(
        `Delete environment "${env.name}"?`,
        {
          modal: true,
          detail:
            `The containers for domain "${binding.domain}" will be stopped and the generated ` +
            `domain configuration will be removed from ${binding.runtimePath}.\n\n` +
            'The database and the runtime clone are preserved.',
        },
        'Delete',
      );
      if (confirm !== 'Delete') return;

      try {
        await vscode.window.withProgress(
          {
            location: vscode.ProgressLocation.Notification,
            title: `Removing the local runtime for "${binding.domain}"`,
            cancellable: true,
          },
          (progress, token) => service.teardown(binding, progress, token),
        );
      } catch (err) {
        if (isCancellation(err)) {
          // Cancel here means "stop", so the entry stays. The
          // strand-the-user argument below is about a teardown that *fails*;
          // it does not apply when the user changed their mind and can simply
          // run Delete again.
          this.showCancelled('Local runtime teardown', 'The environment was not removed.');
          this.invalidateContainerState(envId);
          return;
        }
        // Reported, but the entry still goes: refusing to delete it because a
        // container would not stop would strand the user with an environment
        // they cannot remove.
        await this.showFailure(
          `Local runtime teardown failed: ${describeError(err)}. The environment was removed anyway.`,
          'warning',
        );
      }

      this.containerStates.delete(envId);
      await this.settingsService.removeEnvironment(envId);
      return;
    }

    const confirm = await vscode.window.showWarningMessage(
      `Delete environment "${env.name}"?`,
      { modal: true },
      'Delete',
    );
    if (confirm !== 'Delete') return;

    await this.settingsService.removeEnvironment(envId);
  }

  async setActiveEnvironment(envId: string): Promise<void> {
    await this.settingsService.setActiveEnvironment(envId);
  }

  private async getConfig(): Promise<EnvironmentsConfig> {
    if (!this.envConfig) {
      this.envConfig = await this.settingsService.loadEnvironments();
    }
    return this.envConfig;
  }

  /** Notification + the shared "View CLI Docs" affordance. */
  private async notifyWithDocs(level: 'info' | 'warning', message: string): Promise<void> {
    const action =
      level === 'info'
        ? await vscode.window.showInformationMessage(message, 'View CLI Docs')
        : await vscode.window.showWarningMessage(message, 'View CLI Docs');
    if (action === 'View CLI Docs') {
      void vscode.env.openExternal(vscode.Uri.parse(WORKFLOW_CLI_DOCS_URL));
    }
  }

  /**
   * Register the domain through the registrar, which reads `wf domain list`,
   * replaces a stale entry, and confirms the result by listing again — the
   * only reliable check, since every `wf domain` subcommand exits 0.
   */
  private async runVerifiedDomainRegistration(
    args: WfDomainAddArgs,
    envLabel: string,
    calls: WfDomainCalls,
  ): Promise<void> {
    const { domainName, apiBaseUrl } = args;
    let outcome: RegistrationOutcome;
    try {
      outcome = await registerWfDomain(args, calls);
    } catch {
      await this.notifyWithDocs(
        'warning',
        'Workflow CLI is not available. Install it to enable domain registration.',
      );
      return;
    }

    switch (outcome.kind) {
      case 'added':
        await this.notifyWithDocs(
          'info',
          `Workflow CLI domain "${domainName}" registered for environment "${envLabel}".`,
        );
        return;
      case 'replaced':
        await this.notifyWithDocs(
          'info',
          `Workflow CLI domain "${domainName}" updated to ${apiBaseUrl} for environment "${envLabel}".`,
        );
        return;
      case 'up-to-date':
        await this.notifyWithDocs(
          'info',
          `Workflow CLI domain "${domainName}" already points at ${apiBaseUrl} for environment "${envLabel}".`,
        );
        return;
      case 'blocked-default':
        await this.notifyWithDocs(
          'warning',
          `The Workflow CLI refuses to remove its "default" domain, so Forge cannot repoint it ` +
            `at ${apiBaseUrl}. Give environment "${envLabel}" a domain name other than "default", ` +
            `or edit the CLI's default domain by hand.`,
        );
        return;
      case 'failed': {
        // Sanitised: the reason quotes `wf` output, which is chalk-coloured
        // (a toast reading `ESC[31m✗ Error…` is the same rendering bug as in
        // the Output channel) and can echo a command line carrying
        // --DB_PASSWORD for a local binding. This path does not go through
        // process-runner, so its sanitising does not cover it.
        await this.notifyWithDocs(
          'warning',
          `Workflow CLI domain registration failed: ${sanitizeForDisplay(outcome.reason)}`,
        );
      }
    }
  }

  private async runDomainAdd(
    cliDomain: string,
    baseUrl: string,
    dbName: string,
    /** Environment label — used only for the success/error notification. */
    envLabel: string,
    /** Present for managed local runtimes: carries the discovered DB/Docker
     *  connection details so `wf` targets the container we just started. */
    binding?: LocalRuntimeBinding,
  ): Promise<void> {
    const domainAdd = this.domainAdd;
    if (!domainAdd) return;

    const args: WfDomainAddArgs =
      binding && this.localRuntime
        ? this.localRuntime.buildDomainAddArgs(binding, dbName)
        : { domainName: cliDomain, apiBaseUrl: baseUrl, dbName };

    const { domainList, domainRemove, domainUse } = this;
    if (domainList && domainRemove && domainUse) {
      await this.runVerifiedDomainRegistration(args, envLabel, {
        domainList,
        domainAdd,
        domainRemove,
        domainUse,
      });
      return;
    }

    try {
      const result = await domainAdd(args);
      if (result.exitCode === 0 && isSilentDomainAddFailure(`${result.stdout}\n${result.stderr}`)) {
        // Deliberately not repaired automatically: there is no verified safe
        // way to update an existing registration in place, so the user is
        // given the command instead. --DB_PASSWORD is omitted from it on
        // purpose — a notification is the wrong place for a credential, and
        // the CLI inherits the rest from the default domain.
        const action = await vscode.window.showWarningMessage(
          `Workflow CLI domain "${cliDomain}" is already registered, so its URL was not changed. ` +
            `Forge provisioned ${baseUrl}. To point the CLI there, run: ` +
            `wf domain remove ${cliDomain} && wf domain add ${cliDomain} ` +
            `--API_BASE_URL ${baseUrl} --DB_NAME ${dbName}`,
          'View CLI Docs',
        );
        if (action === 'View CLI Docs') {
          void vscode.env.openExternal(vscode.Uri.parse(WORKFLOW_CLI_DOCS_URL));
        }
      } else if (result.exitCode === 0) {
        const action = await vscode.window.showInformationMessage(
          `Workflow CLI domain "${cliDomain}" registered for environment "${envLabel}".`,
          'View CLI Docs',
        );
        if (action === 'View CLI Docs') {
          void vscode.env.openExternal(vscode.Uri.parse(WORKFLOW_CLI_DOCS_URL));
        }
      } else {
        // Sanitised: raw `wf` output is chalk-coloured, and with a local
        // binding the invocation carries --DB_PASSWORD that a usage error
        // echoes back. This path does not go through process-runner, so its
        // sanitising does not cover it.
        const msg = sanitizeForDisplay(
          result.stderr.trim() || result.stdout.trim() || 'Unknown error',
        );
        const action = await vscode.window.showWarningMessage(
          `Workflow CLI domain registration failed: ${msg}`,
          'View CLI Docs',
        );
        if (action === 'View CLI Docs') {
          void vscode.env.openExternal(vscode.Uri.parse(WORKFLOW_CLI_DOCS_URL));
        }
      }
    } catch {
      const action = await vscode.window.showWarningMessage(
        'Workflow CLI is not available. Install it to enable domain registration.',
        'View CLI Docs',
      );
      if (action === 'View CLI Docs') {
        void vscode.env.openExternal(vscode.Uri.parse(WORKFLOW_CLI_DOCS_URL));
      }
    }
  }

  private buildTooltip(env: RuntimeEnvironment, isActive: boolean, health?: HealthStatus): string {
    const lines = [
      `Name: ${env.name}`,
      `URL: ${env.baseUrl}`,
      `Status: ${isActive ? 'Active' : 'Inactive'}`,
    ];
    if (env.dbName) {
      lines.push(`DB Name: ${env.dbName}`);
    }
    if (health) {
      lines.push(`Health: ${health}`);
    }
    return lines.join('\n');
  }

  /**
   * Container state for a managed environment, or `'unknown'`.
   *
   * `getContainerState` answers `absent` when it cannot find a container CLI,
   * which would make every managed environment look like it was never
   * provisioned whenever Docker Desktop is merely stopped — and invite the
   * user to re-provision runtimes that already exist. So the container runtime
   * is checked once per refresh first; when it is unavailable we skip the
   * per-environment probes entirely (each is a subprocess that could only
   * answer `absent`) and report the state as unknown instead.
   */
  private async resolveContainerState(
    envId: string,
    binding: LocalRuntimeBinding,
  ): Promise<TreeContainerState> {
    const service = this.localRuntime;
    if (!service) return 'unknown';

    const cached = this.containerStates.get(envId);
    if (cached) return cached;

    if (!(await this.isContainerRuntimeAvailable())) return 'unknown';

    try {
      let state = await service.getContainerState(binding);
      // `make down-vnext` runs `compose down`, which REMOVES the containers
      // rather than stopping them — so Forge's own Stop button lands here with
      // nothing left to find. Reported as `absent`, a stopped environment
      // would be indistinguishable from one that was never provisioned, and
      // the tree would invite the user to re-create what already exists. Disk
      // state is the honest signal: the domain configuration is still there,
      // so the environment exists and merely is not up. Do not "correct" this
      // back to absent.
      if (state === 'absent' && (await service.isProvisioned(binding))) {
        state = 'stopped';
      }
      this.containerStates.set(envId, state);
      return state;
    } catch (err) {
      // A throw here would take the whole tree item down; unknown is honest.
      baseLogger.warn(
        { domain: binding.domain, error: (err as Error).message },
        'Failed to read the container state for a managed environment.',
      );
      return 'unknown';
    }
  }

  /**
   * Whether the container CLI + daemon are usable, resolved once per refresh
   * cycle and shared by every managed environment. `git` / `make` issues are
   * ignored here: they block provisioning, not `docker ps`.
   */
  private isContainerRuntimeAvailable(): Promise<boolean> {
    const service = this.localRuntime;
    if (!service) return Promise.resolve(false);
    this.containerRuntimeProbe ??= service.detectPreflight().then(
      (result) => !result.issues.some((issue) => !HOST_TOOL_PREFLIGHT_TOOLS.has(issue.tool)),
      () => false,
    );
    return this.containerRuntimeProbe;
  }

  /**
   * The Workflow CLI's domain registry, read once per refresh cycle, or `null`
   * when Forge could not read it (no `wf` on PATH, or the call threw).
   *
   * The exit code is deliberately not consulted: every `wf domain` subcommand
   * exits 0, even on error, so the output is the only signal — the same rule
   * `wf-domain-registrar` follows. An unparseable body yields `[]`, which reads
   * as "no domains registered"; that matches how the registrar treats it, so
   * the tree and the registration it triggers cannot disagree.
   */
  private readWfDomains(): Promise<WfDomainEntry[] | null> {
    const domainList = this.domainList;
    if (!domainList) return Promise.resolve(null);
    this.wfDomainsProbe ??= domainList().then(
      (result) => parseWfDomainList(result.stdout),
      (err: unknown) => {
        baseLogger.warn(
          { error: describeError(err) },
          'Failed to read the Workflow CLI domain list; registration state is unknown.',
        );
        return null;
      },
    );
    return this.wfDomainsProbe;
  }

  /**
   * Does the Workflow CLI point at this managed runtime?
   *
   * The verdict comes from `planDomainRegistration` — the very function the
   * registrar uses — so "needs registration" in the tree and what a
   * registration would actually do can never diverge. A stale entry counts the
   * same as a missing one: it is the more dangerous of the two, because the
   * designer would talk to one runtime while `wf update` deploys to another.
   */
  private async resolveCliRegistrationState(
    env: RuntimeEnvironment,
    binding: LocalRuntimeBinding,
  ): Promise<CliRegistrationState> {
    const service = this.localRuntime;
    // Without a persisted DB_NAME there is nothing to compare the CLI's entry
    // against, and nothing Forge could register without guessing a database
    // name that may not exist — so the state stays unknown and the action hidden.
    if (!service || !env.dbName) return 'unknown';

    const entries = await this.readWfDomains();
    if (!entries) return 'unknown';

    const { domainName, apiBaseUrl, dbName } = service.buildDomainAddArgs(binding, env.dbName);
    const plan = planDomainRegistration(entries, { domainName, apiBaseUrl, dbName });
    // `blocked-default` also needs registration: it is wrong and the user has
    // to be told, even though only the CLI itself can repair that one.
    return plan.action === 'up-to-date' ? 'ok' : 'needs-registration';
  }

  private buildLocalTooltip(
    env: RuntimeEnvironment,
    binding: LocalRuntimeBinding,
    state: TreeContainerState,
    isActive: boolean,
    health: HealthStatus | undefined,
    cliState: CliRegistrationState,
  ): string {
    const lines = [
      `Name: ${env.name}`,
      `URL: ${env.baseUrl}`,
      `Status: ${isActive ? 'Active' : 'Inactive'}`,
      'Type: Managed local runtime (Docker)',
      `Domain: ${binding.domain}`,
      `Port offset: ${binding.portOffset}`,
    ];
    if (env.dbName) {
      lines.push(`DB Name: ${env.dbName}`);
    }
    if (health) {
      lines.push(`Health: ${health}`);
    }
    lines.push(
      state === 'unknown'
        ? 'Containers: unknown — the container runtime is not available'
        : `Containers: ${CONTAINER_STATE_LABELS[state]}`,
    );
    lines.push(CLI_REGISTRATION_TOOLTIPS[cliState]);
    lines.push(
      'Ports:',
      `  Orchestration API: ${binding.ports.app}`,
      `  Execution: ${binding.ports.execution}`,
      `  Worker Inbox: ${binding.ports.inbox}`,
      `  Worker Outbox: ${binding.ports.outbox}`,
      `  Init: ${binding.ports.init}`,
      `Runtime path: ${binding.runtimePath}`,
    );
    return lines.join('\n');
  }

  private getLocalIcon(
    state: TreeContainerState,
    isActive: boolean,
    health?: HealthStatus,
  ): vscode.ThemeIcon {
    switch (state) {
      case 'running':
        // Amber for "the containers are up but the API is not answering" —
        // a distinct situation from both healthy and stopped.
        return isActive && health === 'unhealthy'
          ? new vscode.ThemeIcon('circle-large-filled', new vscode.ThemeColor('testing.iconQueued'))
          : new vscode.ThemeIcon('circle-large-filled', new vscode.ThemeColor('testing.iconPassed'));
      case 'stopped':
        return new vscode.ThemeIcon('debug-stop');
      case 'absent':
        return new vscode.ThemeIcon('circle-outline');
      default:
        // Deliberately neither the "absent" nor any health colour: we do not
        // know the state, and must not imply that we do.
        return new vscode.ThemeIcon('question');
    }
  }

  private getHealthIcon(isActive: boolean, health?: HealthStatus): vscode.ThemeIcon {
    if (!isActive) return new vscode.ThemeIcon('circle-outline');
    switch (health) {
      case 'healthy':
        return new vscode.ThemeIcon('circle-large-filled', new vscode.ThemeColor('testing.iconPassed'));
      case 'unhealthy':
        return new vscode.ThemeIcon('circle-large-filled', new vscode.ThemeColor('testing.iconFailed'));
      case 'checking':
        return new vscode.ThemeIcon('loading~spin');
      default:
        return new vscode.ThemeIcon('circle-large-outline');
    }
  }
}
