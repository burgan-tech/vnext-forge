import Ajv from 'ajv/dist/2020';
import { useMemo, useState } from 'react';

export interface AjvValidationError {
  path: string;
  message: string;
  keyword: string;
}

export type PayloadValidationState =
  | { status: 'idle' }
  | { status: 'valid' }
  | { status: 'json-error'; message: string }
  | { status: 'schema-error'; message: string }
  | { status: 'invalid'; errors: AjvValidationError[] };

/** Every `x-*` keyword used anywhere in a schema (vnext vocabulary and annotations). */
export function vocabularyKeywords(schema: unknown): string[] {
  const found = new Set<string>();
  const walk = (node: unknown): void => {
    if (Array.isArray(node)) {
      node.forEach(walk);
      return;
    }
    if (!node || typeof node !== 'object') return;
    for (const [key, value] of Object.entries(node)) {
      if (key.startsWith('x-')) found.add(key);
      walk(value);
    }
  };
  walk(schema);
  return [...found];
}

export function usePayloadValidator(schema: Record<string, unknown>) {
  const [state, setState] = useState<PayloadValidationState>({ status: 'idle' });

  // A fresh AJV instance is created for every schema change so that schemas
  // with a $id / id field never trigger the "already exists" duplicate registration error.
  const compiledValidator = useMemo(() => {
    const ajv = new Ajv({ allErrors: true });
    try {
      // The runtime evaluates vnext vocabulary keywords (`x-storage`, `x-roles`, …)
      // as annotations; strict Ajv would refuse to compile the schema over them.
      for (const keyword of vocabularyKeywords(schema)) ajv.addKeyword(keyword);
      return { validator: ajv.compile(schema), error: null };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return { validator: null, error: message };
    }
  }, [schema]);

  function validate(rawPayload: string) {
    if (compiledValidator.error !== null) {
      setState({ status: 'schema-error', message: compiledValidator.error });
      return;
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(rawPayload);
    } catch {
      setState({ status: 'json-error', message: 'Payload must be valid JSON.' });
      return;
    }

    const isValid = compiledValidator.validator!(parsed);
    if (isValid) {
      setState({ status: 'valid' });
      return;
    }

    const errors: AjvValidationError[] = (compiledValidator.validator!.errors ?? []).map((err) => ({
      path: err.instancePath || 'root',
      message: err.message ?? 'Unknown error',
      keyword: err.keyword,
    }));

    setState({ status: 'invalid', errors });
  }

  function reset() {
    setState({ status: 'idle' });
  }

  return { state, validate, reset };
}
