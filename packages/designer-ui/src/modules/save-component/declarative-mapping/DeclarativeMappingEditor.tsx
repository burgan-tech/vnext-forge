import { useEffect, useMemo, useState } from 'react';
import { ArrowDown, ArrowUp, Plus, Trash2 } from 'lucide-react';

import {
  addSetEntry,
  moveSetEntry,
  readMappingBlock,
  removeSetEntry,
  renameSetKey,
  setBlockMember,
  setEntries,
  setSetExpression,
  ownerPhases,
  siteKindOf,
  validateMappingBlock,
  type MappingBindingLike,
  type MappingIssue,
  type MappingOwnerKind,
  type MappingPhase,
  type MappingSiteKind,
} from './declarativeMapping';
import { protectedCopyIssues } from './protectedFieldCopy';
import {
  expressionSuggestions,
  expressionTokenAt,
  filterPaths,
  insertExpressionItem,
  selectPaths,
  writeTargetPaths,
} from './declarativeMappingCompletions';
import { SuggestInput, type SuggestFn } from './SuggestInput';

type BindingUpdater = (updater: (binding: MappingBindingLike) => void) => void;

interface SiteCopy {
  title: string;
  hint: string;
  newKey: string;
  selectPlaceholder: string;
  intoPlaceholder: string;
  expressionPlaceholder: string;
}

const SITE_COPY: Record<MappingSiteKind, SiteCopy> = {
  taskInput: {
    title: 'Input',
    hint: 'Shapes the task request. Targets: $.body, $.headers, $.query (the surfaces the task type supports).',
    newKey: '$.body.field',
    selectPlaceholder: '$.data.customer',
    intoPlaceholder: '$.body.customer',
    expressionPlaceholder: 'data.customer.id',
  },
  taskOutput: {
    title: 'Output',
    hint: 'Writes the task result into instance data in one append: into first, then set in order.',
    newKey: '$.field',
    selectPlaceholder: '$.body (default)',
    intoPlaceholder: 'merge at the data root',
    expressionPlaceholder: 'result.body.score',
  },
  transitionOutput: {
    title: 'Output',
    hint: 'Writes the transition into instance data in one append: into first, then set in order. The delta starts empty; select $.input keeps the whole request.',
    newKey: '$.field',
    selectPlaceholder: '$.input.customer',
    intoPlaceholder: '$.customer',
    expressionPlaceholder: 'input.amount',
  },
  subFlowInput: {
    title: 'Input',
    hint: "Builds the child's start request: $.attributes.x, $.headers.x, $.key (a string), $.tags (an array of strings).",
    newKey: '$.attributes.field',
    selectPlaceholder: '$.data.customer',
    intoPlaceholder: '$.attributes.customer',
    expressionPlaceholder: 'data.customer.id',
  },
  subFlowOutput: {
    title: 'Output',
    hint: 'Runs when the child completes or faults: result = { data, status } ("completed" / "faulted"). Writes into instance data in one append.',
    newKey: '$.field',
    selectPlaceholder: '$.data (default)',
    intoPlaceholder: 'merge at the data root',
    expressionPlaceholder: 'result.status',
  },
};

const EXPRESSION_HELP: Record<MappingOwnerKind, string> = {
  task: 'and result in output',
  transition: 'and headers (no result: read the request with input)',
  subFlow: 'headers, and result ({ data, status }) in output',
};

function pathSuggest(paths: readonly string[]): SuggestFn {
  return (text) => {
    const items = filterPaths(paths, text).filter((p) => p !== text);
    return items.length > 0
      ? { items, apply: (item) => ({ text: item, caret: item.length }) }
      : null;
  };
}

function expressionSuggest(site: MappingSiteKind, schemaRoot: unknown): SuggestFn {
  return (text, caret) => {
    const token = expressionTokenAt(text, caret);
    if (!token) return null;
    const items = expressionSuggestions(site, token, schemaRoot).filter((i) => i !== token.query);
    return items.length > 0
      ? { items, apply: (item) => insertExpressionItem(text, token, caret, item) }
      : null;
  };
}

function IssueLine({ issue }: { issue: MappingIssue }) {
  return (
    <div
      role={issue.severity === 'error' ? 'alert' : undefined}
      className={`text-[10px] ${issue.severity === 'error' ? 'text-destructive-text' : 'text-warning-text'}`}>
      {issue.field ? <span className="font-mono">{issue.field}: </span> : null}
      {issue.message}
    </div>
  );
}

