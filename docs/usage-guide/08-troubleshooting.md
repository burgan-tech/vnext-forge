# Troubleshooting

## Common Issues

### Extension Does Not Activate

**Symptoms:** No Forge commands in Command Palette, no Forge Tools sidebar, status bar item missing.

**Solutions:**
- Verify your workspace contains a `vnext.config.json` file at the root of an open folder
- Check that the extension is installed and enabled (search "vNext Forge" in the Extensions view)
- Reload the window (`Ctrl+Shift+P` → **Developer: Reload Window**)
- Check the Output channel for startup errors

### Project Not Detected

**Symptoms:** Forge Tools shows "Create Project" instead of Project actions, context menus are missing.

**Solutions:**
- Ensure `vnext.config.json` is valid JSON (open it with the text editor to check for syntax errors)
- The file must be at the root of a workspace folder, not in a subfolder
- If using a multi-root workspace, each root with a config file is detected independently

### Runtime Connection Failed

**Symptoms:** Quick Run shows no instances, environment health indicator is red/gray.

**Solutions:**
- Verify the runtime URL is correct in the Environments section (Forge Tools sidebar)
- Ensure the vNext runtime is running and accessible from your machine
- Check for firewall or proxy issues blocking the connection
- Review the `vnextForge.vnextRuntimeUrl` setting if using the default environment
- Check the Output channel for HTTP error details and trace IDs

### C# Language Server Not Working

**Symptoms:** No IntelliSense in `.csx` files, no diagnostics, "Language server not started" errors.

**Solutions:**
- Ensure `vnextForge.lsp.autoInstall` is `true` (default)
- Check the **vnext-forge-studio:csx-native-lsp** Output channel for installation or startup errors
- Try manually triggering a reload after installation completes
- Verify you have network access for the initial OmniSharp download
- On macOS, ensure Xcode Command Line Tools are installed (required for native binaries)

### Canvas Not Rendering

**Symptoms:** Blank white/black area where the workflow diagram should be, or nodes are invisible.

**Solutions:**
- Reload the webview (`Ctrl+Shift+P` → **Developer: Reload Webviews**)
- Check that the workflow JSON is valid (try opening with the text editor)
- Ensure the workflow has at least one state defined
- Try switching the canvas layout algorithm (Settings → Canvas → Layout Algorithm)

### Save Errors

**Symptoms:** Toast notification with "Failed to save", file remains in Modified state.

**Solutions:**
- Check file permissions on the target path
- Ensure the target file is not locked by another process
- Look for the trace ID in the error message and search for it in the Output channel for detailed context
- If the file was renamed or moved externally, close and reopen the designer

### Quick Run Transitions Failing

**Symptoms:** "Fire Transition" returns an error, instance stays in the same state.

**Solutions:**
- Check that required schema fields are filled in the transition dialog
- Verify the runtime is healthy (check environment health indicator)
- Review response headers for error details — the `X-Trace-Id` header can be used to look up server-side logs
- Ensure the transition is valid for the current state (check Available Transitions)

## Output Channels

vNext Forge Studio writes diagnostic logs to VS Code Output channels (accessible via **View → Output** and selecting the channel from the dropdown):

| Channel | Content |
|---------|---------|
| **vnext-forge-studio** | Primary extension log — activation, commands, workspace detection, general diagnostics |
| **vnext-forge-studio-core** | Service-layer logs — handler execution, file operations, runtime proxy calls |
| **vnext-forge-studio:webview** | Webview-forwarded logs — designer UI errors, API call failures, render issues |
| **vnext-forge-studio:csx-native-lsp** | C# Language Server logs — OmniSharp process lifecycle, LSP protocol messages |

## Trace IDs

Every API call between the webview and extension host (and between Quick Run and the runtime) carries a trace ID. When an error occurs:

1. Note the **X-Trace-Id** shown in the error notification or response headers
2. Open the **vnext-forge-studio-core** Output channel
3. Search for the trace ID to find the full error context including stack traces

Trace IDs follow the format: `<hex-string>` (32 characters). The runtime also returns a `traceparent` header following the W3C Trace Context format.

## Bug Report Checklist

When reporting a bug, please include:

- [ ] VS Code version (`Help → About`)
- [ ] vNext Forge Studio extension version (from Extensions view)
- [ ] Operating system and version
- [ ] Steps to reproduce the issue
- [ ] Expected behavior vs. actual behavior
- [ ] Relevant Output channel logs (redact sensitive data)
- [ ] Trace ID(s) if available
- [ ] Screenshot of the error if applicable
- [ ] Contents of `vnext.config.json` (redact sensitive paths if needed)
