# vnext-forge-studio-desktop — Roadmap (v0.1 → v1.0)

**Status:** Phase 1 Sprint 1.1 ✅ done. Phase 2 (v0.2.0 "Foundation Productivity", formerly Sprint 1.4) is next.
**Owner:** TBD
**Last updated:** 2026-05-07
**Plan version:** v3

> **Plan v3 reorder (2026-05-07):** Distribution & onboarding (auto-update, code signing, telemetry, crash reporting, settings, onboarding wizard) moved from Sprint 1.2/1.3 to the **final Phase 9 v1.0.0**. Rationale: build the product first; package for Burgan Tech-wide rollout last. Internal alphas use unsigned binaries with Gatekeeper/SmartScreen warnings.

This roadmap is the consolidated plan for shipping the standalone Electron desktop application of vnext-forge-studio to all of Burgan Tech (200+ developers). It is single-tenant, English-only, GitHub Releases + electron-updater for distribution, no AI features in scope for v1.x.

The plan reuses the existing monorepo. The desktop shell is a thin wrapper around `apps/web` (renderer) and `apps/server` (utility-process child). New features land in `packages/designer-ui` and `packages/services-core` so the existing VS Code extension benefits in parallel.

## Out of scope for v1.x

The following ideas were considered and explicitly deferred:

- Welcome Dashboard / Start Page
- Shared Workspace Settings (`.vnextstudio/` Git-tracked) — partial: only run-configs and snippets in v0.1+
- Bookmarks / Favorites + Multi-Window
- Documentation Hover Help (embedded engine docs)
- In-App Bug Reporter
- Interactive Tutorials
- Network Inspector
- Audit Log Viewer
- Visual Regression Testing for views
- Tag Manager
- Workflow Diff PR Reports
- Localization Manager
- Embedded Knowledge Base
- Health Dashboard (NOC mode)
- License / Usage Reporting
- AI Assistant (any form)
- Multi-tenant / shared backend
- Visual Mapper UI for `.mapper.json` (JSON edit only in v1.x)
- Real-time collaboration
- Plugin marketplace
- Embedded Jaeger / ClickHouse dashboards (link out only)
- Multi-environment deploy promotion

## Phase summary

| Phase | Version | Name | Duration | Headline | Status |
|-------|---------|------|----------|----------|--------|
| 0 | — | Sprint 0 (bootstrap) | 1 week | Branch + plan + smoke | ✅ done |
| 1 | v0.1.0 | Shell Parity (Sprint 1.1) | 1 week | Icons + native menu + window-state + About + native error dialog | ✅ done |
| **2** | **v0.2.0** | **Foundation Productivity** | **2 weeks** | **Smart Search (Cmd+P + Cmd+Shift+F) + Snippets + Sessions + Terminal + Pre-Commit + Test Data Gen** | 🔄 next |
| 3 | v0.3.0 | Runtime Monitor + Operations | 6 weeks | Real-time instance monitoring + saved queries + HTTP recording + run configs |
| 4 | v0.4.0 | API Tester + Codegen | 4 weeks | Built-in REST client + mock server + TS/OpenAPI/Postman codegen |
| 5 | v0.5.0 | View Designer + Live Preview | 5 weeks | Visual Neo-widget builder + multi-platform preview |
| 6 | v0.6.0 | Debugger + Mapping Test + Local Engine | 6 weeks | Visual TransitionPipeline debugger + bundled local engine |
| 7 | v0.7.0 | Refactor + Lint + Docs + Migration | 5 weeks | Cross-project refactor + auto-fix lint + Markdown/Mermaid docs + migration assistant |
| 8 | v0.8.0 | Productivity Tools | 4 weeks | Notebook + DB inspector + patterns catalog + profiler |
| **9** | **v1.0.0** | **Distribution & Onboarding** | **3 weeks** | **electron-updater + Linux CI + mac/win code signing + Sentry + PostHog + Settings + Onboarding wizard** |

**Total:** ~36 weeks (1 FTE) — ~5-6 months with 2 FTE in parallel.

## Phase 0 — Sprint 0 (1 week)

Bootstrap: signing/distribution infrastructure, branch, plan documents, smoke test current scaffold.

