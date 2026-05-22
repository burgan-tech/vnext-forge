import type { VnextWorkflow } from './Conversion';

/**
 * Severity tier for a lint finding. Mirrors the editor-style
 * 3-tier ranking used by VS Code's Problems panel — keeps the
 * UX vocabulary consistent across the app.
 *
 *   - `error`   blocks runtime correctness (unreachable state,
 *               dead-end, missing target).
 *   - `warning` likely a mistake but not provably wrong (state
 *               with no transitions but isn't a Final).
 *   - `info`    style / hygiene (no labels, missing description).
 */
export type LintSeverity = 'error' | 'warning' | 'info';

export interface LintFinding {
  severity: LintSeverity;
  /** Stable rule id — used to dedupe + filter in the UI. */
  rule: string;
  /** Short human-readable message. */
  message: string;
  /** Optional state key — focuses the canvas / inspector when clicked. */
  stateKey?: string;
  /** Optional transition key (combined with `stateKey` for context). */
  transitionKey?: string;
}

const STATE_TYPE_FINAL = 3;
const STATE_TYPE_INITIAL = 1;

/**
 * Run every workflow lint rule and return the flattened set of
 * findings. Each rule is a pure function on the workflow shape;
 * order is irrelevant. Findings are not deduped — if the same
 * issue is reachable through two rules, both fire (intentional
 * for visibility).
 *
 * Performance: O(N + E) where N = number of states and E = total
 * transitions. Safe to call on every workflow change.
 */
export function lintWorkflow(workflow: VnextWorkflow): LintFinding[] {
  const findings: LintFinding[] = [];
  const states = workflow.attributes?.states ?? [];
  if (states.length === 0) return findings;

  const stateByKey = new Map<string, (typeof states)[number]>();
  for (const s of states) stateByKey.set(s.key, s);

  // ── Rule R-LINT-001: every workflow needs exactly one Initial state.
  const initials = states.filter((s) => s.stateType === STATE_TYPE_INITIAL);
  if (initials.length === 0) {
    findings.push({
      severity: 'error',
      rule: 'no-initial-state',
      message: 'Workflow has no Initial state. Every workflow needs exactly one entry point.',
    });
  } else if (initials.length > 1) {
    for (const s of initials.slice(1)) {
      findings.push({
        severity: 'error',
        rule: 'duplicate-initial-state',
        message: `Multiple Initial states found. Only one is allowed (extra: "${s.key}").`,
        stateKey: s.key,
      });
    }
  }

  // ── Rule R-LINT-002: states with zero outgoing transitions that
  //    aren't Final are dead-ends — execution would freeze there.
  for (const s of states) {
    if (s.stateType === STATE_TYPE_FINAL) continue;
    const outs = s.transitions ?? [];
    if (outs.length === 0) {
      findings.push({
        severity: 'warning',
        rule: 'dead-end-state',
        message: `State "${s.key}" has 0 outgoing transitions but isn't a Final state. Execution would halt here.`,
        stateKey: s.key,
      });
    }
  }

  // ── Rule R-LINT-003: transitions pointing at non-existent targets.
  for (const s of states) {
    const outs = s.transitions ?? [];
    for (const t of outs) {
      const target = t.target ?? t.to;
      if (!target) {
        findings.push({
          severity: 'error',
          rule: 'transition-missing-target',
          message: `Transition "${t.key}" from state "${s.key}" has no target.`,
          stateKey: s.key,
          transitionKey: t.key,
        });
        continue;
      }
      if (target === '$self' || target === s.key) continue;
      if (!stateByKey.has(target)) {
        findings.push({
          severity: 'error',
          rule: 'transition-unknown-target',
          message: `Transition "${t.key}" from "${s.key}" targets "${target}", which is not a state in this workflow.`,
          stateKey: s.key,
          transitionKey: t.key,
        });
      }
    }
  }

  // ── Rule R-LINT-004: unreachable states (forward BFS from
  //    Initial doesn't visit them). Skipped when there's no
  //    Initial (R-LINT-001 already covers that gap).
  if (initials.length === 1) {
    const visited = new Set<string>([initials[0].key]);
    const queue = [initials[0].key];
    while (queue.length > 0) {
      const cur = queue.shift()!;
      const s = stateByKey.get(cur);
      if (!s) continue;
      for (const t of s.transitions ?? []) {
        const target = t.target ?? t.to;
        if (!target || target === '$self') continue;
        if (!visited.has(target) && stateByKey.has(target)) {
          visited.add(target);
          queue.push(target);
        }
      }
    }
    for (const s of states) {
      if (!visited.has(s.key)) {
        findings.push({
          severity: 'warning',
          rule: 'unreachable-state',
          message: `State "${s.key}" is unreachable from the Initial state.`,
          stateKey: s.key,
        });
      }
    }
  }

  // ── Rule R-LINT-005: duplicate transition keys within a state.
  for (const s of states) {
    const seen = new Set<string>();
    for (const t of s.transitions ?? []) {
      if (seen.has(t.key)) {
        findings.push({
          severity: 'error',
          rule: 'duplicate-transition-key',
          message: `State "${s.key}" has two transitions named "${t.key}". Transition keys must be unique per state.`,
          stateKey: s.key,
          transitionKey: t.key,
        });
      }
      seen.add(t.key);
    }
  }

  // ── Rule R-LINT-006: states with no labels / no description (info).
  for (const s of states) {
    const labels = (s as { labels?: unknown[]; label?: unknown[] }).labels ?? (s as { label?: unknown[] }).label;
    if (!labels || (Array.isArray(labels) && labels.length === 0)) {
      findings.push({
        severity: 'info',
        rule: 'state-missing-labels',
        message: `State "${s.key}" has no localized labels — only the raw key will show.`,
        stateKey: s.key,
      });
    }
  }

  return findings;
}

