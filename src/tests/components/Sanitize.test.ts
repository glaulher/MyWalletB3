import { describe, it, expect } from 'bun:test';
import { escapeHtml } from '../../ui/utils/sanitize.ts';

describe('escapeHtml', () => {
  it('should escape HTML special characters properly', () => {
    const malicious = '<script>alert("xss & evil")</script>';
    const escaped = escapeHtml(malicious);
    expect(escaped).toBe('&lt;script&gt;alert(&quot;xss &amp; evil&quot;)&lt;/script&gt;');
  });

  it('should escape single quotes', () => {
    const malicious = "onclick='doSomething()'";
    const escaped = escapeHtml(malicious);
    expect(escaped).toBe('onclick=&#039;doSomething()&#039;');
  });

  it('should handle null and undefined safely', () => {
    expect(escapeHtml(null)).toBe('');
    expect(escapeHtml(undefined)).toBe('');
  });

  it('should convert numbers to string safely', () => {
    expect(escapeHtml(12345)).toBe('12345');
    expect(escapeHtml(0)).toBe('0');
  });
});
