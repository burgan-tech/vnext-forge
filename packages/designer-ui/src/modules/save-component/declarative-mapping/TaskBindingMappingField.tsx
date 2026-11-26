import { useState, type ReactNode } from 'react';

import { useWorkflowStore } from '../../../store/useWorkflowStore';
import { readSchemaReference } from '../../vnext-workspace/loadSchemaComponent';
import { useSchemaComponentJson } from '../../vnext-workspace/useSchemaComponentJson';
import {
  ownerKeepBlocks,
  ownerKeepScript,
  ownerMappingContent,
  ownerSwitchToDeclarative,
  ownerSwitchToScript,
  type BindingMappingMode,
  type MappingBindingLike,
  type MappingBlockOptions,
  type MappingIssue,
  type MappingOwnerKind,
  type MappingPhase,
} from './declarativeMapping';
import type { CompletionContext } from './declarativeMappingCompletions';
import { DeclarativeMappingEditor } from './DeclarativeMappingEditor';

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

/**
 * Master schema root (`attributes.schema` of the schema component referenced
 * by the open workflow's `attributes.schema`), or `undefined` while loading,
 * when the workflow has none, or when the component is not in the project.
 */
export function useOpenWorkflowMasterSchemaRoot(): unknown {
  const workflowJson = useWorkflowStore((s) => s.workflowJson);
  const attributes =
    isRecord(workflowJson) && isRecord(workflowJson.attributes)
      ? workflowJson.attributes
      : undefined;
  const ref = readSchemaReference(attributes?.schema);
  const component = useSchemaComponentJson(ref);
  const componentAttributes =
    component && isRecord(component.attributes) ? component.attributes : undefined;
  return componentAttributes?.schema;
}

const MODE_LABEL: Record<BindingMappingMode, string> = {
  declarative: 'Declarative',
  script: 'C# script',
};

const OWNER_COPY: Record<MappingOwnerKind, { noun: string; blocks: string; both: string }> = {
  task: {
    noun: 'binding',
    blocks: 'the input and output blocks',
    both: 'This binding has both a C# mapping and declarative blocks. Publish rejects it; the runtime runs the script and ignores the blocks. Keep one.',
  },
  transition: {
    noun: 'transition',
    blocks: 'the output block',
    both: 'This transition has both a C# mapping and declarative blocks. Publish rejects it; the runtime runs the script and ignores the blocks. Keep one.',
  },
  subFlow: {
    noun: 'SubFlow',
    blocks: 'the input and output blocks',
    both: 'This SubFlow has both a C# mapping and declarative blocks. Publish rejects it; the runtime runs the script and ignores the blocks. Keep one.',
  },
  event: {
    noun: 'event',
    blocks: 'the input block',
    both: "This event has both a C# mapping and an input block. Publish rejects it ('mapping' and 'input' are mutually exclusive); the runtime runs the script. Keep one.",
  },
  workflowOutput: {
    noun: 'workflow output',
    blocks: 'the output block',
    both: 'This output mixes script members (location / code) and block members (select / into / set). Publish rejects it: the runtime cannot read it. Keep one.',
  },
  functionOutput: {
    noun: 'function output',
    blocks: 'the output block',
    both: 'This output mixes script members (location / code) and block members (select / into / set). Publish rejects it: the runtime cannot read it. Keep one.',
  },
};

/**
 * A task binding's, transition's, SubFlow's or event's mapping: declarative blocks or a
 * C# `mapping` script — one or the other (the runtime rejects both at publish). A workflow /
 * function `output` (`owner` `workflowOutput` / `functionOutput`, `binding` = the attributes)
 * holds a script or a block in the one `output` member: switching replaces that object.
 * A new owner starts declarative; the script stays as the escape hatch.
 * Switching away from content that exists asks first, because it drops it.
 * `declarativeAllowed: false` (an automatic / scheduled transition, a `P`
 * SubProcess) offers the script only; blocks already stored still show, so
 * they can be removed.
 */
