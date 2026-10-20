import { describe, expect, it } from 'vitest';
import { FILE_PICKER_KEYS } from '@burgan-tech/pseudo-ui';

import { FORGE_PSEUDO_UI_STRINGS } from './forgeUiStrings';

describe('FORGE_PSEUDO_UI_STRINGS', () => {
  it('covers every FILE_PICKER_KEYS entry and forEach.loadMore', () => {
    const keys = [...FILE_PICKER_KEYS.map((k) => `filePicker.${k}`), 'forEach.loadMore'];
    for (const key of keys) {
      expect(typeof FORGE_PSEUDO_UI_STRINGS[key], key).toBe('string');
      expect(FORGE_PSEUDO_UI_STRINGS[key].length, key).toBeGreaterThan(0);
    }
  });
});
