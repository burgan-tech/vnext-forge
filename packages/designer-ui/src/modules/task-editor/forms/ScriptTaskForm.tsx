import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { isFailure } from '@vnext-forge/app-contracts';
import { FileCode, Plus } from 'lucide-react';

import { ScriptEditorPanel } from '../../code-editor/layout/ScriptEditorPanel';
import type { ScriptCode } from '../../code-editor/CodeEditorTypes';
import { decodeFromBase64, encodeToBase64, isBase64 } from '../../code-editor/editor/Base64Handler';
import { generateTemplate } from '../../code-editor/editor/CsxTemplates';
import { getScriptLocationError } from '../../code-editor/ScriptLocationValidation';
import { readFile } from '../../project-workspace/WorkspaceApi';
import { showNotification } from '../../../notification/notification-port.js';
import { useComponentStore } from '../../../store/useComponentStore';
import { useProjectStore } from '../../../store/useProjectStore';
import { groupCsxScriptsForTaskPicker } from '../groupCsxScriptsForTaskPicker.js';
import { resolveTaskScriptAbsolutePath, toTaskRelativeScriptLocation } from '../scriptTaskPaths';
import { listProjectCsxScripts, type ListedCsxScript } from '../services/listProjectCsxScripts';
import { useScriptTaskChrome } from '../ScriptTaskChromeContext.js';
import { Button } from '../../../ui/Button';
import {
  Dialog,
  DialogCancelButton,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../../../ui/Dialog';
import { Input } from '../../../ui/Input';

interface Props {
  config: Record<string, unknown>;
  onChange: (updater: (draft: any) => void) => void;
}

/** Normalize line endings to avoid spurious hydrate / dirty state. */
function normalizeCsxText(text: string): string {
  return text.replace(/\r\n/g, '\n');
}

/** True when on-disk .csx body matches task JSON script (base64 or plain). */
function taskScriptBodyMatchesDiskFile(config: Record<string, unknown>, fileText: string): boolean {
  const disk = normalizeCsxText(fileText);
  const raw = config.script;
  const rawStr = typeof raw === 'string' ? raw : '';
  if (!rawStr) {
    return disk.length === 0;
  }
  let body: string;
  if (config.encoding === 'B64' || isBase64(rawStr)) {
    body = normalizeCsxText(decodeFromBase64(rawStr));
  } else {
    body = normalizeCsxText(rawStr);
  }
  return body === disk;
}

/** Stable signature for script fields only (used for “discard script” confirm). */
function scriptTaskConfigSignature(cfg: Record<string, unknown>): string {
  return JSON.stringify({
    location: typeof cfg.location === 'string' ? cfg.location : '',
    script: typeof cfg.script === 'string' ? cfg.script : '',
    encoding: cfg.encoding ?? '',
  });
}

function configToScriptCode(config: Record<string, unknown>): ScriptCode {
  const raw = config.script;
  const rawStr = typeof raw === 'string' ? raw : '';
  const location = typeof config.location === 'string' ? config.location : '';
  if (!rawStr) {
    return { location, code: encodeToBase64(''), encoding: 'B64' };
  }
  if (config.encoding === 'B64' || isBase64(rawStr)) {
    return { location, code: rawStr, encoding: 'B64' };
  }
  return { location, code: encodeToBase64(rawStr), encoding: 'B64' };
}

export function ScriptTaskForm({ config, onChange }: Props) {
  const activeProject = useProjectStore((s) => s.activeProject);
  const vnextConfig = useProjectStore((s) => s.vnextConfig);
  const filePath = useComponentStore((s) => s.filePath);
  const taskKey = useComponentStore((s) =>
    String((s.componentJson as Record<string, unknown> | null)?.key ?? 'ScriptTask'),
  );
  const scriptChrome = useScriptTaskChrome();

  const scriptRaw = config.script;
  const scriptLoc = config.location;
  const scriptEnc = config.encoding;

  const scriptValue = useMemo(() => configToScriptCode(config), [scriptRaw, scriptLoc, scriptEnc]);

  const [phase, setPhase] = useState<'pick' | 'edit'>('pick');
  const [pickLocked, setPickLocked] = useState(false);
  const [listQuery, setListQuery] = useState('');
  const [csxList, setCsxList] = useState<ListedCsxScript[]>([]);
  const [listLoading, setListLoading] = useState(false);
  const [listError, setListError] = useState<string | null>(null);
  const [discardDialogOpen, setDiscardDialogOpen] = useState(false);

  const hydrateKeyRef = useRef<string | null>(null);
  /** Baseline script signature after entering edit or hydrating from disk (avoids false confirm vs global isDirty). */
  const scriptConfigBaselineRef = useRef<string | null>(null);
  const prevPhaseRef = useRef<'pick' | 'edit'>(phase);

  useEffect(() => {
    setPickLocked(false);
    hydrateKeyRef.current = null;
    scriptConfigBaselineRef.current = null;
  }, [filePath]);

  useEffect(() => {
    if (pickLocked) return;
    const loc = String(config.location ?? '');
    const hasScript = Boolean(config.script);
    if (!getScriptLocationError(loc) && hasScript) {
      setPhase('edit');
    } else {
      setPhase('pick');
    }
  }, [filePath, scriptRaw, scriptLoc, pickLocked, config.script, config.location]);

  useEffect(() => {
    if (phase === 'edit' && prevPhaseRef.current !== 'edit') {
      scriptConfigBaselineRef.current = scriptTaskConfigSignature({
        location: typeof scriptLoc === 'string' ? scriptLoc : '',
        script: typeof scriptRaw === 'string' ? scriptRaw : '',
        encoding: scriptEnc ?? '',
      });
    }
    prevPhaseRef.current = phase;
  }, [phase, scriptRaw, scriptLoc, scriptEnc]);

  useEffect(() => {
    if (phase !== 'pick') return;
    if (!activeProject?.id || !activeProject.path) {
      setListLoading(false);
      setListError('No project context to load the script list.');
      setCsxList([]);
      return;
    }
    let cancelled = false;
    setListLoading(true);
    setListError(null);
    void listProjectCsxScripts(activeProject.id, activeProject.path).then((res) => {
      if (cancelled) return;
      setListLoading(false);
      if (isFailure(res)) {
        setListError(res.error.message ?? 'Failed to load script list.');
        setCsxList([]);
        return;
      }
      setCsxList(res.data);
    });
    return () => {
      cancelled = true;
    };
  }, [phase, activeProject?.id, activeProject?.path]);

  useEffect(() => {
    if (phase !== 'edit' || pickLocked || !filePath) return;
    const loc = String(config.location ?? '');
    if (getScriptLocationError(loc)) return;
    const key = `${filePath}\0${loc}`;
    if (hydrateKeyRef.current === key) return;
    hydrateKeyRef.current = key;
    let cancelled = false;
    void (async () => {
      const myKey = key;
      try {
        const abs = resolveTaskScriptAbsolutePath(filePath, loc);
        const { content } = await readFile(abs);
        if (cancelled || hydrateKeyRef.current !== myKey) return;
        if (taskScriptBodyMatchesDiskFile(config, content)) {
          hydrateKeyRef.current = key;
          scriptConfigBaselineRef.current = scriptTaskConfigSignature(config);
          return;
        }
        const enc = encodeToBase64(content);
        onChange((d: any) => {
          d.script = enc;
          d.encoding = 'B64';
        });
        scriptConfigBaselineRef.current = scriptTaskConfigSignature({
          ...config,
          location: loc,
          script: enc,
          encoding: 'B64',
        });
      } catch {
        /* File missing or unreadable — keep JSON content */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [phase, pickLocked, filePath, config.location, onChange]);

  const handleScriptChange = useCallback(
    (next: ScriptCode) => {
      onChange((d: any) => {
        d.location = next.location;
        d.script = next.code;
        d.encoding = next.encoding ?? 'B64';
      });
    },
    [onChange],
  );

  const onSelectListedScript = useCallback(
    async (item: ListedCsxScript) => {
      if (!filePath) {
        showNotification({ kind: 'error', message: 'Task file path is unknown.' });
        return;
      }
      setPickLocked(false);
      try {
        const { content } = await readFile(item.absolutePath);
        const rel = toTaskRelativeScriptLocation(filePath, item.absolutePath);
        onChange((d: any) => {
          d.location = rel;
          d.script = encodeToBase64(content);
          d.encoding = 'B64';
        });
        hydrateKeyRef.current = `${filePath}\0${rel}`;
        setPhase('edit');
      } catch {
        showNotification({ kind: 'error', message: 'Could not read script file.' });
      }
    },
    [filePath, onChange],
  );

  const onNewScript = useCallback(() => {
    setPickLocked(false);
    const { location, code } = generateTemplate('mapping', taskKey, 'ScriptTask');
    onChange((d: any) => {
      d.location = location;
      d.script = encodeToBase64(code);
      d.encoding = 'B64';
    });
    if (filePath) {
      hydrateKeyRef.current = `${filePath}\0${location}`;
    }
    setPhase('edit');
  }, [filePath, onChange, taskKey]);

  const proceedDiscardPickAnother = useCallback(() => {
    setDiscardDialogOpen(false);
    setPickLocked(true);
    setPhase('pick');
    setListQuery('');
  }, []);

  const onDiscardPickAnother = useCallback(() => {
    const baseline = scriptConfigBaselineRef.current;
    const current = scriptTaskConfigSignature({
      location: typeof scriptLoc === 'string' ? scriptLoc : '',
      script: typeof scriptRaw === 'string' ? scriptRaw : '',
      encoding: scriptEnc ?? '',
    });
    if (baseline != null && current !== baseline) {
      setDiscardDialogOpen(true);
      return;
    }
    proceedDiscardPickAnother();
  }, [scriptRaw, scriptLoc, scriptEnc, proceedDiscardPickAnother]);

  const unsavedDiscardDialog = (
    <Dialog open={discardDialogOpen} onOpenChange={setDiscardDialogOpen}>
      <DialogContent className="max-w-md gap-6">
        <DialogHeader>
          <DialogTitle>Unsaved script changes</DialogTitle>
        </DialogHeader>
        <DialogDescription className="text-center sm:text-left">
          You have unsaved changes to this script. Go back to the script picker anyway? Your edits stay
          in the task until you save the task file.
        </DialogDescription>
        <DialogFooter>
          <DialogCancelButton type="button">Stay in editor</DialogCancelButton>
          <Button type="button" variant="warning" onClick={proceedDiscardPickAnother}>
            Pick another script
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );

  const filteredCsxList = useMemo(() => {
    const q = listQuery.trim().toLowerCase();
    if (!q) return csxList;
    return csxList.filter((item) => item.projectRelative.toLowerCase().includes(q));
  }, [csxList, listQuery]);

  const groupedPickRows = useMemo(
    () => groupCsxScriptsForTaskPicker(filteredCsxList, vnextConfig?.paths ?? null),
    [filteredCsxList, vnextConfig?.paths],
  );

  const isFlatPicker =
    groupedPickRows.length === 1 && groupedPickRows[0] && groupedPickRows[0].category === '';

  const scriptAbsoluteForHost =
    filePath && !getScriptLocationError(String(scriptValue.location ?? ''))
      ? resolveTaskScriptAbsolutePath(filePath, String(scriptValue.location ?? ''))
      : null;

  if (phase === 'pick') {
    return (
      <>
        {unsavedDiscardDialog}
        <div className="flex h-[min(90vh,1080px)] min-h-[560px] flex-col gap-3 overflow-hidden py-1">
        <div className="shrink-0 space-y-3">
          <div className="text-foreground text-sm font-medium">Choose a script</div>
          <p className="text-muted-foreground text-xs">
            Select an existing .csx file or start from a new script. You must choose before the
            editor opens.
          </p>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              leftIcon={<Plus className="size-3.5" />}
              variant="secondary"
              leftIconType="solid"
              leftIconVariant="success"
              size="sm"
              onClick={onNewScript}>
              New script
            </Button>
          </div>
        </div>
        <div className="flex min-h-0 flex-1 flex-col gap-2">
          {listLoading && (
            <div className="text-muted-foreground flex flex-1 items-center justify-center text-xs">
              Scanning project…
            </div>
          )}
          {listError && <div className="text-destructive shrink-0 text-xs">{listError}</div>}
          {!listLoading && !listError && (
            <>
              <Input
                type="search"
                placeholder="Search by path…"
                value={listQuery}
                onChange={(e) => setListQuery(e.target.value)}
                variant="muted"
                size="sm"
                className="max-w-md shrink-0"
              />
              <div className="border-border bg-surface/30 min-h-0 flex-1 overflow-y-auto rounded-md border">
                {filteredCsxList.length === 0 ? (
                  <div className="text-muted-foreground p-3 text-xs">No matching .csx files.</div>
                ) : isFlatPicker ? (
                  <ul className="divide-border-subtle divide-y">
                    {groupedPickRows[0]!.items.map(({ item }) => (
                      <li key={item.absolutePath}>
                        <button
                          type="button"
                          onClick={() => void onSelectListedScript(item)}
                          className="hover:bg-muted/80 flex w-full cursor-pointer items-center gap-2 px-3 py-2 text-left text-xs transition-colors">
                          <FileCode className="text-muted-icon size-3.5 shrink-0" />
                          <span className="text-foreground font-mono">{item.projectRelative}</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <div className="divide-border-subtle divide-y">
                    {groupedPickRows.map((row) => (
                      <div key={`${row.category}\0${row.subgroup}`} className="py-2">
                        <div className="text-muted-foreground px-3 pb-1 text-[10px] font-semibold tracking-wide uppercase">
                          {row.subgroup ? `${row.category} › ${row.subgroup}` : row.category}
                        </div>
                        <ul>
                          {row.items.map(({ item, displayPath }) => (
                            <li key={item.absolutePath}>
                              <button
                                type="button"
                                onClick={() => void onSelectListedScript(item)}
                                className="hover:bg-muted/80 flex w-full cursor-pointer items-center gap-2 px-3 py-2 text-left text-xs transition-colors">
                                <FileCode className="text-muted-icon size-3.5 shrink-0" />
                                <span className="text-foreground font-mono">{displayPath}</span>
                              </button>
                            </li>
                          ))}
                        </ul>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>
      </>
    );
  }

  return (
    <>
      {unsavedDiscardDialog}
      <div className="border-border flex h-[min(90vh,1080px)] min-h-[560px] flex-1 flex-col overflow-hidden rounded-lg border py-1 shadow-sm">
        <ScriptEditorPanel
          taskInline={{
            value: scriptValue,
            onChange: handleScriptChange,
            label: 'C# Script',
            onPickAnotherScript: onDiscardPickAnother,
            onOpenInFullEditor:
              scriptChrome?.onOpenScriptFileInHost && scriptAbsoluteForHost
                ? () => scriptChrome.onOpenScriptFileInHost!(scriptAbsoluteForHost)
                : undefined,
          }}
        />
      </div>
    </>
  );
}
