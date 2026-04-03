---
name: request-to-response-process
description: Compact guide for designing, reviewing, or debugging the full HTTP request-to-response lifecycle in backend applications. Use when deciding middleware order, route flow, request enrichment, authentication and authorization placement, controller boundaries, standardized success or error responses, fallback handling, or where a concern should live in the request pipeline.
---

# Request To Response Process

## Purpose

Use this skill to reason about how a request enters a backend system, passes through middleware and route logic, reaches application code, and leaves as a success or error response.

The goal is to keep request flow explicit, predictable, and easy to debug.

## What This Skill Says

- Treat request flow as a contract, not as incidental wiring.
- Keep cross-cutting concerns in middleware.
- Keep business rules out of routing glue.
- Keep response shape consistent.
- Keep failure paths as intentional as success paths.

## How To Use This Skill

Use it when you need to:

- add or change middleware
- decide whether logic belongs in middleware, controller, or application layer
- protect endpoints with authentication and authorization
- standardize success and error responses
- debug why a request does not reach the expected handler
- debug why metadata, identity, headers, or error envelopes are missing
- review whether request flow has become implicit, duplicated, or brittle

## Default Lifecycle

The default lifecycle should remain simple:

1. request enters global middleware
2. request is normalized and parsed
3. request is routed
4. route-level guards run
5. controller validates boundary input
6. application logic executes
7. response is mapped to a standard envelope
8. fallback or error handling runs if needed
9. response is finalized and sent

## Placement Rules

Put logic in the narrowest correct place.

### Global Middleware

Use for concerns that apply broadly across requests.

Examples of responsibility type:

- request identification
- logging
- security headers
- CORS
- body parsing
- response metadata finalization

### Route-Level Middleware

Use for concerns that apply only to selected endpoints.

Examples of responsibility type:

- authentication
- authorization
- rate limiting for a route group
- feature-specific boundary guards

### Controller Boundary

Use for:

- parsing input
- calling application logic
- mapping output to the response contract

Controllers should coordinate, not decide business policy.

### Application Logic

Use for:

- business decisions
- orchestration
- state changes
- domain validation that depends on business meaning

## To Do

- keep middleware order explicit and stable
- validate external input at the boundary
- normalize request metadata before business logic runs
- run authentication before authorization
- make protected and public routes clearly distinguishable
- keep success responses structurally consistent
- centralize error normalization
- preserve a single clear fallback path for unmatched routes
- make exceptional raw responses deliberate and rare
- keep request enrichment minimal and predictable
- inject long-lived dependencies from composition roots, not inline
- ensure logs and errors can be correlated by request identity

## Not To Do

- do not create business dependencies inside route files or middleware without a strong reason
- do not hide critical request behavior in scattered helpers
- do not put business rules in controllers just because the data entered through HTTP
- do not mix authentication and authorization into one opaque step
- do not return ad hoc response shapes from normal endpoints
- do not duplicate response metadata logic across controllers
- do not let unmatched-route behavior compete with matched-route error behavior
- do not attach large business objects to the request object
- do not bypass the standard response path unless the exception is intentional
- do not treat middleware order as cosmetic

## Success And Failure Rules

### Success Path

- validate input
- execute application logic
- map result to the standard success shape
- finalize metadata once, centrally

### Error Path

- throw structured errors from the appropriate layer
- normalize errors in one place
- return a predictable error envelope
- keep validation failures distinct from internal failures
- keep authorization failures distinct from authentication failures

### Fallback Path

- keep unmatched routes on a dedicated fallback path
- do not confuse a missing route with a business-level not-found condition

## Response Contract Rules

- use one standard envelope for normal API responses
- add request-scoped metadata centrally
- pass pagination only when pagination exists
- document and isolate endpoints that must return raw responses

## Compact Review Checklist

- Is this concern global, route-specific, controller-level, or application-level?
- Is middleware order still intentional after the change?
- Does boundary validation happen before business execution?
- Does authentication run before authorization?
- Does the endpoint return through the standard response contract?
- Will thrown errors reach one central normalizer?
- Is the fallback path still singular and unambiguous?
- Are dependencies created in the right place?
- If the response bypasses the standard envelope, is that deliberate?

## General Addendum

Use this general model when adapting the skill to any backend stack, framework, or project:

- define one canonical request path
- define one canonical success shape
- define one canonical error shape
- define one canonical fallback behavior
- keep cross-cutting concerns centralized
- keep business concerns out of transport glue
- make request identity, authorization state, and response metadata explicit
- prefer a small number of obvious extension points over many implicit ones

If a team cannot explain where a concern belongs in less than a few sentences, the request pipeline is probably too fragmented.
