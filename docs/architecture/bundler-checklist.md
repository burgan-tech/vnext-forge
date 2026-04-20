# Bundler checklist: new `package.json#exports` subpath

Use this when adding a public entry such as `@vnext-forge/designer-ui/editor`.

1. **Package manifest** — Add the subpath under `packages/designer-ui/package.json` `exports` with `types` + `import` (or the workspace’s single `types`/`import` convention) pointing at the new `src/...` entry.
2. **Source barrel** — Add `src/<subpath>/index.ts` (or the concrete module) and keep the root barrel or legacy `./ui` re-exports in sync if backward compatibility is required.
3. **Vite (apps/web)** — Update `apps/web/vite.config.ts` `optimizeDeps.include` for any pre-bundled dependency pulled only through that subpath (e.g. `@monaco-editor/react`, `monaco-editor`).
4. **Vite (extension webview)** — Mirror the same `optimizeDeps` entries in `apps/extension/webview-ui/vite.config.ts`.
5. **Extension Node bundle** — `apps/extension/esbuild.config.mjs` only bundles the extension host; document that webview concerns stay in the webview Vite config (see comment in that file).
6. **Export-graph CI (R-a1)** — If the repo has a CI step that validates `package.json#exports` vs imports, update allowlists or expectations in the same PR.
7. **Smoke build** — Run `pnpm --filter @vnext-forge/designer-ui --filter @vnext-forge/web --filter @vnext-forge/extension build` (or full `pnpm -r build`) before merging.
