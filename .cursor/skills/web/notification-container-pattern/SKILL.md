---
name: notification-feedback
description: Scope is the host-agnostic notification port in packages/designer-ui plus its shell adapters in apps/web (sonner toast) and apps/extension/webview-ui (VS Code native). Guidelines for emitting and routing transient user feedback (toast / native notification / status-bar pill). Use when calling showNotification(...), wiring a new shell sink, deciding between transient feedback and inline screen state, or working on status-bar notification chrome.
---

# Notification Feedback

> **Scope:**
> - **Port (host-agnostic):** `packages/designer-ui/src/notification/notification-port.ts`.
> - **Web shell sink:** `apps/web/src/app/notifications/SonnerNotificationProvider.tsx` + `Sonner.tsx` (sonner toaster).
> - **VS Code shell sink:** `apps/extension/webview-ui/src/notifications/vscode-notification-sink.ts` + host route in `apps/extension/src/MessageRouter.ts` (`host:notify` → `vscode.window.show*Message`).
> - **Status-bar pill UI (web only):** `apps/web/src/app/layouts/ui/StatusBarNotification.tsx`.
>
> Notifications are not a default architectural requirement — only reach for them when a feature genuinely needs cross-screen, transient feedback.

## Architecture

The repo uses a **host-agnostic notification port + per-shell sink** pattern. There is no `notificationStore`, `NotificationContainer`, or zustand-backed queue anywhere in this codebase — those are all gone. Modules never construct a toaster themselves.

```
designer-ui module / web hook / page handler
        │   showNotification({ message, kind, action? })
        ▼
notification-port (active sink dispatch)
        │
        ├─► Web shell:  SonnerNotificationProvider → sonner <Toaster />
        │
        └─► VS Code webview sink → postMessage('host:notify')
                  │
                  ▼
            extension host MessageRouter.handleNotifyFrame
                  │
                  ▼
            vscode.window.show{Information,Warning,Error}Message
```

### Port (`packages/designer-ui/src/notification/notification-port.ts`)

Public surface re-exported from `@vnext-forge/designer-ui`:

- `showNotification(options: NotificationOptions): void` — call this from anywhere; the active sink decides how to surface it. Calls before any sink is registered are silently dropped.
- `registerNotificationSink(sink: NotificationSink): void` — called once at shell bootstrap.
- `resetNotificationSink(): void` — restores a no-op sink (used in tests / teardown).
- Types: `NotificationOptions`, `NotificationKind` (`'info' | 'success' | 'warning' | 'error'`), `NotificationAction` (`{ label, onPress }`), `NotificationSink` (`{ show(options) }`).

The port keeps a single module-level `activeSink` reference. Re-registration replaces the previous sink.

### Web shell sink (`apps/web/src/app/notifications/`)

`SonnerNotificationProvider`:
- Mounts the shared `<Toaster />` from `./Sonner` at `position="bottom-center"`.
- On mount, calls `registerNotificationSink(sonnerSink)`. On unmount, calls `resetNotificationSink()`.
- The sink translates `NotificationKind` to the matching `toast.success / .warning / .error / .info` call, with a default duration of 3000 ms.
- Action buttons map straight to sonner's `action: { label, onClick }`.

`Sonner.tsx`:
- Wraps `sonner`'s `<Toaster />`. Owns the per-variant Tailwind class strings via `toasterSurfaceVariants` / `toasterButtonVariants` (`cva`).
- Variants are token-backed (`bg-info`, `text-info-foreground`, `border-info-border`, etc.). Do not introduce raw hex colors here.
- The sonner toaster is mounted **once**, near the top of the provider tree in `apps/web/src/main.tsx`:

```tsx
<DesignerUiProvider transport={transport}>
  <SonnerNotificationProvider>
    <AppRouter />
  </SonnerNotificationProvider>
</DesignerUiProvider>
```

### VS Code shell sink (`apps/extension/webview-ui/src/notifications/vscode-notification-sink.ts`)

`createVsCodeNotificationSink(api)`:
- Each `showNotification(...)` is forwarded as a `host:notify` postMessage frame: `{ type: 'host:notify', kind, message, actionLabel?, actionId? }`.
- For actions, the sink keeps a `pendingActions` map keyed by `actionId`. When the host replies with `{ type: 'host:notify:action', actionId }`, the matching `onPress()` runs once and the entry is dropped.
- Sink is registered exactly once in `apps/extension/webview-ui/src/main.tsx`:
  ```tsx
  registerNotificationSink(createVsCodeNotificationSink(vsCodeApi));
  ```
- The webview is intentionally chrome-less; there is no in-webview toast.

Host side (`apps/extension/src/MessageRouter.ts` — `handleNotifyFrame`):
- `kind` → `vscode.window.showInformationMessage` / `showWarningMessage` / `showErrorMessage`.
- If `actionLabel` is present, it is passed as a button. When the user clicks it, the host posts `{ type: 'host:notify:action', actionId }` back to the webview.

### Status-bar pill (web only)

