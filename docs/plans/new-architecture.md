# vnext-forge — Yeni Mimari Planı

> **Durum:** Taslak — Onay Bekleniyor  
> **Hedef Branch:** `migrate-to-fsd`  
> **Oluşturma Tarihi:** 2026-04-02

---

## 1. Genel Vizyon

vnext-forge, bir workflow tasarım ve yönetim platformudur. Mimari iki temel hedef doğrultusunda tasarlanır:

1. **Karmaşıklık yönetimi** — FSD (Feature-Sliced Design) + monorepo ile her modülün sorumluluğu net olmalı
2. **Genişleyebilirlik** — Desktop app, agentic AI gibi gelecek bileşenler mevcut yapıyı bozmadan eklenebilmeli

---

## 2. Monorepo Paket Yapısı

```
vnext-forge/
  apps/
    web/                  → React 19 + Vite 6 (FSD ile organize)
    server/               → Hono BFF (Node.js)
  packages/
    vnext-types/          → Domain model tipleri (MEVCUT)
    app-contracts/       → API contract, ortak error sistemi (YENİ)
    workflow-system/      → Workflow validasyon, simulation, connection (YENİ)
    workspace-service/            → Workspace kuralları ve interface'leri (YENİ)
    editor-kit/      → Intellisense, linter, snippet (YENİ)
```

### 2.1 Paket Karar Matrisi

| Paket               | `apps/web`      | `apps/server` | Paket Olma Gerekçesi                                               |
| ------------------- | --------------- | ------------- | ------------------------------------------------------------------ |
| `vnext-types`       | ✅              | ✅            | Domain modeli; her iki app da kullanıyor                           |
| `app-contracts`     | ✅              | ✅            | Error sistemi + response envelope; her iki app da kullanıyor       |
| `workflow-system`   | ✅              | ✅            | Validasyon + simulation; server save-time, web realtime kullanıyor |
| `workspace-service` | ❌ (sadece tip) | ✅            | Kurallar server-side; arayüz her ikisinde ortak                    |
| `editor-kit`        | ✅              | ❌            | Monaco; şimdi sadece web — ileride desktop                         |

> **Kural:** Bir modülü pakete çıkarmanın tek meşru nedeni:
>
> - Birden fazla app kullanıyor (isomorphic), VEYA
> - Fiziksel olarak izole edilmesi gereken (platform-specific) bir bağımlılık içeriyor

---

## 3. Paket Detayları

### 3.1 `packages/vnext-types` (Mevcut, Değişmez)

**Sorumluluk:** Saf domain model tipleri. Workflow, State, Transition, Component tipleri ve sabitler.

```
packages/vnext-types/src/
  types/
    workflow.ts
    state.ts
    transition.ts
    task.ts
    schema.ts
    view.ts
    function.ts
    extension.ts
    diagram.ts
    config.ts
    error-boundary.ts
    label.ts
    mapping.ts
    instance.ts
  constants/
    state-types.ts
    trigger-types.ts
    task-types.ts
  utils/
    csx-codec.ts
    version.ts
  index.ts
```

**Dışa aktarım:** `@vnext-forge/types`  
**Bağımlılıklar:** Hiçbir pakete bağımlı değil (leaf node)

---

### 3.2 `packages/app-contracts` (YENİ)

**Sorumluluk:** Web ↔ Server haberleşme sözleşmesi. Request/response genel yapısı, hata sistemi, hata kodları, loglama için zengin hata tipi.

```
packages/app-contracts/src/
  response/
    envelope.ts           → ApiResponse<T>, PaginatedResponse<T>
    index.ts
  error/
    vnext-error.ts        → VnextError sınıfı (uygulamaya özgü hata tipi)
    error-codes.ts        → ErrorCode enum
    error-categories.ts   → ErrorCategory enum
    index.ts
  index.ts
```

#### `error/vnext-error.ts` — Uygulamaya Özgü Hata Tipi

Uygulamanın tüm katmanlarında bu hata tipi kullanılır. Debug ve loglama için kritik.

