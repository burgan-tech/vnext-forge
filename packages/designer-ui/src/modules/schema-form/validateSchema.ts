/**
 * Lightweight client-side validator.
 *
 * The web bundle deliberately avoids shipping AJV (Node-only — full Ajv
 * + addFormats inflates the bundle by ~120 KB and pulls in a regex
 * compiler). For UI feedback we cover the common cases:
 *   - required (parent declares it)
 *   - type (string / number / integer / boolean / object / array)
 *   - format (date, date-time, email, uri, url, uuid)
 *   - minLength / maxLength / pattern
 *   - minimum / maximum / multipleOf
 *   - minItems / maxItems / uniqueItems
 *   - enum / oneOf-of-consts
 *
 * Schemas the user submits still hit the **server-side validator** which
 * runs full AJV against `@burgan-tech/vnext-schema` for the project's
 * pinned version. This is purely UX feedback while the user types.
 */
import type {
  FieldErrorMap,
  JsonSchemaPrimitiveType,
  JsonSchemaProperty,
  JsonSchemaRoot,
} from './types';

const FORMAT_PATTERNS: Record<string, RegExp> = {
  // YYYY-MM-DD
  date: /^\d{4}-\d{2}-\d{2}$/,
  // YYYY-MM-DDTHH:mm[:ss[.sss]]Z|±HH:mm
  'date-time':
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:\d{2})?$/,
  time: /^\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:\d{2})?$/,
  // RFC 5322 simplified
  email: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
  // RFC 3986 simplified
  uri: /^[a-zA-Z][a-zA-Z0-9+.-]*:[^\s]+$/,
  url: /^https?:\/\/[^\s]+$/,
  // UUID v1-v5
  uuid: /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$/,
};

function getJsonSchemaTypes(prop: JsonSchemaProperty): JsonSchemaPrimitiveType[] {
  if (!prop.type) return [];
  return Array.isArray(prop.type) ? prop.type : [prop.type];
}

function matchesType(value: unknown, type: JsonSchemaPrimitiveType): boolean {
  switch (type) {
    case 'null':
      return value === null;
    case 'boolean':
      return typeof value === 'boolean';
    case 'string':
      return typeof value === 'string';
    case 'integer':
      return typeof value === 'number' && Number.isFinite(value) && Number.isInteger(value);
    case 'number':
      return typeof value === 'number' && Number.isFinite(value);
    case 'array':
      return Array.isArray(value);
    case 'object':
      return typeof value === 'object' && value !== null && !Array.isArray(value);
    default:
      return true;
  }
}

function isEmpty(value: unknown): boolean {
  if (value === undefined || value === null) return true;
  if (typeof value === 'string' && value.length === 0) return true;
  return false;
}

function joinPath(base: string, segment: string | number): string {
  if (!base) return String(segment);
  return `${base}.${segment}`;
}

function pushError(errors: FieldErrorMap, path: string, message: string): void {
  const list = errors[path] ?? [];
  list.push(message);
  errors[path] = list;
}

