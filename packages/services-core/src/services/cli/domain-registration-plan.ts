import { findWfDomain, type WfDomainEntry } from './wf-domain-list.js'

/** The registration Forge wants `wf` to end up with. */
export interface DesiredDomainRegistration {
  domainName: string
  apiBaseUrl: string
  dbName: string
}

/**
 * What has to happen to make `wf` point at the desired runtime.
 *
 * - `add` — the domain is not registered yet.
 * - `replace` — registered with different values. The CLI has no update
 *   command (`addDomain` throws on an existing name), so the only route is
 *   `remove` then `add`. `wasActive` is carried because `removeDomain`
 *   silently switches `ACTIVE_DOMAIN` to `default` when it removes the
 *   active domain, and the caller must restore it with `domain use`.
 * - `up-to-date` — already correct; re-registering would be pointless churn
 *   and would briefly drop the user's domain profile for no gain.
 * - `blocked-default` — registered under the name `default` with different
 *   values. `removeDomain` refuses to remove `default`, so there is no way
 *   to change it from here.
 */
export type DomainRegistrationPlan =
  | { action: 'add' }
  | { action: 'replace'; wasActive: boolean }
  | { action: 'up-to-date' }
  | { action: 'blocked-default' }

const CLI_UNREMOVABLE_DOMAIN = 'default'

/**
 * Decide how to register `desired` given what `wf domain list` reported.
 *
 * Pure on purpose: the interesting logic here is the decision, and keeping it
 * free of child processes is what makes it testable.
 *
 * A `null` `apiBaseUrl` / `dbName` on the existing entry counts as different:
 * we could not read the value, so we cannot claim it matches.
 */
export function planDomainRegistration(
  existing: readonly WfDomainEntry[],
  desired: DesiredDomainRegistration,
): DomainRegistrationPlan {
  const current = findWfDomain(existing, desired.domainName)
  if (!current) {
    // Only *removing* `default` is refused by the CLI; adding it is fine.
    return { action: 'add' }
  }

  const matches =
    current.apiBaseUrl === desired.apiBaseUrl && current.dbName === desired.dbName
  if (matches) {
    // Checked before the `default` guard on purpose: when nothing needs
    // doing, reporting a block would be a false alarm about a limitation we
    // never actually run into.
    return { action: 'up-to-date' }
  }

  if (current.name === CLI_UNREMOVABLE_DOMAIN) {
    return { action: 'blocked-default' }
  }

  return { action: 'replace', wasActive: current.active }
}
