import { describe, expect, it } from 'vitest';

import { canShowCreateWorkflowScriptFileAction } from './createWorkflowScriptFile.js';

describe('canShowCreateWorkflowScriptFileAction', () => {
  it('shows the action for B64 workflow scripts with a valid location', () => {
    expect(
      canShowCreateWorkflowScriptFileAction({
        isTaskInline: false,
        workflowDirectoryPath: '/project/Components/Workflows/orders',
        encoding: 'B64',
        location: './MapCustomer.csx',
      }),
    ).toBe(true);
  });

  it('hides the action for native inline scripts', () => {
    expect(
      canShowCreateWorkflowScriptFileAction({
        isTaskInline: false,
        workflowDirectoryPath: '/project/Components/Workflows/orders',
        encoding: 'NAT',
        location: './MapCustomer.csx',
      }),
    ).toBe(false);
  });

  it('hides the action when the location is invalid', () => {
    expect(
      canShowCreateWorkflowScriptFileAction({
        isTaskInline: false,
        workflowDirectoryPath: '/project/Components/Workflows/orders',
        encoding: 'B64',
        location: './MapCustomer.txt',
      }),
    ).toBe(false);
  });

  it('hides the action without a workflow directory', () => {
    expect(
      canShowCreateWorkflowScriptFileAction({
        isTaskInline: false,
        workflowDirectoryPath: undefined,
        encoding: 'B64',
        location: './MapCustomer.csx',
      }),
    ).toBe(false);
  });
});
