import { describe, expect, it } from 'vitest';

import { useFunctionRunStore } from './functionRunStore';

describe('functionRunStore reset', () => {
  it('gives payload/viewFormData a fresh object identity on every reset, never a shared reference', () => {
    useFunctionRunStore.getState().reset();
    const firstPayload = useFunctionRunStore.getState().payload;
    const firstViewFormData = useFunctionRunStore.getState().viewFormData;

    // Simulate an in-place mutation slipping past the store's own `set`
    // (e.g. a caller pushing into a nested array without cloning first).
    firstPayload.leaked = 'should not survive a reset';
    firstViewFormData.leaked = 'should not survive a reset';

    useFunctionRunStore.getState().reset();
    const secondPayload = useFunctionRunStore.getState().payload;
    const secondViewFormData = useFunctionRunStore.getState().viewFormData;

    expect(secondPayload).not.toBe(firstPayload);
    expect(secondViewFormData).not.toBe(firstViewFormData);
    expect(secondPayload).toEqual({});
    expect(secondViewFormData).toEqual({});
  });
});
