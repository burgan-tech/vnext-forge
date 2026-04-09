export function parseCron(expression: string): string[] {
  const parts = expression.trim().split(/\s+/);
  while (parts.length < 5) parts.push('*');
  return parts.slice(0, 5);
}

export function formatCron(parts: string[]): string {
  return parts.slice(0, 5).join(' ');
}

export function describeCron(expression: string): string {
  const parts = parseCron(expression);
  const [minute, hour, day, month, weekday] = parts;

  if (parts.every((p) => p === '*')) return 'Every minute';

  const desc: string[] = [];

  if (minute !== '*' && hour !== '*') {
    desc.push(`At ${hour.padStart(2, '0')}:${minute.padStart(2, '0')}`);
  } else if (minute !== '*') {
    desc.push(`At minute ${minute}`);
  } else if (hour !== '*') {
    desc.push(`Every minute during hour ${hour}`);
  }

  if (day !== '*') {
    desc.push(`on day ${day} of the month`);
  }

  if (month !== '*') {
    const monthNames = ['', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const m = Number(month);
    desc.push(`in ${monthNames[m] || `month ${month}`}`);
  }

  if (weekday !== '*') {
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const d = Number(weekday);
    desc.push(`on ${dayNames[d] || `weekday ${weekday}`}`);
  }

  return desc.length > 0 ? desc.join(' ') : `Custom: ${expression}`;
}
