import * as path from 'node:path';

import { describe, expect, it } from 'vitest';

import { parseOpenSubFlowRunMessage } from './open-subflow-run-message.js';

const ROOT = path.resolve('/tmp/forge-workspace');
const WORKFLOW = path.join(ROOT, 'Workflows', 'online-flow.json');

const VALID = {
  type: 'quickrun:open-subflow-run',
  workflowFilePath: WORKFLOW,
  domain: 'core',
  workflowKey: 'online-flow',
};

describe('parseOpenSubFlowRunMessage', () => {
  it('accepts a workflow file inside the workspace', () => {
    expect(parseOpenSubFlowRunMessage(VALID, [ROOT])).toEqual({
      workflowFilePath: WORKFLOW,
      domain: 'core',
      workflowKey: 'online-flow',
    });
  });

  it('ignores messages of another type', () => {
    expect(parseOpenSubFlowRunMessage({ ...VALID, type: 'databucket:loadConfig' }, [ROOT])).toBeNull();
    expect(parseOpenSubFlowRunMessage('quickrun:open-subflow-run', [ROOT])).toBeNull();
  });

  it('rejects a path outside every workspace root', () => {
    const outside = path.resolve('/tmp/elsewhere/Workflows/online-flow.json');
    expect(parseOpenSubFlowRunMessage({ ...VALID, workflowFilePath: outside }, [ROOT])).toBeNull();
  });

  it('rejects a traversal that climbs out of the workspace', () => {
    const escaped = path.join(ROOT, '..', 'elsewhere', 'flow.json');
    expect(parseOpenSubFlowRunMessage({ ...VALID, workflowFilePath: escaped }, [ROOT])).toBeNull();
  });

  it('rejects anything that is not a JSON file', () => {
    const script = path.join(ROOT, 'Workflows', 'online-flow.csx');
    expect(parseOpenSubFlowRunMessage({ ...VALID, workflowFilePath: script }, [ROOT])).toBeNull();
  });

  it('rejects missing or empty fields', () => {
    expect(parseOpenSubFlowRunMessage({ ...VALID, domain: '' }, [ROOT])).toBeNull();
    expect(parseOpenSubFlowRunMessage({ ...VALID, workflowKey: undefined }, [ROOT])).toBeNull();
    expect(parseOpenSubFlowRunMessage({ ...VALID, workflowFilePath: 42 }, [ROOT])).toBeNull();
  });

  it('rejects everything when no workspace is open', () => {
    expect(parseOpenSubFlowRunMessage(VALID, [])).toBeNull();
  });
});