```typescript
// packages/app-contracts/src/error/vnext-error.ts

export interface VnextErrorContext {
  // Nerede oluştu
  source: string; // "FileService.writeFile" | "validateWorkflow" | "SimulatorStep"
  layer: ErrorLayer; // hangi katman

  // Ne üzerinde işlem yapılıyordu
  resourceType?: string; // "workflow" | "component" | "project" | "file"
  resourceId?: string; // ilgili kaynağın id/path'i

  // İşlem bilgisi
  operation?: string; // "read" | "write" | "validate" | "simulate"
  input?: unknown; // hangi input ile çağrıldı (hassas veri içermemeli)

  // Zincir hatalar
  cause?: VnextError | Error;

  // Ekstra debug bilgisi
  metadata?: Record<string, unknown>;
}

export type ErrorLayer =
  | "presentation" // UI
  | "feature" // Feature slice logic
  | "domain" // workflow-system, workspace-service
  | "infrastructure" // FileService, ProjectService, git ops
  | "transport"; // API client, BFF proxy

export class VnextError extends Error {
  readonly code: ErrorCode;
  readonly category: ErrorCategory;
  readonly context: VnextErrorContext;
  readonly timestamp: string;
  readonly traceId: string;

  constructor(code: ErrorCode, message: string, context: VnextErrorContext) {
    super(message);
    this.name = "VnextError";
    this.code = code;
    this.category = getCategory(code);
    this.context = context;
    this.timestamp = new Date().toISOString();
    this.traceId = generateTraceId();
  }

  // Debug için: tam hata zincirini düzleştirme
  toLogEntry(): VnextLogEntry {
    return {
      traceId: this.traceId,
      timestamp: this.timestamp,
      code: this.code,
      category: this.category,
      message: this.message,
      source: this.context.source,
      layer: this.context.layer,
      resourceType: this.context.resourceType,
      resourceId: this.context.resourceId,
      operation: this.context.operation,
      causeChain: buildCauseChain(this),
    };
  }

  // UI için: kullanıcıya gösterilecek mesaj
  toUserMessage(): string {
    return USER_MESSAGES[this.code] ?? this.message;
  }
}
```

#### `error/error-codes.ts` — Hata Kodları

```typescript
export enum ErrorCode {
  // File Operations (1xxx)
  FILE_NOT_FOUND = "FILE_NOT_FOUND",
  FILE_READ_ERROR = "FILE_READ_ERROR",
  FILE_WRITE_ERROR = "FILE_WRITE_ERROR",
  FILE_DELETE_ERROR = "FILE_DELETE_ERROR",
  FILE_PERMISSION_DENIED = "FILE_PERMISSION_DENIED",

  // Project Operations (2xxx)
  PROJECT_NOT_FOUND = "PROJECT_NOT_FOUND",
  PROJECT_INVALID_STRUCTURE = "PROJECT_INVALID_STRUCTURE",
  PROJECT_ALREADY_EXISTS = "PROJECT_ALREADY_EXISTS",
  PROJECT_IMPORT_FAILED = "PROJECT_IMPORT_FAILED",

  // Workflow Validation (3xxx)
  WORKFLOW_SCHEMA_INVALID = "WORKFLOW_SCHEMA_INVALID",
  WORKFLOW_NO_INITIAL_STATE = "WORKFLOW_NO_INITIAL_STATE",
  WORKFLOW_NO_FINAL_STATE = "WORKFLOW_NO_FINAL_STATE",
  WORKFLOW_UNREACHABLE_STATE = "WORKFLOW_UNREACHABLE_STATE",
  WORKFLOW_DUPLICATE_KEY = "WORKFLOW_DUPLICATE_KEY",
  WORKFLOW_INVALID_TRANSITION = "WORKFLOW_INVALID_TRANSITION",
  WORKFLOW_VERSION_INCOMPATIBLE = "WORKFLOW_VERSION_INCOMPATIBLE",

  // Component Validation (4xxx)
  COMPONENT_SCHEMA_INVALID = "COMPONENT_SCHEMA_INVALID",
  COMPONENT_REFERENCE_NOT_FOUND = "COMPONENT_REFERENCE_NOT_FOUND",
  COMPONENT_TYPE_MISMATCH = "COMPONENT_TYPE_MISMATCH",

  // Runtime / Engine (5xxx)
  RUNTIME_CONNECTION_FAILED = "RUNTIME_CONNECTION_FAILED",
  RUNTIME_EXECUTION_FAILED = "RUNTIME_EXECUTION_FAILED",
  RUNTIME_TIMEOUT = "RUNTIME_TIMEOUT",
  RUNTIME_VERSION_MISMATCH = "RUNTIME_VERSION_MISMATCH",

  // Simulation (6xxx)
  SIMULATION_INVALID_INPUT = "SIMULATION_INVALID_INPUT",
  SIMULATION_NO_VALID_TRANSITION = "SIMULATION_NO_VALID_TRANSITION",
  SIMULATION_DEADLOCK = "SIMULATION_DEADLOCK",

  // Git / Version Control (7xxx)
  GIT_NOT_INITIALIZED = "GIT_NOT_INITIALIZED",
  GIT_COMMIT_FAILED = "GIT_COMMIT_FAILED",
  GIT_PUSH_FAILED = "GIT_PUSH_FAILED",
  GIT_AUTH_FAILED = "GIT_AUTH_FAILED",

  // API / Transport (8xxx)
  API_REQUEST_FAILED = "API_REQUEST_FAILED",
  API_UNAUTHORIZED = "API_UNAUTHORIZED",
  API_RATE_LIMITED = "API_RATE_LIMITED",
  API_UNEXPECTED_RESPONSE = "API_UNEXPECTED_RESPONSE",

  // Internal (9xxx)
  INTERNAL_ERROR = "INTERNAL_ERROR",
  NOT_IMPLEMENTED = "NOT_IMPLEMENTED",
}

export enum ErrorCategory {
  FILE_SYSTEM = "FILE_SYSTEM",
  PROJECT = "PROJECT",
  VALIDATION = "VALIDATION",
  RUNTIME = "RUNTIME",
  SIMULATION = "SIMULATION",
  VERSION_CONTROL = "VERSION_CONTROL",
  TRANSPORT = "TRANSPORT",
  INTERNAL = "INTERNAL",
}
```

