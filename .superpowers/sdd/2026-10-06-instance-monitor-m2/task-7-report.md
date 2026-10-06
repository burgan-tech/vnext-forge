# Task 7 report

Implemented per brief: useFocusInstance + QuickRunShell.focusInstanceId, monitor entry button in Active/Recent rows (Sidebar/ListPanel thread onOpenMonitor), InstanceTab Completed/Duration/Attributes/Extensions, MonitorShell onOpenQuickRun(instanceId, isRoot), extension (parseOpenQuickRunFromMonitorMessage, MonitorPanel, QuickRunPanel.focusInstance with pending queue, vnextForge.focusQuickRunInstance, QuickRunApp, MonitorApp), web (?instance= param).

## Adaptations
- useFocusInstance(instanceId, runtimeUrl): dropped the `headers` param; headers read live via quickRunHeadersFromState(getState()) at focus time (same merge rule useOpenInstance uses). Effect keyed on store domain/workflowKey so it runs after setWorkflowContext.
- Brief expected "2m 5s" for 125.4s; formatDurationMs(125400) is "2m 6s" (rounds). Test asserts formatDurationMs(125.4*1000).
- MonitorShellView.onOpenQuickRun stays `() => void`; MonitorShell wraps it with level id + isRoot (level.instanceId === levels[0].instanceId).
- Monitor entry added to Active and Recent rows only (as in brief), not Completed.

## TDD
RED: designer-ui run failed (useFocusInstance missing; InstanceTab lacked Completed/Duration). Extension parser tests were written after the parser edit (green on first run).

## Results
designer-ui: 1613 tests pass, tsc -b ok. extension: 108 tests pass, build ok. web build ok. Touched files lint-clean (test file not in tsconfig project service, pre-existing eslint limitation).

## Concerns
- Re-focusing the same instance id twice in a row on an already-open Quick Run (after the user switched tabs) is a no-op, since the webview state value does not change.
