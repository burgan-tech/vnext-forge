# Troubleshooting

## Common Issues

### Extension Not Activating

**Symptom:** No vNext Forge commands in the palette, no sidebar.

**Solution:**
1. Verify the workspace contains a `vnext.config.json` file at the root.
2. Check the Extensions panel — ensure vNext Forge is enabled.
3. Reload the window (`Ctrl+Shift+P` → **Developer: Reload Window**).

### "Could Not Load Projects" Error

**Symptom:** Red error banner on the project list page.

**Solution:**
- In VS Code extension mode, this usually means the extension host is still initializing. Wait a moment and the project list will appear.
- In web shell mode, ensure the backend server is running (`pnpm --filter @vnext-forge-studio/server dev`).

### Runtime Offline

**Symptom:** Status bar shows "Runtime Offline".

**Solution:**
1. Start the vNext runtime engine (typically at `http://localhost:4201`).
2. Verify the URL in settings: `vnextForge.vnextRuntimeUrl`.
3. Check the **Environments** sidebar → **Check Health**.

### LSP Not Working (No IntelliSense in .csx files)

**Symptom:** No auto-completion or error highlighting in C# scripts.

**Solution:**
1. Check `vnextForge.lsp.autoInstall` is `true`.
2. Look at the **Output** panel → **vnext-forge-studio** channel for installation progress.
3. If installation failed, delete the OmniSharp cache and restart VS Code.
4. Ensure .NET SDK is installed on your machine.

### Canvas Not Rendering

**Symptom:** Blank area where the workflow canvas should be.

**Solution:**
1. Check the browser console (F12 in web mode) or Output channel for errors.
2. Verify the workflow JSON is valid — try opening it as text first.
3. Reload the designer panel.

### Save Not Working

**Symptom:** Cmd+S / Ctrl+S does nothing, save button stays disabled.

**Solution:**
- The save button is disabled when there are no unsaved changes.
- If you have changes but save is disabled, check file write permissions.
- In extension mode, check the Output channel for file system errors.

## Logs and Diagnostics

### VS Code Output Channel

Open **Output** panel → select **vnext-forge-studio** from the dropdown. This shows:

- Extension activation events
- File system operations
- Runtime proxy requests
- LSP connection state
- Error details with trace IDs

### Trace IDs

Every error includes a `traceId` for correlation. When reporting issues, include the trace ID from:

- The error toast message
- The Output channel log entry

## Reporting Issues

When reporting a bug:

1. Note the **trace ID** from the error message.
2. Copy relevant logs from the **vnext-forge-studio** Output channel.
3. Note your VS Code version and extension version.
4. Describe the steps to reproduce.
5. Attach the workflow/component JSON if relevant (sanitize sensitive data).
