export function escapeMarkdown(text: string): string {
  return text.replace(/[|\\`*_{}[\]()#+\-.!~>]/g, '\\$&');
}

export function escapeMermaid(text: string): string {
  return text.replace(/[\n\r\- :"\\{}()[\]<>/]/g, '_');
}

export function escapeMermaidLabel(text: string): string {
  return text.replace(/[\n\r]/g, ' ').replace(/[:"\\{}()[\]<>/]/g, '_');
}

export function heading(level: number, text: string): string {
  return `${'#'.repeat(level)} ${text}`;
}

export function bold(text: string): string {
  return `**${text}**`;
}

export function inlineCode(text: string): string {
  return `\`${text}\``;
}

export function tableRow(cells: string[]): string {
  return `| ${cells.join(' | ')} |`;
}

export function tableHeader(headers: string[]): string {
  const headerRow = tableRow(headers);
  const separator = `| ${headers.map(() => '---').join(' | ')} |`;
  return `${headerRow}\n${separator}`;
}

export function table(headers: string[], rows: string[][]): string {
  const head = tableHeader(headers);
  const body = rows.map((row) => tableRow(row)).join('\n');
  return body ? `${head}\n${body}` : head;
}

export function blockquote(text: string): string {
  return text
    .split('\n')
    .map((line) => `> ${line}`)
    .join('\n');
}

export function callout(title: string, body: string): string {
  return `> **${title}**\n>\n${blockquote(body)}`;
}

export function lines(...parts: (string | null | undefined | false)[]): string {
  return parts.filter(Boolean).join('\n\n');
}