#### `response/envelope.ts` — Response Envelope

```typescript
export type ApiSuccess<T> = {
  success: true;
  data: T;
  meta?: ResponseMeta;
};

export type ApiFailure = {
  success: false;
  error: {
    code: ErrorCode;
    message: string;
    traceId: string;
  };
};

export type ApiResponse<T> = ApiSuccess<T> | ApiFailure;

export type PaginatedResponse<T> = ApiSuccess<{
  items: T[];
  total: number;
  page: number;
  limit: number;
}>;

export type ResponseMeta = {
  traceId?: string;
  duration?: number;
};
```

**Dışa aktarım:** `@vnext-forge/app-contracts`  
**Bağımlılıklar:** Hiçbir pakete bağımlı değil (leaf node)

---

### 3.3 `packages/workflow-system` (YENİ)

**Sorumluluk:** Workflow domain logic'i. Validasyon, bağlantı kuralları, schema kontrolü, proje sağlık analizi, simülasyon. UI içermez, isomorphic (browser + Node.js).

```
packages/workflow-system/src/
  schema/
    workflow-schema.ts    → Zod ile tam workflow JSON schema
    component-schema.ts   → Task, Schema, View, Function, Extension için Zod schema
    version-compat.ts     → Runtime version uyumluluk tablosu ve kontrol

  validation/
    rules/
      structural-rules.ts → Mevcut ValidationEngine.ts içeriği (15 kural)
      semantic-rules.ts   → Cross-reference, erişilebilirlik, döngü tespiti
      schema-rules.ts     → Zod schema uygunluk kontrolleri
    validate.ts           → Tüm kuralları çalıştıran motor
    types.ts              → ValidationResult, Severity (mevcut types taşınır)

  connection/
    connection-rules.ts   → Hangi stateType hangi stateType'a bağlanabilir
    connection-validator.ts → Bağlantı geçerlilik kontrolü
    types.ts

  health/
    project-health.ts     → Proje dosya yapısı analizi
    health-rules.ts       → Eksik dosya, yanlış tip, bozuk referans kontrolleri
    types.ts              → HealthCheckResult, HealthIssue

  simulation/
    simulator.ts          → State machine adım-adım çalıştırma
    step-evaluator.ts     → Tek adım: transition seçimi + yeni state
    execution-context.ts  → SimulationState, test verisi
    types.ts              → SimulationResult, StepResult

  utils/
    graph.ts              → Graf algoritmaları: reachability, cycle detection

  index.ts
```

