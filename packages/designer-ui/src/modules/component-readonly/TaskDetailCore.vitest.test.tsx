import { createElement as h } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { TaskDetailCore } from './TaskDetailCore.js';

const base = { key: 'notify-user', version: '1.0.0', domain: 'core', flow: 'sys-tasks' };

describe('TaskDetailCore', () => {
  it('renders HTTP task config with the real HttpTaskForm read-only', () => {
    const html = renderToStaticMarkup(
      h(TaskDetailCore, {
        json: {
          ...base,
          attributes: {
            type: '6',
            // `headers` makes the KVEditor render a row, so the "no remove
            // button" assertion below is not vacuous.
            config: {
              url: 'https://api.example.com',
              method: 'POST',
              headers: { 'X-Correlation-Id': 'abc-123' },
            },
          },
        },
      }),
    );
    expect(html).toContain('HTTP Request'); // label from TASK_TYPE_LABELS
    expect(html).toContain('https://api.example.com');
    expect(html).toContain('X-Correlation-Id'); // KVEditor row rendered
    expect(html.toLowerCase()).toContain('readonly'); // quiet read-only inputs
    expect(html).not.toContain('aria-label="Remove row'); // no KVEditor remove buttons
  });

  it('falls back to generic config rendering for store-coupled types', () => {
    const html = renderToStaticMarkup(
      h(TaskDetailCore, {
        json: { ...base, attributes: { type: '19', config: { workflowName: 'wf-1' } } },
      }),
    );
    expect(html).toContain('Get Instance');
    expect(html).toContain('wf-1');
  });

  it('accepts the flattened monitor-API shape', () => {
    const html = renderToStaticMarkup(
      h(TaskDetailCore, { json: { ...base, type: '6', config: { url: 'https://flat.example' } } }),
    );
    expect(html).toContain('https://flat.example');
  });

  it('renders metadata for a typeless document without crashing', () => {
    const html = renderToStaticMarkup(h(TaskDetailCore, { json: { ...base } }));
    expect(html).toContain('notify-user');
  });
});