- Apple Developer Program enrolment (Burgan Tech corporate account)
- Authenticode EV cert procurement + secure storage (HSM/USB token)
- Private GitHub repo or Releases-only repo for desktop binaries
- Sentry account + projects (mac/win/linux)
- PostHog account + project key
- Notion install guide page
- Branch `feat/desktop-studio` created off main
- `CLAUDE.DESKTOP.md` written with locked architectural decisions
- `docs/plans/desktop-studio-roadmap.md` (this file) written
- Smoke test results documented in `docs/plans/desktop-studio-smoke-test-results.md`
- Initial commit on `feat/desktop-studio`

## Phase 1 — v0.1 "Shell Parity + Foundation" (5 weeks)

### Sprint 1.1 — Smoke + skeleton completion (1 week)

- End-to-end smoke test of existing scaffold
- Verify `apps/server` reads `DESKTOP_STATIC_DIR` and serves SPA
- Native menu bar (`apps/desktop/src/menu.ts`) with platform-aware template
- Window state persistence via `electron-window-state`
- Native error dialog for server spawn failures
- App icons (.icns/.ico/.png) generated from brand SVG and placed in `apps/desktop/build/icons/`
- About dialog showing version + license

### Sprint 1.2 — Auto-update + signed builds (1 week)

- `electron-updater` dependency + main.ts wiring
- GitHub Actions workflow: tag-trigger → 3 OS build + sign + notarize → publish to Releases
- macOS notarization end-to-end validation
- Windows Authenticode signing
- Linux AppImage GPG signing (optional)
- v0.1.0 → v0.1.1 update mechanism verified

### Sprint 1.3 — Telemetry + crash + onboarding (1 week)

- Sentry SDK integration in main and renderer (opt-in)
- PostHog SDK + standard typed events: `app_started`, `project_opened`, `workflow_saved`, `runtime_connected`, `instance_action_triggered`, etc.
- In-app Settings panel: telemetry opt-in toggle, theme, default project location
- First-launch onboarding wizard
- Internal install guide written and published
- Internal alpha invitation to 5–10 users

### Sprint 1.4 — Foundation productivity (2 weeks) — NEW

| Feature | Days |
|---------|------|
| Smart Search Cmd+P (state/transition/task/mapping/schema quick switcher) | 2 |
| Smart Search Cmd+Shift+F (project-wide regex content search) | 2 |
| Snippets Library (personal + project-shared `.vnextstudio/snippets/`, Monaco snippets API, tab-stops) | 3 |
| Integrated Terminal (xterm.js + node-pty + project pre-configured tasks) | 2 |
| Workspace Sessions (open tabs/selection/scroll/runtime connections, restart-restore) | 2 |
| Pre-Commit Hooks (husky-style; validate.js + format on commit; reject broken refs) | 1 |
| Test Data Generators (Faker.js from JSON Schema; TR phone/TCKN/IBAN; Quick fill button) | 2 |

### v0.1 DoD

- Extension feature parity + 7 foundation productivity tools working
- Signed installers downloadable on 3 OS
- Auto-update verified end-to-end
- 5–10 internal alpha users running 1 week clean

## Phase 2 — v0.2 "Runtime Monitor + Operations" (6 weeks)

New package: `packages/runtime-connector`. New `services-core` methods (`runtime/connect`, `runtime/listInstances`, `runtime/triggerTransition`, etc.).

### Sprint 2.1 — Connection manager + instance list (1.5 weeks)

- Connection manager UI (host/port/headers/JWT, multi-domain)
- Health check + auto-reconnect
- Instance list view (sortable columns, attribute-aware filter, pagination, ETag-polling, status badges)
- "Open in Designer" action per instance

### Sprint 2.2 — Instance detail + canvas overlay (1.5 weeks)

- Instance detail panel: state diagram with current state highlight (reuse workflow canvas)
- Executed-path overlay on canvas (transition history → coloured edges)
- Real-time data view (etag/entityEtag aware)
- Transition history timeline
- Active correlations tree (subflow / subprocess)
- Pending jobs (timers, scheduled transitions)

### Sprint 2.3 — Instance actions (1 week)

