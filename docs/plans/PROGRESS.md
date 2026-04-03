# vnext-flow-studio-web - Progress Tracker

## Proje Durumu: Phase 1 MVP - Temel Yapı Tamamlandı

### Phase 1 - Tamamlanan Adımlar

- [x] **Monorepo scaffold** - pnpm workspace, Turborepo, tsconfig.base.json
- [x] **Paket yapısı** - apps/web, apps/server, packages/vnext-types
- [x] **Web app config** - Vite 6 + React 19 + Tailwind CSS 4
- [x] **BFF server config** - Hono + tsx (port 3001)
- [x] **Shared types paketi** - 14 tip dosyası + 3 constant + 2 utility (csx-codec, version)
- [x] **BFF routes & services** - projects, files, runtime-proxy, validate, templates, export
- [x] **pnpm install** - Tüm bağımlılıklar yüklendi
- [x] **Web app entry** - main.tsx, App.tsx (BrowserRouter, 3 route), index.css (Tailwind 4 theme)
- [x] **Zustand stores** - ui-store, project-store, workflow-store (undo/redo), editor-store, runtime-store, validation-store
- [x] **Layout** - AppLayout, Sidebar (project/search/validation tabs), StatusBar, FileTree
- [x] **Route pages** - ProjectListPage, ProjectWorkspacePage, FlowEditorPage
- [x] **Flow Canvas** - ReactFlow entegrasyonu, auto-layout (ELK.js), minimap, controls
- [x] **Canvas nodes** - StartNode, StateNodeBase (Initial/Intermediate/Final/SubFlow/Wizard)
- [x] **Canvas edges** - TransitionEdge (Manual/Auto/Scheduled/Event/Shared, renk kodlu)
- [x] **Canvas utils** - conversion.ts (JSON <-> ReactFlow), layout.ts (ELK auto-layout)
- [x] **State Property Panel** - General, Tasks, Transitions, SubFlow, ErrorBoundary sekmeleri
- [x] **Code Editor** - Monaco Editor entegrasyonu, tab yönetimi, tema senkronizasyonu
- [x] **C# IntelliSense** - ScriptBase metotları, ScriptContext, task casting, 6 mapping snippet
- [x] **Base64 Handler** - encode/decode, isBase64, extractCsxFromWorkflow
- [x] **Validation Engine** - 7 error + 6 warning + 2 info kuralı, reachability analizi
- [x] **Validation Panel** - Severity bazlı renk kodlama, node/rule bilgisi
- [x] **TypeScript check** - 0 error (web + server)
- [x] **Vite build** - 230 module, ~1.9MB JS bundle

### Phase 1.5 — CSX Script Geliştirme Deneyimi (Tamamlandı)

- [x] **Smart Template Engine** — Task-type-aware template üretimi (HttpTask, DaprPubSubTask, DaprServiceTask, GetInstanceDataTask, GetInstancesTask, DirectTriggerTask, SubProcessTask)
- [x] **Context-Aware Monaco Completions** — Scope detection (InputHandler/OutputHandler/Handler) + dot-trigger (context., httpTask., pubsubTask., serviceTask., TimerSchedule., this.)
- [x] **Snippet Toolbar** — 11 production-kalitesinde snippet (HTTP Setup, Response Parse, Error Handle, Config Access, Safe Property, Array Mutate, Log Pattern, PubSub Event, Dapr Service, ScriptResponse Return, Get Instance)
- [x] **Script Validation (Diagnostics)** — 5 regex-based validation rule (missing return, unused task param, async without await, missing try/catch, unsafe Instance.Data access)
- [x] **API Reference Panel** — Searchable, collapsible panel with click-to-insert functionality
- [x] **CsxEditorField Redesign** — Vertical icon sidebar + side panel layout, requestAnimationFrame snippet fix

### Phase 1.6 — UI Modernization (Tamamlandı)

