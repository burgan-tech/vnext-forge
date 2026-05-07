# Runtime Connection

vNext Forge can connect to a running vNext Runtime engine for live workflow execution, simulation, and instance inspection.

## Connection Status

The status bar shows the runtime connection state:

| Indicator | Meaning |
|-----------|---------|
| 🟢 **Runtime Online** | Connected to the runtime engine |
| 🟡 **Runtime Offline** | No connection; design-only mode |

## Configuring the Runtime URL

Set the runtime engine URL in VS Code Settings:

```json
{
  "vnextForge.vnextRuntimeUrl": "http://localhost:4201"
}
```

For additional allowed URLs (e.g., staging environments):

```json
{
  "vnextForge.runtimeAllowedBaseUrls": [
    "http://staging-runtime:4201"
  ]
}
```

## Quick Run

Quick Run allows executing a workflow directly from the designer:

1. Right-click a workflow file → **Open Quick Run**.
2. Or use the Command Palette → **Quick Run**.

The Quick Run panel provides:

- **New Run** — start a fresh workflow instance
- **Transition dialog** — manually trigger transitions
- **Headers configuration** — set custom HTTP headers for the runtime call
- **Instance dashboard** — view running instances, their current state, and history
- **Progress stepper** — visual progress through workflow states

## Environments

The **Environments** view in the vNext Forge Tools sidebar allows managing multiple runtime connections:

- **Add Environment** — register a new runtime endpoint
- **Set Active** — switch between environments
- **Check Health** — verify runtime connectivity
- **Edit/Delete** — manage environment configurations

## Package Deploy

The **Package Deploy** view provides deployment commands:

| Command | Description |
|---------|-------------|
| **Deploy All** (`wf update --all`) | Deploy all components to runtime |
| **Deploy Changed** (`wf update`) | Deploy only changed components |
| **CSX Update All** (`wf csx --all`) | Update all C# script mappings |
| **Install Workflow CLI** | Install the `wf` CLI tool |

## Security

- The runtime proxy validates all URLs against an allowlist (SSRF defense).
- Only loopback connections are permitted by default.