function SetEntryRow({
  phase,
  site,
  entryKey,
  expression,
  index,
  total,
  otherKeys,
  targets,
  expressionSuggestFn,
  issues,
  onUpdate,
}: {
  phase: MappingPhase;
  site: MappingSiteKind;
  entryKey: string;
  expression: string;
  index: number;
  total: number;
  otherKeys: readonly string[];
  targets: readonly string[];
  expressionSuggestFn: SuggestFn;
  issues: MappingIssue[];
  onUpdate: BindingUpdater;
}) {
  const [draftKey, setDraftKey] = useState(entryKey);
  const [keyError, setKeyError] = useState<string | null>(null);
  useEffect(() => setDraftKey(entryKey), [entryKey]);

  const commitKey = () => {
    if (draftKey === entryKey) {
      setKeyError(null);
      return;
    }
    if (otherKeys.includes(draftKey)) {
      setKeyError(`${draftKey} is already set by another entry.`);
      setDraftKey(entryKey);
      return;
    }
    setKeyError(null);
    onUpdate((b) => void renameSetKey(b, phase, entryKey, draftKey));
  };

  const targetInvalid = issues.some((i) => i.severity === 'error' && i.part === 'target');
  const expressionInvalid = issues.some((i) => i.severity === 'error' && i.part === 'expression');
  return (
    <div className="space-y-0.5">
      <div className="flex items-center gap-1">
        <div className="w-[42%] min-w-0 shrink-0">
          <SuggestInput
            value={draftKey}
            onChange={setDraftKey}
            onCommit={commitKey}
            suggest={pathSuggest(targets)}
            ariaLabel={`${phase} set target ${index + 1}`}
            placeholder={SITE_COPY[site].newKey}
            invalid={targetInvalid}
          />
        </div>
        <span className="text-subtle font-mono text-[10px]">←</span>
        <SuggestInput
          value={expression}
          onChange={(next) => onUpdate((b) => setSetExpression(b, phase, entryKey, next))}
          suggest={expressionSuggestFn}
          ariaLabel={`${phase} set expression for ${entryKey}`}
          placeholder={SITE_COPY[site].expressionPlaceholder}
          invalid={expressionInvalid}
        />
        <button
          type="button"
          onClick={() => onUpdate((b) => moveSetEntry(b, phase, entryKey, -1))}
          disabled={index === 0}
          className="text-subtle hover:text-secondary-icon cursor-pointer p-0.5 disabled:cursor-not-allowed disabled:opacity-30"
          aria-label={`Move ${entryKey} up`}>
          <ArrowUp size={11} />
        </button>
        <button
          type="button"
          onClick={() => onUpdate((b) => moveSetEntry(b, phase, entryKey, 1))}
          disabled={index === total - 1}
          className="text-subtle hover:text-secondary-icon cursor-pointer p-0.5 disabled:cursor-not-allowed disabled:opacity-30"
          aria-label={`Move ${entryKey} down`}>
          <ArrowDown size={11} />
        </button>
        <button
          type="button"
          onClick={() => onUpdate((b) => removeSetEntry(b, phase, entryKey))}
          className="text-subtle hover:text-destructive-text cursor-pointer p-0.5"
          aria-label={`Remove ${entryKey}`}>
          <Trash2 size={11} />
        </button>
      </div>
      {keyError && <div className="text-destructive-text text-[10px]">{keyError}</div>}
      {issues.map((issue, i) => (
        <IssueLine key={i} issue={issue} />
      ))}
    </div>
  );
}

