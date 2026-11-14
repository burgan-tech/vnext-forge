# ai-agent-lab fixtures

Verbatim copies of `vnext-example-ai-agent` (`feature/ai-agent-phase2`, commit dcfab5c):
`core/Workflows/ai-agent-lab/*.json` (7 flows) and `core/Agents/ai-agent-lab/*.json` (4 agents).

They back the AI Agent round-trip tests: every file must open in the designer and save back
byte-for-byte (`agent`, transition `description`, tool fields, unknown members). Refresh them
from the example repository when the runtime contract changes; do not edit them by hand.
