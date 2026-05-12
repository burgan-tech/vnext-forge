import { useEffect, useLayoutEffect, useState } from 'react';
import {
  Accordion,
  Button,
  Checkbox,
  ColorThemeSwitchSidebar,
  Input,
  Label,
  useProjectStore,
  useSettingsStore,
} from '@vnext-forge-studio/designer-ui';
import {
  Loader2,
  Palette,
  Pencil,
  Play,
  Plus,
  Save,
  Server,
  ChevronDown,
  Terminal,
  Trash2,
} from 'lucide-react';
import { isFailure } from '@vnext-forge-studio/app-contracts';

import { executeCliCommand } from '../../../services/cli.service';
import { ProjectWorkspaceSidebarPanel } from '../../../modules/project-workspace';
import { SearchPanel } from '../../../modules/project-search/SearchPanel';
import { ProblemsSidebarPanel, SnippetsSidebarPanel } from '@vnext-forge-studio/designer-ui';
import { useCliStore } from '../../store/useCliStore';
import { useCliOutputStore } from '../../store/useCliOutputStore';
import {
  useQuickRunSettingsStore,
  DEFAULT_QUICKRUN_POLLING,
} from '../../store/useQuickRunSettingsStore';
import { useEnvironmentStore } from '../../store/useEnvironmentStore';
import { useWebShellStore } from '../../store/useWebShellStore';
import { useWorkspaceDiagnosticsStore } from '../../store/useWorkspaceDiagnosticsStore';

