import { createElement as h } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { MappingDetailCore } from './MappingDetailCore.js';

describe('MappingDetailCore', () => {
  it('renders metadata, name, flow version and the script header', () => {
    const html = renderToStaticMarkup(
      h(MappingDetailCore, {
        json: {
          key: 'crypto-helper',
          version: '1.0.0',
          domain: 'core',
          flow: 'sys-mappings',
          flowVersion: '1.0.0',
          attributes: {
            name: 'CryptoHelper',
            location: './src/CryptoHelper.csx',
            code: 'cHVibGljIHN0YXRpYyBjbGFzcyBDcnlwdG9IZWxwZXIge30=',
            encoding: 'B64',
          },
        },
      }),
    );
    expect(html).toContain('value="CryptoHelper"'); // Name field
    expect(html).toContain('CryptoHelper.csx'); // script location
    expect(html).toContain('B64'); // encoding badge
    expect(html).toContain('value="1.0.0"'); // flowVersion field
  });

  it('accepts the flattened shape with a `script` alias', () => {
    const html = renderToStaticMarkup(
      h(MappingDetailCore, {
        json: {
          key: 'm2',
          version: '1.0.0',
          domain: 'core',
          flow: 'sys-mappings',
          name: 'Flat',
          script: 'Ly8geA==',
          encoding: 'B64',
          location: './src/F.csx',
        },
      }),
    );
    expect(html).toContain('F.csx');
    expect(html).toContain('value="Flat"');
  });

  it('renders without a script body gracefully', () => {
    const html = renderToStaticMarkup(
      h(MappingDetailCore, {
        json: {
          key: 'm3',
          version: '1.0.0',
          domain: 'core',
          flow: 'sys-mappings',
          attributes: { name: 'Empty' },
        },
      }),
    );
    expect(html).toContain('value="Empty"');
    expect(html).toContain('No script body'); // empty-state copy
  });
});
