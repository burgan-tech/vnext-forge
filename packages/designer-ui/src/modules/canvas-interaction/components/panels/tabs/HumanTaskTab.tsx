import type { RoleGrant } from '@vnext-forge-studio/vnext-types';
import {
  HUMAN_TASK_MAPPING_SNIPPET,
  hasRoleGrants,
  isHumanTaskState,
  type OfferedTransition,
} from '../../../utils/humanTask';
import { deriveInteractionNodeData, longPollTooltip } from '../../../utils/stateNodeData';
import { Badge, Section } from './PropertyPanelShared';
import { RoleGrantEditor } from './subflow/RoleGrantEditor';

export interface HumanTaskTabProps {
  stateType: number;
  subType: number;
  queryRoles: RoleGrant[];
  workflowQueryRoles: RoleGrant[];
  offeredTransitions: OfferedTransition[];
  interaction: unknown;
  onUpdateQueryRoles: (roles: RoleGrant[]) => void;
}

const SOURCE_LABEL: Record<OfferedTransition['source'], string> = {
  state: 'State',
  shared: 'Shared',
  cancel: 'Cancel',
  exit: 'Exit',
  updateData: 'Update data',
};

const NOTE = 'text-[10px] text-muted-foreground mb-2 leading-relaxed';

export function HumanTaskTab({
  stateType,
  subType,
  queryRoles,
  workflowQueryRoles,
  offeredTransitions,
  interaction,
  onUpdateQueryRoles,
}: HumanTaskTabProps) {
  const listed = isHumanTaskState({ stateType, subType });
  const stateGated = hasRoleGrants(queryRoles);
  const workflowGated = hasRoleGrants(workflowQueryRoles);
  const interactionData = deriveInteractionNodeData(interaction);

  return (
    <div className="space-y-3">
      {!listed && (
        <p className="rounded-md border border-warning-border bg-warning-surface px-2 py-1.5 text-[10px] text-warning-text leading-relaxed">
          Final and SubFlow states never appear in the human-task list — only an active instance
          waiting in this state does.
        </p>
      )}

      <Section title="Query roles (required)" count={queryRoles.length} defaultOpen>
        <p className={NOTE}>
          The human-task list shows this task only to callers these roles allow. The list fails
          closed: when neither this state nor the workflow declares queryRoles, nobody sees the
          task.
        </p>
        {!stateGated &&
          (workflowGated ? (
            <p className="mb-2 text-[10px] text-muted-foreground leading-relaxed">
              No state queryRoles — the workflow queryRoles apply.
            </p>
          ) : (
            <p
              role="alert"
              className="mb-2 rounded-md border border-destructive-border bg-destructive-surface px-2 py-1 text-[10px] text-destructive-text leading-relaxed">
              No queryRoles on this state or the workflow — this task is listed for nobody, unless a
              parent subflow overrides queryRoles for this state.
            </p>
          ))}
        <RoleGrantEditor roles={queryRoles} onChange={onUpdateQueryRoles} contextLabel="human task" />
      </Section>

      <Section title="Task text" defaultOpen>
        <p className={NOTE}>
          The list shows the title and description from instance data <code>humanTask.title</code>{' '}
          and <code>humanTask.description</code>. Set them in a mapping that runs before the
          instance enters this state, for example:
        </p>
        <pre className="overflow-x-auto rounded-lg border border-border-subtle bg-surface p-2 font-mono text-[10px] leading-relaxed text-foreground">
          {HUMAN_TASK_MAPPING_SNIPPET}
        </pre>
      </Section>

      <Section title="Offered transitions" count={offeredTransitions.length} defaultOpen>
        <p className={NOTE}>
          Manual transitions a caller can be offered in this state. Each transition roles decide
          what a caller actually sees when the instance is opened.
        </p>
        {offeredTransitions.length === 0 ? (
          <p className="text-[10px] text-muted-foreground">No manual transitions are offered in this state.</p>
        ) : (
          <ul className="space-y-1">
            {offeredTransitions.map((transition) => (
              <li key={`${transition.source}-${transition.key}`} className="flex items-center gap-1.5">
                <span className="font-mono text-[11px] text-foreground">{transition.key}</span>
                <Badge className="bg-muted text-muted-foreground">{SOURCE_LABEL[transition.source]}</Badge>
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section title="Interaction" defaultOpen>
        <p className="text-[10px] text-muted-foreground leading-relaxed">
          {interactionData.hasLongPoll
            ? longPollTooltip(interactionData)
            : 'No long poll — the client keeps polling normally.'}
        </p>
      </Section>
    </div>
  );
}
