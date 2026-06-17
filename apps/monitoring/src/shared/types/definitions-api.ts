export interface DefinitionListItem {
  id: string;       // = API "key"
  name: string;     // = first English label or key
  version: string;
  domain: string;
  type?: string;    // workflow: 'F'|'S'|'P', others: raw string
  comment?: string;
  // task-specific
  taskType?: string;
  deprecated?: boolean;
  // function-specific
  returnType?: string;
  parameterCount?: number;
  // general
  description?: string;
  usedBy?: string[];
}

// API §2.1 list response shape
export interface ApiComponentLabel {
  language: string;
  label: string;
}

export interface ApiComponentListItem {
  key: string;
  version: string;
  domain: string;
  labels?: ApiComponentLabel[];
  type?: { value: number };
  comment?: string | null;
}

export interface ApiComponentListResponse {
  componentType: string;
  items: ApiComponentListItem[];
}

// API §2.1 detail response (with key param)
export interface ApiComponentDetailResponse extends ApiComponentListItem {
  flow?: string;
  versions?: string[];
}

// API §2.2 full definition response
export interface ApiComponentDefinitionResponse {
  componentType: string;
  items: Record<string, unknown>[];
}