**Dışa aktarım:** `@vnext-forge/workflow-system`  
**Bağımlılıklar:** `@vnext-forge/types`, `@vnext-forge/app-contracts`, `zod`

---

### 3.4 `packages/workspace-service` (YENİ)

**Sorumluluk:** Bir workspace'in (proje dizininin) ne olduğunu tanımlar: yapısal kurallar, interface'ler, dosya yolu standartları. Kurallar server-side işletilir; interface'ler her iki tarafta kullanılır.

```
packages/workspace-service/src/
  interfaces/
    workspace.ts          → IWorkspace, WorkspaceConfig, WorkspaceMetadata
    workspace-tree.ts     → FileTreeNode, WorkspaceStructure
    workspace-paths.ts    → Standart dosya yolları (workflow.json, vnext.config.json vb.)

  rules/
    structure-rules.ts    → Olması gereken dosyalar ve dizinler
    naming-rules.ts       → Dosya adlandırma standartları
    config-rules.ts       → vnext.config.json format kuralları
    index.ts

  analyzer/
    workspace-analyzer.ts → Bir dizini analiz edip WorkspaceAnalysisResult döndürür
    types.ts              → WorkspaceAnalysisResult, WorkspaceIssue

  paths/
    resolver.ts           → Workspace içindeki standart dosya yollarını çözümler
    constants.ts          → WORKFLOW_FILE, DIAGRAM_FILE, CONFIG_FILE sabitleri

  index.ts
```

**Interface örnekleri:**

```typescript
// interfaces/workspace.ts
export interface IWorkspace {
  id: string;
  path: string;
  config: WorkspaceConfig;
  isLinked: boolean;
}

export interface WorkspaceConfig {
  domain: string;
  version: string;
  runtimeVersion?: string;
  description?: string;
}

// paths/constants.ts
export const WORKSPACE_PATHS = {
  CONFIG: "vnext.config.json",
  WORKFLOW_DIR: "workflows",
  COMPONENT_DIR: "components",
  WORKFLOW_FILE: (key: string) => `workflows/${key}/workflow.json`,
  DIAGRAM_FILE: (key: string) => `workflows/${key}/diagram.json`,
} as const;
```

**Dışa aktarım:** `@vnext-forge/workspace-service`  
**Bağımlılıklar:** `@vnext-forge/types`, `@vnext-forge/app-contracts`

> **Not:** `workspace-service/rules/` ve `workspace-service/analyzer/` server-side'da (`apps/server`) çalışır.  
> `workspace-service/interfaces/` ve `workspace-service/paths/` hem web hem server tarafından kullanılır.  
> Web tarafında Node.js API'leri (fs, path) kullanılmaz — sadece tip ve sabit tanımları tüketilir.

---

### 3.5 `packages/editor-kit` (YENİ)

