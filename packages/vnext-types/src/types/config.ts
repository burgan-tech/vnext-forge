export interface VnextConfig {
  version: string;
  description?: string;
  domain: string;
  runtimeVersion?: string;
  schemaVersion?: string;
  paths?: {
    componentsRoot?: string;
    tasks?: string;
    views?: string;
    functions?: string;
    extensions?: string;
    workflows?: string;
    schemas?: string;
    mappings?: string;
  };
  exports?: {
    functions?: string[];
    workflows?: string[];
    tasks?: string[];
    views?: string[];
    schemas?: string[];
    extensions?: string[];
    visibility?: string;
    metadata?: Record<string, unknown>;
  };
  dependencies?: {
    domains?: string[];
    npm?: string[];
  };
  referenceResolution?: {
    enabled?: boolean;
    validateOnBuild?: boolean;
    strictMode?: boolean;
    validateReferenceConsistency?: boolean;
    validateSchemas?: boolean;
  };
  schemaValidationRules?: Record<string, unknown>;
}
