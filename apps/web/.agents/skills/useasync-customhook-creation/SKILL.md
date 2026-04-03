---
name: async-feature-flow-web
description: Use when shaping async UI flows in the web app. This repo supports a shared `useAsync` primitive for reusable async UI contracts; use it when it clarifies a feature flow on top of the shared API client and normalized error contract.
---

# Async Feature Flow Web

## Purpose

Use this skill to design async UI flows around the shared `useAsync` abstraction without turning it into mandatory ceremony.

## Repo Rules

- Use the shared `useAsync` primitive when a reusable async UI contract improves clarity.
- Route async work through the shared API client (`shared/api/client.ts`) and the owning FSD slice.
- Normalize failures into `VnextForgeError` before they reach UI code.
- Use a hook only when the screen benefits from a reusable UI-facing contract.

## Preferred Flow

1. shared API client
2. slice service or action — converts `ApiResponse<T>` using `fold` / `isSuccess` / `unwrap`
3. optional `useAsync`-based hook
4. UI — receives `VnextForgeError`, calls `error.toUserMessage().message` for display

## Use a Hook When

- one feature flow needs reusable loading and error handling
- the UI needs derived booleans or scenario-named actions
- success or failure causes local side effects owned by the feature
- multiple consumers need the same async lifecycle semantics

## Keep It Out Of a Hook When

- the work is synchronous
- the logic is one small local interaction
- the page can call a slice action directly without losing clarity
- the hook would only wrap one function and re-export the same transport vocabulary

## Do

- Build on the shared `useAsync` contract instead of inventing a parallel pattern.
- Return scenario names instead of transport names.
- Keep UI declarative.
- Handle success and failure meaning in the feature boundary.
- Expose only the state the UI actually needs.
- Surface errors as `VnextForgeError`; use `toUserMessage()` at the render edge.

## Do Not Do

- Do not introduce a second async primitive next to `useAsync`.
- Do not use `useAsync` just to standardize loading state where local state is simpler.
- Do not let components inspect raw `ApiResponse<T>` envelopes.
- Do not return `ApiFailure` or raw `Error` from a hook — normalize first.
- Do not put notifications or navigation in services.

## Review Standard

Flag the implementation if:

- a second generic async abstraction appears next to `useAsync`
- a hook merely re-exports transport behavior
- `useAsync` is used where no meaningful reuse or UI contract exists
- JSX branches on backend or transport details
- feature async logic leaks into pages or widgets
- `error.message` is rendered directly instead of `error.toUserMessage().message`
