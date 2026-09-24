import { describe, expect, it } from 'vitest';
import { getStateNodeConfig } from './stateNodeConfig';

describe('getStateNodeConfig', () => {
  it('overlays Human on an intermediate state', () => {
    expect(getStateNodeConfig(2, 6).typeLabel).toBe('Human');
  });

  it('overlays Busy on an intermediate state', () => {
    expect(getStateNodeConfig(2, 5).typeLabel).toBe('Busy');
  });

  it('keeps the plain intermediate look without a subType', () => {
    expect(getStateNodeConfig(2, 0).typeLabel).toBe('State');
  });

  it('keeps SubFlow identity even with a subType', () => {
    expect(getStateNodeConfig(4, 6).typeLabel).toBe('SubFlow');
  });

  it('keeps final subTypes', () => {
    expect(getStateNodeConfig(3, 1).typeLabel).toBe('Success');
    expect(getStateNodeConfig(3, 6).typeLabel).toBe('Human');
  });
});
