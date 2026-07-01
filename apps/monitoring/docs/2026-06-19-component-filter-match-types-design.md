# Design Spec: Component Filter — Caller-Configurable Match Types

**Date:** 2026-06-19  
**Scope:** `GET /monitor/{domain}/components` — free-text filter fields  
**Status:** Approved

---

## Background

Phase 1 added type-discriminated query param filters to the component list endpoint. String fields were added with fixed match semantics: `name` used `Contains`, `flowVersion` used exact, `tags` used list-contains. These semantics were inconsistent and non-configurable.

This design adds explicit bracket operators (`[eq]` / `[contains]`) for all free-text string fields, removes the ambiguous plain variants, and adds `key` as a new filterable field alongside the existing lookup mode.

---

## Goals

1. Let callers choose match type per request for free-text fields.
2. Keep enum-like fields (`definitionType`, `renderer`, `display`, `scope`) as plain, exact-only — no change.
3. Keep `?key=abc` (plain) as the existing single-item lookup — no change to behavior or response shape.
4. Add `key` as a filter field accessible only via bracket operators.
5. Validate: sending both `[eq]` and `[contains]` for the same field → 400.

---

## Field Inventory

### Fields that change

| Old param | New params | Reason |
|---|---|---|
| `?tags=value` | `?tags[contains]=value` | Only one meaningful semantic for list fields; rename for consistency |
| `?flowVersion=value` (exact) | `?flowVersion[eq]=value` \| `?flowVersion[contains]=value` | Adds partial version search |
| `?name=value` (contains) | `?name[eq]=value` \| `?name[contains]=value` | Was implicitly contains; now explicit |

### Fields that are added (new)

| Param | Behavior |
|---|---|
| `?key[eq]=value` | Exact match on component key; returns `MonitorPagedResponse` with 0–1 items |
| `?key[contains]=value` | Partial key search; returns `MonitorPagedResponse` with 0–N items |

### Fields that do not change

| Param | Behavior |
|---|---|
| `?key=abc` (plain) | Existing lookup mode — single item, no pagination wrapper |
| `?definitionType=`, `?renderer=`, `?display=`, `?scope=` | Plain, exact match, no operators added |
| `?createdAt[gte]`, `?createdAt[lte]`, `?modifiedAt[gte]`, `?modifiedAt[lte]` | Unchanged |

---

## Response Shape

| Param used | Response |
|---|---|
| `?key=abc` (plain) | Single `MonitorComponentSummaryItem` (existing shape — no pagination) |
| Any bracket filter including `key[eq]` / `key[contains]` | `MonitorPagedResponse<MonitorComponentSummaryItem>` with `pagination` |

`?key[eq]=abc` and `?key=abc` are independent; they can coexist. Plain `key` triggers lookup mode early-return before filter is evaluated.

---

## Validation Rules

1. **Conflicting operators:** `?flowVersion[eq]=1.0.0` AND `?flowVersion[contains]=1.0` in the same request → `400 ValidationProblemDetails`, error key = field name (e.g. `"flowVersion"`), message = `"Cannot use both '[eq]' and '[contains]' operators for the same field."`.
2. **Type-discriminated disallowed fields:** unchanged — `ComponentFilterDescriptor.FindDisallowed` returns disallowed fields → 400.

---

## Implementation Changes

### `MonitorComponentFilterInput`

Remove: `Tags`, `FlowVersion`, `Name`  
Add:

```csharp
// tags
public string? TagsContains { get; set; }

// flowVersion
public string? FlowVersionEq { get; set; }
public string? FlowVersionContains { get; set; }

// name (sys-mappings only)
public string? NameEq { get; set; }
public string? NameContains { get; set; }

// key (new filter field)
public string? KeyEq { get; set; }
public string? KeyContains { get; set; }
```

`SetFields()` maps both `Eq` and `Contains` variants to the same canonical name:

```csharp
if (TagsContains is not null)     yield return "tags";
if (FlowVersionEq is not null)    yield return "flowVersion";
if (FlowVersionContains is not null) yield return "flowVersion";
if (NameEq is not null)           yield return "name";
if (NameContains is not null)     yield return "name";
if (KeyEq is not null)            yield return "key";
if (KeyContains is not null)      yield return "key";
```

`IsEmpty` remains `!SetFields().Any()`.

### `ComponentFilterDescriptor`

Add `"key"` to `CommonFields` (all component types have a key).  
`"name"` stays in `TypeSpecificFields[Mappings]` only.

