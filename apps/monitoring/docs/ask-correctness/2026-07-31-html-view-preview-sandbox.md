# HTML view preview is rendered in a sandboxed iframe, not sanitized

**Date:** 2026-07-31
**Category:** security
**Related file(s):**
`packages/designer-ui/src/modules/component-readonly/ViewDetailCore.tsx`,
`apps/monitoring/src/modules/definitions/view/ViewDetailPage.tsx`

## Situation

The read-only view designer (`ViewDetailCore`, shown on the monitoring
`/definitions/view/:id` Designer tab) now previews view content by type, the same
way the editable forge `ViewEditorPanel` does. For `ViewType.Html` the forge
panel injects the content straight into the document with
`dangerouslySetInnerHTML` — acceptable there, because the HTML comes from the
developer's own local workspace file.

Monitoring shows HTML that arrives from the **runtime monitor API**, i.e. content
the monitoring user did not author. So the read-only core deliberately does
*not* reuse the forge approach: the HTML is rendered inside

```tsx
<iframe sandbox="" srcDoc={contentText} title="HTML preview" />
```

An empty `sandbox` attribute keeps every sandbox permission off: no scripts, no
form submission, no plugins, no top-level navigation, and a unique opaque origin
(no same-origin access to the monitoring document, its cookies or storage). No
HTML sanitizer (DOMPurify or similar) was added — no such dependency exists in
the repo today and the sandbox already blocks script execution.

## Doubt / Risk

The sandbox removes script execution and same-origin access, but the frame still
renders arbitrary attacker-controlled markup and CSS. Residual risks:

- **Visual spoofing inside the frame** — CSS can draw a convincing fake login
  form or error banner inside the 16rem preview box. It cannot escape the frame
  or read anything, and it cannot submit (forms are blocked), but a user could
  still be socially engineered by what they see.
- **Resource abuse** — pathological CSS (huge images, animations) can slow the
  page down; no size limit is applied to the previewed content.
- If someone later relaxes the sandbox (e.g. adds `allow-scripts` to make a
  preview "work"), this becomes a straightforward stored-XSS vector. The
  attribute must stay empty.

## Expected Confirmation

Platform owner / security reviewer to confirm that sandbox-only (no sanitizer)
is acceptable for previewing runtime-supplied HTML view content, or to ask for a
sanitizer (which would mean adding an HTML-sanitizing dependency to
`designer-ui` and a size cap on the previewed string).

## Resolution (closed once filled in)

_Open._
