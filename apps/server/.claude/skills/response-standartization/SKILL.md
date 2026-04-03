---
name: response-standardization
description: Standardize API and HTTP response design with a compact, reusable contract. Use when creating, reviewing, or refactoring success/error envelopes, status code semantics, pagination metadata, response helper behavior, or middleware-owned response shaping. Prefer this skill when a task requires consistent response structure, clear ownership of response fields, and rejection of ad hoc JSON patterns.
---

# Response Standardization

## Purpose

Keep responses predictable, compact, and easy to maintain.

This skill defines how to design or review a shared response contract without relying on project-specific classes, file structures, or framework details.

Use it to prevent ad hoc response shapes, duplicated metadata logic, inconsistent status codes, and one-off error formats.

## What This Skill Tells You

- keep one shared outer response contract
- separate success and error concerns clearly
- centralize metadata ownership
- keep controllers or handlers thin
- keep pagination in one place
- align documentation with runtime behavior
- reject custom per-endpoint response inventions

## How To Use This Skill

Use this skill in three modes:

1. Design: define a shared response contract before adding endpoints
2. Review: check whether an existing endpoint breaks the standard
3. Refactor: replace local response patterns with one consistent contract

When applying it:

1. identify the current response shape
2. decide whether the flow is success, creation, empty success, paginated success, or error
3. map the endpoint to the shared contract
4. remove local formatting logic that should be centralized
5. verify that docs and runtime match

## Core Contract

Every response should follow one stable outer shape.

Recommended structure:

- success responses contain `success`, `data`, `error`, and `meta`
- error responses contain `success`, `data`, `error`, and `meta`
- `success` changes meaning, not the envelope shape
- `data` is present only for successful business output
- `error` is present only for failure details
- `meta` carries cross-cutting metadata, not business payload

Do not create multiple top-level response styles for different endpoints.

## To Do

- define one response envelope and reuse it everywhere
- keep success and error shapes symmetrical at the top level
- centralize shared metadata injection
- use one consistent place for pagination metadata
- keep status code meaning stable across endpoints
- let centralized error handling format failures
- keep response documentation synchronized with runtime behavior
- treat response helpers as transport utilities, not business logic containers
- keep endpoint-specific data inside `data`, not beside it
- preserve backward compatibility unless the task explicitly allows contract changes

## Not To Do

- do not handcraft response JSON per endpoint
- do not invent new top-level keys for isolated routes
- do not duplicate pagination fields in multiple places
- do not mix business payload with transport metadata
- do not let each controller or handler decide its own error shape
- do not expose internal exception details directly to clients
- do not use different success shapes for similar operations without a strong contract reason
- do not document one contract and return another at runtime
- do not change status code semantics casually
- do not add response wrappers that force clients to guess where data lives

## Ownership Rules

Keep ownership explicit.

- endpoint logic owns business data mapping
- shared response utilities own envelope formatting
- shared middleware or equivalent cross-cutting layer owns common metadata
- centralized error flow owns failure formatting
- pagination contract owns pagination placement and field naming

If ownership is blurred, response drift follows.

## Status Rules

Use status codes as stable semantics, not stylistic choices.

- use one normal success status for standard successful reads or updates
- use one creation status for creation flows
- use one consistent rule for empty successful responses
- derive error statuses from structured error types or a centralized mapping strategy

Avoid status choices that imply a different transport contract than the body actually returns.

## Pagination Rules

Pagination should be standardized, not negotiated per endpoint.

- place pagination only in the shared metadata area
- keep pagination field names stable
- return paginated shape only for collection responses that actually page
- avoid mixing cursor, page, count, and summary data in arbitrary locations

## Error Rules

Errors should be normalized by one shared mechanism.

- throw or return structured errors internally
- translate them once at the boundary
- keep client-facing error payloads consistent
- expose safe, intentional error information only

Do not let local endpoint code format failure payloads unless that exception is itself a defined contract rule.

## Review Checklist

Check these points when reviewing a response design:

1. Does the endpoint use the shared outer envelope?
2. Is business payload inside `data` only?
3. Is `meta` reserved for cross-cutting metadata?
4. Is pagination placed only in the standard pagination area?
5. Is error formatting centralized?
6. Do status codes match the response semantics?
7. Does the documentation match the actual runtime response?
8. Has the change avoided introducing a breaking contract unintentionally?

## Compact Skill Pattern

Use this pattern when refactoring other skills for low context cost:

- start with `Purpose`
- state `What This Skill Tells You`
- explain `How To Use This Skill`
- define the non-negotiable rules
- separate `To Do` and `Not To Do`
- add a short review checklist
- keep everything in one file unless a separate resource is truly unavoidable

For compactness:

- avoid repeated explanations
- avoid project-local names unless absolutely required
- avoid code samples unless the task cannot be understood without them
- avoid references to external files for core guidance
- prefer concrete rules over long narratives
- prefer reusable wording over repository-specific phrasing
