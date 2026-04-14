/** exports.metadata — wizard ve editörlerde kullanıcı girdisi için tip güvenliği. */
export interface VnextExportsMetadata {
  description: string;
  maintainer?: string;
  license?: string;
  keywords?: string[];
}

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
  };
  exports?: {
    functions?: string[];
    workflows?: string[];
    tasks?: string[];
    views?: string[];
    schemas?: string[];
    extensions?: string[];
    visibility?: string;
    metadata?: VnextExportsMetadata | Record<string, unknown>;
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
    allowedHosts?: string[];
    schemaValidationRules?: {
      enforceKeyFormat?: boolean;
      enforceVersionFormat?: boolean;
      enforceFilenameConsistency?: boolean;
      allowUnknownProperties?: boolean;
    };
  };
  schemaValidationRules?: Record<string, unknown>;
}
