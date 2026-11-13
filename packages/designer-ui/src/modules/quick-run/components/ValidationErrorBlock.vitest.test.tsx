import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

// `CopyableJsonBlock` mounts Monaco, which the SSR-only harness cannot load.
vi.mock('./CopyableJsonBlock', () => ({
  CopyableJsonBlock: ({ value }: { value: unknown }) => createElement('pre', null, JSON.stringify(value)),
}));

const { ValidationErrorBlock } = await import('./ValidationErrorBlock');

/** The 409 problem-details body runtime 0.0.106 returns for a rejected lock (sync transition). */
const REJECTED = {
  httpStatus: 409,
  title: 'Conflict',
  status: 409,
  detail: "Resource 'rl-lab:e2e-1' is locked by another instance; the transition was rejected without changing this instance. Retry when the lock frees.",
  errorCode: 'conflict.Execution:200014',
  prefix: 'conflict',
  code: 'Execution:200014',
  target: 'rl-lab:e2e-1',
};

describe('ValidationErrorBlock', () => {
  it('adds the runtime hint for a known code (resource lock rejected)', () => {
    const html = renderToStaticMarkup(createElement(ValidationErrorBlock, { message: 'Runtime returned HTTP 409', details: REJECTED }));
    expect(html).toContain('is locked by another instance');
    expect(html).toContain('Execution:200014 · ');
    expect(html).toContain('retry the same transition once the lock is released');
  });

  it('shows no hint for an unknown code or without details', () => {
    const unknown = renderToStaticMarkup(
      createElement(ValidationErrorBlock, { message: 'Bad request', details: { status: 400, code: 'Validation:900001', detail: 'Invalid.' } }),
    );
    expect(unknown).not.toContain(' · ');
    const bare = renderToStaticMarkup(createElement(ValidationErrorBlock, { message: 'Network down' }));
    expect(bare).toContain('Network down');
    expect(bare).not.toContain(' · ');
  });
});
