/**
 * Public types for the shared `schema-form` renderer.
 *
 * Subset of JSON Schema that we render natively — strings, numbers,
 * booleans, objects, arrays, enums, oneOf consts. Anything we don't
 * recognise falls back to a JSON textarea so the user is never blocked
 * by an unsupported feature.
 *
 * Vendor-specific annotations (`x-localization`, `x-remote-service`, ...)
 * are routed through `fieldRegistry`, so adding a new annotation type is
 * a plugin change — not a renderer change.
 */

export type JsonSchemaPrimitiveType =
  | 'string'
  | 'number'
  | 'integer'
  | 'boolean'
  | 'object'
  | 'array'
  | 'null';

export type JsonSchemaStringFormat =
  | 'date'
  | 'date-time'
  | 'time'
  | 'email'
  | 'uri'
  | 'url'
  | 'uuid'
  | 'password'
  | 'textarea'
  | string;

export interface JsonSchemaOneOfConst {
  const: string;
  description?: string;
  title?: string;
}

/**
 * The subset of JSON Schema property keywords the renderer understands.
 * Extra keywords (e.g. `$ref`, `additionalProperties`) are tolerated but
 * ignored so we never crash on schemas we don't fully cover.
 */
export interface JsonSchemaProperty {
  type?: JsonSchemaPrimitiveType | JsonSchemaPrimitiveType[];
  title?: string;
  description?: string;
  default?: unknown;
  /**
   * Single-value `const` keyword. Used by typed-enum style oneOf
   * branches (`{const: 0, description: "AutoDetect"}`). Vnext schemas
   * also use bare `const` for fixed values (e.g. discriminators).
   */
  const?: unknown;

  // Strings
  format?: JsonSchemaStringFormat;
  minLength?: number;
  maxLength?: number;
  pattern?: string;

  // Numbers
  minimum?: number;
  maximum?: number;
  exclusiveMinimum?: number;
  exclusiveMaximum?: number;
  multipleOf?: number;

  // Enum / oneOf
  enum?: ReadonlyArray<string | number | boolean>;
  /**
   * `oneOf` accepts any sub-schema. Vnext typically uses two patterns:
   *
   *   1. Typed-enum-with-descriptions:
   *      `[{const: 0, description: "AutoDetect"}, {const: 1, ...}]`
   *
   *   2. Alternative-types with parallel enums (Burgan convention):
   *      `[{type: "integer", enum: [0,1,2]},
   *        {type: "string", enum: ["AutoDetect","Burgan","On"]}]`
   *
   *  The renderer detects both patterns via `expandOneOfToOptions` and
   *  pairs integer values with their string labels when present.
   */
  oneOf?: ReadonlyArray<JsonSchemaProperty>;

  // Object
  properties?: Record<string, JsonSchemaProperty>;
  required?: ReadonlyArray<string>;

  // Array
  items?: JsonSchemaProperty;
  minItems?: number;
  maxItems?: number;
  uniqueItems?: boolean;

  // Vendor extensions — handled by fieldRegistry, not the renderer
  'x-localization'?: { key?: string };
  'x-remote-service'?: { url: string; method?: string; valueField?: string; labelField?: string };
  // Allow forward-compat custom annotations without typing every one.
  [extension: `x-${string}`]: unknown;
}

/**
 * Root JSON Schema accepted by `SchemaForm`. Same shape as a property,
 * but at the root we treat it as an object schema by default.
 */
export interface JsonSchemaRoot extends JsonSchemaProperty {
  $schema?: string;
}

/**
 * Map from dotted JSON Pointer (e.g. `deactivatedBy.name`) to one or more
 * inline error messages. Empty / missing entries mean "no error".
 */
export type FieldErrorMap = Record<string, string[]>;

/** Field-level metadata threaded through the recursive renderer. */
export interface SchemaFieldContext {
  /** Dotted path of this field, e.g. `attributes.headers.0.name`. */
  path: string;
  /** Whether the field's `required` flag is set in the parent schema. */
  required: boolean;
  /** Errors keyed by the same dotted path. */
  errors: FieldErrorMap;
  /** Live form value as a record (for cross-field annotations). */
  rootValue: unknown;
}