function EnvironmentsSection() {
  const environments = useEnvironmentStore((s) => s.environments);
  const activeEnvironmentId = useEnvironmentStore((s) => s.activeEnvironmentId);
  const setActiveEnvironment = useEnvironmentStore((s) => s.setActiveEnvironment);
  const addEnvironment = useEnvironmentStore((s) => s.addEnvironment);
  const updateEnvironment = useEnvironmentStore((s) => s.updateEnvironment);
  const removeEnvironment = useEnvironmentStore((s) => s.removeEnvironment);

  const [addingOpen, setAddingOpen] = useState(false);
  const [addName, setAddName] = useState('');
  const [addUrl, setAddUrl] = useState('');
  const [formError, setFormError] = useState<string | null>(null);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editUrl, setEditUrl] = useState('');

  const resetAddForm = () => {
    setAddingOpen(false);
    setAddName('');
    setAddUrl('');
    setFormError(null);
  };

  const handleAdd = () => {
    setFormError(null);
    try {
      addEnvironment(addName, addUrl);
      resetAddForm();
    } catch (e) {
      setFormError(e instanceof Error ? e.message : 'Could not add environment.');
    }
  };

  const beginEdit = (env: { id: string; name: string; baseUrl: string }) => {
    setEditingId(env.id);
    setEditName(env.name);
    setEditUrl(env.baseUrl);
    setFormError(null);
  };

  const saveEdit = (id: string) => {
    setFormError(null);
    try {
      updateEnvironment(id, { name: editName, baseUrl: editUrl });
      setEditingId(null);
    } catch (e) {
      setFormError(e instanceof Error ? e.message : 'Could not save environment.');
    }
  };

  const cancelEdit = () => {
    setEditingId(null);
    setFormError(null);
  };

  const confirmRemove = (id: string, label: string) => {
    if (
      !window.confirm(`Remove environment "${label}"? This cannot be undone.`)
    ) {
      return;
    }
    removeEnvironment(id);
    if (editingId === id) setEditingId(null);
  };

  return (
    <div className="flex flex-col gap-2 py-1">
      {formError ? (
        <p role="alert" className="text-[11px] leading-snug text-destructive">
          {formError}
        </p>
      ) : null}

      {environments.length === 0 ? (
        <p className="text-muted-foreground text-[11px] leading-snug">No environments configured</p>
      ) : (
        <ul className="flex flex-col gap-2" role="radiogroup" aria-label="Runtime environments">
          {environments.map((env) => (
            <li key={env.id}>
              {editingId === env.id ? (
                <div className="border-border flex flex-col gap-2 rounded-md border p-2">
                  <Label htmlFor={`edit-env-name-${env.id}`} className="text-[10px] uppercase">
                    Name
                  </Label>
                  <Input
                    id={`edit-env-name-${env.id}`}
                    size="sm"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                  />
                  <Label htmlFor={`edit-env-url-${env.id}`} className="text-[10px] uppercase">
                    Base URL
                  </Label>
                  <Input
                    id={`edit-env-url-${env.id}`}
                    size="sm"
                    value={editUrl}
                    onChange={(e) => setEditUrl(e.target.value)}
                    placeholder="https://..."
                  />
                  <div className="flex justify-end gap-2 pt-1">
                    <Button type="button" variant="ghost" size="sm" onClick={cancelEdit}>
                      Cancel
                    </Button>
                    <Button type="button" variant="default" size="sm" onClick={() => saveEdit(env.id)}>
                      Save
                    </Button>
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  role="radio"
                  aria-checked={activeEnvironmentId === env.id}
                  onClick={() => setActiveEnvironment(env.id)}
                  className={`border-border hover:bg-muted/50 flex w-full flex-col rounded-md border px-2 py-2 text-left transition-colors ${
                    activeEnvironmentId === env.id ? 'bg-primary/5 border-primary/40 ring-primary/20 ring-1' : ''
                  }`}>
                  <span className="text-[11px] font-semibold">{env.name}</span>
                  <span className="text-muted-foreground truncate text-[10px]">{env.baseUrl}</span>
                  <div className="mt-2 flex gap-1">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-7 min-h-7 px-2"
                      onClick={(e) => {
                        e.stopPropagation();
                        beginEdit(env);
                      }}
                      aria-label={`Edit ${env.name}`}>
                      <Pencil className="size-3" strokeWidth={2} aria-hidden />
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-7 min-h-7 px-2"
                      onClick={(e) => {
                        e.stopPropagation();
                        confirmRemove(env.id, env.name);
                      }}
                      aria-label={`Delete ${env.name}`}>
                      <Trash2 className="size-3" strokeWidth={2} aria-hidden />
                    </Button>
                  </div>
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      {addingOpen ? (
        <div className="border-border flex flex-col gap-2 rounded-md border p-2">
          <Label htmlFor="new-env-name" className="text-[10px] uppercase">
            Name
          </Label>
          <Input
            id="new-env-name"
            size="sm"
            value={addName}
            onChange={(e) => setAddName(e.target.value)}
            placeholder="Local runtime"
          />
          <Label htmlFor="new-env-url" className="text-[10px] uppercase">
            Base URL
          </Label>
          <Input
            id="new-env-url"
            size="sm"
            value={addUrl}
            onChange={(e) => setAddUrl(e.target.value)}
            placeholder="http://localhost:4201"
          />
          <div className="flex justify-end gap-2 pt-1">
            <Button type="button" variant="ghost" size="sm" onClick={resetAddForm}>
              Cancel
            </Button>
            <Button type="button" variant="default" size="sm" onClick={handleAdd}>
              Add
            </Button>
          </div>
        </div>
      ) : (
        <Button type="button" variant="outline" size="sm" className="w-full" onClick={() => setAddingOpen(true)}>
          <Plus className="size-3.5" strokeWidth={2} aria-hidden />
          Add Environment
        </Button>
      )}
    </div>
  );
}

function QuickRunPollingSection() {
  const polling = useQuickRunSettingsStore((s) => s.polling);
  const setPolling = useQuickRunSettingsStore((s) => s.setPolling);

  const retryCount =
    polling.retryCount > 0 ? polling.retryCount : DEFAULT_QUICKRUN_POLLING.retryCount;
  const intervalMs =
    polling.intervalMs > 0 ? polling.intervalMs : DEFAULT_QUICKRUN_POLLING.intervalMs;

  return (
    <div className="flex flex-col gap-3 py-1">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="quickrun-retry-count" className="text-[10px] font-medium uppercase">
          Polling retry count
        </Label>
        <Input
          id="quickrun-retry-count"
          size="sm"
          inputMode="numeric"
          min={1}
          value={retryCount}
          onChange={(e) => {
            const n = Number(e.target.value);
            if (!Number.isNaN(n) && n > 0) setPolling({ retryCount: n });
          }}
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="quickrun-interval-ms" className="text-[10px] font-medium uppercase">
          Polling interval (ms)
        </Label>
        <Input
          id="quickrun-interval-ms"
          size="sm"
          inputMode="numeric"
          min={1}
          value={intervalMs}
          onChange={(e) => {
            const n = Number(e.target.value);
            if (!Number.isNaN(n) && n > 0) setPolling({ intervalMs: n });
          }}
        />
      </div>
    </div>
  );
}

const WORKFLOW_CLI_COMMANDS: { label: string; command: string }[] = [
  { label: 'Deploy All', command: 'update --all' },
  { label: 'Deploy Changed', command: 'update' },
  { label: 'Embed CSX', command: 'csx --all' },
  { label: 'Health Check', command: 'check' },
  { label: 'Sync', command: 'sync' },
];

function WorkflowCliSection() {
  const projectId = useProjectStore((s) => s.activeProject?.id);
  const available = useCliStore((s) => s.available);
  const version = useCliStore((s) => s.version);
  const checking = useCliStore((s) => s.checking);
  const checkAvailability = useCliStore((s) => s.checkAvailability);
  const latestVersion = useCliStore((s) => s.latestVersion);
  const updateAvailable = useCliStore((s) => s.updateAvailable);
  const updating = useCliStore((s) => s.updating);
  const checkForUpdateCli = useCliStore((s) => s.checkForUpdate);
  const runUpdate = useCliStore((s) => s.runUpdate);
  const runningCommand = useCliOutputStore((s) => s.runningCommand);
  const lastOutput = useCliOutputStore((s) => s.lastOutput);

  const [outputOpen, setOutputOpen] = useState(false);

  const cliUnavailable = !(checking || available === null) && available === false;
  const cliReady = available === true;
  const statusPending = checking || available === null;

  useEffect(() => {
    if (!cliReady) return;
    void checkForUpdateCli();
  }, [cliReady, checkForUpdateCli]);

  const runCli = async (command: string) => {
    if (!projectId) return;
    const store = useCliOutputStore.getState();
    store.setRunning(command);
    try {
      const result = await executeCliCommand({ command, projectId });
      if (isFailure(result)) {
        store.setOutput({ command, exitCode: -1, stdout: '', stderr: result.error.message });
        return;
      }
      const { exitCode, stdout, stderr } = result.data;
      store.setOutput({ command, exitCode, stdout, stderr });
    } catch {
      store.setOutput({ command, exitCode: -1, stdout: '', stderr: 'Unexpected error' });
    }
  };

  return (
    <div className="flex flex-col gap-3 py-1">
      <div className="flex flex-col gap-2">
        <div className="text-muted-foreground flex items-center gap-2 text-[11px] leading-snug">
          {statusPending ? (
            <>
              <Loader2 className="text-muted-foreground size-3.5 shrink-0 animate-spin" aria-hidden />
              <span>Checking Workflow CLI...</span>
            </>
          ) : cliReady ? (
            <>
              <span
                className="size-2 shrink-0 rounded-full bg-emerald-500"
                aria-hidden
                title="Workflow CLI available"
              />
              <span>
                Workflow CLI{version ? ` ${version}` : ''}
              </span>
            </>
          ) : (
            <>
              <span
                className="bg-muted-foreground size-2 shrink-0 rounded-full"
                aria-hidden
                title="Workflow CLI not installed"
              />
              <span>Not installed</span>
            </>
          )}
        </div>

        {cliUnavailable ? (
          <p className="text-muted-foreground text-[11px] leading-snug">
            Workflow CLI is not installed. Run:{' '}
            <code className="bg-muted text-foreground rounded px-1 py-px font-mono text-[10px]">
              npm install -g @burgan-tech/vnext-workflow-cli
            </code>
          </p>
        ) : null}

        {!checking && available === false ? (
          <Button type="button" variant="outline" size="sm" className="w-full" onClick={() => void checkAvailability()}>
            Check again
          </Button>
        ) : null}

        {cliReady && updateAvailable && latestVersion ? (
          <div className="border-border bg-muted/30 flex flex-col gap-2 rounded-md border px-2 py-2">
            <p className="text-amber-600 dark:text-amber-400 text-[11px] leading-snug">
              Update available: v{latestVersion}
            </p>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              className="w-full gap-2"
              disabled={updating}
              aria-busy={updating}
              onClick={() => void runUpdate()}>
              {updating ? (
                <>
                  <Loader2 className="size-3.5 shrink-0 animate-spin" aria-hidden />
                  <span>Updating…</span>
                </>
              ) : (
                'Update CLI'
              )}
            </Button>
          </div>
        ) : null}
      </div>

      <div className="flex flex-col gap-2">
        <p className="text-muted-foreground text-[10px] font-medium uppercase tracking-wide">Commands</p>
        <div className="flex flex-col gap-1.5">
          {WORKFLOW_CLI_COMMANDS.map(({ label, command }) => {
            const busy = runningCommand === command;
            return (
              <Button
                key={command}
                type="button"
                variant="outline"
                size="sm"
                className="w-full justify-start gap-2 font-normal"
                disabled={!cliReady || !projectId || runningCommand !== null}
                onClick={() => void runCli(command)}
                aria-busy={busy}>
                {busy ? <Loader2 className="size-3.5 shrink-0 animate-spin" aria-hidden /> : null}
                {label}
              </Button>
            );
          })}
        </div>
      </div>

      {lastOutput ? (
        <div className="flex flex-col gap-1">
          <button
            type="button"
            className="border-border bg-muted/40 text-foreground flex w-full items-center justify-between rounded border px-2 py-1.5 text-left text-[11px] font-medium"
            onClick={() => setOutputOpen((o) => !o)}
            aria-expanded={outputOpen}
            aria-controls="workflow-cli-output-panel">
            <span>Command output</span>
            <ChevronDown
              className={`size-3.5 shrink-0 transition-transform ${outputOpen ? 'rotate-180' : ''}`}
              aria-hidden
            />
          </button>
          {outputOpen ? (
            <div
              id="workflow-cli-output-panel"
              role="region"
              aria-label="Last CLI output"
              className="border-border max-h-48 overflow-auto rounded border bg-[#0f0f12] p-2 font-mono text-[10px] leading-relaxed text-neutral-100 select-text">
              <p className="text-neutral-400 pb-1">{lastOutput.command}</p>
              <p className="text-neutral-400">exit {lastOutput.exitCode}</p>
              {lastOutput.stdout ? (
                <pre className="mt-2 whitespace-pre-wrap break-all">{lastOutput.stdout}</pre>
              ) : null}
              {lastOutput.stderr ? (
                <pre className="mt-2 whitespace-pre-wrap break-all text-red-400">{lastOutput.stderr}</pre>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

export function Sidebar() {
  const sidebarView = useWebShellStore((s) => s.sidebarView);
  // `Snippets` sidebar panel needs the active project so it can ask the
  // host for project-scoped entries (the `Personal` scope works without
  // it). Other sub-sections that need this id resolve it locally.
  const activeProjectId = useProjectStore((s) => s.activeProject?.id);
  const settingsAccordionBootToken = useWebShellStore((s) => s.settingsAccordionBootToken);
  const pendingSettingsAccordionOpenIds = useWebShellStore((s) => s.pendingSettingsAccordionOpenIds);
  const clearPendingSettingsAccordionOpen = useWebShellStore(
    (s) => s.clearPendingSettingsAccordionOpen,
  );
  const colorTheme = useSettingsStore((s) => s.colorTheme);
  const setColorTheme = useSettingsStore((s) => s.setColorTheme);
  const autoSaveEnabled = useSettingsStore((s) => s.autoSaveEnabled);
  const setAutoSaveEnabled = useSettingsStore((s) => s.setAutoSaveEnabled);
  const configIssues = useWorkspaceDiagnosticsStore((s) => s.configIssues);

  const settingsAccordionDefaultOpenIds = pendingSettingsAccordionOpenIds ?? [];

  useLayoutEffect(() => {
    if (pendingSettingsAccordionOpenIds !== null) {
      clearPendingSettingsAccordionOpen();
    }
  }, [clearPendingSettingsAccordionOpen, pendingSettingsAccordionOpenIds]);

  return (
    <div className="flex h-full min-h-0 min-w-0 flex-col">
      <div className="text-muted-foreground px-4 py-3 text-[11px] font-semibold tracking-widest uppercase">
        {sidebarView === 'project' && 'Explorer'}
        {sidebarView === 'search' && 'Search'}
        {sidebarView === 'validation' && 'Problems'}
        {sidebarView === 'templates' && 'Settings'}
        {sidebarView === 'snippets' && 'Snippets'}
      </div>

      <div className="flex-1 overflow-y-auto">
        {sidebarView === 'project' && <ProjectWorkspaceSidebarPanel />}

        {sidebarView === 'search' && (
          <div className="mt-1 flex h-full min-h-0 flex-col">
            <SearchPanel />
          </div>
        )}

        {sidebarView === 'snippets' && (
          <SnippetsSidebarPanel projectId={activeProjectId ?? null} />
        )}

        {sidebarView === 'validation' && (
          <ProblemsSidebarPanel configIssues={configIssues} />
        )}

        {sidebarView === 'templates' && (
          <div className="px-3 pt-2">
            <Accordion
              key={`settings-accordion-${settingsAccordionBootToken}`}
              allowMultiple={false}
              chrome
              density="inline"
              defaultOpenItemIds={settingsAccordionDefaultOpenIds}
              items={[
                {
                  id: 'appearance',
                  title: 'Appearance',
                  icon: <Palette className="size-3.5" strokeWidth={2} aria-hidden />,
                  content: (
                    <ColorThemeSwitchSidebar compact variant="plain" value={colorTheme} onChange={setColorTheme} />
                  ),
                },
                {
                  id: 'editor',
                  title: 'Editor',
                  icon: <Save className="size-3.5" strokeWidth={2} aria-hidden />,
                  content: (
                    <div className="flex items-center gap-2 py-1">
                      <Checkbox
                        id="auto-save-toggle"
                        checked={autoSaveEnabled}
                        onCheckedChange={(checked) => setAutoSaveEnabled(checked === true)}
                      />
                      <Label
                        htmlFor="auto-save-toggle"
                        className="text-[11px] font-medium leading-tight cursor-pointer select-none">
                        Enable Auto Save
                      </Label>
                    </div>
                  ),
                },
                {
                  id: 'environments',
                  title: 'Environments',
                  icon: <Server className="size-3.5" strokeWidth={2} aria-hidden />,
                  content: <EnvironmentsSection />,
                },
                {
                  id: 'workflow-cli',
                  title: 'Workflow CLI',
                  icon: <Terminal className="size-3.5" strokeWidth={2} aria-hidden />,
                  content: <WorkflowCliSection />,
                },
                {
                  id: 'quickrun',
                  title: 'Quick Run',
                  icon: <Play className="size-3.5" strokeWidth={2} aria-hidden />,
                  content: <QuickRunPollingSection />,
                },
              ]}
            />
          </div>
        )}
      </div>
    </div>
  );
}
