/**
 * Resolves the *root storage location* a shell uses for projects.
 *
 * - apps/web-server: returns `~/vnext-projects` (multi-project store, parity
 *   with the legacy Hono BFF behaviour).
 * - apps/extension : returns the active VS Code workspace folder (the project
 *   IS the open workspace; create/import semantics still write `*.link.json`
 *   files into the same dir to keep parity with the projects service).
 *
 * The resolver returns an absolute filesystem path in the host's native
 * separator format; services normalize via `path.join` / `path.posix`.
 */
export interface WorkspaceRootResolver {
  /**
   * Root directory under which `<project-id>` and `<project-id>.link.json`
   * files live. Must exist or be creatable.
   */
  resolveProjectsRoot(): Promise<string>
}
