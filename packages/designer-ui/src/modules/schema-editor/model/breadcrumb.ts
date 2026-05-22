import { buildPointer, parsePointer, type JsonPointer } from './jsonPointer';

export interface BreadcrumbSegment {
  /** Pointer-relative segment label (e.g. `foo`, `allOf[0]`, `items`). */
  label: string;
  /** Pointer that selecting this segment should resolve to. */
  pointer: JsonPointer;
}

/**
 * Project a raw segment list (e.g. `['properties','foo','items','allOf','0']`)
 * into user-meaningful breadcrumb steps. `properties`, `prefixItems`,
 * `patternProperties`, `dependentSchemas`, and the array composition
 * keywords (`allOf`/`anyOf`/`oneOf`) collapse together with their
 * following key/index segment so the label stays short.
 */
export function buildBreadcrumb(pointer: JsonPointer): BreadcrumbSegment[] {
  const segments = parsePointer(pointer);
  const out: BreadcrumbSegment[] = [];
  let consumed: string[] = [];
  let i = 0;

  while (i < segments.length) {
    const current = segments[i];

    if (
      (current === 'properties' ||
        current === 'patternProperties' ||
        current === 'dependentSchemas') &&
      i + 1 < segments.length
    ) {
      const next = segments[i + 1];
      consumed = [...consumed, current, next];
      out.push({ label: next, pointer: buildPointer(consumed) });
      i += 2;
      continue;
    }

    if (current === 'prefixItems' && i + 1 < segments.length) {
      const next = segments[i + 1];
      consumed = [...consumed, current, next];
      out.push({ label: `prefixItems[${next}]`, pointer: buildPointer(consumed) });
      i += 2;
      continue;
    }

    if (
      (current === 'allOf' || current === 'anyOf' || current === 'oneOf') &&
      i + 1 < segments.length
    ) {
      const next = segments[i + 1];
      consumed = [...consumed, current, next];
      out.push({ label: `${current}[${next}]`, pointer: buildPointer(consumed) });
      i += 2;
      continue;
    }

    consumed = [...consumed, current];
    out.push({ label: current, pointer: buildPointer(consumed) });
    i += 1;
  }

  return out;
}
