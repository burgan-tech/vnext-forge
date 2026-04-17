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

export function usePayloadValidator(schema: Record<string, unknown>) {
  const [state, setState] = useState<PayloadValidationState>({ status: 'idle' });

  // A fresh AJV instance is created for every schema change so that schemas
  // with a $id / id field never trigger the "already exists" duplicate registration error.
  const compiledValidator = useMemo(() => {
    const ajv = new Ajv({ allErrors: true });
    try {
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