- Trigger transition (payload editor + schema validation, sync/async)
- Cancel instance (confirmation modal)
- Retry faulted instance (data correction option)
- Update parent data (subflow context)
- Bulk actions on filtered instances (max 50)
- Action audit log (local)

### Sprint 2.4 — Saved Queries + Smart Filters (1 week) — NEW

- Filter expression builder (status + flow + attribute)
- Saved queries sidebar ("Approval > 24h", "Faulted today")
- Threshold alerts (local notification or Slack/Teams webhook)
- Filtered export (CSV/JSON)

### Sprint 2.5 — HTTP Request Recording → Auto-Mock (1 week) — NEW

- Instance run → outbound HTTP proxy/intercept
- Recording → Mockoon-compatible collection export
- "Auto-mock all external services" one-click (integrates with Phase 3 Mock Generator)
- Replay recorded scenarios

### Sprint 2.6 — Run Configurations (1 week) — NEW

- IDE-style run configs (name/env/workflow/sample payload)
- Presets ("Run dev", "Run stage", "Smoke test all")
- Configurations stored in `.vnextstudio/run-configs.json` (project-shared, Git-tracked)
- One-click "Run last config" + recent menu

### v0.2 DoD

- 100+ instances filter/sort smooth, detail open <500ms
- HTTP recording 50+ requests lossless
- 10+ run configs definable
- Internal beta with 30 users

## Phase 3 — v0.3 "API Tester + Codegen" (4 weeks)

New package: `packages/api-tester`.

### Sprint 3.1 — Core request/response (1 week)
- Request builder (method/URL/headers/body/query)
- Response viewer (JSON tree, headers, status, timing, ETag)
- Collections, environment vars (`{{var}}` expansion), auth helpers (Bearer/Basic/custom)

### Sprint 3.2 — vNext auto-discovery (1 week)
- Workflow → endpoint list (start/transition/state/data/view/schema/hierarchy/authorize/permissions)
- Sample payload from schema
- Postman import, cURL/.http export

### Sprint 3.3 — Test runner (1 week)
- Pre-request scripts, post-response assertions (status, body shape, JSONPath)
- Test chains (sequential, response chaining)
- Runner UI + report

### Sprint 3.4 — Mock Server + Code Generation (1 week) — NEW
- Mock Server Generator: HTTP task definitions → Mockoon-compatible mock; response templates (delay, error rate, variance); inline run in Studio
- Code Generation: Schema → TypeScript types (+ optional Zod), Workflow → OpenAPI 3.x, Workflow → Postman collection, Workflow → SDK client wrapper

### v0.3 DoD
- Postman collection round-trip lossless
- 10+ request test chain stable
- Mock server replaces real HTTP task in tests
- TS/OpenAPI codegen valid output on 5 schemas

## Phase 4 — v0.4 "View Designer + Live Preview" (5 weeks)

New package: `packages/view-renderer` — port `view-preview/preview-render.js` (~979 lines vanilla JS) to TypeScript React.

### Sprint 4.1 — Renderer port (1.5 weeks)
- preview-render.js → React; 20+ Neo widgets (`neo_scaffold`, `column`, `row`, `neo_text_form_field`, `neo_stepper`, `neo_indexed_stack`, `neo_selectable_list_view`, `neo_visibility`, `neo_button`, …)
- Expression parser (`${readFromWorkflow}`, `${itemData}`, `${calculateDate}`, `${callback}`, ternary)
- Listen-based re-render
- Theme constants (NeoColors / NeoTheme)

### Sprint 4.2 — Visual builder (2 weeks)
- Widget palette, drag-drop canvas, property inspector (typed forms per widget)
- Tree explorer, undo/redo, keyboard navigation

### Sprint 4.3 — Live preview + mock data (1 week)
- Preview pane, mock data injector (paste JSON or load deneme.json-style file)
- Multi-platform tabs (web/iOS/Android), responsive preview, locale switcher

### Sprint 4.4 — Schema bind + helpers (0.5 weeks)
- Schema picker, view → schema reverse generation, icon URN registry

### v0.4 DoD
- 20 widgets supported
- 5 production views round-trip lossless
- Mock data preview <100ms refresh

## Phase 5 — v0.5 "Debugger + Mapping Test + Local Engine" (6 weeks)

