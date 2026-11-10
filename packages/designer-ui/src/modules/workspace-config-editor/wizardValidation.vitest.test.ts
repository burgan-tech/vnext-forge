import { describe, expect, it } from 'vitest';

import {
  normalizeVnextWizardPayload,
  rawConfigToEditableValues,
  validateNormalizedVnextWizardPayload,
} from './wizardValidation';

const base = {
  version: '1.0.0',
  description: 'core Domain Definition Configuration',
  domain: 'core',
  runtimeVersion: '0.0.105',
  schemaVersion: '0.0.60',
  paths: {
    componentsRoot: 'core',
    tasks: 'Tasks',
    views: 'Views',
    functions: 'Functions',
    extensions: 'Extensions',
    workflows: 'Workflows',
    schemas: 'Schemas',
    mappings: 'Mappings',
  },
  exports: {
    functions: [],
    workflows: [],
    tasks: [],
    views: [],
    schemas: [],
    extensions: [],
    mappings: [],
    visibility: 'public',
    metadata: { description: 'Exported', maintainer: 'vNext Team', license: 'MIT', keywords: ['core'] },
  },
  dependencies: { domains: [], npm: [] },
  referenceResolution: {
    enabled: true,
    validateOnBuild: true,
    strictMode: true,
    validateReferenceConsistency: true,
    validateSchemas: true,
    allowedHosts: ['registry.npmjs.org'],
    schemaValidationRules: {
      enforceKeyFormat: true,
      enforceVersionFormat: true,
      enforceFilenameConsistency: true,
      allowUnknownProperties: false,
    },
  },
};

function roundTrip(raw: Record<string, unknown>) {
  const parsed = validateNormalizedVnextWizardPayload(normalizeVnextWizardPayload(rawConfigToEditableValues(raw)));
  expect(parsed.success).toBe(true);
  return parsed.data!;
}

describe('vnext.config editor: paths.agents (sys-agents, runtime 0.0.105)', () => {
  it('keeps paths.agents through edit and save', () => {
    const saved = roundTrip({ ...base, paths: { ...base.paths, agents: 'Agents' } });
    expect(saved.paths.agents).toBe('Agents');
  });

  it('does not add paths.agents or exports.agents to a solution that has none', () => {
    const saved = roundTrip(base);
    expect(saved.paths).not.toHaveProperty('agents');
    expect(saved.exports).not.toHaveProperty('agents');
  });

  it('drops a blank agents path', () => {
    const values = rawConfigToEditableValues(base);
    const normalized = normalizeVnextWizardPayload({ ...values, paths: { ...values.paths, agents: '  ' } });
    expect(normalized.paths).not.toHaveProperty('agents');
  });
});
