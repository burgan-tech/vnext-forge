---
name: notification-feedback-web
description: Optional guidance for transient user feedback in the web app. Use only when a notification system is intentionally introduced; notifications are not a core architecture requirement of the current refactor.
---

# Notification Feedback Web

## Purpose

Use this skill only when a feature genuinely needs global transient feedback such as toast or banner messages.

Notifications are optional infrastructure in this repo, not a default requirement.

## Repo Rules

- Services never emit notifications.
- Feature or page orchestration decides whether a global notification is needed.
- Inline validation or inline error UI takes priority when the failure belongs to the current screen.
- If a notification layer exists, keep its state ephemeral and minimal.
- In the current repo, notification state lives in `@shared/notification/model/notificationStore` with Zustand.
- Notification rendering lives in `@shared/notification/ui/NotificationContainer`.
- Toast UI should go through the shared `@shared/ui/sonner` wrapper, not a raw app-local `sonner` toaster setup.

## Do

- Use notifications for cross-screen outcomes or short action feedback.
- Keep messages short and user-facing.
- Trigger notifications from feature-level or page-level orchestration via `showNotification(...)`.
- Keep rendering separate from notification creation.
- Let the store own queue/current/visible state only.
- Let the container translate notification entries into `sonner` toasts.
- Reuse the shared `Toaster` from `@shared/ui/sonner`.

## Do Not Do

- Do not introduce notifications as a substitute for proper screen states.
- Do not persist notification state.
- Do not store domain objects or raw errors in notification entries.
- Do not make the notification container decide business logic.
- Do not wire notifications through Redux slices or dispatch-based flow in this repo.
- Do not import `useTheme` or add theme-coupled toaster setup inside the notification layer.

## Review Standard

Flag the implementation if:

- services dispatch notifications
- a notification duplicates an inline screen error for the same scenario without a clear reason
- global notification state becomes long-lived or domain-shaped
- the implementation bypasses `@shared/notification/model/notificationStore`
- the container owns business decisions instead of only rendering queued notifications
- the toaster is mounted from a custom raw `sonner` setup instead of `@shared/ui/sonner`