**Sorumluluk:** Monaco Editor için dil desteği. CSX (C# Script) dili için completions, diagnostics, snippets, hover, code actions. Workflow context'e göre akıllı öneriler.

```
packages/editor-kit/src/
  csx/
    completions/
      csx-completions.ts      → Mevcut csx-completions.ts (taşınır + genişletilir)
      csx-api-reference.ts    → Mevcut csx-api-reference.ts
      context-detector.ts     → Mevcut handler scope/interface type algılama
    diagnostics/
      csx-diagnostics.ts      → Mevcut csx-diagnostics.ts (taşınır + genişletilir)
      rules/
        condition-rules.ts    → return true/false kuralı vb.
        mapping-rules.ts      → InputHandler cast kuralı vb.
    snippets/
      csx-snippets.ts         → Mevcut csx-snippets.ts
      csx-templates.ts        → Mevcut csx-templates.ts
    hover/
      csx-hover.ts            → Hover documentation provider
    index.ts                  → registerCsxLanguage(monaco, context)

  workflow/
    completions/
      workflow-completions.ts → Workflow context'e göre intellisense
                                 (aktif state field'ları, erişilebilir task'lar)
    diagnostics/
      workflow-diagnostics.ts → Workflow JSON için linter markers
    index.ts                  → registerWorkflowLanguage(monaco, context)

  setup/
    monaco-setup.ts           → Mevcut MonacoSetup.ts (taşınır)
    language-registry.ts      → Tüm dilleri Monaco'ya kayıt eden façade

  types/
    language-context.ts       → EditorLanguageContext (aktif workflow state bilgisi)
    diagnostic-marker.ts      → Mevcut DiagnosticMarker tipi

  index.ts
```

**Ana API:**

```typescript
// index.ts — dışarıya açılan tek façade

// Monaco'ya tüm dilleri kayıt eder
export function setupEditorLanguages(
  monaco: Monaco,
  context: EditorLanguageContext,
): void;

// Context güncellenir (aktif state değiştiğinde)
export function updateLanguageContext(
  context: Partial<EditorLanguageContext>,
): void;

// types/language-context.ts
export interface EditorLanguageContext {
  activeWorkflow?: WorkflowSummary; // Hangi workflow'un içindeyiz
  activeStateKey?: string; // Hangi state'in script'ini yazıyoruz
  availableComponents?: ComponentRef[]; // Erişilebilir component'ler
}
```

**Dışa aktarım:** `@vnext-forge/editor-kit`  
**Bağımlılıklar:** `@vnext-forge/types`, `monaco-editor` (peer dep)

> **Not:** Bu paket şimdilik sadece `apps/web` tarafından kullanılır.  
> İleride desktop app geldiğinde aynı paketi tüketir — paketin değerini o zaman kanıtlar.

---

## 4. Dependency Grafiği

```
                    ┌─────────────────────┐
                    │    vnext-types      │  (leaf — hiçbir pakete bağımlı değil)
                    └──────────┬──────────┘
                               │ depended by all
                    ┌──────────▼──────────┐
                    │   app-contracts    │  (leaf — hiçbir pakete bağımlı değil)
                    └──┬───────┬────┬────┘
                       │       │    │
          ┌────────────▼─┐  ┌──▼────▼────────┐
          │  workspace-service │  │ workflow-system │
          └────────────┬─┘  └──┬─────────────┘
                       │       │
          ┌────────────▼───────▼────────────┐
          │        editor-kit               │  (+ monaco-editor peer dep)
          └─────────────────────────────────┘
                       │ all packages used by
              ┌────────▼─────────┐
              │    apps/web      │
              └──────────────────┘
              ┌────────▼─────────┐
              │   apps/server    │  (vnext-types, app-contracts, workflow-system, workspace-service)
              └──────────────────┘
```

**Kural:** Paketler arası dairesel bağımlılık yasak. Bağımlılık yönü her zaman yukarıdan aşağıya.

---

## 5. `apps/web` — FSD Klasör Yapısı

```
apps/web/src/
  app/
    App.tsx
    providers/
      ReactFlowProvider.tsx
      QueryClientProvider.tsx
    routes/
      index.tsx             → Tüm route tanımları
    styles/
      index.css

  pages/
    project-list/
      ui/ProjectListPage.tsx
    project-workspace-service/
      ui/ProjectWorkspacePage.tsx
    flow-editor/
      ui/FlowEditorPage.tsx
    task-editor/
      ui/TaskEditorPage.tsx
    schema-editor/
      ui/SchemaEditorPage.tsx
    view-editor/
      ui/ViewEditorPage.tsx
    function-editor/
      ui/FunctionEditorPage.tsx
    extension-editor/
      ui/ExtensionEditorPage.tsx
    code-editor/
      ui/CodeEditorPage.tsx

  widgets/
    flow-canvas/
      ui/
        FlowCanvas.tsx
        CanvasToolbar.tsx
        CanvasContextMenu.tsx
      model/
    property-panel/
      ui/
        StatePropertyPanel.tsx
        TransitionPropertyPanel.tsx
        WorkflowMetadataPanel.tsx
      model/
    script-editor-panel/
      ui/
        ScriptEditorPanel.tsx
        CodeEditorPanel.tsx
      model/
    sidebar/
      ui/
        Sidebar.tsx
        FileTree.tsx
      model/
    activity-bar/
      ui/ActivityBar.tsx
    status-bar/
      ui/StatusBar.tsx
    validation-panel/
      ui/ValidationPanel.tsx
      model/
    execution-overlay/                    ← YENİ (Phase 4)
      ui/ExecutionOverlay.tsx
      model/
    health-check-panel/                   ← YENİ (Phase 3)
      ui/HealthCheckPanel.tsx
      model/

  features/
    canvas-interaction/
      ui/
        custom-nodes/                     ← Mevcut nodes/
        custom-edges/                     ← Mevcut edges/
        EdgeHoverToolbar.tsx              ← YENİ
        NodeHoverActions.tsx              ← YENİ
        context-menus/                    ← Mevcut
      model/
        connection-rules-adapter.ts       ← workflow-system connection-rules wrapper
        edge-animation.ts                 ← Animasyon konfigürasyonu
      lib/
        auto-layout.ts                    ← Mevcut layout.ts
        canvas-persistence.ts             ← Node pozisyon kaydetme
        canvas-keyboard.ts                ← Keyboard shortcuts

    workflow-validation/
      model/
        validation-store.ts               ← Mevcut
      ui/
        ValidationBadge.tsx
        InlineValidationHint.tsx
      lib/
        realtime-validator.ts             ← Debounced hook, workflow-system çağırır

    project-health/
      model/
        health-store.ts
      lib/
        health-check-runner.ts            ← workspace-service package çağırır

    workflow-execution/
      model/
        execution-store.ts
      ui/
        ExecutionControlBar.tsx
        ExecutionDataInput.tsx
        ExecutionTimeline.tsx
      lib/
        local-simulator.ts                ← workflow-system simulator adapter
        remote-executor.ts                ← Engine API client (Phase 5)

    engine-integration/                   ← Phase 5
      model/
        engine-connection-store.ts
      lib/
        engine-client.ts
        polling-manager.ts

    code-editor/
      model/
        editor-store.ts
        script-panel-store.ts
      ui/
        ResizableLayout.tsx               ← YENİ
        CsxReferencePanel.tsx             ← Mevcut
        CsxSnippetToolbar.tsx             ← Mevcut
      lib/
        editor-setup.ts                   ← editor-kit package'i başlatır
        workflow-context-bridge.ts        ← workflow-store → EditorLanguageContext

    save-workflow/
      model/useSaveWorkflow.ts            ← Mevcut hook
    save-component/
      model/useSaveComponent.ts
    save-file/
      model/useSaveFile.ts
    import-project/
      ui/ImportDialog.tsx
      model/

    ai-assistant/                         ← SLOT (implement etme)
      types/
        ai-commands.ts
        ai-context.ts
      model/
        ai-store.ts                       ← Sadece interface
      README.md

  entities/
    workflow/
      model/
        workflow-store.ts                 ← Mevcut
      lib/
        conversion.ts                     ← Mevcut canvas/utils/conversion.ts
    project/
      model/
        project-store.ts                  ← Mevcut
      lib/
        file-router.ts                    ← Mevcut
    component/
      model/
        component-store.ts                ← Mevcut
    runtime/
      model/
        runtime-store.ts                  ← Mevcut

  shared/
    ui/
      Field.tsx
      KVEditor.tsx
      LabelEditor.tsx
      TagEditor.tsx
      JsonCodeField.tsx
      ResourceReferenceField.tsx
      SchemaReferenceField.tsx
      ComponentEditorLayout.tsx
      index.ts
    api/
      client.ts                           ← Hono RPC client (type-safe)
    config/
      env.ts
      constants.ts
    lib/
      error-handler.ts                    ← VnextError → kullanıcı mesajı dönüşümü
      logger.ts                           ← VnextError.toLogEntry() kullanan logger
```

### FSD Katman Import Kuralları

```
app  →  pages  →  widgets  →  features  →  entities  →  shared
```

- Üst katman alt katmanı import edebilir, tersi yasak
- `entities` birbirini import edemez (cross-entity yasak)
- `features` birbirini import edemez
- `widgets` aynı katmandaki widget'ları import edebilir
- `packages/*` her katmandan import edilebilir

---

## 6. `apps/server` — Klasör Yapısı

```
apps/server/src/
  index.ts                          → Hono app + AppType export (Hono RPC için)

  routes/
    files.ts                        ← Mevcut
    projects.ts                     ← Mevcut
    validate.ts                     ← Genişletilecek (workflow-system entegrasyonu)
    runtime-proxy.ts                ← Mevcut
    workspace.ts                    ← YENİ (workspace analizi endpoint'leri)
    templates.ts                    ← Mevcut

  services/
    file.service.ts                 ← Mevcut
    project.service.ts              ← Mevcut
    export.service.ts               ← Mevcut
    workspace.service.ts            ← YENİ (workspace package kullanan servis)
    validation.service.ts           ← YENİ (workflow-system kullanan servis)

  middleware/
    error-handler.ts                ← VnextError → ApiResponse<never> dönüşümü
    logger.ts                       ← VnextError.toLogEntry() kullanan merkezi logger

  lib/
    response.ts                     ← ApiResponse helper'ları (app-contracts kullanır)
```

### Server Hata Yönetimi

```typescript
// middleware/error-handler.ts
import { VnextError, ErrorCode } from "@vnext-forge/app-contracts";
import type { ApiResponse } from "@vnext-forge/app-contracts";

export function errorMiddleware(err: unknown, c: Context): Response {
  if (err instanceof VnextError) {
    // Zengin log kaydı
    logger.error(err.toLogEntry());

    // İstemciye minimal bilgi
    const response: ApiResponse<never> = {
      success: false,
      error: {
        code: err.code,
        message: err.toUserMessage(),
        traceId: err.traceId,
      },
    };
    return c.json(response, getHttpStatus(err.code));
  }

  // Bilinmeyen hata — internal error
  const wrapped = new VnextError(
    ErrorCode.INTERNAL_ERROR,
    "Beklenmeyen bir hata oluştu",
    { source: "errorMiddleware", layer: "transport" },
  );
  logger.error(wrapped.toLogEntry());
  return c.json(
    {
      success: false,
      error: {
        code: wrapped.code,
        message: wrapped.toUserMessage(),
        traceId: wrapped.traceId,
      },
    },
    500,
  );
}
```

---

## 7. Web ↔ Server Haberleşme (Hono RPC)

Mevcut durumda web tarafı ham `fetch('/api/files', ...)` çağrısı yapıyor — tip güvencesi yok. Yeni mimaride Hono RPC kullanılır.

```typescript
// apps/server/src/index.ts
const app = new Hono()
  .route("/api/files", fileRoutes)
  .route("/api/projects", projectRoutes)
  .route("/api/validate", validateRoutes)
  .route("/api/runtime", runtimeProxyRoutes)
  .route("/api/workspace", workspaceRoutes);

export type AppType = typeof app; // ← Bu tip web'e gider
export default app;
```

```typescript
// apps/web/src/shared/api/client.ts
import { hc } from "hono/client";
import type { AppType } from "../../../../apps/server/src/index";

export const api = hc<AppType>("/");
// api.api.files.$get({ query: { path: '...' } }) — fully typed
// api.api.projects.$get() — fully typed
```

Response'lar `ApiResponse<T>` envelope'una sarılır. Web tarafı `app-contracts` tiplerini kullanarak `response.success` ile discriminated union kontrolü yapar.

---

## 8. Uygulama Fazları

### Faz 1 — Paket Altyapısı + Contract (Öncelik: EN YÜKSEK)

| #   | Görev                                                                 | Bağımlılık |
| --- | --------------------------------------------------------------------- | ---------- |
| 1.1 | `packages/app-contracts` oluştur: VnextError, ErrorCode, ApiResponse  | Yok        |
| 1.2 | `packages/workflow-system` scaffold: ValidationEngine'i taşı          | 1.1        |
| 1.3 | `packages/workspace-service` scaffold: interface'ler + path sabitleri | 1.1        |
| 1.4 | `packages/editor-kit` scaffold: editor dosyalarını taşı               | 1.1        |
| 1.5 | Server error middleware: VnextError → ApiResponse dönüşümü            | 1.1        |
| 1.6 | Hono RPC client kurulumu (`shared/api/client.ts`)                     | 1.5        |

**Doğrulama:** `tsc --noEmit` tüm workspace'de 0 hata.

### Faz 2 — FSD Migrasyonu (Öncelik: YÜKSEK)

| #   | Görev                                                    | Bağımlılık |
| --- | -------------------------------------------------------- | ---------- |
| 2.1 | FSD klasör yapısını oluştur, mevcut dosyaları taşı       | Faz 1      |
| 2.2 | Import path'lerini toplu güncelle                        | 2.1        |
| 2.3 | ESLint FSD kuralı ekle (`@feature-sliced/eslint-config`) | 2.2        |

**Doğrulama:** `vite build` başarılı, tüm özellikler çalışıyor.

### Faz 3 — Canvas + Validasyon Geliştirmeleri (Öncelik: YÜKSEK)

| #   | Görev                                        | Bağımlılık |
| --- | -------------------------------------------- | ---------- |
| 3.1 | Zod workflow schema + version-compat         | Faz 1      |
| 3.2 | Connection rules (edge bağlantı validasyonu) | 3.1        |
| 3.3 | Edge hover toolbar + Node hover actions      | Faz 2      |
| 3.4 | Animasyonlu edge'ler + keyboard shortcuts    | Faz 2      |
| 3.5 | Gerçek zamanlı validasyon hook (debounced)   | 3.1        |

### Faz 4 — Project Health + Code Editor (Öncelik: ORTA)

| #   | Görev                                        | Bağımlılık |
| --- | -------------------------------------------- | ---------- |
| 4.1 | workspace-service analyzer + health rules    | Faz 1      |
| 4.2 | HealthCheckPanel UI                          | 4.1        |
| 4.3 | Monaco linter genişletme (editor-kit paketi) | Faz 2      |
| 4.4 | Workflow context intellisense                | 4.3        |
| 4.5 | ResizableLayout (panel boyutlandırma)        | Faz 2      |

### Faz 5 — Workflow Execution (Öncelik: ORTA)

| #   | Görev                                            | Bağımlılık |
| --- | ------------------------------------------------ | ---------- |
| 5.1 | Lokal simulator (workflow-system)                | Faz 1      |
| 5.2 | Execution UI (control bar, data input, timeline) | 5.1        |
| 5.3 | Canvas execution overlay (aktif node highlight)  | 5.2        |

### Faz 6 — Engine API Entegrasyonu (Öncelik: DÜŞÜK)

| #   | Görev                                             | Bağımlılık |
| --- | ------------------------------------------------- | ---------- |
| 6.1 | Engine client + BFF proxy genişletme              | Faz 5      |
| 6.2 | Polling manager                                   | 6.1        |
| 6.3 | Agentic AI slot finalize (tip dosyaları + README) | Faz 2      |

---

## 9. Risk Analizi

| Risk                                             | Etki   | Önlem                                                                                                            |
| ------------------------------------------------ | ------ | ---------------------------------------------------------------------------------------------------------------- |
| Import path kırılmaları (FSD migrasyonu)         | Yüksek | Her taşımadan sonra `tsc --noEmit`; TypeScript strict mode                                                       |
| `editor-kit` paketi Monaco bağımlılığı           | Orta   | `monaco-editor` peer dependency; SSR/Node ortamında import edilmez                                               |
| `workspace-service` paketi Node.js API sızıntısı | Orta   | `rules/` ve `analyzer/` klasörlerini tree-shaking ile izole et; web sadece `interfaces/` ve `paths/` import eder |
| VnextError serileştirme (JSON transport)         | Düşük  | `toLogEntry()` düz obje döner; class instance wire üzerinden gitmez                                              |
| Fazlar arası paralel geliştirme çakışması        | Orta   | Faz 1 tamamlanmadan Faz 2+ başlatma; feature branch stratejisi                                                   |

---

## 10. Başarı Kriterleri

- [ ] 5 paket bağımsız olarak build ediliyor (`tsc`)
- [ ] Paketler arası dairesel bağımlılık yok
- [ ] `apps/web` FSD katman ihlali yok (ESLint)
- [ ] Tüm API çağrıları Hono RPC üzerinden, ham `fetch` kalmıyor
- [ ] Her hata `VnextError` ile wrap'leniyor, `traceId` içeriyor
- [ ] `vite build` başarılı, regresyon yok
- [ ] `tsc --noEmit` tüm workspace'de 0 hata

---

## 11. Paket İsim Listesi

| Paket                        | npm adı                          |
| ---------------------------- | -------------------------------- |
| `packages/vnext-types`       | `@vnext-forge/types`             |
| `packages/app-contracts`     | `@vnext-forge/app-contracts`     |
| `packages/workflow-system`   | `@vnext-forge/workflow-system`   |
| `packages/workspace-service` | `@vnext-forge/workspace-service` |
| `packages/editor-kit`        | `@vnext-forge/editor-kit`        |
| `apps/web`                   | `@vnext-forge/web`               |
| `apps/server`                | `@vnext-forge/server`            |