### `MonitorComponentFilter.Apply`

Replace old lambdas:

```csharp
// tags
if (filter.TagsContains is not null)
    items = items.Where(x => x.Tags is not null &&
        x.Tags.Contains(filter.TagsContains, StringComparer.OrdinalIgnoreCase));

// flowVersion
if (filter.FlowVersionEq is not null)
    items = items.Where(x => string.Equals(x.FlowVersion, filter.FlowVersionEq, OrdinalIgnoreCase));
if (filter.FlowVersionContains is not null)
    items = items.Where(x => x.FlowVersion is not null &&
        x.FlowVersion.Contains(filter.FlowVersionContains, OrdinalIgnoreCase));

// name
if (filter.NameEq is not null)
    items = items.Where(x => string.Equals(x.Name, filter.NameEq, OrdinalIgnoreCase));
if (filter.NameContains is not null)
    items = items.Where(x => x.Name is not null &&
        x.Name.Contains(filter.NameContains, OrdinalIgnoreCase));

// key
if (filter.KeyEq is not null)
    items = items.Where(x => string.Equals(x.Key, filter.KeyEq, OrdinalIgnoreCase));
if (filter.KeyContains is not null)
    items = items.Where(x => x.Key is not null &&
        x.Key.Contains(filter.KeyContains, OrdinalIgnoreCase));
```

### `MonitorComponentController.GetComponentSummaryAsync`

Remove: `string? tags`, `string? flowVersion`, `string? name`  
Add:

```csharp
[FromQuery(Name = "tags[contains]")]       string? tagsContains      = null,
[FromQuery(Name = "flowVersion[eq]")]      string? flowVersionEq     = null,
[FromQuery(Name = "flowVersion[contains]")] string? flowVersionContains = null,
[FromQuery(Name = "name[eq]")]             string? nameEq            = null,
[FromQuery(Name = "name[contains]")]       string? nameContains      = null,
[FromQuery(Name = "key[eq]")]              string? keyEq             = null,
[FromQuery(Name = "key[contains]")]        string? keyContains       = null,
```

Conflict validation (before `FindDisallowed`):

```csharp
var conflicts = new List<string>();
if (flowVersionEq is not null && flowVersionContains is not null) conflicts.Add("flowVersion");
if (nameEq is not null && nameContains is not null)               conflicts.Add("name");
if (keyEq is not null && keyContains is not null)                 conflicts.Add("key");
if (conflicts.Count > 0)
{
    var errors = conflicts.ToDictionary(
        f => f,
        f => new[] { $"Cannot use both '[eq]' and '[contains]' operators for '{f}'." });
    return BadRequest(new ValidationProblemDetails { Errors = errors });
}
```

---

## Descriptor: Updated `CommonFields`

```csharp
private static readonly IReadOnlySet<string> CommonFields = new HashSet<string>(StringComparer.OrdinalIgnoreCase)
{
    "createdAt", "modifiedAt", "tags", "flowVersion", "key"
};
```

---

## Test Changes

### `ComponentFilterDescriptorTests`

- Update existing `CommonFields` test: add `"key"` to expected set.
- `"name"` remains only for `sys-mappings` — no change.

### `MonitorComponentFilterTests`

Replace old `Tags`, `Name`, `FlowVersion` tests with:
- `TagsContains` filter test
- `FlowVersionEq` exact test
- `FlowVersionContains` partial test (e.g. `"1.0"` matches `"1.0.0"`)
- `NameEq` exact test
- `NameContains` partial test
- `KeyEq` exact test
- `KeyContains` partial test
- Conflict: `FlowVersionEq + FlowVersionContains` (validated in controller, not filter — no filter test needed)

---

## §7.1 Sync (mandatory)

After implementation:
1. `endpoints/vnext-monitor.http` — new bracket param examples for all changed fields
2. `endpoints/vnext-monitor-endpoints.postman_collection.json` — update Phase 1 component entries
3. `endpoints/vnext-monitor.postman_collection.json` — update folder 7 filter examples + folder 9 (conflict 400)
4. `docs/features/monitoring-features.md` — update filter table

---

## Out of Scope

- Match type selection for enum-like fields (`definitionType`, `renderer`, `display`, `scope`) — always exact, no operators.
- ETag / conditional GET support.
- Server-side (DB-level) filtering — in-memory filter model is retained.
- `key[eq]` result count guarantee — API returns 0–1 items due to uniqueness; this is not enforced at API level.
