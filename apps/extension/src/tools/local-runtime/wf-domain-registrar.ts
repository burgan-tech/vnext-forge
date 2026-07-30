import {
  findWfDomain,
  parseWfDomainList,
  planDomainRegistration,
  type WfDomainEntry,
} from '@vnext-forge-studio/services-core';

/** The full argument set `wf domain add` accepts from Forge. */
export interface WfDomainAddArgs {
  domainName: string;
  apiBaseUrl: string;
  dbName: string;
  dbHost?: string;
  dbPort?: number;
  dbUser?: string;
  dbPassword?: string;
  useDocker?: boolean;
  dockerPostgresContainer?: string;
}

export interface WfCliResult {
  exitCode: number;
  stdout: string;
  stderr: string;
}

/**
 * The four `wf domain` calls the registrar needs, injected rather than
 * imported so this stays a plain function with no service dependency.
 */
export interface WfDomainCalls {
  domainList: () => Promise<WfCliResult>;
  domainAdd: (args: WfDomainAddArgs) => Promise<WfCliResult>;
  domainRemove: (name: string) => Promise<WfCliResult>;
  domainUse: (name: string) => Promise<WfCliResult>;
}

export type RegistrationOutcome =
  | { kind: 'added' }
  | { kind: 'replaced' }
  | { kind: 'up-to-date' }
  | { kind: 'blocked-default' }
  | { kind: 'failed'; reason: string };

/** Render a possibly-unreadable listed value for a human-facing message. */
function show(value: string | null): string {
  return value === null || value === '' ? '(unknown)' : value;
}

function describeEntry(entry: WfDomainEntry): string {
  return `API_BASE_URL ${show(entry.apiBaseUrl)}, DB_NAME ${show(entry.dbName)}`;
}

/**
 * How to put back a registration we removed and then failed to replace.
 *
 * Deliberately hand-restorable rather than auto-rolled-back: a second `add`
 * that fails the same way would leave the user with two confusing errors and
 * no clearer idea of the state on disk.
 */
function describeLostRegistration(removed: WfDomainEntry): string {
  return (
    `The previous registration was already removed (${describeEntry(removed)}); ` +
    `wf domain list does not report its DB credentials or Docker settings, so only ` +
    `these two values are known. To restore them, run: wf domain add ${removed.name} ` +
    `--API_BASE_URL ${show(removed.apiBaseUrl)} --DB_NAME ${show(removed.dbName)}`
  );
}

async function listDomains(calls: WfDomainCalls): Promise<WfDomainEntry[]> {
  const result = await calls.domainList();
  // `wf domain list` exits 0 even when it fails, so the exit code is not
  // consulted; an unparseable body yields [] and is handled by the caller.
  return parseWfDomainList(result.stdout);
}

/**
 * Register `args` with the Workflow CLI, replacing an existing registration
 * for the same domain when its values differ.
 *
 * Every `wf domain` subcommand exits 0 — including on error — so success is
 * never inferred from an exit code. The registrar decides from `wf domain
 * list` and confirms by listing again afterwards.
 */
export async function registerWfDomain(
  args: WfDomainAddArgs,
  calls: WfDomainCalls,
): Promise<RegistrationOutcome> {
  const desired = {
    domainName: args.domainName,
    apiBaseUrl: args.apiBaseUrl,
    dbName: args.dbName,
  };

  const before = await listDomains(calls);
  const plan = planDomainRegistration(before, desired);

  if (plan.action === 'up-to-date') return { kind: 'up-to-date' };
  if (plan.action === 'blocked-default') return { kind: 'blocked-default' };

  // Captured *before* the remove so a failed re-add can tell the user exactly
  // what was lost. `replace` implies the entry exists, but the lookup is kept
  // total so a null can never masquerade as "nothing was removed".
  const existing = plan.action === 'replace' ? findWfDomain(before, desired.domainName) : null;

  // Only set once the remove has actually run: reporting a lost registration
  // when the `remove` call itself threw would send the user to restore
  // something that is still there.
  let removed: WfDomainEntry | null = null;

  try {
    if (plan.action === 'replace') {
      await calls.domainRemove(desired.domainName);
      removed = existing;
    }
    await calls.domainAdd(args);
    if (plan.action === 'replace' && plan.wasActive) {
      // `removeDomain` silently switches ACTIVE_DOMAIN to "default" when it
      // removes the active domain, so the selection has to be restored.
      await calls.domainUse(desired.domainName);
    }
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    const lost = removed ? ` ${describeLostRegistration(removed)}` : '';
    return { kind: 'failed', reason: `The Workflow CLI could not be run: ${detail}.${lost}` };
  }

  const after = findWfDomain(await listDomains(calls), desired.domainName);

  if (!after) {
    const lost = removed ? ` ${describeLostRegistration(removed)}` : '';
    return {
      kind: 'failed',
      reason: `domain "${desired.domainName}" is still not registered after the attempt.${lost}`,
    };
  }

  if (after.apiBaseUrl !== desired.apiBaseUrl || after.dbName !== desired.dbName) {
    const lost = removed ? ` ${describeLostRegistration(removed)}` : '';
    return {
      kind: 'failed',
      reason:
        `domain "${desired.domainName}" is registered as ${describeEntry(after)}, ` +
        `expected API_BASE_URL ${desired.apiBaseUrl}, DB_NAME ${desired.dbName}.${lost}`,
    };
  }

  if (plan.action === 'replace' && plan.wasActive && !after.active) {
    // The values are right but the domain is no longer selected, so `wf
    // update` would deploy somewhere else — the same silent divergence this
    // whole path exists to prevent, and worth a warning even though nothing
    // was lost.
    return {
      kind: 'failed',
      reason:
        `domain "${desired.domainName}" now points at ${desired.apiBaseUrl}, but it is no ` +
        `longer the active domain. Run: wf domain use ${desired.domainName}`,
    };
  }

  return { kind: plan.action === 'replace' ? 'replaced' : 'added' };
}