function PhaseSection({
  phase,
  site,
  binding,
  schemaRoot,
  onUpdate,
  hint,
}: {
  phase: MappingPhase;
  site: MappingSiteKind;
  binding: MappingBindingLike;
  schemaRoot: unknown;
  onUpdate: BindingUpdater;
  hint?: string;
}) {
  const block = readMappingBlock(binding, phase);
  const entries = setEntries(block);
  const issues = useMemo(
    () => [...validateMappingBlock(site, block), ...protectedCopyIssues(site, block, schemaRoot)],
    [site, block, schemaRoot],
  );
  const targets = useMemo(() => writeTargetPaths(site, schemaRoot), [site, schemaRoot]);
  const reads = useMemo(() => selectPaths(site, schemaRoot), [site, schemaRoot]);
  const exprSuggest = useMemo(() => expressionSuggest(site, schemaRoot), [site, schemaRoot]);
  const copy = SITE_COPY[site];

  const blockIssues = issues.filter((i) => !i.field.startsWith('set['));
  const entryIssues = (key: string) => issues.filter((i) => i.field === `set['${key}']`);

  return (
    <div
      className="border-border space-y-1.5 rounded-lg border px-2 py-1.5"
      data-testid={`declarative-${phase}`}>
      <div>
        <div className="text-foreground text-[11px] font-semibold">{copy.title}</div>
        <div className="text-muted-foreground text-[10px]">{hint ?? copy.hint}</div>
      </div>
      <div className="flex items-center gap-1">
        <span className="text-muted-foreground w-10 shrink-0 text-[10px] font-semibold">
          select
        </span>
        <SuggestInput
          value={block?.select ?? ''}
          onChange={(next) =>
            onUpdate((b) => setBlockMember(b, phase, 'select', next === '' ? undefined : next))
          }
          suggest={pathSuggest(reads)}
          ariaLabel={`${phase} select`}
          placeholder={copy.selectPlaceholder}
          invalid={issues.some((i) => i.field === 'select' && i.severity === 'error')}
        />
      </div>
      <div className="flex items-center gap-1">
        <span className="text-muted-foreground w-10 shrink-0 text-[10px] font-semibold">into</span>
        <SuggestInput
          value={block?.into ?? ''}
          onChange={(next) =>
            onUpdate((b) => setBlockMember(b, phase, 'into', next === '' ? undefined : next))
          }
          suggest={pathSuggest(targets)}
          ariaLabel={`${phase} into`}
          placeholder={copy.intoPlaceholder}
          invalid={issues.some((i) => i.field === 'into' && i.severity === 'error')}
        />
      </div>
      <div className="space-y-1">
        <div className="text-muted-foreground text-[10px] font-semibold">
          set (runs in this order)
        </div>
        {entries.map(([key, expression], index) => (
          <SetEntryRow
            key={`${index}:${key}`}
            phase={phase}
            site={site}
            entryKey={key}
            expression={expression}
            index={index}
            total={entries.length}
            otherKeys={entries.filter((_, i) => i !== index).map(([k]) => k)}
            targets={targets}
            expressionSuggestFn={exprSuggest}
            issues={entryIssues(key)}
            onUpdate={onUpdate}
          />
        ))}
        <button
          type="button"
          onClick={() => onUpdate((b) => void addSetEntry(b, phase, copy.newKey))}
          className="text-primary-text hover:bg-muted inline-flex cursor-pointer items-center gap-1 rounded px-1 py-0.5 text-[10px] font-medium">
          <Plus size={11} /> Add set entry
        </button>
      </div>
      {blockIssues.map((issue, i) => (
        <IssueLine key={i} issue={issue} />
      ))}
    </div>
  );
}

/**
 * Editor for the declarative blocks of a task binding (`input` / `output`), a
 * transition (`output`) or a SubFlow state (`input` / `output`). Writes go
 * through `onUpdate`, which applies the updater to the owner inside the
 * owner's draft; untouched members (and their order) are never rewritten.
 */
export function DeclarativeMappingEditor({
  binding,
  schemaRoot,
  onUpdate,
  phaseHints,
  owner = 'task',
}: {
  binding: MappingBindingLike;
  /** Workflow master schema root (`attributes.schema` of the schema component), when known. */
  schemaRoot?: unknown;
  onUpdate: BindingUpdater;
  /** Replaces a phase's hint where the blocks shape something other than a workflow task binding. */
  phaseHints?: Partial<Record<MappingPhase, string>>;
  /** What holds the blocks; decides the phases, targets, select roots and variables. */
  owner?: MappingOwnerKind;
}) {
  return (
    <div className="space-y-1.5">
      {ownerPhases(owner).map((phase) => (
        <PhaseSection
          key={phase}
          phase={phase}
          site={siteKindOf(owner, phase)}
          binding={binding}
          schemaRoot={schemaRoot}
          onUpdate={onUpdate}
          hint={phaseHints?.[phase]}
        />
      ))}
      <div className="text-muted-foreground text-[10px] leading-snug">
        Expressions: <span className="font-mono">data</span>,{' '}
        <span className="font-mono">input</span>, <span className="font-mono">instance</span>,{' '}
        <span className="font-mono">now</span>, <span className="font-mono">user</span>,{' '}
        <span className="font-mono">context</span>, {EXPRESSION_HELP[owner]}. Members are camelCase;
        JSON values need <span className="font-mono">.AsDouble()</span> /{' '}
        <span className="font-mono">.AsInt32()</span> /{' '}
        <span className="font-mono">.AsBoolean()</span> /{' '}
        <span className="font-mono">.AsArrayLength()</span> to compare or calculate. Assignment is
        not allowed. A missing value writes nothing.
      </div>
    </div>
  );
}