### Sprint 5.1 — Mapping Test Runner (1.5 weeks)
- Test tab on mapping editor
- Sample ScriptContext editor (Body/Headers/Instance.Data/etc.)
- Roslyn compile + execute
- Output viewer (ScriptResponse JSON tree)
- "Save as test case" (versioned JSON)
- Per-mapping coverage tracker

### Sprint 5.2 — Visual Pipeline Debugger (2 weeks)
- UI on top of `services-core/quickrun/*`
- Workflow → start instance with custom data
- Step-by-step mode (17 pipeline steps with canvas highlight)
- ScriptContext inspector at breakpoints
- Step over/into (subflow), reset/restart
- Time-travel (rewind transitions)
- Auto-mock layer for HTTP tasks

### Sprint 5.3 — Conditional Breakpoints + Watches + Live Reload (1.5 weeks) — NEW
- Conditional BPs (`amount > 100000`)
- Watch expressions (`context.Instance.Data.customerId` tracked across steps)
- Call stack view (subflow chain parent → child → grandchild)
- Live reload: pause at BP, edit mapping inline, continue with new code
- Variable hover → tooltip with value

### Sprint 5.4 — Local Engine Manager (1 week) — NEW
- Download/start/stop engine binary from Studio
- Pre-configured sample data
- "Reset DB" button
- Multi-version (v0.0.50 + v0.0.45 side-by-side)
- Engine log stream in Studio
- New-developer onboarding sandbox in 30s

### v0.5 DoD
- Bug-find-and-fix in mid-complexity workflow <30 min
- 50+ mapping test cases stable
- Conditional BP + watch production-grade
- Local engine 1-click <30s start
- Internal GA ready

## Phase 6 — v1.0 "Refactor + Lint + Docs + Migration" (5 weeks)

### Sprint 6.1 — Cross-Project Refactoring (1.5 weeks)
- Find usages, rename across files
- Extract subflow from selection
- Convert inline mapping → .csx file
- Bulk version bump

### Sprint 6.2 — Lint + Quality (1 week)
- Pluggable lint rules (Finish state subType required, mapping >200 lines warn, auto-transition chain depth warn, timeout-less long task warn)
- Auto-fix where possible
- Lint report sidebar
- Pre-build integration

### Sprint 6.3 — Documentation Generator (1 week)
- Workflow → Markdown + Mermaid
- State diagram → SVG/PNG
- Project-wide developer guide
- CHANGELOG auto-update from version diffs

### Sprint 6.4 — Migration Assistant + Diff Compare + Versioning UI (1.5 weeks) — NEW
- Migration Assistant: parse engine release notes, breaking-change detection, highlight affected workflows, auto-fix suggestions, migration history per env, pre-flight check before deploy
- Differential Workflow Comparison: side-by-side state machine + JSON diff cross-domain and cross-version (e.g., "compare our IDM vs vnext-idm reference"), copy-missing-state action
- Workflow Versioning UI: list all versions side-by-side, "Major or Minor?" auto analysis, migration plan per version, rollback to previous, semver bump wizard

### v1.0 DoD
- Rename across 5 files stable
- Engine v0.0.42 → v0.0.50 migration assistant works
- Doc gen production-grade Markdown + Mermaid
- 200 users stable, crash rate <0.5%
- Burgan Tech-wide GA

## Phase 7 — v1.1 "Productivity Tools" (4 weeks)

### Sprint 7.1 — Notebook-Style Workflow Exploration (1.5 weeks)
- Markdown + code cells (Jupyter-style)
- Cell runs `quickrun` with inline output
- Visualize step-by-step inline
- "How does OTP flow work?" runnable doc
- `.vnotebook` format Git-tracked

### Sprint 7.2 — Database Inspector (1 week)
- PostgreSQL connection (read-only and read-write)
- Multi-schema browser (sys_flows, sys_views, dynamic flow schemas)
- SQL query helper, instance data direct from table, JSON path query helper
- CSV/JSON export, migration history viewer

### Sprint 7.3 — Workflow Patterns Catalog (1 week)
- Anonymized patterns from production projects
- Ready patterns (OTP with retry, multi-party approval, saga with compensation, long-running with timeout, fan-out/fan-in, idempotent start)
- Apply + customize one-click
- Anti-patterns list

