/**
 * Inline Dynamic Expresso expressions in script slots: `{ location: "dynamicExpresso", encoding: "NAT", code }`.
 *
 * Every slot sees the same expression variables: `data`, `input`, `instance` (camelCase members:
 * currentState, key, id, ...), `now`, `user` (available, roles, hasRole("x")) and the legacy `context`
 * (PascalCase members: `context.Body`, `context.Headers`, `context.Instance`, ...). The agent decision slot adds
 * `outcome` and `candidates`.
 *
 * JSON values need a conversion for comparison and arithmetic: `data.amount.AsDouble() > 1000`.
 */
export const DYNAMIC_EXPRESSO_LOCATION = 'dynamicExpresso';

/**
 * - `condition`: a boolean rule (transition, view, schema, long-poll, notification).
 * - `value`: a string (resource-lock key).
 * - `timer`: a schedule (transition timer, workflow timeout mapping, subflow timeout override mapping).
 * - `string`: a string result (agent prompt).
 * - `decision`: the chosen transition key (agent decision mapping in script mode).
 */
export type ExpressionKind = 'condition' | 'value' | 'timer' | 'string' | 'decision';

const VALUE_VARIABLES =
  'data, input, instance (camelCase: currentState, key, id, ...), now, user (available, roles, hasRole("x")), ' +
  'context (legacy PascalCase)';
const JSON_CONVERSION = 'JSON values need AsDouble() / AsInt32() / AsBoolean() to compare.';

const HELP: Record<ExpressionKind, { placeholder: string; hint: string }> = {
  condition: {
    placeholder: 'data.amount.AsDouble() > 100000',
    hint: `Boolean result. Variables: ${VALUE_VARIABLES}. ${JSON_CONVERSION}`,
  },
  value: {
    placeholder: '"seat:" + data.concertId + ":" + input.seat',
    hint: `String result. Variables: ${VALUE_VARIABLES}.`,
  },
  timer: {
    placeholder: 'data.priority.AsInt32() > 1 ? TimeSpan.FromMinutes(15.0) : TimeSpan.FromHours(2.0)',
    hint:
      'Schedule: a TimeSpan (TimeSpan.FromMinutes(15.0)), a DateTime / DateTimeOffset (now.AddHours(2)), ' +
      'an ISO-8601 string ("PT15M" or a date-time) or null = immediately; numbers are rejected. ' +
      `Variables: ${VALUE_VARIABLES}. ${JSON_CONVERSION}`,
  },
  string: {
    placeholder: '"Classify this message: " + data.message',
    hint: `String result (the prompt). Variables: ${VALUE_VARIABLES}. ${JSON_CONVERSION}`,
  },
  decision: {
    placeholder: 'data.risk.AsDouble() > 0.8 ? "is-fraud" : null',
    hint:
      'The chosen transition key (a string), or null = no decision (the fallback is taken). ' +
      `Variables: outcome (the agent run outcome), candidates (the candidate transition keys), ${VALUE_VARIABLES}. ` +
      JSON_CONVERSION,
  },
};

export function expressionHelp(kind: ExpressionKind): { placeholder: string; hint: string } {
  return HELP[kind];
}