`StatusBarNotification` is a pure presentational component used inside the bottom status bar in `apps/web`. It is **not** a notification sink — it does not subscribe to `notification-port`. It is a styled `<span>` / `<button>` (`cva` variants like `info`, `warning`, `success`, `destructive`, `info-wide`, `chip-*`) that pages render based on their own state (e.g. `StatusBarErrorIssuesPopover`).

Use the status-bar pill when the message belongs to a persistent UI region; use `showNotification(...)` when it belongs to a transient toast / native popup.

## When to Use Each Channel

Decide before reaching for code:

- **Inline screen state** — use this first when the failure or success belongs to a single screen / form (e.g. validation errors, "no projects yet" empty state, an inline destructive-action confirm). Inline state should win over a transient notification when both would describe the same thing.
- **`showNotification(...)`** — use for cross-screen outcomes or short, time-limited feedback that the user must notice but does not need to interact with for long. Examples:
  - "Workflow scaffold could not be created."
  - "vnext.config could not be re-read from disk."
  - A long-running async action finished after the user navigated away.
- **`StatusBarNotification`** — use for a persistent status indicator that lives inside the bottom bar (e.g. lint/issue counters, environment chips). Do not use it for one-off transient feedback.

## Repo Rules

- **Services never emit notifications.** Service modules return `Promise<ApiResponse<T>>` (or throw `VnextForgeError`). Hooks / orchestrators / page handlers decide whether the failure deserves a notification.
- **One toaster, one sink per shell.** `SonnerNotificationProvider` is mounted once in `apps/web/src/main.tsx`. `createVsCodeNotificationSink` is registered once in `apps/extension/webview-ui/src/main.tsx`. Do not mount additional toasters or register a second sink at module scope.
- **Notification options stay primitive.** `NotificationOptions.message` is a string; do not pass domain objects, raw errors, or React nodes. Format the message at the call site.
- **Error notifications are last-mile UX, not the error contract.** Continue to throw / return `VnextForgeError` and `ApiResponse` failures; only translate to a `showNotification({ kind: 'error' })` at the orchestration boundary, and only if there is no inline place to show the error.
- **Use `useAsync`'s built-in path when possible.** Many web hooks pass `showNotificationOnError: false` to `useAsync` and call `showNotification(...)` themselves inside `onError`. Pick one path per call site; don't double-toast.
- **Status-bar UI is not a notification sink.** Do not wire `StatusBarNotification` into `notification-port`. It renders state owned by the page/module.

## Do

- Call `showNotification({ message, kind: 'error' | 'warning' | 'info' | 'success' })` from feature/page orchestration.
- Keep messages short, user-facing, and already localized at the call site.
- Use `kind: 'error'` for failures, `kind: 'warning'` for recoverable issues, `kind: 'info'` for neutral updates, `kind: 'success'` for confirmations.
- Provide an `action: { label, onPress }` only when the user can actually do something useful from the toast itself (it round-trips correctly through both sinks).
- Reuse `Sonner.tsx` styling tokens for any new toast variant; extend its `cva` block instead of inlining hex colors.
- For native VS Code button actions, keep `onPress` idempotent — the callback may fire late or not at all (user dismissed the popup).

## Do Not Do

- Do **not** introduce a new `notificationStore`, `NotificationContainer`, zustand slice, or in-app queue for notifications. The port + sink is the only mechanism.
- Do **not** import `sonner` directly in app code outside `apps/web/src/app/notifications/`. Always go through `showNotification(...)`.
- Do **not** mount a second `<Toaster />` in a page or module.
- Do **not** persist notification state.
- Do **not** stuff raw error objects, full stack traces, or domain entities into `NotificationOptions`.
- Do **not** use a notification as a substitute for a proper screen state (loading, empty, inline error).
- Do **not** route notifications through `MessageRouter` from arbitrary host code; only the webview's `vscode-notification-sink.ts` may emit `host:notify` frames.

## Adding a New Shell Sink

When you bring up a new shell (e.g. an alternative editor or a CLI host that surfaces user feedback):

1. Implement a `NotificationSink` (object with `show(options: NotificationOptions): void`) that knows how to render in that shell.
2. Call `registerNotificationSink(yourSink)` exactly once during shell bootstrap, before any module that might call `showNotification(...)`.
3. If the shell needs a request/response action callback, mirror the `host:notify` / `host:notify:action` envelope already used by the VS Code sink (`actionId` correlation through a `pendingActions` map).

## Review Standard

Flag the implementation if:

- A service or domain module calls `showNotification(...)` directly.
- A notification duplicates an inline error for the same scenario without a clear reason.
- Something reintroduces a `notificationStore`, `NotificationContainer`, or zustand-backed queue.
- A second `<Toaster />` is mounted, or `registerNotificationSink(...)` is called from outside the shell entry point.
- `Sonner.tsx` gets raw hex colors instead of token-backed Tailwind classes.
- Notification entries carry domain objects, raw errors, or React nodes instead of plain strings.
- `StatusBarNotification` is wired into `notification-port` (it should stay presentational).
- An action callback is registered but never cleaned up on the host side (memory leak in `pendingActions`).
