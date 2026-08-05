import type { FunctionScope, FunctionVerb } from '@vnext-forge-studio/vnext-types';

/** One slot's discovery entry from `/info`. */
export interface ContractSlotInfo {
  hasView?: boolean;
  hasSchema?: boolean;
  loadData?: boolean;
  href: string;
}

/** The `/info` payload, as parsed out of a {@link FunctionExchange}'s `json`. */
export interface FunctionInfo {
  key: string;
  domain: string;
  version: string;
  scope: FunctionScope;
  function: { verbs?: FunctionVerb[]; href: string };
  rawResponse?: boolean;
  cacheable?: boolean;
  inputView?: ContractSlotInfo;
  outputView?: ContractSlotInfo;
  inputSchema?: ContractSlotInfo;
  outputSchema?: ContractSlotInfo;
}

/**
 * What every `functions/*` method returns — the raw HTTP exchange. Mirrors
 * `functionExchangeResult` in
 * `packages/services-core/src/services/function-run/function-run-schemas.ts`
 * field-for-field; keep the two in sync.
 */
export interface FunctionExchange {
  status: number;
  contentType: string;
  responseHeaders: Record<string, string>;
  /**
   * Parsed body when the content type is JSON and parsing succeeded.
   *
   * A legitimate JSON body can decode to `null`, `0`, `false`, or `''` — all
   * falsy. Consumers must check `'json' in exchange` to know whether parsing
   * happened, never this field's truthiness.
   */
  json?: unknown;
  /**
   * Populated when the content type said JSON but `JSON.parse` failed.
   * `body` still carries the raw text either way.
   */
  jsonParseError?: string;
  body: string;
}
