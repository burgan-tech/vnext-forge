import { describe, expect, it } from 'vitest';

import {
  buildTenantOverrideBlock,
  extractAllowedDeclarations,
  tokensToHostBlock,
} from './parseTenantCss';

describe('parseTenantCss', () => {
  describe('tokensToHostBlock', () => {
    it('renders allowed --p-* tokens', () => {
      const block = tokensToHostBlock({
        '--p-primary-color': '#FF6B35',
        '--p-surface-0': '#1a1a1a',
      });
      expect(block).toContain(':host {');
      expect(block).toContain('--p-primary-color: #FF6B35;');
      expect(block).toContain('--p-surface-0: #1a1a1a;');
    });

    it('accepts --font-family', () => {
      const block = tokensToHostBlock({ '--font-family': 'Inter, sans-serif' });
      expect(block).toContain('--font-family: Inter, sans-serif;');
    });

    it('rejects unknown CSS variables', () => {
      const block = tokensToHostBlock({ '--my-evil-token': 'red' });
      expect(block).toBe('');
    });

    it('rejects standard properties (non-custom)', () => {
      const block = tokensToHostBlock({ color: 'red', background: 'blue' });
      expect(block).toBe('');
    });

    it('drops values with CSS injection characters', () => {
      const block = tokensToHostBlock({
        '--p-primary-color': '#ok;@import "evil.css"',
      });
      expect(block).toBe('');
    });

    it('returns empty string for empty input', () => {
      expect(tokensToHostBlock({})).toBe('');
    });
  });

  describe('extractAllowedDeclarations', () => {
    it('pulls declarations from :host blocks', () => {
      const css = `:host { --p-primary-color: red; --p-surface-0: white; }`;
      const block = extractAllowedDeclarations(css);
      expect(block).toContain('--p-primary-color: red;');
      expect(block).toContain('--p-surface-0: white;');
    });

    it('also accepts :root selectors (alias)', () => {
      const css = `:root { --p-primary-color: blue; }`;
      const block = extractAllowedDeclarations(css);
      expect(block).toContain('--p-primary-color: blue;');
    });

    it('ignores rules with non-:host/:root selectors', () => {
      const css = `.d-card { display: none; } :host { --p-primary-color: red; }`;
      const block = extractAllowedDeclarations(css);
      expect(block).toContain('--p-primary-color: red;');
      expect(block).not.toContain('display: none');
    });

    it('strips comments before scanning', () => {
      const css = `/* malicious comment { } */ :host { --p-primary-color: red; }`;
      const block = extractAllowedDeclarations(css);
      expect(block).toContain('--p-primary-color: red;');
    });

    it('rejects @import injections inside declaration values', () => {
      const css = `:host { --p-primary-color: red; @import "evil.css"; }`;
      const block = extractAllowedDeclarations(css);
      // The :host block is parsed but @import is dropped because the
      // regex only captures `--*: value;` pairs.
      expect(block).toContain('--p-primary-color: red;');
      expect(block).not.toContain('@import');
    });

    it('rejects non-token declarations inside :host', () => {
      const css = `:host { color: red; --p-primary-color: blue; }`;
      const block = extractAllowedDeclarations(css);
      expect(block).toContain('--p-primary-color: blue;');
      expect(block).not.toContain('color: red');
    });

    it('returns empty for CSS with no :host/:root blocks', () => {
      const css = `.foo { color: red; } .bar { background: blue; }`;
      expect(extractAllowedDeclarations(css)).toBe('');
    });
  });

  describe('buildTenantOverrideBlock dispatcher', () => {
    it('returns empty for null/undefined', () => {
      expect(buildTenantOverrideBlock(null)).toBe('');
      expect(buildTenantOverrideBlock(undefined)).toBe('');
    });

    it('routes object input to tokensToHostBlock', () => {
      const block = buildTenantOverrideBlock({ '--p-primary-color': 'red' });
      expect(block).toContain('--p-primary-color: red;');
    });

    it('routes string input to extractAllowedDeclarations', () => {
      const block = buildTenantOverrideBlock(':host { --p-primary-color: blue; }');
      expect(block).toContain('--p-primary-color: blue;');
    });
  });
});