export function TaskBindingMappingField({
  binding,
  onUpdate,
  renderScript,
  schemaRoot,
  className,
  phaseHints,
  owner = 'task',
  declarativeAllowed = true,
  ownerIssues = [],
  blockOptions,
  completionContext,
}: {
  binding: MappingBindingLike;
  onUpdate: (updater: (binding: MappingBindingLike) => void) => void;
  /** The existing C# mapping editor (CsxEditorField and its scripts section). */
  renderScript: () => ReactNode;
  /** Workflow master schema root for output target completion. */
  schemaRoot?: unknown;
  /** Padding for the mode switch and the declarative editor; the script editor keeps its own layout. */
  className?: string;
  /** Phase hints for owners whose blocks are not a workflow task binding (CacheAside source, agent tool). */
  phaseHints?: Partial<Record<MappingPhase, string>>;
  /** What holds the blocks (default: a task binding). */
  owner?: MappingOwnerKind;
  /** False where the runtime rejects the blocks: only the script is offered. */
  declarativeAllowed?: boolean;
  /** Owner-level findings (a transition `input`, blocks on a `P`, output on an automatic transition). */
  ownerIssues?: MappingIssue[];
  /** Owner facts for the block checks (function output: `rawResponse`). */
  blockOptions?: MappingBlockOptions;
  /** Owner facts for completions (function output: the task entries' `result` slots). */
  completionContext?: CompletionContext;
}) {
  const [preferred, setPreferred] = useState<BindingMappingMode>(
    declarativeAllowed ? 'declarative' : 'script',
  );
  const [pending, setPending] = useState<BindingMappingMode | null>(null);
  const content = ownerMappingContent(owner, binding);
  // What the owner holds wins; an empty owner takes the author's last choice. `both` opens the script (what runs).
  const mode: BindingMappingMode =
    content === 'script' || content === 'both'
      ? 'script'
      : content === 'declarative'
        ? 'declarative'
        : declarativeAllowed
          ? preferred
          : 'script';
  const copy = OWNER_COPY[owner];
  const modes: BindingMappingMode[] =
    declarativeAllowed || content === 'declarative' || content === 'both'
      ? ['declarative', 'script']
      : ['script'];

  const choose = (next: BindingMappingMode) => {
    if (next === mode) {
      setPending(null);
      return;
    }
    const loses =
      next === 'declarative'
        ? content === 'script' || content === 'both'
        : content === 'declarative';
    if (loses) {
      setPending(next);
      return;
    }
    setPreferred(next);
    setPending(null);
  };

  const confirm = () => {
    if (!pending) return;
    onUpdate(pending === 'declarative' ? ownerSwitchToDeclarative(owner) : ownerSwitchToScript(owner));
    setPreferred(pending);
    setPending(null);
  };

  return (
    <div data-testid={owner === 'task' ? 'task-binding-mapping' : `${owner}-mapping`}>
      <div className={className}>
        <div className="flex items-center gap-2 pb-1.5">
          <span className="text-muted-foreground text-[10px] font-semibold">Mapping</span>
          <div
            role="radiogroup"
            aria-label="Mapping mode"
            className="border-border inline-flex rounded-md border p-0.5">
            {modes.map((m) => (
              <button
                key={m}
                type="button"
                role="radio"
                aria-checked={mode === m}
                onClick={() => choose(m)}
                className={`cursor-pointer rounded px-2 py-0.5 text-[10px] font-medium transition-colors ${
                  mode === m
                    ? 'bg-muted text-foreground'
                    : 'text-muted-foreground hover:text-foreground'
                }`}>
                {MODE_LABEL[m]}
              </button>
            ))}
          </div>
        </div>

        {pending && (
          <div
            role="alert"
            className="border-warning-border bg-warning-surface mb-1.5 rounded-md border px-2 py-1.5 text-[10px]">
            <div className="text-foreground">
              {pending === 'declarative'
                ? `Switching to declarative removes the C# mapping from this ${copy.noun}.`
                : `Switching to C# script removes ${copy.blocks} from this ${copy.noun}.`}
            </div>
            <div className="mt-1 flex gap-2">
              <button
                type="button"
                onClick={confirm}
                className="text-destructive-text cursor-pointer font-semibold hover:underline">
                Remove and switch
              </button>
              <button
                type="button"
                onClick={() => setPending(null)}
                className="text-muted-foreground cursor-pointer hover:underline">
                Cancel
              </button>
            </div>
          </div>
        )}

        {content === 'both' && (
          <div
            role="alert"
            className="border-destructive-border bg-destructive-surface mb-1.5 rounded-md border px-2 py-1.5 text-[10px]">
            <div className="text-destructive-text">{copy.both}</div>
            <div className="mt-1 flex gap-2">
              <button
                type="button"
                onClick={() => onUpdate(ownerKeepScript(owner))}
                className="text-destructive-text cursor-pointer font-semibold hover:underline">
                Keep the script
              </button>
              <button
                type="button"
                onClick={() => {
                  onUpdate(ownerKeepBlocks(owner));
                  setPreferred('declarative');
                }}
                className="text-destructive-text cursor-pointer font-semibold hover:underline">
                Keep the blocks
              </button>
            </div>
          </div>
        )}

        {ownerIssues.map((issue, i) => (
          <div
            key={i}
            role={issue.severity === 'error' ? 'alert' : undefined}
            className={`mb-1.5 text-[10px] ${issue.severity === 'error' ? 'text-destructive-text' : 'text-warning-text'}`}>
            {issue.field ? <span className="font-mono">{issue.field}: </span> : null}
            {issue.message}
          </div>
        ))}

        {mode === 'declarative' && (
          <DeclarativeMappingEditor
            binding={binding}
            schemaRoot={schemaRoot}
            onUpdate={onUpdate}
            phaseHints={phaseHints}
            owner={owner}
            blockOptions={blockOptions}
            completionContext={completionContext}
          />
        )}
      </div>
      {mode === 'script' && renderScript()}
    </div>
  );
}
