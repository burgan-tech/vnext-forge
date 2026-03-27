export function encodeBase64(code: string): string {
  if (typeof btoa !== 'undefined') {
    return btoa(unescape(encodeURIComponent(code)));
  }
  return Buffer.from(code, 'utf-8').toString('base64');
}

export function decodeBase64(encoded: string): string {
  if (typeof atob !== 'undefined') {
    return decodeURIComponent(escape(atob(encoded)));
  }
  return Buffer.from(encoded, 'base64').toString('utf-8');
}
