---
name: errors-and-error-handling-mechanism
description: Use when designing, reviewing, or implementing module error contracts, layer-specific error classes, controller/application throw patterns, registry-based status resolution, sanitized client error codes, and centralized error middleware behavior in this backend.
---

# Errors And Error Handling Mechanism

## Purpose

Use this skill to keep error design explicit, stable, and easy to operate. It defines what an error should mean, where it should be created, how it should move across layers, what the client may see, and what must stay internal.

This skill aims to prevent ad hoc failure handling, duplicated translation logic, unstable client contracts, and noisy logging.

## What This Skill Says

- treat errors as part of the system contract, not as incidental strings
- decide error ownership before writing the throw path
- keep business meaning close to the layer that detects the failure
- translate errors centrally at the boundary
- expose only stable and sanitized client-facing data
- log unexpected failures once, with enough operational context

## How To Use This Skill

1. Identify the failure type: business rule, validation, authorization, dependency, timeout, conflict, or unknown failure.
2. Identify the owner: bounded context, module, or shared platform concern.
3. Define a stable error code and a canonical meaning for that failure.
4. Throw a structured error from the layer that discovers or translates the failure.
5. Let one boundary component map the error to the transport response.
6. Keep internal details in logs, not in client payloads.
7. Review whether the same error can be reused without changing its meaning.

## To Do

- define errors around business meaning, not around implementation accidents
- keep error codes stable once clients or other modules depend on them
- use one clear owner for each error contract
- separate expected failures from unexpected failures
- translate third-party and infrastructure failures into local error semantics
- map status or transport details in one place
- keep messages short, deterministic, and safe to expose when client-visible
- include correlation context in logs for unknown or operationally relevant failures
- make retryability, conflict semantics, and validation failures explicit
- review whether an error is safe to expose before returning it

## Not To Do

- do not throw raw strings or unstructured generic errors in normal flow
- do not invent new codes in controllers, handlers, or adapters without a contract decision
- do not leak stack traces, SQL errors, provider messages, tokens, or secrets to clients
- do not let multiple layers remap the same failure differently
- do not couple client behavior to free-form human-readable text
- do not use transport status as the primary business identifier
- do not log the same handled failure repeatedly across layers
- do not reuse one error code for multiple meanings
- do not hide domain or business failures behind vague internal-server-error style responses unless the failure is truly unknown

## Concrete Rules

### Error Ownership

- one failure meaning must have one clear owner
- shared errors should be reserved for truly cross-cutting concerns
- module or bounded-context errors should stay local unless intentionally published as a contract

### Error Shape

- each error should carry a stable machine-readable code
- each error should have one canonical meaning
- optional metadata should be minimal and intentional
- client-visible payloads should remain compact and sanitized

### Layer Responsibility

- validation layer rejects malformed input
- application layer rejects impossible or disallowed actions
- domain layer protects invariants and business rules
- infrastructure layer detects provider, network, storage, and integration failures
- boundary layer translates structured errors into protocol-specific responses

### Translation Rules

- translate once from internal semantics to external response shape
- convert external-provider failures into local terms before they cross inward
- keep fallback behavior deterministic for unknown failures

### Logging Rules

- log unknown failures as operational events
- avoid logging expected failures multiple times
- include request or operation correlation where available
- sanitize sensitive values before logging

## Expected Output

This skill should produce:

- a small and stable error taxonomy
- clear ownership of each error family
- explicit throw guidance by layer
- one consistent boundary translation strategy
- sanitized client-facing error responses
- lower duplication in error handling decisions

## General Compact Skill Pattern

Use this pattern when rewriting any skill so it stays compact, reusable, and low-cost in context.

### Structure

Keep the skill in a single file with this order:

1. Purpose
2. What This Skill Says
3. How To Use This Skill
4. To Do
5. Not To Do
6. Concrete Rules
7. Expected Output

### Compact Writing Rules

- start with what the skill is for and what decisions it governs
- state usage intent early so the reader understands when to apply it
- prefer short imperative bullets over long explanation blocks
- remove repeated ideas even if they appear in different wording
- keep the text general enough to reuse, but concrete enough to act on
- describe decisions and constraints, not implementation trivia
- avoid examples unless the rule would be unclear without one
- avoid references to external files when the core guidance can fit in one file

### General To Do

- define scope at the top
- make the skill readable in one pass
- express rules as direct actions and prohibitions
- keep terminology consistent from start to finish
- optimize for fast scanning and low token cost
- prefer contract-level guidance over code-level narration

### General Not To Do

- do not depend on reference files for core guidance
- do not repeat the same rule in overview, checklist, and summary
- do not anchor the skill to project-specific names unless unavoidable
- do not turn the skill into a tutorial
- do not include code samples if the goal is policy and decision quality
- do not mix scope, workflow, and edge cases into one dense section
