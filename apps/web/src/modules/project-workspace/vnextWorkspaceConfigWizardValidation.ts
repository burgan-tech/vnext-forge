import type { VnextWorkspaceConfig } from '@vnext-forge/app-contracts';
import { z } from 'zod';

/** Kayıt öncesi: boş / yalnızca whitespace satırlarını at. */
export function compactNonEmptyLines(items: string[] | undefined): string[] {
  return (items ?? []).map((s) => s.trim()).filter((s) => s.length > 0);
}

/**
 * Form değerlerini kayıt / doğrulama ile aynı şekilde normalize eder (satır listeleri sıkıştırılır).
 */
export function normalizeVnextWizardPayload(values: VnextWorkspaceConfig): VnextWorkspaceConfig {
  const ref = values.referenceResolution;
  return {
    ...values,
    ...(ref && {
      referenceResolution: {
        ...ref,
        allowedHosts: compactNonEmptyLines(ref.allowedHosts),
      },
    }),
    exports: {
      ...values.exports,
      functions: compactNonEmptyLines(values.exports.functions),
      workflows: compactNonEmptyLines(values.exports.workflows),
      tasks: compactNonEmptyLines(values.exports.tasks),
      views: compactNonEmptyLines(values.exports.views),
      schemas: compactNonEmptyLines(values.exports.schemas),
      extensions: compactNonEmptyLines(values.exports.extensions),
      metadata: {
        ...values.exports.metadata,
        keywords: (values.exports.metadata.keywords ?? [])
          .map((k) => k.trim())
          .filter((k) => k.length > 0),
      },
    },
  };
}

const nonEmpty = (label: string) =>
  z
    .string()
    .trim()
    .min(1, `${label} cannot be empty.`);

const pathsSchema = z.object({
  componentsRoot: nonEmpty('paths.componentsRoot'),
  tasks: nonEmpty('paths.tasks'),
  views: nonEmpty('paths.views'),
  functions: nonEmpty('paths.functions'),
  extensions: nonEmpty('paths.extensions'),
  workflows: nonEmpty('paths.workflows'),
  schemas: nonEmpty('paths.schemas'),
});

const metadataSchema = z.object({
  description: nonEmpty('exports.metadata.description'),
  maintainer: nonEmpty('exports.metadata.maintainer'),
  license: nonEmpty('exports.metadata.license'),
  keywords: z
    .array(z.string())
    .min(1, 'At least one keyword (exports.metadata.keywords) is required.')
    .superRefine((arr, ctx) => {
      for (let i = 0; i < arr.length; i++) {
        if (!arr[i].trim()) {
          ctx.addIssue({
            code: 'custom',
            message: 'Keyword cannot be empty.',
            path: [i],
          });
        }
      }
    }),
});

const referenceResolutionSchema = z
  .object({
    enabled: z.boolean(),
    validateOnBuild: z.boolean(),
    strictMode: z.boolean(),
    validateReferenceConsistency: z.boolean(),
    validateSchemas: z.boolean(),
    allowedHosts: z.array(z.string()),
    schemaValidationRules: z.object({
      enforceKeyFormat: z.boolean(),
      enforceVersionFormat: z.boolean(),
      enforceFilenameConsistency: z.boolean(),
      allowUnknownProperties: z.boolean(),
    }),
  })
  .superRefine((data, ctx) => {
    const hosts = compactNonEmptyLines(data.allowedHosts);
    if (hosts.length === 0) {
      ctx.addIssue({
        code: 'custom',
        message: 'referenceResolution.allowedHosts: at least one hostname is required.',
        path: ['allowedHosts'],
      });
    }
  });

/** Sihirbazda zorunlu alanlar; exports dizileri ve dependencies boş olabilir. */
export const vnextWorkspaceConfigWizardSchema = z.object({
  version: nonEmpty('version'),
  description: nonEmpty('description'),
  domain: nonEmpty('domain'),
  runtimeVersion: nonEmpty('runtimeVersion'),
  schemaVersion: nonEmpty('schemaVersion'),
  paths: pathsSchema,
  exports: z.object({
    functions: z.array(z.string()),
    workflows: z.array(z.string()),
    tasks: z.array(z.string()),
    views: z.array(z.string()),
    schemas: z.array(z.string()),
    extensions: z.array(z.string()),
    visibility: z.enum(['public', 'private']),
    metadata: metadataSchema,
  }),
  dependencies: z.object({
    domains: z.array(z.string()),
    npm: z.array(z.string()),
  }),
  referenceResolution: referenceResolutionSchema,
});

export type VnextWorkspaceConfigWizardParse = z.infer<typeof vnextWorkspaceConfigWizardSchema>;

export type VnextWizardSafeParseResult = ReturnType<typeof vnextWorkspaceConfigWizardSchema.safeParse>;

export function validateNormalizedVnextWizardPayload(
  normalized: VnextWorkspaceConfig,
): VnextWizardSafeParseResult {
  return vnextWorkspaceConfigWizardSchema.safeParse(normalized);
}

