import { describe, expect, it } from 'vitest';

import sampleCustomerRegistrationView from './__fixtures__/customer-registration-form.view.json';
import { parseBuilderDefinition, PSEUDO_UI_BUILDER_NODE_TYPES } from './PseudoUiBuilder';

describe('PseudoUiBuilder', () => {
  it('round-trips full pseudo-ui view definitions', () => {
    const source = {
      $schema: 'https://amorphie.io/schemas/pseudo-ui-view.json',
      dataSchema: 'urn:amorphie:schema:customer',
      lookups: ['branchDetail'],
      view: {
        type: 'Column',
        gap: 'md',
        children: [
          { type: 'TextField', bind: 'firstName' },
          { type: 'Button', label: { en: 'Continue' }, action: 'submit', command: 'next' },
        ],
      },
    };

    const parsed = parseBuilderDefinition(JSON.stringify(source), 'customer');

    expect(parsed.error).toBeNull();
    expect(parsed.definition).toEqual(source);
  });

  it('wraps bare component nodes into a ViewDefinition', () => {
    const parsed = parseBuilderDefinition(JSON.stringify({ type: 'Text', content: { en: 'Hello' } }), 'hello');

    expect(parsed.error).toBeNull();
    expect(parsed.definition.dataSchema).toBe('');
    expect(parsed.definition.view).toEqual({ type: 'Text', content: { en: 'Hello' } });
  });

  it('accepts a real pseudo-ui SDK sample fixture', () => {
    const parsed = parseBuilderDefinition(JSON.stringify(sampleCustomerRegistrationView), 'customer-registration-form');

    expect(parsed.error).toBeNull();
    expect(parsed.definition.dataSchema).toBe('urn:amorphie:res:schema:customer:registration-form');
    expect(parsed.definition.view.type).toBe('ScrollView');
  });

  it('covers all React SDK node categories observed in DynamicRenderer', () => {
    expect(PSEUDO_UI_BUILDER_NODE_TYPES).toEqual([
      'Column',
      'Row',
      'Expanded',
      'ScrollView',
      'Center',
      'Wrap',
      'Spacer',
      'Stack',
      'Grid',
      'Card',
      'Divider',
      'Text',
      'Icon',
      'Image',
      'Chip',
      'Badge',
      'Avatar',
      'ProgressIndicator',
      'LoadingIndicator',
      'ListTile',
      'RichText',
      'TextField',
      'TextArea',
      'NumberField',
      'Dropdown',
      'Checkbox',
      'Switch',
      'RadioGroup',
      'DatePicker',
      'TimePicker',
      'Slider',
      'SegmentedButton',
      'SearchField',
      'AutoComplete',
      'Button',
      'IconButton',
      'FAB',
      'TabView',
      'ExpansionPanel',
      'Stepper',
      'Tooltip',
      'Snackbar',
      'Dialog',
      'BottomSheet',
      'SideSheet',
      'NavigationDrawer',
      'AppBar',
      'Toolbar',
      'NavigationBar',
      'Menu',
      'Carousel',
      'ForEach',
      'Component',
    ]);
  });
});
