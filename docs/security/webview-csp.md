# Webview Content Security Policy and `unsafe-eval`

This note documents why the VS Code extension designer webview allows `'unsafe-eval'` in its Content Security Policy (CSP), what risk that creates, how the product mitigates it today, and how we could tighten the model later.

## Where the CSP is set

The designer webview HTML is assembled in `apps/extension/src/panels/DesignerPanel.ts`. The CSP is built as a string and injected via a `<meta http-equiv="Content-Security-Policy">` tag:

```144:152:apps/extension/src/panels/DesignerPanel.ts
    const csp = [
      `default-src 'none'`,
      `style-src ${webview.cspSource} 'unsafe-inline'`,
      `script-src 'nonce-${nonce}' 'unsafe-eval' 'strict-dynamic'`,
      `worker-src blob:`,
      `font-src ${webview.cspSource} data:`,
      `img-src ${webview.cspSource} data:`,
      `connect-src ${webview.cspSource}`,
    ].join('; ')
```

Scripts from the bundled webview assets are loaded with a per-load nonce; `strict-dynamic` allows those scripts to load further scripts they trust. `'unsafe-eval'` is still listed explicitly because parts of the Monaco Editor stack rely on `eval`/`new Function` during worker bootstrap and when loading bundled TextMate grammars.

## Why Monaco currently needs `'unsafe-eval'`

Monaco’s web build historically uses dynamic code generation paths when:

- Bootstrapping language workers (including loading worker code from blob or bundled chunks that use eval-style bootstrapping).
- Initializing grammar/tokenization pipelines where generated code or WASM glue interacts with patterns that CSP treats as eval.

Without `'unsafe-eval'`, those code paths can fail at runtime, breaking syntax highlighting, validation, or the editor surface entirely inside the webview.

## Risk introduced by `'unsafe-eval'`

CSP’s goal is to limit what a compromised renderer can do. If attacker-controlled content can execute as script in the webview (for example via a cross-site scripting flaw in HTML or script injection), then allowing `'unsafe-eval'` raises the impact: the injected script can use `eval` / `Function` to run arbitrary JavaScript, not only static bundles that passed review.

So `'unsafe-eval'` is a **defense-in-depth regression**: it does not create XSS by itself, but it **amplifies** the damage if XSS ever appears in the webview.

## Current mitigations

The webview is not a generic browser tab; it is a host-controlled surface with a narrow threat model:

1. **No remote document or script origins** — `default-src 'none'`, script from nonce + extension webview URIs, and `connect-src` limited to `webview.cspSource` reduce exposure to arbitrary network fetches from untrusted pages.
2. **Local assets only** — `localResourceRoots` is scoped to `dist/webview-ui` under the extension; the HTML rewrites asset URLs to `asWebviewUri` targets.
3. **Host–webview messaging** — the extension injects configuration (for example `window.__VNEXT_CONFIG__` including `POST_MESSAGE_ALLOWED_ORIGINS`) so the webview can enforce an origin allowlist on `postMessage` traffic (Core-4 **R-f20**). That limits which senders the UI treats as trusted for RPC/LSP-style messages.

These measures aim to prevent untrusted origins and data from becoming executable script in the first place; CSP `unsafe-eval` remains a residual risk if that boundary fails.

## Future hardening paths

Longer term, we can reduce or remove `'unsafe-eval'` by one or more of:

1. **Worker packaging** — adopt a worker build that does not rely on eval for bootstrap (for example bundling workers with explicit entry points and a loader pattern compatible with strict CSP).
2. **Editor isolation** — move the heaviest editor (Monaco, grammars, workers) into a **sandboxed iframe** with its own CSP and a minimal `postMessage` API to the parent, so a grammar or editor bug is less likely to reach host privileges.
3. **Monaco / upstream alignment** — track upstream Monaco and VS Code guidance for CSP-safe embedding; upgrade when official builds support stricter policies without breaking tokenization.

Until one of these is implemented, `'unsafe-eval'` stays as a pragmatic compatibility shim, documented here for security review and future removal work.
