/**
 * Solution file naming helpers.
 *
 * A vNext workspace root may hold one default solution file (`vnext.config.json`)
 * plus any number of domain-suffixed ones (`vnext.<domain>.config.json`). These
 * pure helpers are the single place that knows the naming scheme; every layer
 * (services-core, extension host, web, designer-ui) must go through them rather
 * than comparing against the literal file name.
 */

export const DEFAULT_SOLUTION_FILE_NAME = 'vnext.config.json';

const DOMAIN_SOLUTION_FILE_RE = /^vnext\.(.+)\.config\.json$/i;

/** True for `vnext.config.json` and `vnext.<domain>.config.json` (case-insensitive). */
export function isSolutionFileName(fileName: string): boolean {
  return isDefaultSolutionFileName(fileName) || DOMAIN_SOLUTION_FILE_RE.test(fileName);
}

/** True only for the default solution file `vnext.config.json` (case-insensitive). */
export function isDefaultSolutionFileName(fileName: string): boolean {
  return fileName.toLowerCase() === DEFAULT_SOLUTION_FILE_NAME;
}

/**
 * Domain segment encoded in a domain-suffixed solution file name, verbatim.
 * Returns `undefined` for the default file and for names that are not solution files.
 */
export function domainFromSolutionFileName(fileName: string): string | undefined {
  if (isDefaultSolutionFileName(fileName)) return undefined;
  const match = DOMAIN_SOLUTION_FILE_RE.exec(fileName);
  return match ? match[1] : undefined;
}

/** `vnext.<domain>.config.json`; an empty/absent domain yields the default file name. */
export function solutionFileNameForDomain(domain?: string | null): string {
  const trimmed = domain?.trim();
  if (!trimmed) return DEFAULT_SOLUTION_FILE_NAME;
  return `vnext.${trimmed}.config.json`;
}

/** Human-readable editor tab / list label: `vNext Config` or `vNext Config (partner)`. */
export function solutionDisplayLabel(fileName: string): string {
  const domain = domainFromSolutionFileName(fileName);
  return domain ? `vNext Config (${domain})` : 'vNext Config';
}