/** Zod path → ilk hata mesajı (alan bazlı gösterim). */
export function wizardValidationIssueMap(error: z.ZodError): Record<string, string> {
  const map: Record<string, string> = {};
  for (const iss of error.issues) {
    const key = iss.path.join('.');
    if (key && !map[key]) {
      map[key] = iss.message;
    }
  }
  return map;
}

/**
 * Diskten okunan ham JSON nesnesini wizard form yapısına dönüştürür.
 * Eksik alanlar boş bırakılır (Zod doğrulaması hataları göstersin diye).
 */
export function rawConfigToEditableValues(raw: Record<string, unknown>): VnextWorkspaceConfig {
  const str = (v: unknown): string => (typeof v === 'string' ? v : '');
  const bool = (v: unknown, fallback: boolean): boolean =>
    typeof v === 'boolean' ? v : fallback;
  const strArr = (v: unknown): string[] =>
    Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [];

  const p =
    raw.paths != null && typeof raw.paths === 'object'
      ? (raw.paths as Record<string, unknown>)
      : {};
  const exp =
    raw.exports != null && typeof raw.exports === 'object'
      ? (raw.exports as Record<string, unknown>)
      : {};
  const meta =
    exp.metadata != null && typeof exp.metadata === 'object'
      ? (exp.metadata as Record<string, unknown>)
      : {};
  const deps =
    raw.dependencies != null && typeof raw.dependencies === 'object'
      ? (raw.dependencies as Record<string, unknown>)
      : {};
  const ref =
    raw.referenceResolution != null && typeof raw.referenceResolution === 'object'
      ? (raw.referenceResolution as Record<string, unknown>)
      : {};
  const rules =
    ref.schemaValidationRules != null && typeof ref.schemaValidationRules === 'object'
      ? (ref.schemaValidationRules as Record<string, unknown>)
      : {};

  return {
    version: str(raw.version),
    description: str(raw.description),
    domain: str(raw.domain),
    runtimeVersion: str(raw.runtimeVersion),
    schemaVersion: str(raw.schemaVersion),
    paths: {
      componentsRoot: str(p.componentsRoot),
      tasks: str(p.tasks),
      views: str(p.views),
      functions: str(p.functions),
      extensions: str(p.extensions),
      workflows: str(p.workflows),
      schemas: str(p.schemas),
    },
    exports: {
      functions: strArr(exp.functions),
      workflows: strArr(exp.workflows),
      tasks: strArr(exp.tasks),
      views: strArr(exp.views),
      schemas: strArr(exp.schemas),
      extensions: strArr(exp.extensions),
      visibility: exp.visibility === 'private' ? 'private' : 'public',
      metadata: {
        description: str(meta.description),
        maintainer: str(meta.maintainer),
        license: str(meta.license),
        keywords: strArr(meta.keywords),
      },
    },
    dependencies: {
      domains: strArr(deps.domains),
      npm: strArr(deps.npm),
    },
    referenceResolution: {
      enabled: bool(ref.enabled, true),
      validateOnBuild: bool(ref.validateOnBuild, true),
      strictMode: bool(ref.strictMode, true),
      validateReferenceConsistency: bool(ref.validateReferenceConsistency, true),
      validateSchemas: bool(ref.validateSchemas, true),
      allowedHosts: strArr(ref.allowedHosts),
      schemaValidationRules: {
        enforceKeyFormat: bool(rules.enforceKeyFormat, true),
        enforceVersionFormat: bool(rules.enforceVersionFormat, true),
        enforceFilenameConsistency: bool(rules.enforceFilenameConsistency, true),
        allowUnknownProperties: bool(rules.allowUnknownProperties, false),
      },
    },
  };
}

/**
 * Kod editöründen kaydedilen ham metin için sihirbaz ile aynı sıkı kurallar (sunucu şeması daha gevşek olabilir).
 */
export function validateVnextConfigJsonText(
  raw: string,
): { ok: true } | { ok: false; summary: string } {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { ok: false, summary: 'vnext.config.json is not valid JSON.' };
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return { ok: false, summary: 'vnext.config.json root must be an object.' };
  }
  let normalized: VnextWorkspaceConfig;
  try {
    normalized = normalizeVnextWizardPayload(parsed as VnextWorkspaceConfig);
  } catch {
    return {
      ok: false,
      summary:
        'vnext.config.json is missing or has invalid required sections (paths, exports, referenceResolution, etc.).',
    };
  }
  const result = validateNormalizedVnextWizardPayload(normalized);
  if (result.success) {
    return { ok: true };
  }
  const lines = result.error.issues
    .slice(0, 5)
    .map((i: z.core.$ZodIssue) => `${i.path.join('.') || 'root'}: ${i.message}`);
  return {
    ok: false,
    summary: `vnext.config.json does not meet studio rules — ${lines.join(' · ')}`,
  };
}
