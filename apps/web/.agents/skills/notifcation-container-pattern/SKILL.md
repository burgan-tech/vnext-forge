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

## Do

- Use notifications for cross-screen outcomes or short action feedback.
- Keep messages short and user-facing.
- Trigger notifications from feature-level orchestration.
- Keep rendering separate from notification creation.

## Do Not Do

- Do not introduce notifications as a substitute for proper screen states.
- Do not persist notification state.
- Do not store domain objects or raw errors in notification entries.
- Do not make the notification container decide business logic.

## Review Standard

Flag the implementation if:

- services dispatch notifications
- a notification duplicates an inline screen error for the same scenario without a clear reason
- global notification state becomes long-lived or domain-shaped