function validateValue(
  prop: JsonSchemaProperty,
  value: unknown,
  path: string,
  errors: FieldErrorMap,
): void {
  if (isEmpty(value)) return; // required-ness handled at parent level

  // Enum (after empty-check so empty string in optional enum stays valid)
  if (prop.enum && prop.enum.length > 0 && !prop.enum.includes(value as never)) {
    pushError(errors, path, `Must be one of ${prop.enum.join(', ')}`);
    return;
  }

  // oneOf — supports both typed-const style and alternative-types-with-
  // parallel-enums style (see `expandOneOfToOptions` in SchemaField).
  if (prop.oneOf && prop.oneOf.length > 0) {
    const allowed: unknown[] = [];
    for (const branch of prop.oneOf) {
      if (branch.const !== undefined) allowed.push(branch.const);
      if (Array.isArray(branch.enum)) {
        for (const v of branch.enum) allowed.push(v);
      }
    }
    if (allowed.length > 0) {
      const valueStr = String(value);
      const ok = allowed.some((a) => a === value || String(a) === valueStr);
      if (!ok) {
        pushError(errors, path, `Must be one of ${allowed.join(', ')}`);
        return;
      }
    }
    // If oneOf shape isn't recognised, fall through — better silent than
    // false-positive errors while the user is still typing.
  }

  // Type check
  const declaredTypes = getJsonSchemaTypes(prop);
  if (declaredTypes.length > 0) {
    const ok = declaredTypes.some((t) => matchesType(value, t));
    if (!ok) {
      pushError(errors, path, `Expected ${declaredTypes.join(' | ')}`);
      return;
    }
  }

  // Per-type extra checks
  if (typeof value === 'string') {
    if (prop.minLength !== undefined && value.length < prop.minLength) {
      pushError(errors, path, `Must be at least ${prop.minLength} characters`);
    }
    if (prop.maxLength !== undefined && value.length > prop.maxLength) {
      pushError(errors, path, `Must be at most ${prop.maxLength} characters`);
    }
    if (prop.pattern) {
      try {
        const re = new RegExp(prop.pattern);
        if (!re.test(value)) pushError(errors, path, `Does not match pattern ${prop.pattern}`);
      } catch {
        // bad pattern in schema — don't block the user
      }
    }
    if (prop.format && FORMAT_PATTERNS[prop.format] && !FORMAT_PATTERNS[prop.format].test(value)) {
      pushError(errors, path, `Invalid ${prop.format} format`);
    }
  }

  if (typeof value === 'number') {
    if (prop.minimum !== undefined && value < prop.minimum) {
      pushError(errors, path, `Must be ≥ ${prop.minimum}`);
    }
    if (prop.maximum !== undefined && value > prop.maximum) {
      pushError(errors, path, `Must be ≤ ${prop.maximum}`);
    }
    if (prop.exclusiveMinimum !== undefined && value <= prop.exclusiveMinimum) {
      pushError(errors, path, `Must be > ${prop.exclusiveMinimum}`);
    }
    if (prop.exclusiveMaximum !== undefined && value >= prop.exclusiveMaximum) {
      pushError(errors, path, `Must be < ${prop.exclusiveMaximum}`);
    }
    if (prop.multipleOf !== undefined && prop.multipleOf > 0) {
      const ratio = value / prop.multipleOf;
      if (!Number.isInteger(ratio)) {
        pushError(errors, path, `Must be a multiple of ${prop.multipleOf}`);
      }
    }
  }

  if (Array.isArray(value)) {
    if (prop.minItems !== undefined && value.length < prop.minItems) {
      pushError(errors, path, `Must have at least ${prop.minItems} items`);
    }
    if (prop.maxItems !== undefined && value.length > prop.maxItems) {
      pushError(errors, path, `Must have at most ${prop.maxItems} items`);
    }
    if (prop.uniqueItems) {
      const seen = new Set<string>();
      for (const item of value) {
        const key = JSON.stringify(item);
        if (seen.has(key)) {
          pushError(errors, path, 'Items must be unique');
          break;
        }
        seen.add(key);
      }
    }
    if (prop.items) {
      value.forEach((item, idx) => {
        validateValue(prop.items!, item, joinPath(path, idx), errors);
      });
    }
  }

  if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
    validateObject(prop, value as Record<string, unknown>, path, errors);
  }
}

function validateObject(
  prop: JsonSchemaProperty,
  value: Record<string, unknown>,
  path: string,
  errors: FieldErrorMap,
): void {
  const properties = prop.properties ?? {};
  const required = new Set(prop.required ?? []);

  // Required keys
  for (const key of required) {
    const childPath = joinPath(path, key);
    if (isEmpty(value[key])) {
      pushError(errors, childPath, 'Required');
    }
  }

  // Recursively validate each known property
  for (const [key, childProp] of Object.entries(properties)) {
    const childPath = joinPath(path, key);
    if (key in value && value[key] !== undefined) {
      validateValue(childProp, value[key], childPath, errors);
    }
  }
}

/**
 * Validate `value` against the root JSON Schema. Returns a flat map keyed
 * by dotted JSON pointer paths. Empty record means "all good".
 */
export function validateAgainstSchema(
  schema: JsonSchemaRoot | undefined,
  value: unknown,
): FieldErrorMap {
  const errors: FieldErrorMap = {};
  if (!schema) return errors;

  // Treat root as object schema by default — same as TransitionDialog UX.
  if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
    validateObject(schema, value as Record<string, unknown>, '', errors);
  } else {
    validateValue(schema, value, '', errors);
  }

  return errors;
}
