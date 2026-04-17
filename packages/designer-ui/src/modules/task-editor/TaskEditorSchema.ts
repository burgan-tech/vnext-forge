import { z } from 'zod';

const jsonObjectLikeSchema = z
  .string()
  .trim()
  .transform((value) => {
    if (value.length === 0) {
      return '';
    }

    try {
      return JSON.parse(value) as unknown;
    } catch {
      return value;
    }
  });

export function toJsonEditorValue(value: unknown): string {
  if (typeof value === 'string') {
    return value;
  }

  return JSON.stringify(value ?? {}, null, 2);
}

export function parseJsonEditorValue(value: string): unknown {
  return jsonObjectLikeSchema.parse(value);
}