- [x] **Theme overhaul** — Zinc/gray palette → Slate-based richer neutrals, indigo primary accent
- [x] **Activity Bar** — Dark sidebar (slate-900) with luminous active states, indigo accent indicators
- [x] **Status Bar** — Indigo-600 background with status-specific colors (emerald, amber, rose)
- [x] **Layout** — Glassmorphism sidebar (backdrop-blur), subtle background gradient
- [x] **Landing Page** — Gradient hero, rounded-2xl cards, gradient buttons with shadows
- [x] **Canvas** — Refined toolbar with gradient buttons, backdrop-blur dropdowns, improved node shadows
- [x] **Context Menus** — Glassmorphism (backdrop-blur-xl), rounded-xl, scale-in animations
- [x] **Property Panels** — Consistent slate palette, refined tab bar, improved input styling
- [x] **File Tree** — Indigo hover states, rounded-md items, indigo folder icons
- [x] **Code Editor** — Slate-themed tabs, breadcrumbs, status indicators
- [x] **Import Dialog** — Indigo primary buttons, slate palette throughout
- [x] **Global animations** — fade-in, slide-up, slide-down, scale-in keyframes
- [x] **Typography** — Selection color (indigo-200), focus-visible outline (indigo)
- [x] **Scrollbar** — Refined 5px with pill-shaped thumb (rounded-full)
- [x] **TypeScript check** — 0 error after full modernization

### Phase 1.7 — Script Editor Panel + Workflow Creation (Tamamlandı)

- [x] **Script Panel Store** — Zustand store for managing active script in bottom panel
- [x] **UI Store update** — scriptPanelOpen, scriptPanelHeight state & setters
- [x] **ScriptEditorPanel** — Full-width bottom panel with resize handle, Monaco editor, snippets, API reference
- [x] **FlowEditorPage layout** — Split view: canvas (top) + script editor (bottom)
- [x] **CsxEditorField redesign** — Compact preview card (3-line readonly preview + "Open in Editor" click)
- [x] **Workflow Creation** — "New Workflow" context menu in FileTree for Workflows directories
- [x] **Sidebar handler** — Creates workflow JSON + diagram JSON + .meta folder, navigates to flow editor
- [x] **TypeScript check** — 0 error

### Phase 1 - Devam Edecek

- [ ] Project Manager (create, import, export entegrasyonu)
- [ ] Keyboard shortcuts (undo/redo, save, cmd+k)
- [ ] Auto-save hook

### Phase 2 - Bileşen Editörleri (Sonraki)

- [ ] Task Editor (13+ task tipi)
- [ ] Schema Editor (conditional, parts)
- [ ] View Builder (display strategy, platform override)
- [ ] Function Editor (3 scope)
- [ ] Extension Editor (4 tip, 3 scope)
- [ ] Error Boundary Builder (3 seviye, 6 aksiyon)
- [ ] Timer/Schedule Helper (cron, duration)

### Phase 3 - Data Mapper + Gelismis

- [ ] BizTalk-style data mapper
- [ ] Functoid paleti (6 kategori)
- [ ] C# kod uretimi
- [ ] Template galerisi (12 sablon)
- [ ] Command palette (Cmd+K)
- [ ] Global search + Go To Definition
- [ ] Component Registry + Dependency Graph

### Phase 4 - Runtime Baglantisi

- [ ] Runtime connection + health check
- [ ] Instance browser + filtre builder
- [ ] Instance detay + timeline
- [ ] Manual start/transition
- [ ] Live canvas overlay
- [ ] Debug panel

---

## Dosya Yapisi Ozeti

```
vnext-flow-studio-web/
  apps/
    web/src/
      main.tsx, App.tsx, index.css
      stores/          (6 Zustand store)
      layout/          (AppLayout, Sidebar, StatusBar)
      routes/          (3 sayfa: index, project.$id, project.$id.flow.$key)
      project/         (FileTree)
      canvas/
        FlowCanvas.tsx
        nodes/         (StartNode, StateNodeBase, index)
        edges/         (TransitionEdge, index)
        panels/        (StatePropertyPanel)
        utils/         (conversion, layout)
      editor/          (MonacoSetup, CodeEditorPanel, Base64Handler)
      validation/      (ValidationEngine, ValidationPanel)
    server/src/
      index.ts
      routes/          (projects, files, runtime-proxy, validate, templates)
      services/        (project, file, export, base64, validation)
  packages/
    vnext-types/src/   (14 tip + 3 constant + 2 utility + index)
```

## Nasil Calistirilir

```bash
cd /Users/burgan/Documents/Projects/vnext-flow-studio-web
pnpm install
pnpm dev          # Web (3000) + Server (3001) birlikte baslar
```
