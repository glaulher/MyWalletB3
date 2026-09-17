/**
 * HTML Sanitization utilities to protect against Cross-Site Scripting (XSS).
 */

export function escapeHtml(value: string | number | null | undefined): string {
  if (value === null || value === undefined) {
    return '';
  }
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
