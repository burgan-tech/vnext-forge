/**
 * Best-effort parser for the runtime engine's validation-failed
 * response. The engine returns HTTP 400 with a body shaped like:
 *
 *   {
 *     "error": {
 *       "prefix": "validation",
 *       "code": "App:900002",
 *       "message": "JSON schema validation failed",
 *       "validationErrors": [{ message, members: ["session", ...] }],
 *       "data": {
 *         "validation": {
 *           "culture": "tr-TR",
 *           "errors": [{
 *             "path": "customer.ownerUserId",
 *             "keyword": "minLength",
 *             "code": "schema.minLength",
 *             "message": "Value should be at least 1 characters",
 *             "label": "Sahip Kullanıcı ID",
 *             "schemaPath": "/properties/customer/properties/ownerUserId",
 *             "parameters": { "minLength": 1 }
 *           }]
 *         }
 *       }
 *     }
 *   }
 *
 * Forge's transport layer (`callApi`) wraps this in `ApiFailure`
 * (`{ success: false; error: { code, message, details? } }`). The
 * upstream payload lands in `error.details` — but the exact nesting
 * depends on how the runtime-proxy passes the upstream body
 * through. We try several known shapes so the consumer code
 * doesn't have to care.
 */

export interface FieldValidationError {
  path: string;
  message: string;
  label?: string;
  keyword?: string;
  parameters?: Record<string, unknown>;
}

export interface ParsedValidationFailure {
  /** Top-level human message (e.g. "JSON schema validation failed"). */
  topMessage: string;
  /** Per-field errors, when the upstream provided them. */
  fieldErrors: FieldValidationError[];
}

function isObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object';
}

function readRichErrors(node: unknown): FieldValidationError[] | null {
  if (!isObject(node)) return null;
  const data = node['data'];
  if (!isObject(data)) return null;
  const validation = data['validation'];
  if (!isObject(validation)) return null;
  const errors = validation['errors'];
  if (!Array.isArray(errors) || errors.length === 0) return null;
  const out: FieldValidationError[] = [];
  for (const e of errors) {
    if (!isObject(e)) continue;
    const path = typeof e['path'] === 'string' ? (e['path'] as string) : null;
    const message = typeof e['message'] === 'string' ? (e['message'] as string) : null;
    if (!path || !message) continue;
    out.push({
      path,
      message,
      label: typeof e['label'] === 'string' ? (e['label'] as string) : undefined,
      keyword: typeof e['keyword'] === 'string' ? (e['keyword'] as string) : undefined,
      parameters: isObject(e['parameters']) ? (e['parameters'] as Record<string, unknown>) : undefined,
    });
  }
  return out.length > 0 ? out : null;
}

function readSlimErrors(node: unknown): FieldValidationError[] | null {
  if (!isObject(node)) return null;
  const arr = node['validationErrors'];
  if (!Array.isArray(arr) || arr.length === 0) return null;
  const out: FieldValidationError[] = [];
  for (const e of arr) {
    if (!isObject(e)) continue;
    const members = e['members'];
    const message = typeof e['message'] === 'string' ? (e['message'] as string) : null;
    if (!Array.isArray(members) || !message) continue;
    const path = members.filter((m) => typeof m === 'string').join('.');
    if (!path) continue;
    out.push({ path, message });
  }
  return out.length > 0 ? out : null;
}

/**
 * Tries every known nesting depth in turn. Walks down `details ->
 * error -> ...` because some transports flatten one level and
 * others don't.
 */
function findValidationErrors(root: unknown, depth = 0): FieldValidationError[] | null {
  if (depth > 3 || !isObject(root)) return null;
  return (
    readRichErrors(root) ??
    readSlimErrors(root) ??
    findValidationErrors(root['error'], depth + 1) ??
    findValidationErrors(root['details'], depth + 1) ??
    findValidationErrors(root['data'], depth + 1)
  );
}

export function parseValidationFailure(
  apiError: { code: string; message: string; details?: unknown } | null | undefined,
): ParsedValidationFailure | null {
  if (!apiError) return null;
  const fieldErrors = findValidationErrors(apiError.details) ?? findValidationErrors(apiError);
  if (!fieldErrors || fieldErrors.length === 0) return null;
  return {
    topMessage: apiError.message || 'Validation failed',
    fieldErrors,
  };
}
