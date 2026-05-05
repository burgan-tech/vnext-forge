/* ────────────── State Type Helpers ────────────── */

export function getStateTypeLabel(t: number): string {
  switch (t) {
    case 1: return 'Initial';
    case 2: return 'Intermediate';
    case 3: return 'Final';
    case 4: return 'SubFlow';
    case 5: return 'Wizard';
    default: return 'Unknown';
  }
}

export function getStateTypeColor(t: number): string {
  switch (t) {
    case 1: return 'bg-cyan-100 text-cyan-700';
    case 2: return 'bg-indigo-100 text-indigo-700';
    case 3: return 'bg-slate-100 text-slate-700';
    case 4: return 'bg-violet-100 text-violet-700';
    case 5: return 'bg-amber-100 text-amber-700';
    default: return 'bg-slate-100 text-slate-600';
  }
}

export function getSubTypeLabel(t: number): string {
  switch (t) {
    case 1: return 'Success';
    case 2: return 'Error';
    case 3: return 'Terminated';
    case 4: return 'Suspended';
    case 5: return 'Busy';
    case 6: return 'Human';
    case 7: return 'Cancelled';
    case 8: return 'Timeout';
    default: return '';
  }
}

export function getSubTypeBadge(t: number): string {
  switch (t) {
    case 1: return 'bg-emerald-100 text-emerald-700';
    case 2: return 'bg-red-100 text-red-700';
    case 3: return 'bg-orange-100 text-orange-700';
    case 4: return 'bg-yellow-100 text-yellow-700';
    case 5: return 'bg-sky-100 text-sky-700';
    case 6: return 'bg-indigo-100 text-indigo-700';
    case 7: return 'bg-rose-100 text-rose-700';
    case 8: return 'bg-amber-100 text-amber-700';
    default: return 'bg-slate-100 text-slate-600';
  }
}

/* ────────────── Trigger Helpers ────────────── */

export function getTriggerLabel(t: number): string {
  switch (t) {
    case 0: return 'Manual';
    case 1: return 'Auto';
    case 2: return 'Scheduled';
    case 3: return 'Event';
    default: return 'Manual';
  }
}

export function getTriggerColor(t: number): string {
  switch (t) {
    case 0: return 'bg-slate-100 text-slate-600';
    case 1: return 'bg-emerald-100 text-emerald-700';
    case 2: return 'bg-amber-100 text-amber-700';
    case 3: return 'bg-violet-100 text-violet-700';
    default: return 'bg-slate-100 text-slate-600';
  }
}

export function getTriggerKindLabel(k: number): string {
  switch (k) {
    case 10: return 'Default';
    default: return '';
  }
}

/* ────────────── Error Helpers ────────────── */

export function getErrorActionLabel(a: number): string {
  switch (a) {
    case 0: return 'Abort';
    case 1: return 'Retry';
    case 2: return 'Rollback';
    case 3: return 'Ignore';
    case 4: return 'Notify';
    case 5: return 'Log';
    default: return 'Unknown';
  }
}

export function getErrorActionColor(a: number): string {
  switch (a) {
    case 0: return 'bg-red-100 text-red-700';
    case 1: return 'bg-amber-100 text-amber-700';
    case 2: return 'bg-orange-100 text-orange-700';
    case 3: return 'bg-slate-100 text-slate-600';
    case 4: return 'bg-blue-100 text-blue-700';
    case 5: return 'bg-slate-100 text-slate-600';
    default: return 'bg-slate-100 text-slate-600';
  }
}

/* ────────────── Data Helpers ────────────── */

export function decodeBase64(code: string): string {
  try {
    return atob(code);
  } catch {
    return '// Unable to decode';
  }
}

export function getLabels(obj: any): any[] {
  return obj?.labels || obj?.label || [];
}

export function getLabel(obj: any, lang = 'en'): string {
  const labels = getLabels(obj);
  const found = labels.find((l: any) => l.language === lang);
  return found?.label || labels[0]?.label || '';
}

export function copyToClipboard(text: string): void {
  navigator.clipboard.writeText(text).catch(() => {});
}