### Sprint 7.4 — Performance Profiler (0.5 weeks)
- Synthetic load (100 instances, 1000 transitions)
- Slowest task/mapping/transition report
- Slow query suggestion (DB index hints)
- "Performance budget" alerts
- Shareable profile snapshot

### v1.1 DoD
- 5+ working notebook examples
- DB inspector browses all 6 schema types
- 10+ patterns in catalog
- Profiler reports bottlenecks

## Burgan Tech rollout strategy

| Stage | Audience | Trigger |
|-------|----------|---------|
| Internal Alpha | 5–10 users | End of Phase 1 (v0.1) |
| Internal Beta | 30 users | End of Phase 2 (v0.2) |
| Internal GA | 200+ users | End of Phase 5 (v0.5) |
| v1.0 GA | All Burgan Tech | End of Phase 6 |

Distribution: Notion install guide (primary) + DMG (Homebrew tap optional) + EXE NSIS (Chocolatey optional) + AppImage (Snap optional). Auto-update via electron-updater + GitHub Releases (private repo).

Onboarding: first-launch wizard, "What's New" modal per major version, in-app feedback form (GitHub Issues).

Support: Slack/Teams `#vnext-studio` channel, weekly office hours for first 3 months.

## Cross-cutting standards

- **i18n:** English only (existing forge rule)
- **Errors:** `VnextForgeError`, `toUserMessage()` for UI, `toLogEntry()` for logs
- **Logs:** renderer console + LogLevel filter; main + utility process pino → file (10MB rotation, 30 days); Sentry opt-in
- **Telemetry events (PostHog):** `app_started`, `app_quit`, `project_opened`, `project_created`, `workflow_saved`, `workflow_validated`, `mapping_test_run`, `runtime_connected`, `instance_action_triggered`, `api_request_sent` — no PII / project content / instance data
- **Security:** contextIsolation=true, nodeIntegration=false, CSP, loopback bind only, FS jail, SSRF allowlist, IPC allow-list, secrets via OS keychain (keytar)
- **Performance targets:** cold start <3s, 100-file project open <1s, 50-state canvas render <500ms, 1000-row instance list 60fps scroll

## Test strategy

- **Unit:** services-core (Vitest), designer-ui hooks (Vitest + RTL)
- **Integration:** apps/server REST endpoints (Vitest + supertest)
- **E2E:** apps/desktop (Playwright + Electron driver)
- **Smoke:** 3 OS automated per release
- **Coverage targets:** services-core 85%+, designer-ui hooks 80%+, E2E 20 critical user journeys

## Risk register (top items)

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Code signing cert delay/cost | Medium | High | Phase 0 parallel start; ad-hoc unsigned beta fallback |
| electron-updater + private repo complexity | Low | Medium | First release manual update, automate v0.2 |
| Roslyn LSP perf on large projects | Medium | Medium | Lazy compile, project-scoped indexing |
| Neo widget vocabulary changes | Low | High | Renderer plugin-friendly design |
| Runtime monitor data load freezes UI | Medium | High | Virtualized list, ETag polling, background worker |
| Burgan Tech corporate MDM/proxy/SSL inspection | High | High | Early test, IT coordination |
| Existing extension users migration | Medium | Medium | Coexist 3–6 months |
| Phase 4 (View Designer) overrun | High | Medium | Scope-cut: JSON-only first, visual builder v1.1 |

## Open decisions (block kickoff if not answered)

1. Apple Developer Program account — corporate or new?
2. Authenticode cert — EV (hw token, expensive, fast SmartScreen rep) vs OV (sw, cheap, 30+ install rep)?
3. Private repo for binaries — `burgan-tech/vnext-studio` (new) vs Releases on existing `vnext-forge`? Auto-updater token distribution constraint
4. Sentry — Cloud (eu) vs self-hosted (data residency TR)?
5. PostHog — Cloud (eu) vs self-hosted?
6. Existing VS Code extension — deprecate post-v1.0, parallel support, or read-only legacy?
7. 1 dev or 2 devs in parallel — estimates assume 1 FTE; 2 paralel cuts ~%40 calendar
