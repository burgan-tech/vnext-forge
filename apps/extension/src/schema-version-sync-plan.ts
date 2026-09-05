/**
 * Pure planner for the schemaVersion → package.json → `npm install` sync.
 *
 * Kept free of `vscode` so the decisions (what counts as a change, seeding,
 * de-duplication per package.json directory, shared-package warnings) are
 * unit-tested; `SchemaVersionSyncController` only performs the side effects.
 */

export interface SchemaSyncSolutionInput {
  /** Absolute solution file path (posix or native — used as an opaque key). */
  filePath: string;
  fileName: string;
  rootPath: string;
  domain: string;
  schemaVersion: string;
  /** Resolved package.json for this solution; absent when none exists. */
  packageJsonPath?: string;
}

export interface SchemaSyncAction {
  filePath: string;
  fileName: string;
  rootPath: string;
  domain: string;
  from: string;
  to: string;
  packageJsonPath?: string;
  /**
   * Domains whose solution resolves to the same package.json but pins a
   * different schemaVersion — the user should know the shared pin just moved.
   */
  sharedWith: string[];
}

export interface SchemaSyncPlan {
  actions: SchemaSyncAction[];
  /** Next `filePath → schemaVersion` snapshot to feed into the following call. */
  nextLastKnown: Map<string, string>;
}

function keyOf(filePath: string): string {
  return filePath.replace(/\\/g, '/');
}

/**
 * Diff the last-known schemaVersion per solution file against the current
 * scan. The first call (`seeded === false`) only records the snapshot — an
 * upgrade must never trigger a surprise `npm install`. Files seen for the
 * first time are seeded silently as well. One action per package.json
 * directory per pass: two solutions sharing a package.json cannot both win.
 */
export function planSchemaVersionSync(
  lastKnown: ReadonlyMap<string, string>,
  solutions: readonly SchemaSyncSolutionInput[],
  opts: { seeded: boolean },
): SchemaSyncPlan {
  const nextLastKnown = new Map<string, string>();
  for (const solution of solutions) {
    nextLastKnown.set(keyOf(solution.filePath), solution.schemaVersion);
  }
  if (!opts.seeded) return { actions: [], nextLastKnown };

  const actions: SchemaSyncAction[] = [];
  const seenPackageDirs = new Set<string>();

  for (const solution of solutions) {
    const previous = lastKnown.get(keyOf(solution.filePath));
    if (previous === undefined) continue; // new file → seed only
    if (previous === solution.schemaVersion) continue;

    const pkgKey = solution.packageJsonPath ? keyOf(solution.packageJsonPath) : undefined;
    if (pkgKey) {
      if (seenPackageDirs.has(pkgKey)) continue;
      seenPackageDirs.add(pkgKey);
    }

    const sharedWith = pkgKey
      ? solutions
          .filter(
            (other) =>
              other !== solution &&
              other.packageJsonPath &&
              keyOf(other.packageJsonPath) === pkgKey &&
              other.schemaVersion !== solution.schemaVersion,
          )
          .map((other) => other.domain)
          .sort((a, b) => a.localeCompare(b))
      : [];

    actions.push({
      filePath: solution.filePath,
      fileName: solution.fileName,
      rootPath: solution.rootPath,
      domain: solution.domain,
      from: previous,
      to: solution.schemaVersion,
      ...(solution.packageJsonPath ? { packageJsonPath: solution.packageJsonPath } : {}),
      sharedWith,
    });
  }

  return { actions, nextLastKnown };
}

/** User-facing notification for one applied action (English, single sentence group). */
export function describeSchemaSyncAction(
  action: SchemaSyncAction,
  packageJsonRelPath: string,
): string {
  const base =
    `vNext Forge: schemaVersion is now ${action.to} in ${action.fileName}. ` +
    `Updated ${packageJsonRelPath} and started "npm install" in the Forge terminal.`;
  if (action.sharedWith.length === 0) return base;
  const domains = action.sharedWith.join(', ');
  return `${base} Note: this package.json is shared with domain(s) ${domains}, which pin a different schemaVersion.`;
}

export function describeMissingPackageJson(action: SchemaSyncAction, componentsRoot: string | undefined): string {
  const checked = componentsRoot
    ? `${componentsRoot}/package.json or package.json`
    : 'package.json';
  return (
    `vNext Forge: schemaVersion changed in ${action.fileName}, but no package.json was found (${checked}). ` +
    'Update @burgan-tech/vnext-schema manually.'
  );
}