// ─── Pattern Detection ────────────────────────────────────────────
// Heuristic recognizer for common workflow shapes. Output is a
// list of pattern labels per workflow, not per state. UI surface:
// a small "Patterns" chip row in the bottom-right of the canvas.

export interface WorkflowPattern {
  /** Stable id used for icon mapping + filtering. */
  id: 'approval' | 'retry' | 'wizard' | 'saga' | 'gate';
  /** Human-readable label rendered on the chip. */
  label: string;
  /** Optional supporting evidence ("3 retry edges back to busy"). */
  evidence?: string;
  /** Optional confidence 0–1 used to tint the chip. */
  confidence?: number;
}

export function detectPatterns(workflow: VnextWorkflow): WorkflowPattern[] {
  const patterns: WorkflowPattern[] = [];
  const states = workflow.attributes?.states ?? [];
  if (states.length === 0) return patterns;

  // ── Approval pattern: there's a state with at least 2 outgoing
  //    transitions whose keys look like an approve/reject pair.
  const APPROVE_KEYWORDS = ['approve', 'accept', 'confirm', 'submit', 'pass'];
  const REJECT_KEYWORDS = ['reject', 'deny', 'decline', 'cancel', 'fail', 'fraud'];
  for (const s of states) {
    const outs = s.transitions ?? [];
    if (outs.length < 2) continue;
    const lower = outs.map((t) => t.key.toLowerCase());
    const hasApprove = lower.some((k) => APPROVE_KEYWORDS.some((w) => k.includes(w)));
    const hasReject = lower.some((k) => REJECT_KEYWORDS.some((w) => k.includes(w)));
    if (hasApprove && hasReject) {
      patterns.push({
        id: 'approval',
        label: 'Approval flow',
        evidence: `Branching at state "${s.key}"`,
        confidence: 0.85,
      });
      break;
    }
  }

  // ── Retry pattern: a self-loop OR a back-edge from a later
  //    state to an earlier one. We detect self-loops cheaply via
  //    target === source.
  for (const s of states) {
    const outs = s.transitions ?? [];
    const hasSelfLoop = outs.some((t) => {
      const target = t.target ?? t.to;
      return target === s.key || target === '$self';
    });
    if (hasSelfLoop) {
      patterns.push({
        id: 'retry',
        label: 'Retry loop',
        evidence: `Self-loop at "${s.key}"`,
        confidence: 0.9,
      });
      break;
    }
  }

  // ── Wizard pattern: a linear chain of intermediate states each
  //    with exactly one outgoing transition. Detected when ≥3
  //    consecutive states have a single outgoing edge and the
  //    transitions form a chain.
  if (states.length >= 4) {
    let linearCount = 0;
    for (const s of states) {
      if (s.stateType !== 2) continue; // intermediate only
      const outs = s.transitions ?? [];
      if (outs.length === 1) linearCount++;
    }
    if (linearCount >= 3) {
      patterns.push({
        id: 'wizard',
        label: 'Multi-step wizard',
        evidence: `${linearCount} linear intermediate states`,
        confidence: 0.7,
      });
    }
  }

  // ── Gate pattern: a state with 1 outgoing transition keyed
  //    `validate`, `check`, `gate`, `guard`, `verify`.
  const GATE_KEYWORDS = ['validate', 'check', 'gate', 'guard', 'verify'];
  for (const s of states) {
    const outs = s.transitions ?? [];
    if (outs.length === 0) continue;
    if (outs.some((t) => GATE_KEYWORDS.some((w) => t.key.toLowerCase().includes(w)))) {
      patterns.push({
        id: 'gate',
        label: 'Gated transition',
        evidence: `At state "${s.key}"`,
        confidence: 0.65,
      });
      break;
    }
  }

  return patterns;
}

// ─── Smart Transition Naming ───────────────────────────────────────
/**
 * Suggest a default transition name based on source + target state
 * keys + their labels. Returns a *list* (in priority order) so the
 * UI can render them as quick-pick chips. The first entry is the
 * "best guess".
 *
 * Heuristics:
 *   - Target key as verb: "approve" → "approve" (common case)
 *   - source→target verb shape: "draft" → "review" yields "submit"
 *   - Pure connector: yields "go-to-{target}" as a last resort
 */
export function suggestTransitionName(
  sourceKey: string,
  targetKey: string,
  sourceLabel?: string,
  targetLabel?: string,
): string[] {
  const out: string[] = [];
  const targetLower = targetKey.toLowerCase();
  const sourceLower = sourceKey.toLowerCase();

  // Direct target-as-verb (most common workflow naming).
  out.push(targetLower);

  // source → target verb suggestions for common semantic pairs.
  const VERBS: Array<[RegExp, RegExp, string]> = [
    [/draft|new|init/i, /review|pending|submitted/i, 'submit'],
    [/review|pending|submitted/i, /approve|accept|active/i, 'approve'],
    [/review|pending|submitted/i, /reject|deny|declined/i, 'reject'],
    [/active|live/i, /cancel|cancelled/i, 'cancel'],
    [/active|live/i, /pause|suspend/i, 'suspend'],
    [/suspend|paused/i, /active|resume/i, 'resume'],
    [/active|live/i, /complete|done|closed/i, 'complete'],
    [/active|live/i, /fail|error/i, 'fail'],
  ];
  for (const [src, tgt, verb] of VERBS) {
    if (src.test(sourceLower) && tgt.test(targetLower) && !out.includes(verb)) {
      out.push(verb);
    }
  }

  // Connector fallback — useful when the target name doesn't
  // make sense as a verb on its own.
  out.push(`go-to-${targetLower}`);

  // Dedupe while preserving order.
  return Array.from(new Set(out)).slice(0, 4);
}
