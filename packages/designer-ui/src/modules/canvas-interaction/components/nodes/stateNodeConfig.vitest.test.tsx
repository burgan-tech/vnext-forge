import { describe, expect, it } from 'vitest';
import { getStateNodeConfig } from './stateNodeConfig';

describe('getStateNodeConfig', () => {
  it('uses the Human look with a dotted border on an intermediate state', () => {
    const config = getStateNodeConfig(2, 6);
    expect(config.typeLabel).toBe('Human');
    expect(config.borderStyle).toBe('border-dotted');
  });

  it('uses the Human look on a wizard state', () => {
    expect(getStateNodeConfig(5, 6).typeLabel).toBe('Human');
  });

  // Controller ruling F1: the Human (6) overlay also applies to Initial
  // states (spec A3.1/C4) — Human wins over Initial, both here and in
  // Conversion.ts's getNodeType (which checks subType 6 before stateType 1).
  it('overlays Human on a Human initial state (Human wins over Initial)', () => {
    expect(getStateNodeConfig(1, 6).typeLabel).toBe('Human');
  });

  it('overlays Busy on intermediate and initial states', () => {
    expect(getStateNodeConfig(2, 5).typeLabel).toBe('Busy');
    expect(getStateNodeConfig(1, 5).typeLabel).toBe('Busy');
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
