/**
 * Parse a pseudo-ui `Button.command` value into a workflow
 * transition key.
 *
 * Canonical shape (see SDK `view-vocabulary.md:809-834`):
 *
 *   "action":  "submit"
 *   "command": "urn:amorphie:transition:<domain>:<workflow>:<instance>:<transition-name>"
 *
 * The transition name is always the **last colon segment** of the
 * Amorphie URN. The SDK treats `command` as an opaque string and
 * forwards it as-is to `delegate.onAction`; the host (us) is
 * responsible for interpreting it.
 *
 * Tolerated variants — all degrade gracefully to "last segment":
 *
 *   1. Amorphie 6-segment URN (canonical):
 *      `urn:amorphie:transition:customer:registration:inst-001:submit`
 *      → `submit`
 *   2. Amorphie 5-segment URN (legacy, no instance scope):
 *      `urn:amorphie:transition:retail:loan:approve` → `approve`
 *   3. Generic `urn:...:key` → last `:` segment.
 *   4. URL form `https://host/transitions/<flow>/<name>` → last `/`
 *      segment.
 *   5. Raw key `approve` → `approve` (no parsing).
 *   6. Empty / undefined / non-string → `null` so the caller can
 *      surface a "Missing transition command" error.
 */

const AMORPHIE_TRANSITION_URN_PREFIX = 'urn:amorphie:transition:';

export function resolveTransitionKey(command: string | undefined | null): string | null {
  if (typeof command !== 'string') return null;
  const trimmed = command.trim();
  if (!trimmed) return null;

  // Canonical Amorphie URN — explicit prefix check so any future
  // variants slot in here rather than relying on generic guessing.
  if (trimmed.startsWith(AMORPHIE_TRANSITION_URN_PREFIX)) {
    const tail = trimmed.split(':').pop()?.trim();
    return tail && tail.length > 0 ? tail : null;
  }

  // Other URN shapes — last `:` or `/` segment.
  if (trimmed.startsWith('urn:')) {
    const tail = trimmed.split(/[:/]/).pop()?.trim();
    return tail && tail.length > 0 ? tail : trimmed;
  }

  // HTTP(S) URL — last `/` segment (no query / fragment stripping;
  // such URLs are not in current Amorphie use, basic split is enough).
  if (/^https?:\/\//i.test(trimmed)) {
    const tail = trimmed.split('/').pop()?.trim();
    return tail && tail.length > 0 ? tail : trimmed;
  }

  // Raw key (or short code).
  return trimmed;
}
