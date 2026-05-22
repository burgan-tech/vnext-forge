import { describe, expect, it, vi } from 'vitest';

import { createWorkflowScriptFile } from './createWorkflowScriptFile.js';

describe('createWorkflowScriptFile', () => {
  it('creates a missing workflow script file with decoded editor content', async () => {
    const readOptionalFile = vi.fn().mockResolvedValue(null);
    const writeFile = vi.fn().mockResolvedValue({ success: true, data: undefined, error: null });

    const result = await createWorkflowScriptFile({
      workflowDirectoryPath: '/project/Components/Workflows/orders',
      location: './MapCustomer.csx',
      content: 'public class MapCustomer {}',
      readOptionalFile,
      writeFile,
    });

    expect(result).toEqual({
      status: 'created',
      path: '/project/Components/Workflows/orders/MapCustomer.csx',
    });
    expect(readOptionalFile).toHaveBeenCalledWith('/project/Components/Workflows/orders/MapCustomer.csx');
    expect(writeFile).toHaveBeenCalledWith(
      '/project/Components/Workflows/orders/MapCustomer.csx',
      'public class MapCustomer {}',
    );
  });

  it('skips writing when the workflow script file already exists', async () => {
    const readOptionalFile = vi.fn().mockResolvedValue({ content: 'existing' });
    const writeFile = vi.fn();

    const result = await createWorkflowScriptFile({
      workflowDirectoryPath: '/project/Components/Workflows/orders',
      location: './MapCustomer.csx',
      content: 'new content',
      readOptionalFile,
      writeFile,
    });

    expect(result).toEqual({
      status: 'exists',
      path: '/project/Components/Workflows/orders/MapCustomer.csx',
    });
    expect(writeFile).not.toHaveBeenCalled();
  });

  it('returns invalid-location without reading or writing', async () => {
    const readOptionalFile = vi.fn();
    const writeFile = vi.fn();

    const result = await createWorkflowScriptFile({
      workflowDirectoryPath: '/project/Components/Workflows/orders',
      location: './MapCustomer.txt',
      content: 'new content',
      readOptionalFile,
      writeFile,
    });

    expect(result.status).toBe('invalid-location');
    expect(readOptionalFile).not.toHaveBeenCalled();
    expect(writeFile).not.toHaveBeenCalled();
  });
});
