import type { ViewResponse } from '../quick-run/types/quickrun.types';

import type { FunctionExchange } from './types/functionRun.types';

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Adapts a `functions/fetchContract` exchange into the `ViewResponse` that
 * `PseudoUiOrJsonBlock` consumes.
 *
 * Returns `null` rather than throwing for every "no view to show" case — a
 * non-2xx, an unparseable body, or a payload that is not a view. `/info`'s
 * `hasView` means "following this href returns content *now*", so an empty
 * result is an expected outcome, not a failure.
 */
export function toViewResponse(exchange: FunctionExchange | null | undefined): ViewResponse | null {
  if (!exchange) return null;
  if (exchange.status < 200 || exchange.status >= 300) return null;
  if (exchange.jsonParseError) return null;

  const json = exchange.json;
  if (!isPlainObject(json)) return null;
  if (!('content' in json)) return null;

  const content = json.content as string | Record<string, unknown>;
  const view: ViewResponse = {
    key: typeof json.key === 'string' ? json.key : '',
    type: typeof json.type === 'string' ? json.type : '',
    content,
  };
  if (typeof json.display === 'string') view.display = json.display;
  if (isPlainObject(json.modes)) view.modes = json.modes as ViewResponse['modes'];
  if (typeof json.label === 'string') view.label = json.label;
  if (typeof json.renderer === 'string') view.renderer = json.renderer;
  return view;
}
