import { describe, expect, it } from 'vitest';

import { generateWorkflowMarkdown } from '../src/generators/workflow-doc.js';

const base = {
  key: 'demo',
  domain: 'core',
  version: '1.0.0',
  flow: 'sys-flows',
  flowVersion: '1.0.0',
  tags: ['demo'],
};

const STATES = [
  {
    key: 'review',
    stateType: 1,
    versionStrategy: 'Minor',
    labels: [{ language: 'en', label: 'Review' }],
    transitions: [
      {
        key: 'go',
        target: 'done',
        triggerType: 0,
        versionStrategy: 'Minor',
        labels: [{ language: 'en', label: 'Go' }],
      },
    ],
  },
  {
    key: 'approval',
    stateType: 2,
    versionStrategy: 'Minor',
    labels: [{ language: 'en', label: 'Approval' }],
    transitions: [],
  },
  { key: 'done', stateType: 3, versionStrategy: 'Minor', labels: [{ language: 'en', label: 'Done' }], transitions: [] },
];

function generate(availableIn: unknown): string {
  return generateWorkflowMarkdown({
    ...base,
    attributes: {
      type: 'F',
      labels: [{ language: 'en', label: 'Demo' }],
      startTransition: {
        key: 'start',
        target: 'review',
        triggerType: 0,
        versionStrategy: 'Minor',
        labels: [{ language: 'en', label: 'Start' }],
      },
      states: STATES,
      sharedTransitions: [
        {
          key: 'escalate',
          target: 'done',
          triggerType: 0,
          versionStrategy: 'Minor',
          labels: [{ language: 'en', label: 'Escalate' }],
          availableIn,
        },
      ],
    },
  });
}

/** Pull the "Available In:" line out of the Shared Transitions section. */
function availableInLine(md: string): string | undefined {
  return md.split('\n').find((line) => line.includes('Available In:'));
}

describe('generateWorkflowMarkdown — availableIn', () => {
  it('lists bare state keys as inline code', () => {
    expect(availableInLine(generate(['review', 'approval']))).toBe(
      '**Available In:** `review`, `approval`',
    );
  });

  it('spells out the grants of a role-scoped entry', () => {
    expect(
      availableInLine(
        generate([
          'review',
          { state: 'approval', roles: [{ role: 'backoffice.supervisor', grant: 'allow' }] },
        ]),
      ),
    ).toBe('**Available In:** `review`, `approval` (allow: backoffice.supervisor)');
  });

  it('renders an object entry without roles like the bare form', () => {
    expect(availableInLine(generate([{ state: 'review' }]))).toBe('**Available In:** `review`');
  });

  it('never leaks a stringified object', () => {
    const md = generate([{ state: 'approval', roles: [{ role: 'x', grant: 'deny' }] }]);
    expect(md).not.toContain('[object Object]');
  });

  it('omits the line when nothing is declared', () => {
    expect(availableInLine(generate(undefined))).toBeUndefined();
    expect(availableInLine(generate([]))).toBeUndefined();
  });

  it('draws one mermaid arrow per state, in both authored forms', () => {
    const md = generate([
      'review',
      { state: 'approval', roles: [{ role: 'x', grant: 'allow' }] },
    ]);
    expect(md).toContain('review --> done: Escalate');
    expect(md).toContain('approval --> done: Escalate');
  });
});
